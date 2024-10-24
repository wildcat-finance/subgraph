import { Address } from "@graphprotocol/graph-ts";
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
import { IERC20 } from "../generated/templates/WildcatMarketController/IERC20";
import { isNullAddress } from "./utils";

function createTokenIfNotExists(asset: Address): string | null {
  if (isNullAddress(asset)) {
    return null;
  }
  let assetId = generateTokenId(asset);
  let token = Token.load(assetId);
  if (token == null) {
    let erc20 = IERC20.bind(asset);
    let result = erc20.try_isMock();
    let isMock = !result.reverted && result.value;
    return createToken(assetId, {
      address: asset,
      name: erc20.name(),
      symbol: erc20.symbol(),
      decimals: erc20.decimals(),
      isMock: isMock,
    }).id;
  }
  return token.id;
}

export function handleNewController(event: NewControllerEvent): void {
  let controllerFactory = getControllerFactory(
    generateControllerFactoryId(event.address)
  );
  let controller = event.params.controller;
  let borrower = event.params.borrower;
  WildcatMarketControllerTemplate.create(controller);
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
    originationFeeAsset
  );
  controllerFactory.protocolFeeBips = protocolFeeBips;
  controllerFactory.save();
}
