import React, { Component } from 'react';
import { Link } from 'react-router-dom';

import Wrapper from 'modules/trading/components/wrapper/wrapper';
import { ACCOUNT_SUMMARY } from 'modules/routes/constants/views';
import makePath from 'modules/routes/helpers/make-path';
import Styles from 'modules/market/components/trading-form/trading-form.styles.less';

import { PrimaryButton } from 'modules/common/buttons';
import { MarketData, OutcomeFormatted, OutcomeOrderBook } from 'modules/types';
import { BigNumber } from 'utils/create-big-number';

interface TradingFormProps {
  availableEth: BigNumber;
  availableDai: BigNumber;
  hasFunds: boolean;
  isLogged: boolean;
  allowanceBigNumber: BigNumber;
  isConnectionTrayOpen: boolean;
  market: MarketData;
  disclaimerSeen: boolean;
  disclaimerModal: Function;
  selectedOrderProperties: object;
  selectedOutcomeId: number;
  sortedOutcomes: OutcomeFormatted[];
  updateSelectedOrderProperties: Function;
  handleFilledOnly: Function;
  gasPrice: number;
  updateSelectedOutcome: Function;
  updateTradeCost: Function;
  updateTradeShares: Function;
  toggleConnectionTray: Function;
  onSubmitPlaceTrade: Function;
  updateLiquidity?: Function;
  initialLiquidity?: boolean;
  orderBook: OutcomeOrderBook;
  addFundsModal: Function;
  loginModal: Function;
  signupModal: Function;
  currentTimestamp: Number;
}

interface TradingFormState {
  showForm: boolean;
  selectedOutcome: OutcomeFormatted | undefined;
}

class TradingForm extends Component<TradingFormProps, TradingFormState> {
  static defaultProps = {
    selectedOutcomeId: 2,
  };

  state: TradingFormState = {
    showForm: false,
    selectedOutcome:
      this.props.market &&
      this.props.market.outcomesFormatted &&
      this.props.market.outcomesFormatted.find(
        outcome => outcome.id === this.props.selectedOutcomeId
      ),
  };

  UNSAFE_componentWillReceiveProps(nextProps: TradingFormProps) {
    const { selectedOutcomeId } = this.props;
    const { market } = nextProps;
    if (
      selectedOutcomeId !== nextProps.selectedOutcomeId ||
      market.outcomes !== this.props.market.outcomes
    ) {
      if (nextProps.selectedOutcomeId !== null) {
        const selectedOutcome =
          market &&
          market.outcomesFormatted &&
          market.outcomesFormatted.find(
            outcome => outcome.id === nextProps.selectedOutcomeId
          );
        this.setState({ selectedOutcome });
      }
    }
  }

  toggleForm = () => {
    this.setState({ showForm: !this.state.showForm });
  };

  render() {
    const {
      allowanceBigNumber,
      hasFunds,
      availableEth,
      availableDai,
      isLogged,
      isConnectionTrayOpen,
      market,
      selectedOrderProperties,
      gasPrice,
      handleFilledOnly,
      updateSelectedOutcome,
      updateTradeCost,
      updateTradeShares,
      toggleConnectionTray,
      onSubmitPlaceTrade,
      disclaimerSeen,
      disclaimerModal,
      sortedOutcomes,
      updateLiquidity,
      initialLiquidity,
      orderBook,
      addFundsModal,
      loginModal,
      signupModal,
      currentTimestamp
    } = this.props;
    const s = this.state;

    const hasSelectedOutcome = s.selectedOutcome !== null;

    let initialMessage: string | boolean = '';

    switch (true) {
      case !isLogged:
        initialMessage = 'Login or Signup to place an order.';
        break;
      case isLogged && !hasFunds:
        initialMessage = 'Add funds to begin trading.';
        break;
      case isLogged && hasFunds && !hasSelectedOutcome:
        initialMessage = 'Select an outcome to begin placing an order.';
        break;
      default:
        initialMessage = false;
    }

    return (
      <section className={Styles.TradingForm}>
        <Wrapper
          market={market}
          currentTimestamp={currentTimestamp}
          allowanceBigNumber={allowanceBigNumber}
          selectedOutcome={s.selectedOutcome}
          selectedOrderProperties={selectedOrderProperties}
          sortedOutcomes={sortedOutcomes}
          availableEth={availableEth}
          availableDai={availableDai}
          updateSelectedOrderProperties={
            this.props.updateSelectedOrderProperties
          }
          gasPrice={gasPrice}
          handleFilledOnly={handleFilledOnly}
          updateSelectedOutcome={updateSelectedOutcome}
          updateTradeCost={updateTradeCost}
          updateTradeShares={updateTradeShares}
          onSubmitPlaceTrade={onSubmitPlaceTrade}
          disclaimerModal={disclaimerModal}
          disclaimerSeen={disclaimerSeen}
          updateLiquidity={updateLiquidity}
          initialLiquidity={initialLiquidity}
          orderBook={orderBook}
        />
        {initialMessage && (
          <div>
            {initialMessage && <p>{initialMessage}</p>}
            {!isLogged && (
              <div>
                <PrimaryButton
                  id='login-button'
                  action={() => loginModal()}
                  text='Login'
                />
                <PrimaryButton
                  id='login-button'
                  action={() => signupModal()}
                  text='Signup'
                />
              </div>
            )}
            {!hasFunds && isLogged && (
              <PrimaryButton
                id='add-funds'
                action={() => addFundsModal()}
                text='Add Funds'
              />
            )}
          </div>
        )}
      </section>
    );
  }
}

export default TradingForm;
