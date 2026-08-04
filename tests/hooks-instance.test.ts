import {
  assert,
  clearStore,
  describe,
  test,
} from "matchstick-as/assembly/index";
import { newMockEvent } from "matchstick-as";
import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import {
  RoleProviderAdded,
  RoleProviderRemoved,
  RoleProviderUpdated,
} from "../generated/templates/CombinedHooks/CombinedHooks";
import {
  createHooksInstance,
  generateHooksInstanceId,
  generateRoleProviderId,
} from "../generated/UncrashableEntityHelpers";
import {
  handleRoleProviderAdded,
  handleRoleProviderRemoved,
  handleRoleProviderUpdated,
} from "../src/hooks-instance";

let hooksAddress = Address.fromString(
  "0x0000000000000000000000000000000000003001"
);
let providerAddress = Address.fromString(
  "0x0000000000000000000000000000000000003002"
);

function saveHooksInstance(): void {
  createHooksInstance(generateHooksInstanceId(hooksAddress), {
    name: "role provider test hooks",
    kind: "OpenTerm",
    borrower: Address.zero(),
    hooksTemplate: "hooks-template",
    hooksFactory: "hooks-factory",
  });
}

function createRoleProviderAddedEvent(
  timeToLive: BigInt,
  pullProviderIndex: i32,
  pushProviderIndex: i32
): RoleProviderAdded {
  let event = changetype<RoleProviderAdded>(newMockEvent());
  event.address = hooksAddress;
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam(
      "providerAddress",
      ethereum.Value.fromAddress(providerAddress)
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "timeToLive",
      ethereum.Value.fromUnsignedBigInt(timeToLive)
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "pullProviderIndex",
      ethereum.Value.fromI32(pullProviderIndex)
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "pushProviderIndex",
      ethereum.Value.fromI32(pushProviderIndex)
    )
  );
  return event;
}

function createRoleProviderUpdatedEvent(
  timeToLive: BigInt,
  pullProviderIndex: i32,
  pushProviderIndex: i32
): RoleProviderUpdated {
  let event = changetype<RoleProviderUpdated>(newMockEvent());
  event.address = hooksAddress;
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam(
      "providerAddress",
      ethereum.Value.fromAddress(providerAddress)
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "timeToLive",
      ethereum.Value.fromUnsignedBigInt(timeToLive)
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "pullProviderIndex",
      ethereum.Value.fromI32(pullProviderIndex)
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "pushProviderIndex",
      ethereum.Value.fromI32(pushProviderIndex)
    )
  );
  return event;
}

function createRoleProviderRemovedEvent(
  pullProviderIndex: i32,
  pushProviderIndex: i32
): RoleProviderRemoved {
  let event = changetype<RoleProviderRemoved>(newMockEvent());
  event.address = hooksAddress;
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam(
      "providerAddress",
      ethereum.Value.fromAddress(providerAddress)
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "pullProviderIndex",
      ethereum.Value.fromI32(pullProviderIndex)
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "pushProviderIndex",
      ethereum.Value.fromI32(pushProviderIndex)
    )
  );
  return event;
}

describe("role provider events", () => {
  test("preserves max TTL and updates provider classifications", () => {
    clearStore();
    saveHooksInstance();

    let nullProviderIndex = 2 ** 24 - 1;
    let providerId = generateRoleProviderId(hooksAddress, providerAddress);
    let hooksId = generateHooksInstanceId(hooksAddress);

    handleRoleProviderAdded(
      createRoleProviderAddedEvent(
        BigInt.fromString("4294967295"),
        nullProviderIndex,
        0
      )
    );

    assert.fieldEquals("RoleProvider", providerId, "timeToLive", "4294967295");
    assert.fieldEquals("RoleProvider", providerId, "isPullProvider", "false");
    assert.fieldEquals("RoleProvider", providerId, "isPushProvider", "true");

    handleRoleProviderUpdated(
      createRoleProviderUpdatedEvent(BigInt.zero(), 0, nullProviderIndex)
    );

    assert.fieldEquals("RoleProvider", providerId, "timeToLive", "0");
    assert.fieldEquals("RoleProvider", providerId, "isPullProvider", "true");
    assert.fieldEquals("RoleProvider", providerId, "pullProviderIndex", "0");
    assert.fieldEquals("RoleProvider", providerId, "isPushProvider", "false");
    assert.fieldEquals(
      "RoleProvider",
      providerId,
      "pushProviderIndex",
      "16777215"
    );
    assert.fieldEquals("HooksInstance", hooksId, "eventIndex", "2");
  });

  test("clears pull and push state when a provider is removed", () => {
    clearStore();
    saveHooksInstance();

    let nullProviderIndex = 2 ** 24 - 1;
    let providerId = generateRoleProviderId(hooksAddress, providerAddress);

    handleRoleProviderAdded(
      createRoleProviderAddedEvent(
        BigInt.fromString("4294967295"),
        nullProviderIndex,
        0
      )
    );
    handleRoleProviderRemoved(
      createRoleProviderRemovedEvent(nullProviderIndex, 0)
    );

    assert.fieldEquals("RoleProvider", providerId, "isApproved", "false");
    assert.fieldEquals("RoleProvider", providerId, "timeToLive", "0");
    assert.fieldEquals("RoleProvider", providerId, "isPullProvider", "false");
    assert.fieldEquals("RoleProvider", providerId, "pullProviderIndex", "0");
    assert.fieldEquals("RoleProvider", providerId, "isPushProvider", "false");
    assert.fieldEquals("RoleProvider", providerId, "pushProviderIndex", "0");
  });
});
