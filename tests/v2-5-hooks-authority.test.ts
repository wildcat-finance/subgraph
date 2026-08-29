import {
  assert,
  clearStore,
  describe,
  test,
} from "matchstick-as/assembly";
import { Address, BigInt } from "@graphprotocol/graph-ts";
import {
  AdministratorTransferRequested,
  AdministratorTransferred,
  RoleProviderAdded,
} from "../generated/templates/CombinedHooksV2_5/CombinedHooksV2_5";
import {
  generateHooksInstanceId,
  generateRoleProviderId,
} from "../generated/UncrashableEntityHelpers";
import {
  handleAdministratorTransferRequested,
  handleAdministratorTransferred,
  handleRoleProviderAdded,
} from "../src/hooks-instance-v2-5";
import {
  createV25Event,
  pushAddress,
  pushBigInt,
  seedV25Factory,
  seedV25Hooks,
} from "./v2-5-test-utils";

const FACTORY = Address.fromString(
  "0x000000000000000000000000000000000000d001"
);
const TEMPLATE = Address.fromString(
  "0x000000000000000000000000000000000000d002"
);
const HOOKS_A = Address.fromString(
  "0x000000000000000000000000000000000000d003"
);
const HOOKS_B = Address.fromString(
  "0x000000000000000000000000000000000000d004"
);
const ADMINISTRATOR = Address.fromString(
  "0x000000000000000000000000000000000000d005"
);
const NEW_ADMINISTRATOR = Address.fromString(
  "0x000000000000000000000000000000000000d006"
);
const PROVIDER = Address.fromString(
  "0x000000000000000000000000000000000000d007"
);
const NULL_PROVIDER_INDEX = BigInt.fromI32(16_777_215);

function addProvider(hooks: Address, logIndex: i32): void {
  let event = changetype<RoleProviderAdded>(
    createV25Event(hooks, logIndex)
  );
  pushAddress(event, "administrator", ADMINISTRATOR);
  pushAddress(event, "providerAddress", PROVIDER);
  pushBigInt(event, "timeToLive", BigInt.fromI32(86_400));
  pushBigInt(event, "pullProviderIndex", BigInt.zero());
  pushBigInt(event, "pushProviderIndex", NULL_PROVIDER_INDEX);
  handleRoleProviderAdded(event);
}

describe("v2.5 hook authority", () => {
  test("shares provider identity without coupling hook administration", () => {
    clearStore();
    seedV25Factory(FACTORY, "STANDARD");
    seedV25Hooks(FACTORY, TEMPLATE, HOOKS_A, ADMINISTRATOR);
    seedV25Hooks(FACTORY, TEMPLATE, HOOKS_B, ADMINISTRATOR);

    addProvider(HOOKS_A, 1);
    addProvider(HOOKS_B, 2);

    assert.entityCount("RoleProviderInstance", 1);
    assert.entityCount("RoleProvider", 2);
    assert.fieldEquals(
      "RoleProvider",
      generateRoleProviderId(HOOKS_A, PROVIDER),
      "providerInstance",
      PROVIDER.toHexString()
    );
    assert.fieldEquals(
      "RoleProvider",
      generateRoleProviderId(HOOKS_B, PROVIDER),
      "providerInstance",
      PROVIDER.toHexString()
    );

    let requested = changetype<AdministratorTransferRequested>(
      createV25Event(HOOKS_A, 3)
    );
    pushAddress(requested, "administrator", ADMINISTRATOR);
    pushAddress(
      requested,
      "previousPendingAdministrator",
      Address.zero()
    );
    pushAddress(requested, "pendingAdministrator", NEW_ADMINISTRATOR);
    handleAdministratorTransferRequested(requested);

    let accepted = changetype<AdministratorTransferred>(
      createV25Event(HOOKS_A, 4)
    );
    pushAddress(accepted, "previousAdministrator", ADMINISTRATOR);
    pushAddress(accepted, "newAdministrator", NEW_ADMINISTRATOR);
    handleAdministratorTransferred(accepted);

    assert.fieldEquals(
      "HooksInstance",
      generateHooksInstanceId(HOOKS_A),
      "administrator",
      NEW_ADMINISTRATOR.toHexString()
    );
    assert.fieldEquals(
      "HooksInstance",
      generateHooksInstanceId(HOOKS_A),
      "eventIndex",
      "3"
    );
    assert.fieldEquals(
      "HooksInstance",
      generateHooksInstanceId(HOOKS_B),
      "administrator",
      ADMINISTRATOR.toHexString()
    );
    assert.entityCount("HookAdministratorChange", 2);
  });
});
