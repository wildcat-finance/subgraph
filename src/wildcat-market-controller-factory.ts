import { Address, BigInt } from "@graphprotocol/graph-ts";
import {
  createController,
  createToken,
  generateControllerFactoryId,
  generateControllerId,
  generateTokenId,
  getControllerFactory,
} from "../generated/UncrashableEntityHelpers";
import {
  NewController as NewControllerEvent,
  UpdateProtocolFeeConfiguration as UpdateProtocolFeeConfigurationEvent,
} from "../generated/templates/WildcatMarketControllerFactory/WildcatMarketControllerFactory";
import { WildcatMarketController as WildcatMarketControllerTemplate } from "../generated/templates";
import { Token } from "../generated/schema";
import { readTokenMetadata } from "./token-metadata";
import { isNullAddress } from "./utils";
import { setupTokenPriceFeeds } from "./price-feeds";
import { createDeploymentChildContext } from "./deployment-context";

function createTokenIfNotExists(
  asset: Address,
  timestamp: BigInt
): string | null {
  if (isNullAddress(asset)) {
    return null;
  }
  let assetId = generateTokenId(asset);
  let token = Token.load(assetId);
  if (token == null) {
    let metadata = readTokenMetadata(asset);
    let newToken = createToken(assetId, {
      address: asset,
      name: metadata.name,
      symbol: metadata.symbol,
      decimals: metadata.decimals,
      isMock: metadata.isMock,
    });
    setupTokenPriceFeeds(newToken, timestamp);
    return newToken.id;
  }
  return token.id;
}

export function handleNewController(event: NewControllerEvent): void {
  let controllerFactory = getControllerFactory(
    generateControllerFactoryId(event.address)
  );
  let controller = event.params.controller;
  let borrower = event.params.borrower;
  WildcatMarketControllerTemplate.createWithContext(
    controller,
    createDeploymentChildContext()
  );
  createController(generateControllerId(controller), {
    borrower: borrower,
    controllerFactory: generateControllerFactoryId(event.address),
    isRegistered: true,
    archController: controllerFactory.archController,
  });
}

export function handleUpdateProtocolFeeConfiguration(
  event: UpdateProtocolFeeConfigurationEvent
): void {
  let controllerFactory = getControllerFactory(
    generateControllerFactoryId(event.address)
  );
  let feeRecipient = event.params.feeRecipient;
  let originationFeeAmount = event.params.originationFeeAmount;
  let originationFeeAsset = event.params.originationFeeAsset;
  let protocolFeeBips = event.params.protocolFeeBips;
  controllerFactory.feeRecipient = feeRecipient;
  controllerFactory.originationFeeAmount = originationFeeAmount;
  controllerFactory.originationFeeAsset = createTokenIfNotExists(
    originationFeeAsset,
    event.block.timestamp
  );
  controllerFactory.protocolFeeBips = protocolFeeBips;
  controllerFactory.save();
}
