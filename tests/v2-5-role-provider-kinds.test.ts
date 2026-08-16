import { assert, clearStore, describe, test } from "matchstick-as/assembly";
import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import {
  AdministratorTransferRequested,
  AdministratorTransferred,
  RootUpdated
} from "../generated/templates/MerkleRoleProvider/MerkleRoleProvider";
import {
  handleERC1155RoleProviderDeployed,
  handleERC20RoleProviderDeployed,
  handleERC4626AssetsRoleProviderDeployed,
  handleERC721RoleProviderDeployed,
  handleMerkleRoleProviderDeployed
} from "../src/role-provider-factories";
import {
  handleAdministratorTransferRequested,
  handleAdministratorTransferred,
  handleRootUpdated
} from "../src/merkle-role-provider";
import { createV25Event, pushAddress, pushBigInt } from "./v2-5-test-utils";

const DEPLOYER = Address.fromString(
  "0x000000000000000000000000000000000000d001"
);
const ADMINISTRATOR = Address.fromString(
  "0x000000000000000000000000000000000000d002"
);
const NEW_ADMINISTRATOR = Address.fromString(
  "0x000000000000000000000000000000000000d003"
);
const TOKEN = Address.fromString("0x000000000000000000000000000000000000d004");
const VAULT = Address.fromString("0x000000000000000000000000000000000000d005");

function address(suffix: i32): Address {
  return Address.fromString(
    "0x000000000000000000000000000000000000d".concat(
      suffix.toString().padStart(3, "0")
    )
  );
}

function bytes32(suffix: i32): Bytes {
  return Bytes.fromHexString(
    "0x0000000000000000000000000000000000000000000000000000000000000".concat(
      suffix.toString().padStart(3, "0")
    )
  );
}

function pushBytes(event: ethereum.Event, name: string, value: Bytes): void {
  event.parameters.push(
    new ethereum.EventParam(name, ethereum.Value.fromFixedBytes(value))
  );
}

function pushBoolean(
  event: ethereum.Event,
  name: string,
  value: boolean
): void {
  event.parameters.push(
    new ethereum.EventParam(name, ethereum.Value.fromBoolean(value))
  );
}

function createFactoryEvent(
  factory: Address,
  provider: Address,
  configurationAddress: Address,
  logIndex: i32
): ethereum.Event {
  let event = createV25Event(factory, logIndex);
  pushAddress(event, "provider", provider);
  pushAddress(event, "configurationAddress", configurationAddress);
  pushAddress(event, "deployer", DEPLOYER);
  pushBytes(event, "salt", bytes32(logIndex));
  return event;
}

describe("v2.5 typed role-provider provenance", () => {
  test("indexes every factory-backed provider configuration", () => {
    clearStore();

    let merkleFactory = address(101);
    let merkleProvider = address(102);
    let initialRoot = bytes32(1);
    let merkle = createFactoryEvent(
      merkleFactory,
      merkleProvider,
      ADMINISTRATOR,
      1
    );
    pushBytes(merkle, "root", initialRoot);
    handleMerkleRoleProviderDeployed(merkle);

    let erc20Factory = address(103);
    let erc20Provider = address(104);
    let erc20 = createFactoryEvent(erc20Factory, erc20Provider, TOKEN, 2);
    pushBigInt(erc20, "minBalance", BigInt.fromI32(1_000));
    handleERC20RoleProviderDeployed(erc20);

    let erc4626Factory = address(105);
    let erc4626Provider = address(106);
    let erc4626 = createFactoryEvent(erc4626Factory, erc4626Provider, VAULT, 3);
    pushBigInt(erc4626, "minAssets", BigInt.fromI32(2_000));
    handleERC4626AssetsRoleProviderDeployed(erc4626);

    let erc721Factory = address(107);
    let erc721Provider = address(108);
    let erc721 = createFactoryEvent(erc721Factory, erc721Provider, TOKEN, 4);
    pushBoolean(erc721, "skipInterfaceCheck", true);
    handleERC721RoleProviderDeployed(erc721);

    let erc1155Factory = address(109);
    let erc1155Provider = address(110);
    let erc1155 = createFactoryEvent(erc1155Factory, erc1155Provider, TOKEN, 5);
    pushBigInt(erc1155, "tokenId", BigInt.fromI32(42));
    pushBoolean(erc1155, "skipInterfaceCheck", false);
    handleERC1155RoleProviderDeployed(erc1155);

    assert.fieldEquals(
      "RoleProviderInstance",
      merkleProvider.toHexString(),
      "kind",
      "MERKLE"
    );
    assert.fieldEquals(
      "RoleProviderInstance",
      merkleProvider.toHexString(),
      "administrator",
      ADMINISTRATOR.toHexString()
    );
    assert.fieldEquals(
      "RoleProviderInstance",
      merkleProvider.toHexString(),
      "root",
      initialRoot.toHexString()
    );
    assert.fieldEquals(
      "RoleProviderInstance",
      erc20Provider.toHexString(),
      "minBalance",
      "1000"
    );
    assert.fieldEquals(
      "RoleProviderInstance",
      erc4626Provider.toHexString(),
      "vault",
      VAULT.toHexString()
    );
    assert.fieldEquals(
      "RoleProviderInstance",
      erc721Provider.toHexString(),
      "skipInterfaceCheck",
      "true"
    );
    assert.fieldEquals(
      "RoleProviderInstance",
      erc1155Provider.toHexString(),
      "tokenId",
      "42"
    );
    assert.fieldEquals(
      "RoleProviderInstance",
      erc1155Provider.toHexString(),
      "deploymentFactory",
      erc1155Factory.toHexString()
    );
    assert.fieldEquals(
      "RoleProviderFactory",
      erc1155Factory.toHexString(),
      "kind",
      "ERC1155"
    );
    assert.entityCount("RoleProviderFactory", 5);
  });

  test("indexes Merkle administration and root history", () => {
    clearStore();

    let factory = address(111);
    let provider = address(112);
    let initialRoot = bytes32(10);
    let deployed = createFactoryEvent(factory, provider, ADMINISTRATOR, 10);
    pushBytes(deployed, "root", initialRoot);
    handleMerkleRoleProviderDeployed(deployed);

    let requested = changetype<AdministratorTransferRequested>(
      createV25Event(provider, 11)
    );
    pushAddress(requested, "administrator", ADMINISTRATOR);
    pushAddress(requested, "previousPendingAdministrator", Address.zero());
    pushAddress(requested, "pendingAdministrator", NEW_ADMINISTRATOR);
    handleAdministratorTransferRequested(requested);

    let transferred = changetype<AdministratorTransferred>(
      createV25Event(provider, 12)
    );
    pushAddress(transferred, "previousAdministrator", ADMINISTRATOR);
    pushAddress(transferred, "newAdministrator", NEW_ADMINISTRATOR);
    handleAdministratorTransferred(transferred);

    let newRoot = bytes32(11);
    let updated = changetype<RootUpdated>(createV25Event(provider, 13));
    pushAddress(updated, "administrator", NEW_ADMINISTRATOR);
    pushBytes(updated, "previousRoot", initialRoot);
    pushBytes(updated, "newRoot", newRoot);
    handleRootUpdated(updated);

    assert.fieldEquals(
      "RoleProviderInstance",
      provider.toHexString(),
      "administrator",
      NEW_ADMINISTRATOR.toHexString()
    );
    assert.fieldEquals(
      "RoleProviderInstance",
      provider.toHexString(),
      "root",
      newRoot.toHexString()
    );
    assert.entityCount("RoleProviderAdministratorChange", 2);
    assert.entityCount("RoleProviderRootChange", 1);
  });
});
