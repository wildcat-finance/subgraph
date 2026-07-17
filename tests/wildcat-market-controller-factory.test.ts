import { assert, clearStore, describe, test } from "matchstick-as/assembly";
import { Address } from "@graphprotocol/graph-ts";
import {
  createControllerFactory,
  generateControllerFactoryId,
  generateControllerId,
} from "../generated/UncrashableEntityHelpers";
import { handleNewController } from "../src/wildcat-market-controller-factory";
import { createNewControllerEvent } from "./wildcat-market-controller-factory-utils";

let borrower = Address.fromString(
  "0x0000000000000000000000000000000000000001"
);
let controller = Address.fromString(
  "0x0000000000000000000000000000000000000002"
);

describe("wildcat market controller factory", () => {
  test("creates controllers from new controller events", () => {
    clearStore();

    let event = createNewControllerEvent(borrower, controller, "Wildcat ", "WLD");
    createControllerFactory(generateControllerFactoryId(event.address), {
      address: event.address,
      generation: "v1",
      abiFamily: "controller-factory-v1",
      sentinel: Address.zero(),
      originationFeeAsset: null,
      constraints: "constraints",
      archController: "arch-controller",
      isRegistered: true,
    });

    handleNewController(event);

    let controllerId = generateControllerId(controller);
    assert.entityCount("Controller", 1);
    assert.fieldEquals("Controller", controllerId, "borrower", borrower.toHex());
    assert.fieldEquals(
      "Controller",
      controllerId,
      "controllerFactory",
      generateControllerFactoryId(event.address)
    );
    assert.fieldEquals("Controller", controllerId, "isRegistered", "true");
  });
});
