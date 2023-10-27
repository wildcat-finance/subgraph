import {
  createController,
  generateControllerFactoryId,
  generateControllerId,
  getControllerFactory,
} from "../generated/UncrashableEntityHelpers";
import {
  NewController as NewControllerEvent,
  UpdateProtocolFeeConfiguration as UpdateProtocolFeeConfigurationEvent,
} from "../generated/templates/WildcatMarketControllerFactory/WildcatMarketControllerFactory";
import { WildcatMarketController } from "../generated/templates";

export function handleNewController(event: NewControllerEvent): void {
  let controllerFactory = getControllerFactory(
    generateControllerFactoryId(event.address)
  );
  // let controller = event.params.controller;
  // let borrower = event.params.borrower;
  let controller = event.params.borrower;
  let borrower = event.params.controller;
  WildcatMarketController.create(controller);
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
  controllerFactory.originationFeeAsset = originationFeeAsset;
  controllerFactory.protocolFeeBips = protocolFeeBips;
  controllerFactory.save();
}
