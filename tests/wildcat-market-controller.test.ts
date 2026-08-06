import {
  assert,
  clearStore,
  describe,
  test
} from "matchstick-as/assembly/index";
import { Address } from "@graphprotocol/graph-ts";
import {
  createController,
  generateControllerId,
  generateLenderAuthorizationId
} from "../generated/UncrashableEntityHelpers";
import { handleLenderAuthorized } from "../src/wildcat-market-controller";
import { generateEventId } from "../src/utils";
import { createLenderAuthorizedEvent } from "./wildcat-market-controller-utils";

describe("WildcatMarketController", () => {
  test("authorizing a lender updates current and historical state", () => {
    clearStore();

    let lender = Address.fromString(
      "0x0000000000000000000000000000000000000001"
    );
    let event = createLenderAuthorizedEvent(lender);
    let controllerId = generateControllerId(event.address);
    createController(controllerId, {
      borrower: Address.zero(),
      controllerFactory: "test-controller-factory",
      archController: "test-arch-controller",
      isRegistered: true
    });

    handleLenderAuthorized(event);

    let authorizationId = generateLenderAuthorizationId(event.address, lender);
    assert.fieldEquals(
      "LenderAuthorization",
      authorizationId,
      "controller",
      controllerId
    );
    assert.fieldEquals(
      "LenderAuthorization",
      authorizationId,
      "authorized",
      "true"
    );
    assert.fieldEquals(
      "LenderAuthorizationChange",
      generateEventId(event),
      "authorization",
      authorizationId
    );
    assert.fieldEquals(
      "LenderAuthorizationChange",
      generateEventId(event),
      "authorized",
      "true"
    );
  });
});
