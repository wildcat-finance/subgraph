import { assert, clearStore, describe, test } from "matchstick-as/assembly";
import { Address } from "@graphprotocol/graph-ts";
import { handleNewSanctionsEscrow } from "../src/wildcat-sanctions-sentinel";
import { generateEventId } from "../src/utils";
import { createNewSanctionsEscrowEvent } from "./wildcat-sanctions-sentinel-utils";

let borrower = Address.fromString(
  "0x0000000000000000000000000000000000000001"
);
let account = Address.fromString(
  "0x0000000000000000000000000000000000000002"
);
let asset = Address.fromString("0x0000000000000000000000000000000000000003");

describe("wildcat sanctions sentinel", () => {
  test("records new sanctions escrows", () => {
    clearStore();

    let event = createNewSanctionsEscrowEvent(borrower, account, asset);
    handleNewSanctionsEscrow(event);

    let eventId = generateEventId(event);
    assert.entityCount("NewSanctionsEscrow", 1);
    assert.fieldEquals(
      "NewSanctionsEscrow",
      eventId,
      "borrower",
      borrower.toHex()
    );
    assert.fieldEquals("NewSanctionsEscrow", eventId, "account", account.toHex());
    assert.fieldEquals("NewSanctionsEscrow", eventId, "asset", asset.toHex());
  });
});
