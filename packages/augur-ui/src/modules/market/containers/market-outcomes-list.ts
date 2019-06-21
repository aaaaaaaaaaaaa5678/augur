import { connect } from "react-redux";
import { withRouter } from "react-router-dom";
import MarketOutcomesList from "modules/market/components/market-outcomes-list/market-outcomes-list";
import { selectMarket } from "modules/markets/selectors/market";

const mapStateToProps = (state, ownProps) => {
  const market = selectMarket(ownProps.marketId);

  return {
    scalarDenomination: market.scalarDenomination,
    marketOutcomes: market.marketOutcomes,
    marketType: market.marketType,
    minPriceBigNumber: market.minPriceBigNumber,
    maxPriceBigNumber: market.maxPriceBigNumber
  };
};

const MarketOutcomesListContainer = withRouter(
  connect(mapStateToProps)(MarketOutcomesList)
);

export default MarketOutcomesListContainer;
