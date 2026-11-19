import {
  assert,
  clearStore,
  dataSourceMock,
  describe,
  test,
} from "matchstick-as/assembly";
import { Address, BigInt, Bytes, DataSourceContext, ethereum } from "@graphprotocol/graph-ts";
import {
  AdministratorTransferRequested,
  AdministratorTransferred,
  MemberAdded,
  MemberRemoved,
} from "../generated/templates/AccessListRoleProvider/AccessListRoleProvider";
import {
  handleAccessListRoleProviderDeployed,
} from "../src/access-list-role-provider-factory";
import {
  handleAdministratorTransferRequested,
  handleAdministratorTransferred,
  handleMemberRemoved,
} from "../src/access-list-role-provider";
import { handleDeployment, handleMemberAdded } from "../src/kyc-role-provider";
import {
  createV25Event,
  pushAddress,
} from "./v2-5-test-utils";

const FACTORY = Address.fromString(
  "0x000000000000000000000000000000000000c001"
);
const PROVIDER = Address.fromString(
  "0x000000000000000000000000000000000000c002"
);
const ADMINISTRATOR = Address.fromString(
  "0x000000000000000000000000000000000000c003"
);
const NEW_ADMINISTRATOR = Address.fromString(
  "0x000000000000000000000000000000000000c004"
);
const DEPLOYER = Address.fromString(
  "0x000000000000000000000000000000000000c005"
);
const MEMBER_A = Address.fromString(
  "0x000000000000000000000000000000000000c006"
);

test("tracks KYC enrollment, removal and re-enrollment", () => {
  clearStore();
  let deployment = createV25Event(PROVIDER, 0);
  let context = new DataSourceContext();
  context.setString("initialAdministrator", ADMINISTRATOR.toHexString());
  context.setString("deployTxHash", deployment.transaction.hash.toHexString());
  dataSourceMock.setAddressAndContext(PROVIDER.toHexString(), context);
  handleDeployment(deployment.block);
  let provider = PROVIDER.toHexString();
  assert.fieldEquals("RoleProviderInstance", provider, "kind", "KYC");
  assert.fieldEquals("RoleProviderInstance", provider, "administrator", ADMINISTRATOR.toHexString());
  assert.fieldEquals("RoleProviderInstance", provider, "deployedAtTransaction", deployment.transaction.hash.toHexString());
  assert.entityCount("RoleProviderAdministratorChange", 0);
  assert.entityCount("RoleProviderMember", 0);

  let id = provider + "-" + MEMBER_A.toHexString();
  let added = changetype<MemberAdded>(createV25Event(PROVIDER, 1));
  pushAddress(added, "administrator", ADMINISTRATOR);
  pushAddress(added, "account", MEMBER_A);
  handleMemberAdded(added);
  assert.fieldEquals("RoleProviderMember", id, "isMember", "true");

  let removed = changetype<MemberRemoved>(createV25Event(PROVIDER, 2));
  pushAddress(removed, "administrator", ADMINISTRATOR);
  pushAddress(removed, "account", MEMBER_A);
  handleMemberRemoved(removed);
  assert.fieldEquals("RoleProviderMember", id, "isMember", "false");

  added.logIndex = BigInt.fromI32(3);
  added.block.timestamp = BigInt.fromI32(2000);
  handleMemberAdded(added);
  assert.fieldEquals("RoleProviderMember", id, "isMember", "true");
  assert.fieldEquals("RoleProviderMember", id, "updatedAtTimestamp", "2000");
  assert.fieldEquals("RoleProviderInstance", provider, "kind", "KYC");
  assert.entityCount("RoleProviderMembershipChange", 3);
  dataSourceMock.resetValues();
});
const MEMBER_B = Address.fromString(
  "0x000000000000000000000000000000000000c007"
);

describe("v2.5 access-list role providers", () => {
  test("indexes reusable membership and transferable administration", () => {
    clearStore();

    let deployed = createV25Event(FACTORY, 1);
    pushAddress(deployed, "provider", PROVIDER);
    pushAddress(deployed, "administrator", ADMINISTRATOR);
    pushAddress(deployed, "deployer", DEPLOYER);
    deployed.parameters.push(
      new ethereum.EventParam(
        "salt",
        ethereum.Value.fromFixedBytes(
          Bytes.fromHexString(
            "0x0000000000000000000000000000000000000000000000000000000000000001"
          )
        )
      )
    );
    let initialMembers = new Array<Address>();
    initialMembers.push(MEMBER_A);
    initialMembers.push(MEMBER_B);
    deployed.parameters.push(
      new ethereum.EventParam(
        "initialMembers",
        ethereum.Value.fromAddressArray(initialMembers)
      )
    );
    handleAccessListRoleProviderDeployed(deployed);

    assert.fieldEquals(
      "RoleProviderInstance",
      PROVIDER.toHexString(),
      "administrator",
      ADMINISTRATOR.toHexString()
    );
    assert.entityCount("RoleProviderMember", 2);
    assert.entityCount("RoleProviderMembershipChange", 2);

    let requested = changetype<AdministratorTransferRequested>(
      createV25Event(PROVIDER, 2)
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
      createV25Event(PROVIDER, 3)
    );
    pushAddress(accepted, "previousAdministrator", ADMINISTRATOR);
    pushAddress(accepted, "newAdministrator", NEW_ADMINISTRATOR);
    handleAdministratorTransferred(accepted);

    let removed = changetype<MemberRemoved>(
      createV25Event(PROVIDER, 4)
    );
    pushAddress(removed, "administrator", NEW_ADMINISTRATOR);
    pushAddress(removed, "account", MEMBER_A);
    handleMemberRemoved(removed);

    assert.fieldEquals(
      "RoleProviderInstance",
      PROVIDER.toHexString(),
      "administrator",
      NEW_ADMINISTRATOR.toHexString()
    );
    assert.fieldEquals(
      "RoleProviderMember",
      PROVIDER.toHexString().concat("-").concat(MEMBER_A.toHexString()),
      "isMember",
      "false"
    );
    assert.fieldEquals(
      "RoleProviderMember",
      PROVIDER.toHexString().concat("-").concat(MEMBER_B.toHexString()),
      "isMember",
      "true"
    );
    assert.entityCount("RoleProviderAdministratorChange", 2);
    assert.entityCount("RoleProviderMembershipChange", 3);
  });
});
