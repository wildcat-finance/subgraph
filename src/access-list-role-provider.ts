import {
  AdministratorTransferCancelled,
  AdministratorTransferRequested,
  AdministratorTransferred,
  MemberAdded,
  MemberRemoved
} from "../generated/templates/AccessListRoleProvider/AccessListRoleProvider";
import {
  getOrCreateRoleProviderInstance,
  setRoleProviderMember
} from "./role-provider-domain";
import {
  recordAdministratorTransferCancelled,
  recordAdministratorTransferRequested,
  recordAdministratorTransferred
} from "./managed-role-provider-domain";

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
