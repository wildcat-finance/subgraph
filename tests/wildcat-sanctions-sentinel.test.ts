import {
  assert,
  clearStore,
  createMockedFunction,
  describe,
  newMockEvent,
  test,
} from "matchstick-as/assembly";
import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import {
  NewSanctionsEscrow,
  SanctionOverride,
  SanctionOverrideRemoved,
} from "../generated/WildcatSanctionsSentinel/WildcatSanctionsSentinel";
import {
  handleNewSanctionsEscrow,
  handleSanctionOverride,
  handleSanctionOverrideRemoved,
} from "../src/wildcat-sanctions-sentinel";
import { generateEventId } from "../src/utils";

const SENTINEL = Address.fromString(
  "0x1000000000000000000000000000000000000001"
);
const BORROWER = Address.fromString(
  "0x2000000000000000000000000000000000000002"
);
const ACCOUNT = Address.fromString(
  "0x3000000000000000000000000000000000000003"
);
const ASSET = Address.fromString(
  "0x4000000000000000000000000000000000000004"
);
const ESCROW = Address.fromString(
  "0x5000000000000000000000000000000000000005"
);

function positionEvent(event: ethereum.Event, logIndex: i32): void {
  event.address = SENTINEL;
  event.block.number = BigInt.fromI32(42);
  event.block.timestamp = BigInt.fromI32(1000 + logIndex);
  event.logIndex = BigInt.fromI32(logIndex);
}

function createNewSanctionsEscrowEvent(): NewSanctionsEscrow {
  let event = changetype<NewSanctionsEscrow>(newMockEvent());
  positionEvent(event, 1);
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam("borrower", ethereum.Value.fromAddress(BORROWER))
  );
  event.parameters.push(
    new ethereum.EventParam("account", ethereum.Value.fromAddress(ACCOUNT))
  );
  event.parameters.push(
    new ethereum.EventParam("asset", ethereum.Value.fromAddress(ASSET))
  );
  return event;
}

function createSanctionOverrideEvent(): SanctionOverride {
  let event = changetype<SanctionOverride>(newMockEvent());
  positionEvent(event, 2);
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam("borrower", ethereum.Value.fromAddress(BORROWER))
  );
  event.parameters.push(
    new ethereum.EventParam("account", ethereum.Value.fromAddress(ACCOUNT))
  );
  return event;
}

function createSanctionOverrideRemovedEvent(): SanctionOverrideRemoved {
  let event = changetype<SanctionOverrideRemoved>(newMockEvent());
  positionEvent(event, 3);
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam("borrower", ethereum.Value.fromAddress(BORROWER))
  );
  event.parameters.push(
    new ethereum.EventParam("account", ethereum.Value.fromAddress(ACCOUNT))
  );
  return event;
}

describe("wildcat sanctions sentinel", () => {
  test("indexes escrow identity and current override state", () => {
    clearStore();
    createMockedFunction(
      SENTINEL,
      "getEscrowAddress",
      "getEscrowAddress(address,address,address):(address)"
    )
      .withArgs([
        ethereum.Value.fromAddress(BORROWER),
        ethereum.Value.fromAddress(ACCOUNT),
        ethereum.Value.fromAddress(ASSET),
      ])
      .returns([ethereum.Value.fromAddress(ESCROW)]);

    let escrowEvent = createNewSanctionsEscrowEvent();
    let overrideEvent = createSanctionOverrideEvent();
    let removedEvent = createSanctionOverrideRemovedEvent();
    handleNewSanctionsEscrow(escrowEvent);
    handleSanctionOverride(overrideEvent);
    handleSanctionOverrideRemoved(removedEvent);

    let statusId = BORROWER.toHexString() + "-" + ACCOUNT.toHexString();
    assert.entityCount("Borrower", 1);
    assert.fieldEquals(
      "SanctionsEscrow",
      ESCROW.toHexString(),
      "borrower",
      BORROWER.toHexString()
    );
    assert.fieldEquals(
      "SanctionsEscrow",
      ESCROW.toHexString(),
      "account",
      ACCOUNT.toHexString()
    );
    assert.fieldEquals(
      "NewSanctionsEscrow",
      generateEventId(escrowEvent),
      "escrow",
      ESCROW.toHexString()
    );
    assert.fieldEquals(
      "NewSanctionsEscrow",
      generateEventId(escrowEvent),
      "borrowerProfile",
      BORROWER.toHexString()
    );
    assert.fieldEquals(
      "SanctionOverrideStatus",
      statusId,
      "isOverridden",
      "false"
    );
    assert.fieldEquals(
      "SanctionOverrideStatus",
      statusId,
      "updatedAtLogIndex",
      "3"
    );
    assert.fieldEquals(
      "SanctionOverride",
      generateEventId(overrideEvent),
      "status",
      statusId
    );
    assert.fieldEquals(
      "SanctionOverrideRemoved",
      generateEventId(removedEvent),
      "status",
      statusId
    );
    assert.entityCount("IndexerDiagnostic", 0);
  });

  test("retains creation history when escrow address lookup reverts", () => {
    clearStore();
    createMockedFunction(
      SENTINEL,
      "getEscrowAddress",
      "getEscrowAddress(address,address,address):(address)"
    )
      .withArgs([
        ethereum.Value.fromAddress(BORROWER),
        ethereum.Value.fromAddress(ACCOUNT),
        ethereum.Value.fromAddress(ASSET),
      ])
      .reverts();

    let event = createNewSanctionsEscrowEvent();
    handleNewSanctionsEscrow(event);

    assert.entityCount("NewSanctionsEscrow", 1);
    assert.entityCount("SanctionsEscrow", 0);
    assert.fieldEquals(
      "IndexerDiagnostic",
      generateEventId(event) + "-SANCTIONS_ESCROW_ADDRESS_UNAVAILABLE",
      "kind",
      "SANCTIONS_ESCROW_ADDRESS_UNAVAILABLE"
    );
  });
});
