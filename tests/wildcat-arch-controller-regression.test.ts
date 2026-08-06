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
  handleMarketAdded,
} from "../src/wildcat-arch-controller";
import { generateEventId } from "../src/utils";
import { MarketAdded } from "../generated/schema";
import {
  createController,
  createHooksFactory,
} from "../generated/UncrashableEntityHelpers";
import {
  createBorrowerAddedEvent,
  createBorrowerRemovedEvent,
  createMarketAddedEvent,
} from "./wildcat-arch-controller-utils";

function createTestHooksFactory(address: Address, indexed: boolean): void {
  createHooksFactory(address.toHexString(), {
    address,
    label: "test-hooks-factory",
    archController: "test-arch-controller",
    marketKind: "STANDARD",
    generation: "v2.5",
    abiFamily: "test-hooks-abi",
    hookedMarketAbi: "BASE",
    configuredStartBlock: BigInt.zero(),
    indexed,
    deploymentTarget: indexed,
    lifecycle: "ACTIVE",
    configured: true,
    isRegistered: true,
    registrationUpdatedAtBlock: null,
    registrationUpdatedAtTimestamp: null,
    eventIndex: 0,
    sentinel: Address.zero(),
  });
}

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

  test("MarketAdded preserves raw addresses and classifies legacy controllers", () => {
    clearStore();

    let controllerAddress = Address.fromString(
      "0x1000000000000000000000000000000000000001"
    );
    let marketAddress = Address.fromString(
      "0x2000000000000000000000000000000000000002"
    );
    createController(controllerAddress.toHexString(), {
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
    assert.stringEquals(record!.controller!, controllerAddress.toHexString());
    assert.assertNull(record!.hooksFactory);
    assert.bytesEquals(record!.marketAddress, marketAddress);
    assert.stringEquals(record!.market!, marketAddress.toHexString());
    assert.fieldEquals(
      "MarketEvent",
      generateEventId(event),
      "kind",
      "MARKET_REGISTERED"
    );
    assert.fieldEquals(
      "MarketEvent",
      generateEventId(event),
      "market",
      marketAddress.toHexString()
    );
    assert.fieldEquals(
      "MarketEvent",
      generateEventId(event),
      "sequence",
      "0"
    );

    clearStore();
  });

  test("MarketAdded classifies hooks factories without fake controllers", () => {
    clearStore();

    let hooksFactoryAddress = Address.fromString(
      "0x3000000000000000000000000000000000000003"
    );
    let marketAddress = Address.fromString(
      "0x4000000000000000000000000000000000000004"
    );
    createTestHooksFactory(hooksFactoryAddress, true);

    let event = createMarketAddedEvent(hooksFactoryAddress, marketAddress);
    handleMarketAdded(event);

    let record = MarketAdded.load(generateEventId(event));
    assert.assertNotNull(record);
    assert.assertNull(record!.controller);
    assert.stringEquals(
      record!.hooksFactory!,
      hooksFactoryAddress.toHexString()
    );
    assert.fieldEquals(
      "MarketEvent",
      generateEventId(event),
      "kind",
      "MARKET_REGISTERED"
    );

    clearStore();
  });

  test("MarketAdded skips normalized events for unindexed hooks factories", () => {
    clearStore();

    let hooksFactoryAddress = Address.fromString(
      "0x5000000000000000000000000000000000000005"
    );
    let marketAddress = Address.fromString(
      "0x6000000000000000000000000000000000000006"
    );
    createTestHooksFactory(hooksFactoryAddress, false);

    let event = createMarketAddedEvent(hooksFactoryAddress, marketAddress);
    handleMarketAdded(event);

    let record = MarketAdded.load(generateEventId(event));
    assert.assertNotNull(record);
    assert.assertNull(record!.controller);
    assert.stringEquals(
      record!.hooksFactory!,
      hooksFactoryAddress.toHexString()
    );
    assert.stringEquals(record!.market!, marketAddress.toHexString());
    assert.entityCount("MarketEvent", 0);
    assert.entityCount("MarketEventCursor", 0);

    clearStore();
  });

  test("MarketAdded keeps unknown addresses with nullable relations", () => {
    clearStore();

    let unknownController = Address.fromString(
      "0x7000000000000000000000000000000000000007"
    );
    let unknownMarket = Address.fromString(
      "0x8000000000000000000000000000000000000008"
    );

    let event = createMarketAddedEvent(unknownController, unknownMarket);
    handleMarketAdded(event);

    let record = MarketAdded.load(generateEventId(event));
    assert.assertNotNull(record);
    assert.bytesEquals(record!.controllerAddress, unknownController);
    assert.assertNull(record!.controller);
    assert.assertNull(record!.hooksFactory);
    assert.bytesEquals(record!.marketAddress, unknownMarket);
    assert.stringEquals(record!.market!, unknownMarket.toHexString());
    assert.entityCount("MarketEvent", 0);
    assert.entityCount("MarketEventCursor", 0);

    clearStore();
  });
});
