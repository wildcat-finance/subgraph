import { Address } from "@graphprotocol/graph-ts";
import {
  Market,
  SimpleCollateralContract,
  SimpleCollateralMarketIndex,
  Wildcat4626Wrapper,
  WrapperMarketIndex,
} from "../generated/schema";

function linkWrapperToMarket(
  market: Market,
  wrapper: Wildcat4626Wrapper
): void {
  wrapper.market = market.id;
  wrapper.save();
  market.tokenWrapper = wrapper.id;
  market.save();
}

function linkCollateralToMarket(
  market: Market,
  collateral: SimpleCollateralContract
): void {
  if (collateral.market == market.id) {
    return;
  }
  collateral.market = market.id;
  collateral.save();
  market.numCollateralContracts = market.numCollateralContracts + 1;
  market.save();
}

export function observeWrapperMarketLink(
  marketAddress: Address,
  wrapper: Wildcat4626Wrapper
): Market | null {
  let marketId = marketAddress.toHexString();
  let index = WrapperMarketIndex.load(marketId);
  if (index == null) {
    index = new WrapperMarketIndex(marketId);
    index.marketAddress = marketAddress;
  }
  index.wrapper = wrapper.id;
  index.save();

  let market = Market.load(marketId);
  if (market == null) {
    return null;
  }
  linkWrapperToMarket(market, wrapper);
  return market;
}

export function observeCollateralMarketLink(
  marketAddress: Address,
  collateral: SimpleCollateralContract
): Market | null {
  let marketId = marketAddress.toHexString();
  let index = SimpleCollateralMarketIndex.load(marketId);
  if (index == null) {
    index = new SimpleCollateralMarketIndex(marketId);
    index.marketAddress = marketAddress;
    index.collateralContractIds = [];
  }
  let ids = index.collateralContractIds;
  if (ids.indexOf(collateral.id) < 0) {
    ids.push(collateral.id);
    index.collateralContractIds = ids;
  }
  index.save();

  let market = Market.load(marketId);
  if (market == null) {
    return null;
  }
  linkCollateralToMarket(market, collateral);
  return market;
}

/** Reconcile optional-module observations that arrived before market discovery. */
export function reconcileOptionalMarketLinks(market: Market): void {
  let wrapperIndex = WrapperMarketIndex.load(market.id);
  if (wrapperIndex != null) {
    let wrapper = Wildcat4626Wrapper.load(wrapperIndex.wrapper);
    if (wrapper != null) {
      linkWrapperToMarket(market, wrapper);
    }
  }

  let collateralIndex = SimpleCollateralMarketIndex.load(market.id);
  if (collateralIndex == null) {
    return;
  }
  let ids = collateralIndex.collateralContractIds;
  for (let i = 0; i < ids.length; i++) {
    let collateral = SimpleCollateralContract.load(ids[i]);
    if (collateral != null) {
      linkCollateralToMarket(market, collateral);
    }
  }
}
