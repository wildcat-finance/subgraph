import {
  assert,
  clearStore,
  describe,
  test
} from "matchstick-as/assembly/index";
import { Address } from "@graphprotocol/graph-ts";
import {
  createControllerFactory,
  generateControllerFactoryId,
  generateControllerId
} from "../generated/UncrashableEntityHelpers";
import { handleNewController } from "../src/wildcat-market-controller-factory";
import { createNewControllerEvent } from "./wildcat-market-controller-factory-utils";

describe("WildcatMarketControllerFactory", () => {
  test("a NewController event creates the controller state", () => {
    clearStore();

    let borrower = Address.fromString(
      "0x0000000000000000000000000000000000000001"
    );
    let controller = Address.fromString(
      "0x0000000000000000000000000000000000000002"
    );
    let event = createNewControllerEvent(
      borrower,
      controller,
      "Example name prefix",
      "Example symbol prefix"
    );
    let controllerFactoryId = generateControllerFactoryId(event.address);
    createControllerFactory(controllerFactoryId, {
      sentinel: Address.zero(),
      originationFeeAsset: null,
      constraints: "test-constraints",
      archController: "test-arch-controller",
      isRegistered: true
    });

    handleNewController(event);

    let controllerId = generateControllerId(controller);
    assert.entityCount("Controller", 1);
    assert.fieldEquals(
      "Controller",
      controllerId,
      "borrower",
      borrower.toHexString()
    );
    assert.fieldEquals(
      "Controller",
      controllerId,
      "controllerFactory",
      controllerFactoryId
    );
    assert.fieldEquals(
      "Controller",
      controllerId,
      "archController",
      "test-arch-controller"
    );
    assert.fieldEquals("Controller", controllerId, "isRegistered", "true");
  });
});
