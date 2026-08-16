import {
  AdministratorTransferCancelled,
  AdministratorTransferRequested,
  AdministratorTransferred,
  RootUpdated
} from "../generated/templates/MerkleRoleProvider/MerkleRoleProvider";
import { RoleProviderRootChange } from "../generated/schema";
import {
  recordAdministratorTransferCancelled,
  recordAdministratorTransferRequested,
  recordAdministratorTransferred
} from "./managed-role-provider-domain";
import { getOrCreateRoleProviderInstance } from "./role-provider-domain";
import { generateEventId } from "./utils";

export function handleAdministratorTransferRequested(
  event: AdministratorTransferRequested
): void {
  recordAdministratorTransferRequested(
    event,
    event.params.administrator,
    event.params.previousPendingAdministrator,
    event.params.pendingAdministrator
  );
}

export function handleAdministratorTransferCancelled(
  event: AdministratorTransferCancelled
): void {
  recordAdministratorTransferCancelled(
    event,
    event.params.administrator,
    event.params.cancelledPendingAdministrator
  );
}

export function handleAdministratorTransferred(
  event: AdministratorTransferred
): void {
  recordAdministratorTransferred(
    event,
    event.params.previousAdministrator,
    event.params.newAdministrator
  );
}

export function handleRootUpdated(event: RootUpdated): void {
  let provider = getOrCreateRoleProviderInstance(event.address);
  provider.root = event.params.newRoot;
  provider.save();

  let change = new RoleProviderRootChange(generateEventId(event));
  change.provider = provider.id;
  change.administrator = event.params.administrator;
  change.previousRoot = event.params.previousRoot;
  change.newRoot = event.params.newRoot;
  change.blockNumber = event.block.number;
  change.blockTimestamp = event.block.timestamp;
  change.transactionHash = event.transaction.hash;
  change.blockLogIndex = event.logIndex;
  change.save();
}
