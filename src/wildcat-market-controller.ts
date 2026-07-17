import { Address, BigInt } from "@graphprotocol/graph-ts";
import {
  createLenderAuthorizationChange,
  createMarket,
  createMarketDeployed,
  createToken,
  generateLenderAuthorizationId,
  generateMarketId,
  generateTokenId,
  getController,
  getControllerFactory,
  getOrInitializeLenderAuthorization,
  getOrInitializeToken,
} from "../generated/UncrashableEntityHelpers";
import { WildcatMarket } from "../generated/templates/WildcatMarket/WildcatMarket";
import {
  LenderAuthorized as LenderAuthorizedEvent,
  LenderDeauthorized as LenderDeauthorizedEvent,
  MarketDeployed as MarketDeployedEvent,
  TemporaryExcessReserveRatioActivated,
  TemporaryExcessReserveRatioCanceled,
  TemporaryExcessReserveRatioExpired,
  TemporaryExcessReserveRatioUpdated,
} from "../generated/templates/WildcatMarketController/WildcatMarketController";
import { generateEventId, loadExistingMarket } from "./utils";
import { setupTokenPriceFeeds } from "./price-feeds";
import { getOrCreateProtocolStats, getOrCreateBorrowerStats } from "./daily-stats";
import { generateControllerId } from "../generated/UncrashableEntityHelpers";
import { WildcatMarket as MarketTemplate } from "../generated/templates";
import { Token } from "../generated/schema";
import { readTokenMetadata } from "./token-metadata";
import {
  createInitialMarketSnapshot,
  saveMarketAndSnapshot,
} from "./market-domain";
import { recordMarketEvent } from "./market-event-domain";
import { getOrCreateBorrower } from "./borrower-domain";
import { createDeploymentChildContext } from "./deployment-context";

export function handleLenderAuthorized(event: LenderAuthorizedEvent): void {
  let controller = getController(generateControllerId(event.address));
  let id = generateLenderAuthorizationId(event.address, event.params.param0);
  let status = getOrInitializeLenderAuthorization(id, {
    authorized: true,
    controller: controller.id,
    lender: event.params.param0,
    addedTimestamp: event.block.timestamp.toI32(),
  });
  if (!status.wasCreated) {
    status.entity.authorized = true;
    status.entity.save();
  }
  createLenderAuthorizationChange(generateEventId(event), {
    authorized: true,
    controller: controller.id,
    lender: event.params.param0,
    blockNumber: event.block.number.toI32(),
    blockTimestamp: event.block.timestamp.toI32(),
    transactionHash: event.transaction.hash,
    blockLogIndex: event.logIndex.toI32(),
    authorization: id,
  });
}

export function handleLenderDeauthorized(event: LenderDeauthorizedEvent): void {
  let controller = getController(generateControllerId(event.address));
  let id = generateLenderAuthorizationId(event.address, event.params.param0);
  let status = getOrInitializeLenderAuthorization(id, {
    authorized: false,
    controller: controller.id,
    lender: event.params.param0,
    addedTimestamp: event.block.timestamp.toI32(),
  });
  if (!status.wasCreated) {
    status.entity.authorized = false;
    status.entity.save();
  }
  createLenderAuthorizationChange(generateEventId(event), {
    authorized: false,
    controller: controller.id,
    lender: event.params.param0,
    blockNumber: event.block.number.toI32(),
    blockTimestamp: event.block.timestamp.toI32(),
    transactionHash: event.transaction.hash,
    blockLogIndex: event.logIndex.toI32(),
    authorization: id,
  });
}

export function handleMarketDeployed(event: MarketDeployedEvent): void {
  let controller = getController(event.address.toHex());
  let controllerFactory = getControllerFactory(controller.controllerFactory);
  let contract = WildcatMarket.bind(event.params.market);
  let assetId = generateTokenId(event.params.asset);
  if (Token.load(assetId) == null) {
    let metadata = readTokenMetadata(event.params.asset);
    let newToken = createToken(assetId, {
      address: event.params.asset,
      name: metadata.name,
      symbol: metadata.symbol,
      decimals: metadata.decimals,
      isMock: metadata.isMock,
    });
    setupTokenPriceFeeds(newToken);
  }
  const marketId = generateMarketId(event.params.market);
  MarketTemplate.createWithContext(
    event.params.market,
    createDeploymentChildContext()
  );
  const marketDeployedId = generateEventId(event);
  createMarketDeployed(marketDeployedId, {
    blockNumber: event.block.number.toI32(),
    blockTimestamp: event.block.timestamp.toI32(),
    transactionHash: event.transaction.hash,
    blockLogIndex: event.logIndex.toI32(),
    market: marketId,
  });

  const version = "V1";
  let borrowerProfile = getOrCreateBorrower(
    event,
    Address.fromBytes(controller.borrower)
  );
  let market = createMarket(marketId, {
    address: event.params.market,
    name: event.params.name,
    symbol: event.params.symbol,
    asset: assetId,
    borrower: controller.borrower,
    borrowerProfile: borrowerProfile.id,
    controller: controller.id,
    annualInterestBips: event.params.annualInterestBips.toI32(),
    decimals: contract.decimals(),
    delinquencyGracePeriod: event.params.delinquencyGracePeriod.toI32(),
    delinquencyFeeBips: event.params.delinquencyFeeBips.toI32(),
    feeRecipient: controllerFactory.feeRecipient,
    protocolFeeBips: controllerFactory.protocolFeeBips,
    sentinel: controllerFactory.sentinel,
    scaleFactor: BigInt.fromI32(10).pow(27),
    maxTotalSupply: event.params.maxTotalSupply,
    lastInterestAccruedTimestamp: event.block.timestamp.toI32(),
    lastInterestAccruedBlockNumber: event.block.number.toI32(),
    reserveRatioBips: event.params.reserveRatioBips.toI32(),
    withdrawalBatchDuration: event.params.withdrawalBatchDuration.toI32(),
    isRegistered: true,
    archController: controller.archController,
    marketKind: "STANDARD",
    originKind: "CONTROLLER",
    generation: "v1",
    abiFamily: "controller-market-v1",
    deployedEvent: marketDeployedId,
    createdAt: event.block.timestamp.toI32(),
    createdAtBlock: event.block.number,
    createdAtTimestamp: event.block.timestamp,
    createdAtTransaction: event.transaction.hash,
    createdAtLogIndex: event.logIndex,
    hooks: null,
    hooksFactory: null,
    commitmentFeeBips: null,
    drawnAmount: null,
    version: version,
    numCollateralContracts: 0,
  });
  createInitialMarketSnapshot(event, market, "EVENT_PROJECTION");
  recordMarketEvent(event, market, "MARKET_DEPLOYED");
  controller.numMarkets = controller.numMarkets + 1;
  controller.save();

  // Update protocol and borrower stats
  let ps = getOrCreateProtocolStats();
  ps.numMarkets = ps.numMarkets + 1;
  ps.save();

  let bs = getOrCreateBorrowerStats(controller.borrower);
  bs.numMarkets = bs.numMarkets + 1;
  bs.save();
}

export function handleTemporaryExcessReserveRatioActivated(
  event: TemporaryExcessReserveRatioActivated
): void {
  let market = loadExistingMarket(
    generateMarketId(event.params.market),
    "handleTemporaryExcessReserveRatioActivated"
  );
  if (market == null) {
    return;
  }
  recordMarketEvent(event, market, "TEMPORARY_RESERVE_RATIO_ACTIVATED");
  market.originalAnnualInterestBips = market.annualInterestBips;
  market.originalReserveRatioBips = event.params.originalReserveRatioBips.toI32();
  market.temporaryReserveRatioExpiry = event.params.temporaryReserveRatioExpiry.toI32();
  market.temporaryReserveRatioActive = true;
  saveMarketAndSnapshot(event, market);
}

export function handleTemporaryExcessReserveRatioUpdated(
  event: TemporaryExcessReserveRatioUpdated
): void {
  let market = loadExistingMarket(
    generateMarketId(event.params.market),
    "handleTemporaryExcessReserveRatioUpdated"
  );
  if (market == null) {
    return;
  }
  recordMarketEvent(event, market, "TEMPORARY_RESERVE_RATIO_UPDATED");
  market.temporaryReserveRatioExpiry = event.params.temporaryReserveRatioExpiry.toI32();
  saveMarketAndSnapshot(event, market);
}

export function handleTemporaryExcessReserveRatioExpired(
  event: TemporaryExcessReserveRatioExpired
): void {
  let market = loadExistingMarket(
    generateMarketId(event.params.market),
    "handleTemporaryExcessReserveRatioExpired"
  );
  if (market == null) {
    return;
  }
  recordMarketEvent(event, market, "TEMPORARY_RESERVE_RATIO_EXPIRED");
  market.originalAnnualInterestBips = 0;
  market.temporaryReserveRatioActive = false;
  market.originalReserveRatioBips = 0;
  market.temporaryReserveRatioExpiry = 0;
  saveMarketAndSnapshot(event, market);
}

export function handleTemporaryExcessReserveRatioCanceled(
  event: TemporaryExcessReserveRatioCanceled
): void {
  let market = loadExistingMarket(
    generateMarketId(event.params.market),
    "handleTemporaryExcessReserveRatioCanceled"
  );
  if (market == null) {
    return;
  }
  recordMarketEvent(event, market, "TEMPORARY_RESERVE_RATIO_CANCELLED");
  market.originalAnnualInterestBips = 0;
  market.temporaryReserveRatioActive = false;
  market.originalReserveRatioBips = 0;
  market.temporaryReserveRatioExpiry = 0;
  saveMarketAndSnapshot(event, market);
}
