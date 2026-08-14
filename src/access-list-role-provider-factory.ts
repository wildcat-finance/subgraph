import { Address, ethereum } from "@graphprotocol/graph-ts";
import { AccessListRoleProvider as AccessListRoleProviderTemplate } from "../generated/templates";
import { AccessListRoleProviderFactory } from "../generated/schema";
import {
  getOrCreateRoleProviderInstance,
  setRoleProviderMember,
} from "./role-provider-domain";
import { generateEventId } from "./utils";

export function handleAccessListRoleProviderDeployed(
  event: ethereum.Event
): void {
  let providerAddress = event.parameters[0].value.toAddress();
  let administrator = event.parameters[1].value.toAddress();
  let deployer = event.parameters[2].value.toAddress();
  let salt = event.parameters[3].value.toBytes();
  let initialMembers = event.parameters[4].value.toAddressArray();

  let factoryId = event.address.toHexString();
  let factory = AccessListRoleProviderFactory.load(factoryId);
  if (factory == null) {
    factory = new AccessListRoleProviderFactory(factoryId);
    factory.address = event.address;
    factory.eventIndex = 0;
  }

  let provider = getOrCreateRoleProviderInstance(providerAddress);
  provider.kind = "ACCESS_LIST";
  provider.administrator = administrator;
  provider.deployer = deployer;
  provider.deploymentFactory = factory.id;
  provider.salt = salt;
  provider.deployedAtBlock = event.block.number;
  provider.deployedAtTimestamp = event.block.timestamp;
  provider.deployedAtTransaction = event.transaction.hash;
  provider.deployedAtLogIndex = event.logIndex;
  provider.save();

  let eventId = generateEventId(event);
  for (let i = 0; i < initialMembers.length; i++) {
    setRoleProviderMember(
      event,
      provider,
      initialMembers[i],
      administrator,
      true,
      eventId.concat("-initial-").concat(i.toString())
    );
  }

  factory.eventIndex = factory.eventIndex + 1;
  factory.save();
  AccessListRoleProviderTemplate.create(providerAddress);
}
