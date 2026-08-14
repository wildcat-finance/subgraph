import { Address, BigInt } from "@graphprotocol/graph-ts";
import { HooksFactory as HooksFactoryContract } from "../generated/HooksFactory/HooksFactory";
import {
  ArchController,
  FactoryRegistration,
  HooksFactory,
} from "../generated/schema";
import { getConfiguredHooksFactory } from "./factory-context";

export function generateFactoryRegistrationId(
  archController: Address,
  factory: Address
): string {
  return archController.toHexString() + "-" + factory.toHexString();
}

function normalizeMarketKind(fallbackMarketType: string): string {
  if (fallbackMarketType == "Revolving") {
    return "REVOLVING";
  }
  if (fallbackMarketType == "REVOLVING") {
    return "REVOLVING";
  }
  if (fallbackMarketType == "Legacy") {
    return "STANDARD";
  }
  if (fallbackMarketType == "STANDARD") {
    return "STANDARD";
  }
  return "UNKNOWN";
}

function ensureArchController(address: Address): ArchController {
  let id = address.toHexString();
  let archController = ArchController.load(id);
  if (archController == null) {
    archController = new ArchController(id);
    archController.save();
  }
  return archController;
}

export function getOrCreateHooksFactory(
  address: Address,
  fallbackMarketType: string,
  fallbackArchController: string = ""
): HooksFactory {
  let configured = getConfiguredHooksFactory(address);
  let id = address.toHexString();
  let factory = HooksFactory.load(id);

  let archControllerAddress = Address.zero();
  if (configured != null) {
    archControllerAddress = configured.archController;
  } else if (fallbackArchController.length > 0) {
    archControllerAddress = Address.fromString(fallbackArchController);
  } else if (factory != null) {
    archControllerAddress = Address.fromString(factory.archController);
  } else {
    let archControllerResult = HooksFactoryContract.bind(
      address
    ).try_archController();
    if (!archControllerResult.reverted) {
      archControllerAddress = archControllerResult.value;
    }
  }
  ensureArchController(archControllerAddress);

  if (factory == null) {
    let sentinelResult = HooksFactoryContract.bind(
      address
    ).try_sanctionsSentinel();
    factory = new HooksFactory(id);
    factory.address = address;
    factory.label = "UNKNOWN";
    factory.marketKind = normalizeMarketKind(fallbackMarketType);
    factory.generation = "UNKNOWN";
    factory.abiFamily = "UNKNOWN";
    factory.eventGeneration = "LEGACY";
    factory.hookedMarketAbi = "UNKNOWN";
    factory.configuredStartBlock = BigInt.zero();
    factory.indexed = false;
    factory.deploymentTarget = false;
    factory.lifecycle = "UNKNOWN";
    factory.configured = false;
    factory.archController = archControllerAddress.toHexString();
    factory.sentinel = Address.zero();
    if (!sentinelResult.reverted) {
      factory.sentinel = sentinelResult.value;
    }
    factory.isRegistered = false;
    factory.eventIndex = 0;
  }
  if (configured != null) {
    // Checked-in configuration owns generation and deployment eligibility.
    // ArchController events own observed registration state.
    factory.marketKind = configured.marketKind;
    factory.label = configured.label;
    factory.generation = configured.generation;
    factory.abiFamily = configured.abiFamily;
    factory.eventGeneration = configured.eventGeneration;
    factory.hookedMarketAbi = configured.hookedMarketAbi;
    factory.configuredStartBlock = configured.startBlock;
    factory.indexed = configured.indexed;
    factory.deploymentTarget = configured.deploymentTarget;
    factory.lifecycle = configured.lifecycle;
    factory.configured = true;
    factory.archController = configured.archController.toHexString();
  }

  let registration = FactoryRegistration.load(
    generateFactoryRegistrationId(archControllerAddress, address)
  );
  if (registration != null) {
    factory.isRegistered = registration.isRegistered;
    factory.registrationUpdatedAtBlock = registration.updatedAtBlock;
    factory.registrationUpdatedAtTimestamp = registration.updatedAtTimestamp;
  }
  factory.save();
  return factory;
}
