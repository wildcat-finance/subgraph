import {
  AdministratorTransferCancelled,
  AdministratorTransferRequested,
  AdministratorTransferred,
  MemberAdded,
  MemberRemoved,
} from "../generated/templates/AccessListRoleProvider/AccessListRoleProvider";
import { RoleProviderAdministratorChange } from "../generated/schema";
import {
  getOrCreateRoleProviderInstance,
  setRoleProviderMember,
} from "./role-provider-domain";
import { generateEventId } from "./utils";

export function handleAdministratorTransferRequested(
  event: AdministratorTransferRequested
): void {
  let provider = getOrCreateRoleProviderInstance(event.address);
  let change = new RoleProviderAdministratorChange(generateEventId(event));
  change.provider = provider.id;
  change.kind = "TRANSFER_REQUESTED";
  change.administrator = event.params.administrator;
  change.previousPendingAdministrator =
    event.params.previousPendingAdministrator;
  change.pendingAdministrator = event.params.pendingAdministrator;
  change.blockNumber = event.block.number;
  change.blockTimestamp = event.block.timestamp;
  change.transactionHash = event.transaction.hash;
  change.blockLogIndex = event.logIndex;
  change.save();
  provider.pendingAdministrator = event.params.pendingAdministrator;
  provider.save();
}

export function handleAdministratorTransferCancelled(
  event: AdministratorTransferCancelled
): void {
  let provider = getOrCreateRoleProviderInstance(event.address);
  let change = new RoleProviderAdministratorChange(generateEventId(event));
  change.provider = provider.id;
  change.kind = "TRANSFER_CANCELLED";
  change.administrator = event.params.administrator;
  change.cancelledPendingAdministrator =
    event.params.cancelledPendingAdministrator;
  change.blockNumber = event.block.number;
  change.blockTimestamp = event.block.timestamp;
  change.transactionHash = event.transaction.hash;
  change.blockLogIndex = event.logIndex;
  change.save();
  provider.unset("pendingAdministrator");
  provider.save();
}

export function handleAdministratorTransferred(
  event: AdministratorTransferred
): void {
  let provider = getOrCreateRoleProviderInstance(event.address);
  let change = new RoleProviderAdministratorChange(generateEventId(event));
  change.provider = provider.id;
  change.kind = "TRANSFERRED";
  change.previousAdministrator = event.params.previousAdministrator;
  change.newAdministrator = event.params.newAdministrator;
  change.blockNumber = event.block.number;
  change.blockTimestamp = event.block.timestamp;
  change.transactionHash = event.transaction.hash;
  change.blockLogIndex = event.logIndex;
  change.save();
  provider.administrator = event.params.newAdministrator;
  provider.unset("pendingAdministrator");
  provider.save();
}

export function handleMemberAdded(event: MemberAdded): void {
  let provider = getOrCreateRoleProviderInstance(event.address);
  setRoleProviderMember(
    event,
    provider,
    event.params.account,
    event.params.administrator,
    true
  );
}

export function handleMemberRemoved(event: MemberRemoved): void {
  let provider = getOrCreateRoleProviderInstance(event.address);
  setRoleProviderMember(
    event,
    provider,
    event.params.account,
    event.params.administrator,
    false
  );
}
