import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import { RoleProviderFactory, RoleProviderInstance } from "../generated/schema";
import {
  ConfiguredOptionalModuleFactory,
  getConfiguredOptionalModuleFactory
} from "./optional-module-context";
import { getOrCreateRoleProviderInstance } from "./role-provider-domain";

function getOrCreateRoleProviderFactory(
  event: ethereum.Event,
  kind: string
): RoleProviderFactory {
  let id = event.address.toHexString();
  let factory = RoleProviderFactory.load(id);
  if (factory == null) {
    factory = new RoleProviderFactory(id);
    factory.address = event.address;
    factory.label = "UNKNOWN";
    factory.generation = "UNKNOWN";
    factory.configuredStartBlock = BigInt.zero();
    factory.indexed = false;
    factory.lifecycle = "UNKNOWN";
    factory.configured = false;
    factory.eventIndex = 0;
  }

  factory.kind = kind;
  let configured = getConfiguredOptionalModuleFactory();
  if (configured != null) {
    let settings = configured as ConfiguredOptionalModuleFactory;
    factory.label = settings.label;
    factory.generation = settings.generation;
    factory.configuredStartBlock = settings.startBlock;
    factory.indexed = settings.indexed;
    factory.lifecycle = settings.lifecycle;
    factory.configured = true;
  }
  return factory;
}

export function recordRoleProviderDeployment(
  event: ethereum.Event,
  kind: string,
  providerAddress: Address,
  deployer: Address,
  salt: Bytes
): RoleProviderInstance {
  let factory = getOrCreateRoleProviderFactory(event, kind);
  let provider = getOrCreateRoleProviderInstance(providerAddress);
  provider.kind = kind;
  provider.deployer = deployer;
  provider.deploymentFactory = factory.id;
  provider.salt = salt;
  provider.deployedAtBlock = event.block.number;
  provider.deployedAtTimestamp = event.block.timestamp;
  provider.deployedAtTransaction = event.transaction.hash;
  provider.deployedAtLogIndex = event.logIndex;
  provider.save();

  factory.eventIndex = factory.eventIndex + 1;
  factory.save();
  return provider;
}
