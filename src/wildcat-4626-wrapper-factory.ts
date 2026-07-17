import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import {
  Wildcat4626WrapperFactory as Wildcat4626WrapperFactoryContract,
  WrapperDeployed as WrapperDeployedEvent,
} from "../generated/Wildcat4626WrapperFactory/Wildcat4626WrapperFactory";
import {
  ArchController,
  Token,
  Wildcat4626Wrapper,
  Wildcat4626WrapperDeployed,
  Wildcat4626WrapperFactory,
} from "../generated/schema";
import {
  createToken,
  generateTokenId,
} from "../generated/UncrashableEntityHelpers";
import {
  CONTEXT_DEPLOYMENT_ARCH_CONTROLLER,
  contextString,
  ensureIndexerDeployment,
} from "./deployment-context";
import { recordIndexerDiagnostic } from "./indexer-diagnostics";
import {
  ConfiguredOptionalModuleFactory,
  getConfiguredOptionalModuleFactory,
} from "./optional-module-context";
import { observeWrapperMarketLink } from "./optional-market-links";
import { setupTokenPriceFeeds } from "./price-feeds";
import { readTokenMetadata } from "./token-metadata";
import { generateEventId } from "./utils";

function getOrCreateToken(tokenAddress: Address): Token {
  let tokenId = generateTokenId(tokenAddress);
  let token = Token.load(tokenId);
  if (token != null) {
    return token;
  }

  let metadata = readTokenMetadata(tokenAddress);
  token = createToken(tokenId, {
    address: tokenAddress,
    name: metadata.name,
    symbol: metadata.symbol,
    decimals: metadata.decimals,
    isMock: metadata.isMock,
  });
  setupTokenPriceFeeds(token);
  return token;
}

function getArchControllerAddress(
  event: ethereum.Event,
  factoryAddress: Address
): Address {
  let configured = contextString(CONTEXT_DEPLOYMENT_ARCH_CONTROLLER);
  if (configured != null) {
    return Address.fromString(configured as string);
  }
  let result = Wildcat4626WrapperFactoryContract.bind(
    factoryAddress
  ).try_archController();
  if (!result.reverted) {
    return result.value;
  }
  recordIndexerDiagnostic(
    event,
    "MISSING_OPTIONAL_MODULE_CONFIG",
    "Wrapper factory has no generated context and archController() reverted",
    factoryAddress
  );
  return Address.zero();
}

function ensureArchController(address: Address): ArchController {
  let id = address.toHexString();
  let archController = ArchController.load(id);
  if (archController == null) {
    archController = new ArchController(id);
    archController.save();
  }
  return archController;
}

function getOrCreateWrapperFactory(
  event: WrapperDeployedEvent
): Wildcat4626WrapperFactory {
  let factoryId = event.address.toHexString();
  let factory = Wildcat4626WrapperFactory.load(factoryId);
  let archController = ensureArchController(
    getArchControllerAddress(event, event.address)
  );
  if (factory == null) {
    factory = new Wildcat4626WrapperFactory(factoryId);
    factory.address = event.address;
    factory.archController = archController.id;
    factory.label = "UNKNOWN";
    factory.generation = "UNKNOWN";
    factory.configuredStartBlock = BigInt.zero();
    factory.indexed = false;
    factory.deploymentTarget = false;
    factory.lifecycle = "UNKNOWN";
    factory.configured = false;
    factory.eventIndex = 0;
  }

  let configured = getConfiguredOptionalModuleFactory();
  if (configured != null) {
    let settings = configured as ConfiguredOptionalModuleFactory;
    factory.archController = archController.id;
    factory.label = settings.label;
    factory.generation = settings.generation;
    factory.configuredStartBlock = settings.startBlock;
    factory.indexed = settings.indexed;
    factory.deploymentTarget = settings.deploymentTarget;
    factory.lifecycle = settings.lifecycle;
    factory.configured = true;
  } else if (!factory.configured) {
    recordIndexerDiagnostic(
      event,
      "MISSING_OPTIONAL_MODULE_CONFIG",
      "Wrapper factory event was indexed without generated factory context",
      event.address
    );
  }
  factory.save();
  return factory;
}

export function handleWrapperDeployed(event: WrapperDeployedEvent): void {
  ensureIndexerDeployment(event);
  let factory = getOrCreateWrapperFactory(event);
  let marketAddress = event.params.market;
  let wrapperAddress = event.params.wrapper;
  let wrapperId = wrapperAddress.toHexString();

  let wrapper = Wildcat4626Wrapper.load(wrapperId);
  if (wrapper == null) {
    wrapper = new Wildcat4626Wrapper(wrapperId);
  }
  wrapper.address = wrapperAddress;
  wrapper.factory = factory.id;
  wrapper.market = null;
  wrapper.marketAddress = marketAddress;
  wrapper.marketToken = getOrCreateToken(marketAddress).id;
  wrapper.token = getOrCreateToken(wrapperAddress).id;
  wrapper.blockNumber = event.block.number.toI32();
  wrapper.blockTimestamp = event.block.timestamp.toI32();
  wrapper.transactionHash = event.transaction.hash;
  wrapper.blockLogIndex = event.logIndex.toI32();
  wrapper.save();

  let market = observeWrapperMarketLink(marketAddress, wrapper);
  if (market == null) {
    recordIndexerDiagnostic(
      event,
      "UNKNOWN_WRAPPER_MARKET",
      "Wrapper deployment referenced a market not yet indexed",
      marketAddress
    );
  }

  let deployed = new Wildcat4626WrapperDeployed(generateEventId(event));
  deployed.factory = factory.id;
  deployed.market = market == null ? null : market.id;
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
