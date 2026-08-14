import { Address, ethereum } from "@graphprotocol/graph-ts";
import {
  RoleProviderAdministratorChange,
  RoleProviderInstance
} from "../generated/schema";
import { getOrCreateRoleProviderInstance } from "./role-provider-domain";
import { generateEventId } from "./utils";

function createAdministratorChange(
  event: ethereum.Event,
  provider: RoleProviderInstance,
  kind: string
): RoleProviderAdministratorChange {
  let change = new RoleProviderAdministratorChange(generateEventId(event));
  change.provider = provider.id;
  change.kind = kind;
  change.blockNumber = event.block.number;
  change.blockTimestamp = event.block.timestamp;
  change.transactionHash = event.transaction.hash;
  change.blockLogIndex = event.logIndex;
  return change;
}

export function recordAdministratorTransferRequested(
  event: ethereum.Event,
  administrator: Address,
  previousPendingAdministrator: Address,
  pendingAdministrator: Address
): void {
  let provider = getOrCreateRoleProviderInstance(event.address);
  let change = createAdministratorChange(event, provider, "TRANSFER_REQUESTED");
  change.administrator = administrator;
  change.previousPendingAdministrator = previousPendingAdministrator;
  change.pendingAdministrator = pendingAdministrator;
  change.save();
  provider.pendingAdministrator = pendingAdministrator;
  provider.save();
}

export function recordAdministratorTransferCancelled(
  event: ethereum.Event,
  administrator: Address,
  cancelledPendingAdministrator: Address
): void {
  let provider = getOrCreateRoleProviderInstance(event.address);
  let change = createAdministratorChange(event, provider, "TRANSFER_CANCELLED");
  change.administrator = administrator;
  change.cancelledPendingAdministrator = cancelledPendingAdministrator;
  change.save();
  provider.unset("pendingAdministrator");
  provider.save();
}

export function recordAdministratorTransferred(
  event: ethereum.Event,
  previousAdministrator: Address,
  newAdministrator: Address
): void {
  let provider = getOrCreateRoleProviderInstance(event.address);
  let change = createAdministratorChange(event, provider, "TRANSFERRED");
  change.previousAdministrator = previousAdministrator;
  change.newAdministrator = newAdministrator;
  change.save();
  provider.administrator = newAdministrator;
  provider.unset("pendingAdministrator");
  provider.save();
}
