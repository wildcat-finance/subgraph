import { BigInt } from "@graphprotocol/graph-ts";
import {
  createLenderAuthorizationChange,
  createMarket,
  generateLenderAuthorizationId,
  getController,
  getControllerFactory,
  getOrInitializeLenderAuthorization,
} from "../generated/UncrashableEntityHelpers";
import { WildcatMarket } from "../generated/templates/WildcatMarket/WildcatMarket";
import {
  LenderAuthorized as LenderAuthorizedEvent,
  LenderDeauthorized as LenderDeauthorizedEvent,
  MarketDeployed as MarketDeployedEvent,
} from "../generated/templates/WildcatMarketController/WildcatMarketController";
import { generateEventId } from "./utils";
import { generateControllerId } from "../generated/UncrashableEntityHelpers";
import { WildcatMarket as MarketTemplate } from "../generated/templates";

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
  });
}

export function handleMarketDeployed(event: MarketDeployedEvent): void {
  let controller = getController(event.address.toHex());
  let controllerFactory = getControllerFactory(controller.controllerFactory);
  let contract = WildcatMarket.bind(event.params.market);
  MarketTemplate.create(event.params.market);

  createMarket(event.params.market.toHex(), {
    name: event.params.name,
    symbol: event.params.symbol,
    asset: event.params.asset,
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
  });
}
