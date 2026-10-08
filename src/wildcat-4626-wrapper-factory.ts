import { Address } from "@graphprotocol/graph-ts";
import {
  Wildcat4626WrapperFactory as WrapperFactoryContract,
  WrapperDeployed,
} from "../generated/Wildcat4626WrapperFactory/Wildcat4626WrapperFactory";
import {
  Token,
  Wildcat4626Wrapper,
  Wildcat4626WrapperDeployed,
  Wildcat4626WrapperFactory,
} from "../generated/schema";
import {
  createToken,
  generateTokenId,
  getOrInitializeArchController,
} from "../generated/UncrashableEntityHelpers";
import { readTokenMetadata } from "./token-metadata";
import { generateEventId } from "./utils";
import { observeWrapperMarketLink } from "./wrapper-market-links";

function getOrCreateToken(address: Address): Token {
  let id = generateTokenId(address);
  let token = Token.load(id);
  if (token != null) return token;

  let metadata = readTokenMetadata(address);
  // Discovery reads metadata only. A market or wrapper share token does not
  // inherit the underlying asset's fixed-dollar policy or price feeds.
  token = createToken(id, {
    address,
    name: metadata.name,
    symbol: metadata.symbol,
    decimals: metadata.decimals,
    isMock: metadata.isMock,
    isUsdStablecoin: false,
  });
  token.lastPriceFeedSearchDay = -1;
  token.save();
  return token;
}

function getOrCreateFactory(address: Address): Wildcat4626WrapperFactory {
  let id = address.toHexString();
  let factory = Wildcat4626WrapperFactory.load(id);
  if (factory != null) return factory;

  // The configured legacy factory exposes this immutable value. Do not
  // fabricate zero-address provenance if a historical call is unavailable.
  let archControllerAddress = WrapperFactoryContract.bind(address).archController();
  let archController = getOrInitializeArchController(
    archControllerAddress.toHexString(),
    {}
  ).entity;
  factory = new Wildcat4626WrapperFactory(id);
  factory.address = address;
  factory.archController = archController.id;
  factory.eventIndex = 0;
  factory.save();
  return factory;
}

export function handleWrapperDeployed(event: WrapperDeployed): void {
  let eventId = generateEventId(event);
  if (Wildcat4626WrapperDeployed.load(eventId) != null) return;

  let factory = getOrCreateFactory(event.address);
  let marketId = event.params.market.toHexString();
  let wrapperId = event.params.wrapper.toHexString();
  let wrapper = new Wildcat4626Wrapper(wrapperId);
  wrapper.address = event.params.wrapper;
  wrapper.factory = factory.id;
  wrapper.marketAddress = event.params.market;
  wrapper.marketToken = getOrCreateToken(event.params.market).id;
  wrapper.token = getOrCreateToken(event.params.wrapper).id;
  wrapper.blockNumber = event.block.number.toI32();
  wrapper.blockTimestamp = event.block.timestamp.toI32();
  wrapper.transactionHash = event.transaction.hash;
  wrapper.blockLogIndex = event.logIndex.toI32();
  wrapper.save();
  observeWrapperMarketLink(wrapper);

  let deployed = new Wildcat4626WrapperDeployed(eventId);
  deployed.factory = factory.id;
  // Like MarketAdded, retain the eventual ID. A nullable relation resolves
  // once the Market exists without rewriting the immutable event.
  deployed.market = marketId;
  deployed.marketAddress = event.params.market;
  deployed.wrapper = wrapper.id;
  deployed.wrapperAddress = event.params.wrapper;
  deployed.blockNumber = event.block.number.toI32();
  deployed.blockTimestamp = event.block.timestamp.toI32();
  deployed.transactionHash = event.transaction.hash;
  deployed.blockLogIndex = event.logIndex.toI32();
  deployed.save();

  factory.eventIndex = factory.eventIndex + 1;
  factory.save();
}
