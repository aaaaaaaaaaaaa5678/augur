import { NetworkId } from "@augurproject/artifacts";
import { Filter, Log, LogValues } from "@augurproject/types";
import { Transaction } from "contract-dependencies";
import { EthersProvider as EProvider } from "contract-dependencies-ethers";
import { ethers } from "ethers";
import { Abi } from "ethereum";
import * as _ from "lodash";
import { AsyncQueue, queue, retry } from "async";
import {isInstanceOfBigNumber, isInstanceOfArray } from "./utils"
import { JSONRPCRequestPayload } from "ethereum-types";

interface ContractMapping {
  [contractName: string]: ethers.utils.Interface;
}

interface PerformQueueTask {
  message: any;
  params: any;
  resolve: (res: any) => void;
  reject: (err?: Error | null) => void;
}

export class EthersProvider extends ethers.providers.BaseProvider implements EProvider {
  private contractMapping: ContractMapping = {};
  private performQueue: AsyncQueue<PerformQueueTask>;
  readonly provider: ethers.providers.JsonRpcProvider;

  private _overrideGasPrice: ethers.utils.BigNumber | null = null;
  get overrideGasPrice() {
    return this._overrideGasPrice;
  }

  set overrideGasPrice(gasPrice: ethers.utils.BigNumber|null) {
    if (gasPrice !== null && gasPrice.eq(new ethers.utils.BigNumber(0))) {
      this._overrideGasPrice = null;
    } else {
      this._overrideGasPrice = gasPrice;
    }
  }

  constructor(provider: ethers.providers.JsonRpcProvider, times: number, interval: number, concurrency: number) {
    super(provider.getNetwork());
    this.provider = provider;
    this.performQueue = queue((item: PerformQueueTask, callback: () => void) => {
      const _this = this;
      retry(
        { times, interval },
        async function(callback) {
          let results: any;
          try {
            results = await _this.provider.perform(item.message, item.params);
          } catch (err) {
            return callback(err);
          }
          callback(null, results);
        },
        function(err: Error, results: any) {
          if (err) {
            item.reject(err);
            return callback();
          }
          item.resolve(results);
          return callback();
        }
      );
    }, concurrency);
  }

  public async listAccounts(): Promise<Array<string>> {
    return this.provider.listAccounts();
  }

  public async call(transaction: Transaction<ethers.utils.BigNumber>): Promise<string> {
    return super.call(transaction);
  }

  public async getNetworkId(): Promise<NetworkId> {
    return <NetworkId>(await this.getNetwork()).chainId.toString();
  }

  public async getBlockNumber(): Promise<number> {
    return super.getBlockNumber();
  }

  public async getGasPrice(): Promise<ethers.utils.BigNumber> {
    if(this.overrideGasPrice !== null) {
      return this.overrideGasPrice;
    }
    return super.getGasPrice();
  }

  public storeAbiData(abi: Abi, contractName: string): void {
    this.contractMapping[contractName] = new ethers.utils.Interface(abi);
  }

  public async getEthBalance(address: string): Promise<string> {
    const result = await super.getBalance(address);
    return result.toString();
  }

  public getEventTopic(contractName: string, eventName: string): string {
    const contractInterface = this.getContractInterface(contractName);
    if (contractInterface.events[eventName] === undefined) {
      throw new Error(`Contract name ${contractName} did not have event ${eventName}`);
    }
    return contractInterface.events[eventName].topic;
  }

  public encodeContractFunction(contractName: string, functionName: string, funcParams: any[]): string {
    const contractInterface = this.getContractInterface(contractName);
    const func = contractInterface.functions[functionName];
    if (func === undefined) {
      throw new Error(`Contract name ${contractName} did not have function ${functionName}`);
    }
    const ethersParams = _.map(funcParams, (param) => {
      if (isInstanceOfBigNumber(param)) {
        return new ethers.utils.BigNumber(param.toFixed());
      } else if (isInstanceOfArray(param) && param.length > 0 && isInstanceOfBigNumber(param[0])) {
        return _.map(param, (value) => new ethers.utils.BigNumber(value.toFixed()));
      }
      return param;
    });
    return func.encode(ethersParams);
  }

  public parseLogValues(contractName: string, log: Log): LogValues {
    const contractInterface = this.getContractInterface(contractName);
    const parsedLog = contractInterface.parseLog(log);
    const omittedValues = _.map(_.range(parsedLog.values.length), (n) => n.toString());
    omittedValues.push('length');
    const logValues = _.omit(parsedLog.values, omittedValues);
    return {
      name: parsedLog.name,
      ..._.mapValues(logValues, (val:any) => {
        if (val._hex) {
          return val._hex;
        }
        else if (Array.isArray(val)) {
          val = _.map(val, (innerVal) => {
            if (innerVal._hex) {
              return innerVal._hex;
            }
            return innerVal;
          });
        }
        return val;
      })
    };
  }

  private getContractInterface(contractName: string): ethers.utils.Interface {
    const contractInterface = this.contractMapping[contractName];
    if (!contractInterface) {
      throw new Error(`Contract name ${contractName} not found in EthersJSProvider. Call 'storeAbiData' first with this name and the contract abi`);
    }
    return contractInterface;
  }

  public async getLogs(filter: Filter): Promise<Array<Log>> {
    const logs = await super.getLogs(filter);
    return logs.map<Log>((log) => ({
      name: "",
      transactionHash: "",
      blockNumber: 0,
      blockHash: "",
      logIndex: 0,
      transactionIndex: 0,
      transactionLogIndex: 0,
      removed: false,
      ...log,
    }))
  }

  // This is to support the 0x Provider Engine requirements
  public async sendAsync(payload: JSONRPCRequestPayload): Promise<any> {
    return await this.provider.send(payload.method, payload.params);
  }

  public async perform(message: any, params: any): Promise<any> {
    return new Promise((resolve, reject) => {
      this.performQueue.push({ message, params, resolve, reject });
    });
  }

}
