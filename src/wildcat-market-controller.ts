import { BigInt } from "@graphprotocol/graph-ts";
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
  getMarket,
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
import { generateEventId } from "./utils";
import { generateControllerId } from "../generated/UncrashableEntityHelpers";
import { WildcatMarket as MarketTemplate } from "../generated/templates";
import { Token } from "../generated/schema";
import { IERC20 } from "../generated/templates/WildcatMarketController/IERC20";

export function handleLenderAuthorized(event: LenderAuthorizedEvent): void {
  let controller = getController(generateControllerId(event.address));
  let id = generateLenderAuthorizationId(event.address, event.params.param0);
  let status = getOrInitializeLenderAuthorization(id, {
    authorized: true,
    controller: controller.id,
    lender: event.params.param0,
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
    authorization: id,
  });
}

export function handleMarketDeployed(event: MarketDeployedEvent): void {
  let controller = getController(event.address.toHex());
  let controllerFactory = getControllerFactory(controller.controllerFactory);
  let contract = WildcatMarket.bind(event.params.market);
  let assetId = generateTokenId(event.params.asset);
  if (Token.load(assetId) == null) {
    let erc20 = IERC20.bind(event.params.asset);
    let result = erc20.try_isMock();
    // let isMock = !result.reverted && result.value;
    createToken(assetId, {
      address: event.params.asset,
      name: erc20.name(),
      symbol: erc20.symbol(),
      decimals: erc20.decimals(),
      isMock: true,
    });
  }
  const marketId = generateMarketId(event.params.market);
  MarketTemplate.create(event.params.market);
  const marketDeployedId = generateEventId(event);
  createMarketDeployed(marketDeployedId, {
    blockNumber: event.block.number.toI32(),
    blockTimestamp: event.block.timestamp.toI32(),
    transactionHash: event.transaction.hash,
    market: marketId,
  });

  const version = "V1";
  createMarket(marketId, {
    name: event.params.name,
    symbol: event.params.symbol,
    asset: assetId,
    borrower: controller.borrower,
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
    reserveRatioBips: event.params.reserveRatioBips.toI32(),
    withdrawalBatchDuration: event.params.withdrawalBatchDuration.toI32(),
    isRegistered: true,
    archController: controller.archController,
    deployedEvent: marketDeployedId,
    createdAt: event.block.timestamp.toI32(),
    hooks: null,
    hooksFactory: null,
    minimumDeposit: null,
    version: version,
  });
}

export function handleTemporaryExcessReserveRatioActivated(
  event: TemporaryExcessReserveRatioActivated
): void {
  let market = getMarket(generateMarketId(event.params.market));
  market.originalAnnualInterestBips = market.annualInterestBips;
  market.originalReserveRatioBips = event.params.originalReserveRatioBips.toI32();
  market.temporaryReserveRatioExpiry = event.params.temporaryReserveRatioExpiry.toI32();
  market.temporaryReserveRatioActive = true;
  market.save();
}

export function handleTemporaryExcessReserveRatioUpdated(
  event: TemporaryExcessReserveRatioUpdated
): void {
  let market = getMarket(generateMarketId(event.params.market));
  market.temporaryReserveRatioExpiry = event.params.temporaryReserveRatioExpiry.toI32();
  market.save();
}

export function handleTemporaryExcessReserveRatioExpired(
  event: TemporaryExcessReserveRatioExpired
): void {
  let market = getMarket(generateMarketId(event.params.market));
  market.originalAnnualInterestBips = 0;
  market.temporaryReserveRatioActive = false;
  market.originalReserveRatioBips = 0;
  market.temporaryReserveRatioExpiry = 0;
  market.save();
}

export function handleTemporaryExcessReserveRatioCanceled(
  event: TemporaryExcessReserveRatioCanceled
): void {
  let market = getMarket(generateMarketId(event.params.market));
  market.originalAnnualInterestBips = 0;
  market.temporaryReserveRatioActive = false;
  market.originalReserveRatioBips = 0;
  market.temporaryReserveRatioExpiry = 0;
  market.save();
}
