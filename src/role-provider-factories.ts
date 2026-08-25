import { Address, Bytes, ethereum } from "@graphprotocol/graph-ts";
import { MerkleRoleProvider as MerkleRoleProviderTemplate } from "../generated/templates";
import { RoleProviderInstance } from "../generated/schema";
import { recordRoleProviderDeployment } from "./role-provider-factory-domain";

function addressParam(event: ethereum.Event, index: i32): Address {
  return event.parameters[index].value.toAddress();
}

function bytesParam(event: ethereum.Event, index: i32): Bytes {
  return event.parameters[index].value.toBytes();
}

function recordDeployment(
  event: ethereum.Event,
  kind: string
): RoleProviderInstance {
  return recordRoleProviderDeployment(
    event,
    kind,
    addressParam(event, 0),
    addressParam(event, 2),
    bytesParam(event, 3)
  );
}

export function handleMerkleRoleProviderDeployed(event: ethereum.Event): void {
  let provider = recordDeployment(event, "MERKLE");
  provider.administrator = addressParam(event, 1);
  provider.root = bytesParam(event, 4);
  provider.save();
  MerkleRoleProviderTemplate.create(addressParam(event, 0));
}

export function handleERC20RoleProviderDeployed(event: ethereum.Event): void {
  let provider = recordDeployment(event, "ERC20");
  provider.token = addressParam(event, 1);
  provider.minBalance = event.parameters[4].value.toBigInt();
  provider.save();
}

export function handleERC4626AssetsRoleProviderDeployed(
  event: ethereum.Event
): void {
  let provider = recordDeployment(event, "ERC4626_ASSETS");
  provider.vault = addressParam(event, 1);
  provider.minAssets = event.parameters[4].value.toBigInt();
  provider.save();
}

export function handleERC721RoleProviderDeployed(event: ethereum.Event): void {
  let provider = recordDeployment(event, "ERC721");
  provider.token = addressParam(event, 1);
  provider.skipInterfaceCheck = event.parameters[4].value.toBoolean();
  provider.save();
}

export function handleERC1155RoleProviderDeployed(event: ethereum.Event): void {
  let provider = recordDeployment(event, "ERC1155");
  provider.token = addressParam(event, 1);
  provider.tokenId = event.parameters[4].value.toBigInt();
  provider.skipInterfaceCheck = event.parameters[5].value.toBoolean();
  provider.save();
}
