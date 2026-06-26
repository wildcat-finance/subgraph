import { assert, clearStore, describe, test } from "matchstick-as/assembly";
import { Address } from "@graphprotocol/graph-ts";
import {
  createController,
  generateControllerId,
  generateLenderAuthorizationId,
} from "../generated/UncrashableEntityHelpers";
import { handleLenderAuthorized } from "../src/wildcat-market-controller";
import { createLenderAuthorizedEvent } from "./wildcat-market-controller-utils";

let lender = Address.fromString(
  "0x0000000000000000000000000000000000000003"
);

describe("wildcat market controller", () => {
  test("tracks lender authorizations", () => {
    clearStore();

    let event = createLenderAuthorizedEvent(lender);
    createController(generateControllerId(event.address), {
      borrower: Address.zero(),
      controllerFactory: "controller-factory",
      archController: "arch-controller",
      isRegistered: true,
    });

    handleLenderAuthorized(event);

    let authorizationId = generateLenderAuthorizationId(event.address, lender);
    assert.entityCount("LenderAuthorization", 1);
    assert.entityCount("LenderAuthorizationChange", 1);
    assert.fieldEquals(
      "LenderAuthorization",
      authorizationId,
      "authorized",
      "true"
    );
    assert.fieldEquals(
      "LenderAuthorization",
      authorizationId,
      "lender",
      lender.toHex()
    );
  });
});
