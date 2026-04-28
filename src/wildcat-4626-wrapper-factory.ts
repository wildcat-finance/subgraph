import { Address, log } from "@graphprotocol/graph-ts";
import {
  Wildcat4626WrapperFactory as Wildcat4626WrapperFactoryContract,
  WrapperDeployed as WrapperDeployedEvent,
} from "../generated/Wildcat4626WrapperFactory/Wildcat4626WrapperFactory";
import {
  Market,
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

function getOrCreateToken(tokenAddress: Address): Token {
  let tokenId = generateTokenId(tokenAddress);
  let token = Token.load(tokenId);
  if (token != null) {
    return token;
  }

  let metadata = readTokenMetadata(tokenAddress);
  return createToken(tokenId, {
    address: tokenAddress,
    name: metadata.name,
    symbol: metadata.symbol,
    decimals: metadata.decimals,
    isMock: metadata.isMock,
  });
}

function getOrCreateWrapperFactory(
  factoryAddress: Address
): Wildcat4626WrapperFactory {
  let factoryId = factoryAddress.toHexString();
  let factory = Wildcat4626WrapperFactory.load(factoryId);
  if (factory != null) {
    return factory;
  }

  let factoryContract = Wildcat4626WrapperFactoryContract.bind(factoryAddress);
  let archControllerResult = factoryContract.try_archController();
  let archControllerAddress = archControllerResult.reverted
    ? Address.zero()
    : archControllerResult.value;
  let archController = getOrInitializeArchController(
    archControllerAddress.toHexString(),
    {}
  ).entity;

  factory = new Wildcat4626WrapperFactory(factoryId);
  factory.address = factoryAddress;
  factory.archController = archController.id;
  factory.eventIndex = 0;
  factory.save();
  return factory;
}

export function handleWrapperDeployed(event: WrapperDeployedEvent): void {
  let factory = getOrCreateWrapperFactory(event.address);
  let marketAddress = event.params.market;
  let wrapperAddress = event.params.wrapper;
  let marketId = marketAddress.toHexString();
  let wrapperId = wrapperAddress.toHexString();
  let market = Market.load(marketId);

  if (market == null) {
    log.warning("handleWrapperDeployed: indexed wrapper {} for unknown market {}", [
      wrapperId,
      marketId,
    ]);
  } else {
    market.tokenWrapper = wrapperId;
    market.save();
  }

  let wrapper = Wildcat4626Wrapper.load(wrapperId);
  if (wrapper == null) {
    wrapper = new Wildcat4626Wrapper(wrapperId);
  }
  wrapper.address = wrapperAddress;
  wrapper.factory = factory.id;
  wrapper.market = marketId;
  wrapper.marketAddress = marketAddress;
  wrapper.marketToken = getOrCreateToken(marketAddress).id;
  wrapper.token = getOrCreateToken(wrapperAddress).id;
  wrapper.blockNumber = event.block.number.toI32();
  wrapper.blockTimestamp = event.block.timestamp.toI32();
  wrapper.transactionHash = event.transaction.hash;
  wrapper.blockLogIndex = event.logIndex.toI32();
  wrapper.save();

  let deployed = new Wildcat4626WrapperDeployed(generateEventId(event));
  deployed.factory = factory.id;
  deployed.market = marketId;
  deployed.marketAddress = marketAddress;
  deployed.wrapper = wrapper.id;
  deployed.wrapperAddress = wrapperAddress;
  deployed.blockNumber = event.block.number.toI32();
  deployed.blockTimestamp = event.block.timestamp.toI32();
  deployed.transactionHash = event.transaction.hash;
  deployed.blockLogIndex = event.logIndex.toI32();
  deployed.save();

  factory.eventIndex = factory.eventIndex + 1;
  factory.save();
}
