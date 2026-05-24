import { assert, clearStore, describe, test } from "matchstick-as/assembly";
import { Address } from "@graphprotocol/graph-ts";
import { generateRegisteredBorrowerId } from "../generated/UncrashableEntityHelpers";
import {
  handleBorrowerAdded,
  handleBorrowerRemoved,
} from "../src/wildcat-arch-controller";
import {
  createBorrowerAddedEvent,
  createBorrowerRemovedEvent,
} from "./wildcat-arch-controller-utils";

let borrower = Address.fromString(
  "0x0000000000000000000000000000000000000001"
);

describe("wildcat arch controller", () => {
  test("tracks borrower registration changes", () => {
    clearStore();

    let added = createBorrowerAddedEvent(borrower);
    handleBorrowerAdded(added);

    let borrowerId = generateRegisteredBorrowerId(added.address, borrower);
    assert.entityCount("RegisteredBorrower", 1);
    assert.entityCount("BorrowerRegistrationChange", 1);
    assert.fieldEquals("RegisteredBorrower", borrowerId, "isRegistered", "true");
    assert.fieldEquals(
      "RegisteredBorrower",
      borrowerId,
      "borrower",
      borrower.toHex()
    );

    handleBorrowerRemoved(createBorrowerRemovedEvent(borrower));

    assert.fieldEquals("RegisteredBorrower", borrowerId, "isRegistered", "false");
  });
});
