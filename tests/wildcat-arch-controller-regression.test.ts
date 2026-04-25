import {
  assert,
  clearStore,
  describe,
  test,
} from "matchstick-as/assembly/index";
import { Address, BigInt } from "@graphprotocol/graph-ts";
import {
  handleBorrowerAdded,
  handleBorrowerRemoved,
} from "../src/wildcat-arch-controller";
import { generateEventId } from "../src/utils";
import {
  createBorrowerAddedEvent,
  createBorrowerRemovedEvent,
} from "./wildcat-arch-controller-utils";

describe("WildcatArchController regressions", () => {
  test("BorrowerRemoved records removal history as unregistered", () => {
    clearStore();

    let borrower = Address.fromString(
      "0x0000000000000000000000000000000000000001"
    );
    let borrowerAddedEvent = createBorrowerAddedEvent(borrower);
    handleBorrowerAdded(borrowerAddedEvent);

    let borrowerRemovedEvent = createBorrowerRemovedEvent(borrower);
    borrowerRemovedEvent.logIndex = BigInt.fromI32(2);
    handleBorrowerRemoved(borrowerRemovedEvent);

    assert.entityCount("BorrowerRegistrationChange", 2);
    assert.fieldEquals(
      "BorrowerRegistrationChange",
      generateEventId(borrowerRemovedEvent),
      "isRegistered",
      "false"
    );

    clearStore();
  });
});
