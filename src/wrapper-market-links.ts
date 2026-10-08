import { Market, Wildcat4626Wrapper, WrapperMarketIndex } from "../generated/schema";

export function reconcileWrapperMarketLink(market: Market): void {
  let index = WrapperMarketIndex.load(market.id);
  if (index == null) return;

  let wrapper = Wildcat4626Wrapper.load(index.wrapper);
  if (wrapper == null) return;

  wrapper.market = market.id;
  wrapper.save();
  market.tokenWrapper = wrapper.id;
  market.save();
}

export function observeWrapperMarketLink(wrapper: Wildcat4626Wrapper): void {
  let marketId = wrapper.marketAddress.toHexString();
  let index = new WrapperMarketIndex(marketId);
  index.wrapper = wrapper.id;
  index.save();

  let market = Market.load(marketId);
  if (market != null) reconcileWrapperMarketLink(market);
}
