import { Address, Bytes, ethereum } from "@graphprotocol/graph-ts";
import {
  RoleProviderInstance,
  RoleProviderMember,
  RoleProviderMembershipChange,
} from "../generated/schema";
import { generateEventId } from "./utils";

export function getOrCreateRoleProviderInstance(
  address: Bytes
): RoleProviderInstance {
  let id = address.toHexString();
  let provider = RoleProviderInstance.load(id);
  if (provider == null) {
    provider = new RoleProviderInstance(id);
    provider.address = address;
    provider.kind = "UNKNOWN";
    provider.save();
  }
  return provider;
}

export function setRoleProviderMember(
  event: ethereum.Event,
  provider: RoleProviderInstance,
  account: Address,
  administrator: Address,
  isMember: boolean,
  changeId: string = ""
): void {
  let id = provider.id.concat("-").concat(account.toHexString());
  let member = RoleProviderMember.load(id);
  if (member == null) {
    member = new RoleProviderMember(id);
    member.provider = provider.id;
    member.account = account;
  }
  member.isMember = isMember;
  member.updatedAtBlock = event.block.number;
  member.updatedAtTimestamp = event.block.timestamp;
  member.updatedAtTransaction = event.transaction.hash;
  member.updatedAtLogIndex = event.logIndex;
  member.save();

  let change = new RoleProviderMembershipChange(
    changeId.length == 0 ? generateEventId(event) : changeId
  );
  change.provider = provider.id;
  change.member = member.id;
  change.account = account;
  change.administrator = administrator;
  change.kind = isMember ? "ADDED" : "REMOVED";
  change.blockNumber = event.block.number;
  change.blockTimestamp = event.block.timestamp;
  change.transactionHash = event.transaction.hash;
  change.blockLogIndex = event.logIndex;
  change.save();
}
