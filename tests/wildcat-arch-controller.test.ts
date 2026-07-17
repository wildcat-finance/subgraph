import {
  assert,
  clearStore,
  createMockedFunction,
  dataSourceMock,
  describe,
  test,
} from "matchstick-as/assembly";
import {
  Address,
  BigInt,
  DataSourceContext,
  ethereum,
} from "@graphprotocol/graph-ts";
import { generateRegisteredBorrowerId } from "../generated/UncrashableEntityHelpers";
import {
  handleBorrowerAdded,
  handleBorrowerRemoved,
  handleControllerFactoryAdded,
  handleControllerFactoryRemoved,
} from "../src/wildcat-arch-controller";
import { configuredHooksFactoryContextKey } from "../src/factory-context";
import {
  createBorrowerAddedEvent,
  createBorrowerRemovedEvent,
  createControllerFactoryAddedEvent,
  createControllerFactoryRemovedEvent,
} from "./wildcat-arch-controller-utils";

let borrower = Address.fromString(
  "0x0000000000000000000000000000000000000001"
);
let hooksFactory = Address.fromString(
  "0x0000000000000000000000000000000000000010"
);
let unknownFactory = Address.fromString(
  "0x0000000000000000000000000000000000000011"
);

function mockNotControllerFactory(factory: Address): void {
  createMockedFunction(
    factory,
    "getParameterConstraints",
    "getParameterConstraints():((uint32,uint32,uint16,uint16,uint16,uint16,uint32,uint32,uint16,uint16))"
  ).reverts();
}

describe("wildcat arch controller", () => {
  test("tracks borrower registration changes", () => {
    clearStore();

    let added = createBorrowerAddedEvent(borrower);
    handleBorrowerAdded(added);

    let borrowerId = generateRegisteredBorrowerId(added.address, borrower);
    assert.entityCount("Borrower", 1);
    assert.entityCount("RegisteredBorrower", 1);
    assert.entityCount("BorrowerRegistrationChange", 1);
    assert.fieldEquals("Borrower", borrower.toHexString(), "address", borrower.toHexString());
    assert.fieldEquals(
      "RegisteredBorrower",
      borrowerId,
      "profile",
      borrower.toHexString()
    );
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

  test("tracks configured hooks-factory registration without treating it as V1", () => {
    clearStore();
    let added = createControllerFactoryAddedEvent(hooksFactory);
    let context = new DataSourceContext();
    context.setString(
      configuredHooksFactoryContextKey(hooksFactory),
      "REVOLVING|v2.5|hooks-v2.5-revolving|BASE|123|true|true|ACTIVE|revolving-v2.5|" +
        added.address.toHexString()
    );
    dataSourceMock.setContext(context);

    mockNotControllerFactory(hooksFactory);
    createMockedFunction(
      hooksFactory,
      "archController",
      "archController():(address)"
    ).returns([ethereum.Value.fromAddress(added.address)]);
    createMockedFunction(
      hooksFactory,
      "sanctionsSentinel",
      "sanctionsSentinel():(address)"
    ).returns([ethereum.Value.fromAddress(Address.zero())]);

    handleControllerFactoryAdded(added);

    let registrationId =
      added.address.toHexString() + "-" + hooksFactory.toHexString();
    assert.fieldEquals("FactoryRegistration", registrationId, "kind", "HOOKS");
    assert.fieldEquals(
      "FactoryRegistration",
      registrationId,
      "isRegistered",
      "true"
    );
    assert.fieldEquals(
      "HooksFactory",
      hooksFactory.toHexString(),
      "marketKind",
      "REVOLVING"
    );
    assert.fieldEquals(
      "HooksFactory",
      hooksFactory.toHexString(),
      "generation",
      "v2.5"
    );
    assert.fieldEquals(
      "HooksFactory",
      hooksFactory.toHexString(),
      "hookedMarketAbi",
      "BASE"
    );
    assert.fieldEquals(
      "HooksFactory",
      hooksFactory.toHexString(),
      "label",
      "revolving-v2.5"
    );
    assert.fieldEquals(
      "HooksFactory",
      hooksFactory.toHexString(),
      "deploymentTarget",
      "true"
    );
    assert.entityCount("ControllerFactory", 0);

    let removed = createControllerFactoryRemovedEvent(hooksFactory);
    removed.address = added.address;
    removed.logIndex = BigInt.fromI32(2);
    handleControllerFactoryRemoved(removed);

    assert.fieldEquals(
      "FactoryRegistration",
      registrationId,
      "isRegistered",
      "false"
    );
    assert.fieldEquals(
      "HooksFactory",
      hooksFactory.toHexString(),
      "isRegistered",
      "false"
    );
    assert.entityCount("FactoryRegistrationEvent", 2);
    dataSourceMock.resetValues();
  });

  test("keeps an unclassified registered factory visible as a diagnostic", () => {
    clearStore();
    dataSourceMock.resetValues();
    let added = createControllerFactoryAddedEvent(unknownFactory);
    mockNotControllerFactory(unknownFactory);
    createMockedFunction(
      unknownFactory,
      "archController",
      "archController():(address)"
    ).reverts();

    handleControllerFactoryAdded(added);

    let registrationId =
      added.address.toHexString() + "-" + unknownFactory.toHexString();
    assert.fieldEquals("FactoryRegistration", registrationId, "kind", "UNKNOWN");
    assert.entityCount("FactoryRegistrationEvent", 1);
    assert.entityCount("IndexerDiagnostic", 1);
  });
});
