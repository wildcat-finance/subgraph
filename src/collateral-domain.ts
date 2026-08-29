import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import {
  SimpleCollateralContract,
  SimpleCollateralContractDepositor,
  SimpleCollateralContractSnapshot,
  SimpleCollateralFactory,
} from "../generated/schema";
import {
  ConfiguredOptionalModuleFactory,
  getConfiguredOptionalModuleFactory,
} from "./optional-module-context";
import { recordIndexerDiagnostic } from "./indexer-diagnostics";
import { ensureIndexerDeployment } from "./deployment-context";

export function generateFactoryAccountId(
  factory: Address,
  account: Address
): string {
  return factory.toHexString() + "-" + account.toHexString();
}

export function generateCollateralDepositorId(
  collateralContract: Address,
  account: Address
): string {
  return collateralContract.toHexString() + "-" + account.toHexString();
}

export function getOrCreateCollateralFactory(
  event: ethereum.Event
): SimpleCollateralFactory {
  ensureIndexerDeployment(event);
  let id = event.address.toHexString();
  let factory = SimpleCollateralFactory.load(id);
  if (factory == null) {
    factory = new SimpleCollateralFactory(id);
    factory.address = event.address;
    factory.label = "UNKNOWN";
    factory.generation = "UNKNOWN";
    factory.configuredStartBlock = BigInt.zero();
    factory.indexed = false;
    factory.lifecycle = "UNKNOWN";
    factory.configured = false;
  }

  let configured = getConfiguredOptionalModuleFactory();
  if (configured != null) {
    let settings = configured as ConfiguredOptionalModuleFactory;
    factory.label = settings.label;
    factory.generation = settings.generation;
    factory.configuredStartBlock = settings.startBlock;
    factory.indexed = settings.indexed;
    factory.lifecycle = settings.lifecycle;
    factory.configured = true;
  } else if (!factory.configured) {
    recordIndexerDiagnostic(
      event,
      "MISSING_OPTIONAL_MODULE_CONFIG",
      "Collateral factory event was indexed without generated factory context",
      event.address
    );
  }
  factory.save();
  return factory;
}

export function loadCollateralContract(
  event: ethereum.Event
): SimpleCollateralContract | null {
  let collateral = SimpleCollateralContract.load(event.address.toHexString());
  if (collateral == null) {
    recordIndexerDiagnostic(
      event,
      "MISSING_COLLATERAL_CONTRACT",
      "Collateral event was observed without a discovered collateral contract",
      event.address
    );
    return null;
  }
  return collateral as SimpleCollateralContract;
}

export function getOrCreateCollateralDepositor(
  event: ethereum.Event,
  collateral: SimpleCollateralContract,
  account: Address
): SimpleCollateralContractDepositor {
  let id = generateCollateralDepositorId(event.address, account);
  let depositor = SimpleCollateralContractDepositor.load(id);
  if (depositor == null) {
    depositor = new SimpleCollateralContractDepositor(id);
    depositor.collateralContract = collateral.id;
    depositor.address = account;
    depositor.shares = BigInt.zero();
    depositor.totalDeposited = BigInt.zero();
    depositor.totalReclaimed = BigInt.zero();
  }
  return depositor as SimpleCollateralContractDepositor;
}

export function saveCollateralDepositor(
  event: ethereum.Event,
  depositor: SimpleCollateralContractDepositor
): void {
  depositor.updatedAtBlock = event.block.number;
  depositor.updatedAtTimestamp = event.block.timestamp;
  depositor.updatedAtTransaction = event.transaction.hash;
  depositor.updatedAtLogIndex = event.logIndex;
  depositor.save();
}

export function saveCollateralSnapshot(
  event: ethereum.Event,
  collateral: SimpleCollateralContract,
  source: string = "EVENT_PROJECTION"
): SimpleCollateralContractSnapshot {
  let snapshot = SimpleCollateralContractSnapshot.load(collateral.id);
  if (snapshot == null) {
    snapshot = new SimpleCollateralContractSnapshot(collateral.id);
    snapshot.collateralContract = collateral.id;
  }
  snapshot.source = source;
  snapshot.totalDeposited = collateral.totalDeposited;
  snapshot.totalReclaimed = collateral.totalReclaimed;
  snapshot.totalLiquidated = collateral.totalLiquidated;
  snapshot.totalShares = collateral.totalShares;
  snapshot.availableCollateral = collateral.availableCollateral;
  snapshot.lastFullLiquidationIndex = collateral.lastFullLiquidationIndex;
  snapshot.depositIndex = collateral.depositIndex;
  let cooldown = collateral.get("liquidationCooldown");
  if (cooldown == null) {
    snapshot.unset("liquidationCooldown");
  } else {
    snapshot.liquidationCooldown = cooldown.toI32();
  }
  snapshot.nextLiquidationTrigger = collateral.nextLiquidationTrigger;
  snapshot.eventIndex = collateral.eventIndex;
  snapshot.updatedAtBlock = event.block.number;
  snapshot.updatedAtTimestamp = event.block.timestamp;
  snapshot.updatedAtTransaction = event.transaction.hash;
  snapshot.updatedAtLogIndex = event.logIndex;
  snapshot.save();
  return snapshot as SimpleCollateralContractSnapshot;
}
