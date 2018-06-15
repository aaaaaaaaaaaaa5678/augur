import { Augur } from "augur.js";
import { eachSeries, mapLimit } from "async";
import * as Knex from "knex";
import * as _ from "lodash";
import { BlockDetail, ErrorCallback, FormattedEventLog } from "../types";
import { processLog } from "./process-logs";
import { logProcessors } from "./log-processors";
import { processBlockByBlockDetails } from "./process-block";

const BLOCK_DOWNLOAD_PARALLEL_LIMIT = 15;

interface BlockDetailsByBlock {
  [blockNumber: number]: BlockDetail;
}

function fetchAllBlockDetails(augur: Augur, blockNumbers: Array<number>, callback: (error: Error|null, blockDetailsByBlock?: BlockDetailsByBlock) => void) {
  mapLimit(blockNumbers, BLOCK_DOWNLOAD_PARALLEL_LIMIT, (blockNumber, nextBlockNumber) => {
    augur.rpc.eth.getBlockByNumber([blockNumber, false], (err: Error|null, block: BlockDetail): void => {
      if (err || block == null) return nextBlockNumber(new Error("Could not get block"));
      nextBlockNumber(undefined, [blockNumber, block]);
    });
  }, (err: Error|undefined, blockDetails: Array<[number, BlockDetail]>) => {
    if (err) return callback(err);
    const blockDetailsByBlock = _.fromPairs(blockDetails);
    callback(null, blockDetailsByBlock);
  });
}

export function downloadAugurLogs(db: Knex, augur: Augur, fromBlock: number, toBlock: number, callback: ErrorCallback): void {
  console.log("Getting Augur logs from block " + fromBlock + " to block " + toBlock);
  augur.events.getAllAugurLogs({ fromBlock, toBlock }, (err?: string|object|null, allAugurLogs?: Array<FormattedEventLog>): void => {
    if (err) return callback(err instanceof Error ? err : new Error(JSON.stringify(err)));
    if (!allAugurLogs) return callback(null);
    const blockNumbers = _.uniq(allAugurLogs.map((augurLog) => augurLog.blockNumber));
    fetchAllBlockDetails(augur, blockNumbers, (err, blockDetailsByBlock) => {
      if (err || blockDetailsByBlock == null) return callback(err);
      const logsByBlock: { [blockNumber: number]: Array<FormattedEventLog> } = _.groupBy(allAugurLogs, (log) => log.blockNumber);
      eachSeries(blockNumbers, (blockNumber: number, nextBlock: ErrorCallback) => {
        const logs = logsByBlock[blockNumber];
        db.transaction((trx: Knex.Transaction): void => {
          processBlockByBlockDetails(trx, augur, blockDetailsByBlock[blockNumber], (err: Error|null) => {
            if (err) {
              return nextBlock(err);
            }
            eachSeries(logs, (log: FormattedEventLog, nextLog: ErrorCallback) => {
              const contractName = log.contractName;
              const eventName = log.eventName;
              if (logProcessors[contractName] == null || logProcessors[contractName][eventName] == null) {
                console.log("Log processor does not exist:", contractName, eventName);
                nextLog();
              } else {
                processLog(trx, augur, log, logProcessors[contractName][eventName], nextLog);
              }
            }, (err: Error|null) => {
              if (err) {
                trx.rollback(err);
                return nextBlock(err);
              } else {
                trx.commit();
                return nextBlock();
              }
            });
          });
        });
      }, callback);
    });
  });
}
