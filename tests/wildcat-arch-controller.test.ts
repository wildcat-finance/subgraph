import { assert, clearStore, describe, test } from "matchstick-as/assembly";
import { Address, BigInt } from "@graphprotocol/graph-ts";
import { MarketAdded } from "../generated/schema";
import {
  createController,
  createHooksFactory,
  generateControllerId,
  generateMarketId,
  generateRegisteredBorrowerId,
} from "../generated/UncrashableEntityHelpers";
import {
  handleBorrowerAdded,
  handleBorrowerRemoved,
  handleMarketAdded,
} from "../src/wildcat-arch-controller";
import { generateEventId } from "../src/utils";
import {
  createBorrowerAddedEvent,
  createBorrowerRemovedEvent,
  createMarketAddedEvent,
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

    let removed = createBorrowerRemovedEvent(borrower);
    removed.address = added.address;
    removed.logIndex = BigInt.fromI32(2);
    handleBorrowerRemoved(removed);

    assert.fieldEquals("RegisteredBorrower", borrowerId, "isRegistered", "false");
    assert.entityCount("BorrowerRegistrationChange", 2);
    assert.fieldEquals(
      "BorrowerRegistrationChange",
      generateEventId(removed),
      "isRegistered",
      "false"
    );
  });

  test("preserves MarketAdded addresses and resolves a legacy controller", () => {
    clearStore();

    let controllerAddress = Address.fromString(
      "0x1000000000000000000000000000000000000001"
    );
    let marketAddress = Address.fromString(
      "0x2000000000000000000000000000000000000002"
    );
    let controllerId = generateControllerId(controllerAddress);
    createController(controllerId, {
      borrower: Address.zero(),
      controllerFactory: "test-controller-factory",
      archController: "test-arch-controller",
      isRegistered: true,
    });

    let event = createMarketAddedEvent(controllerAddress, marketAddress);
    handleMarketAdded(event);

    let record = MarketAdded.load(generateEventId(event));
    assert.assertNotNull(record);
    assert.bytesEquals(record!.controllerAddress, controllerAddress);
    assert.stringEquals(record!.controller!, controllerId);
    assert.assertNull(record!.hooksFactory);
    assert.bytesEquals(record!.marketAddress, marketAddress);
    assert.stringEquals(record!.market!, generateMarketId(marketAddress));
  });

  test("resolves a hooks factory without a fake controller", () => {
    clearStore();

    let hooksFactoryAddress = Address.fromString(
      "0x3000000000000000000000000000000000000003"
    );
    let marketAddress = Address.fromString(
      "0x4000000000000000000000000000000000000004"
    );
    createHooksFactory(hooksFactoryAddress.toHexString(), {
      archController: "test-arch-controller",
      isRegistered: true,
      sentinel: Address.zero(),
    });

    let event = createMarketAddedEvent(hooksFactoryAddress, marketAddress);
    handleMarketAdded(event);

    let record = MarketAdded.load(generateEventId(event));
    assert.assertNotNull(record);
    assert.bytesEquals(record!.controllerAddress, hooksFactoryAddress);
    assert.assertNull(record!.controller);
    assert.stringEquals(
      record!.hooksFactory!,
      hooksFactoryAddress.toHexString()
    );
    assert.bytesEquals(record!.marketAddress, marketAddress);
    assert.stringEquals(record!.market!, generateMarketId(marketAddress));
  });

  test("keeps unknown MarketAdded addresses with nullable relations", () => {
    clearStore();

    let controllerAddress = Address.fromString(
      "0x5000000000000000000000000000000000000005"
    );
    let marketAddress = Address.fromString(
      "0x6000000000000000000000000000000000000006"
    );
    let event = createMarketAddedEvent(controllerAddress, marketAddress);
    handleMarketAdded(event);

    let record = MarketAdded.load(generateEventId(event));
    assert.assertNotNull(record);
    assert.bytesEquals(record!.controllerAddress, controllerAddress);
    assert.assertNull(record!.controller);
    assert.assertNull(record!.hooksFactory);
    assert.bytesEquals(record!.marketAddress, marketAddress);
    assert.stringEquals(record!.market!, generateMarketId(marketAddress));
  });
});
