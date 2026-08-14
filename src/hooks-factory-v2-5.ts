import {
  Address,
  BigDecimal,
  BigInt,
  Bytes,
  ethereum,
  store,
} from "@graphprotocol/graph-ts";
import {
  createHooksConfig,
  createHooksInstance,
  createHooksInstanceDeployed,
  createMarket,
  generateHooksConfigId,
  generateHooksInstanceDeployedId,
  generateHooksInstanceId,
  generateMarketId,
} from "../generated/UncrashableEntityHelpers";
import {
  BorrowerIdentityRegistry,
  BorrowerAccount,
  HooksInstance,
  HooksInstanceRoleProviderSnapshot,
  HooksTemplateRegistration,
  HooksTemplateRegistrationEvent,
  MarketDeployed,
  MarketDeploymentConfig,
  MarketHooksData,
  PendingMarketDeployment,
  RevolvingMarketDeployment,
} from "../generated/schema";
import {
  CombinedHooksV2_5 as CombinedHooksTemplate,
  WildcatMarketV2_5 as MarketTemplate,
} from "../generated/templates";
import {
  createTokenIfNotExists,
  decodeAndCreateRoleProvider,
  getOrCreateTokenId,
  handleHooksTemplateAddedForMarketType,
  handleHooksTemplateDisabledForMarketType,
  handleHooksTemplateFeesUpdatedForMarketType,
} from "./hooks-factory";
import { getOrCreateBorrower } from "./borrower-domain";
import { generateBorrowerAccountId } from "./borrower-identity-domain";
import { recordMarketCreated } from "./daily-stats";
import {
  CONTEXT_HOOKS_KIND,
  CONTEXT_HOOKS_TEMPLATE,
  CONTEXT_TEMPLATE_REGISTRATION,
  createFactoryChildContext,
} from "./factory-context";
import { getOrCreateHooksFactory } from "./factory-domain";
import {
  generateHooksTemplateRegistrationId,
  getOrCreateHooksTemplate,
} from "./hooks-template-domain";
import { recordIndexerDiagnostic } from "./indexer-diagnostics";
import { createInitialMarketSnapshot } from "./market-domain";
import { recordMarketEventAt } from "./market-event-domain";
import { generateEventId, isNullAddress } from "./utils";

function addressParam(event: ethereum.Event, index: i32): Address {
  return event.parameters[index].value.toAddress();
}

function bigIntParam(event: ethereum.Event, index: i32): BigInt {
  return event.parameters[index].value.toBigInt();
}

function stringParam(event: ethereum.Event, index: i32): string {
  return event.parameters[index].value.toString();
}

function marketType(event: ethereum.Event): string {
  let factory = getOrCreateHooksFactory(event.address, "Legacy");
  return factory.marketKind == "REVOLVING" ? "Revolving" : "Legacy";
}

function getOrCreateBorrowerIdentityRegistry(
  address: Address,
  archController: string
): BorrowerIdentityRegistry {
  let id = address.toHexString();
  let registry = BorrowerIdentityRegistry.load(id);
  if (registry == null) {
    registry = new BorrowerIdentityRegistry(id);
    registry.address = address;
    registry.archController = archController;
    registry.eventIndex = 0;
    registry.save();
  }
  return registry;
}

export function handleChangedSpherexEngineAddress(
  event: ethereum.Event
): void {}

export function handleChangedSpherexOperator(event: ethereum.Event): void {}

export function handleHooksTemplateAdded(event: ethereum.Event): void {
  handleHooksTemplateAddedForMarketType(
    event,
    addressParam(event, 0),
    stringParam(event, 2),
    addressParam(event, 3),
    addressParam(event, 4),
    bigIntParam(event, 5),
    bigIntParam(event, 6).toI32(),
    marketType(event)
  );
  let record = HooksTemplateRegistrationEvent.load(generateEventId(event));
  if (record != null) {
    record.caller = addressParam(event, 1);
    record.save();
  }
}

export function handleHooksTemplateDisabled(event: ethereum.Event): void {
  handleHooksTemplateDisabledForMarketType(
    event,
    addressParam(event, 0),
    marketType(event)
  );
  let record = HooksTemplateRegistrationEvent.load(generateEventId(event));
  if (record != null) {
    record.caller = addressParam(event, 1);
    record.save();
  }
}

export function handleHooksTemplateFeesUpdated(event: ethereum.Event): void {
  handleHooksTemplateFeesUpdatedForMarketType(
    event,
    addressParam(event, 0),
    addressParam(event, 3),
    addressParam(event, 5),
    bigIntParam(event, 7),
    bigIntParam(event, 9).toI32(),
    marketType(event)
  );
  let record = HooksTemplateRegistrationEvent.load(generateEventId(event));
  if (record != null) {
    record.caller = addressParam(event, 1);
    record.previousFeeRecipient = addressParam(event, 2);
    record.previousOriginationFeeAsset = getOrCreateTokenId(
      addressParam(event, 4),
      event.block.timestamp
    );
    record.previousOriginationFeeAmount = bigIntParam(event, 6);
    record.previousProtocolFeeBips = bigIntParam(event, 8);
    record.save();
  }
}

export function handleHooksInstanceDeployed(event: ethereum.Event): void {
  let factory = getOrCreateHooksFactory(event.address, marketType(event));
  let hooksAddress = addressParam(event, 0);
  let templateAddress = addressParam(event, 1);
  let administrator = addressParam(event, 2);
  let deployer = addressParam(event, 3);
  let name = stringParam(event, 4);
  let version = stringParam(event, 5);
  let registration = HooksTemplateRegistration.load(
    generateHooksTemplateRegistrationId(event.address, templateAddress)
  );
  if (registration == null) {
    recordIndexerDiagnostic(
      event,
      "MISSING_TEMPLATE_REGISTRATION",
      "Hooks instance deployment referenced a template that is not registered on this factory",
      templateAddress
    );
    return;
  }
  let template = getOrCreateHooksTemplate(
    event,
    templateAddress,
    factory.abiFamily,
    version
  );
  let hooksId = generateHooksInstanceId(hooksAddress);
  let hooks = createHooksInstance(hooksId, {
    address: hooksAddress,
    borrower: administrator,
    administrator: administrator,
    deployer: deployer,
    name: name,
    version: version,
    providerMetadataState: "UNKNOWN",
    hooksFactory: factory.id,
    hooksTemplate: template.id,
    templateRegistration: registration.id,
    kind: template.kind,
    marketKind: factory.marketKind,
    generation: factory.generation,
    abiFamily: factory.abiFamily,
    eventGeneration: "V2_5",
    deployedAtBlock: event.block.number,
    deployedAtTimestamp: event.block.timestamp,
    deployedAtTransaction: event.transaction.hash,
    deployedAtLogIndex: event.logIndex,
  });
  hooks.save();
  createHooksInstanceDeployed(
    generateHooksInstanceDeployedId(hooksAddress, factory.eventIndex),
    {
      hooks: hooks.id,
      hooksTemplate: template.id,
      templateRegistration: registration.id,
      administrator: administrator,
      deployer: deployer,
      name: name,
      version: version,
      blockNumber: event.block.number.toI32(),
      blockTimestamp: event.block.timestamp.toI32(),
      transactionHash: event.transaction.hash,
      blockLogIndex: event.logIndex.toI32(),
    }
  );
  factory.eventIndex = factory.eventIndex + 1;
  factory.save();

  let context = createFactoryChildContext(factory);
  context.setString(CONTEXT_TEMPLATE_REGISTRATION, registration.id);
  context.setString(CONTEXT_HOOKS_TEMPLATE, template.id);
  context.setString(CONTEXT_HOOKS_KIND, template.kind);
  CombinedHooksTemplate.createWithContext(hooksAddress, context);
}

export function handleHooksInstanceRoleProviders(
  event: ethereum.Event
): void {
  let hooksAddress = addressParam(event, 0);
  let hooks = HooksInstance.load(generateHooksInstanceId(hooksAddress));
  if (hooks == null) {
    return;
  }
  let metadataAvailable = event.parameters[1].value.toBoolean();
  let pullProviders = event.parameters[2].value.toBigIntArray();
  let pushProviders = event.parameters[3].value.toBigIntArray();
  hooks.providerMetadataState = metadataAvailable
    ? "AVAILABLE"
    : "UNAVAILABLE";
  if (metadataAvailable) {
    for (let i = 0; i < pullProviders.length; i++) {
      decodeAndCreateRoleProvider(hooksAddress, hooks.id, pullProviders[i]);
    }
    for (let i = 0; i < pushProviders.length; i++) {
      decodeAndCreateRoleProvider(hooksAddress, hooks.id, pushProviders[i]);
    }
  }
  hooks.save();

  let snapshot = new HooksInstanceRoleProviderSnapshot(generateEventId(event));
  snapshot.hooks = hooks.id;
  snapshot.metadataAvailable = metadataAvailable;
  snapshot.pullProviders = pullProviders;
  snapshot.pushProviders = pushProviders;
  snapshot.blockNumber = event.block.number;
  snapshot.blockTimestamp = event.block.timestamp;
  snapshot.transactionHash = event.transaction.hash;
  snapshot.blockLogIndex = event.logIndex;
  snapshot.save();
}

export function handleHooksInstanceAdministratorTransferred(
  event: ethereum.Event
): void {
  let hooks = HooksInstance.load(
    generateHooksInstanceId(addressParam(event, 0))
  );
  if (hooks == null) {
    return;
  }
  hooks.administrator = addressParam(event, 2);
  hooks.borrower = addressParam(event, 2);
  hooks.unset("pendingAdministrator");
  hooks.save();
}

export function handleMarketDeployed(event: ethereum.Event): void {
  let factory = getOrCreateHooksFactory(event.address, marketType(event));
  let templateAddress = addressParam(event, 0);
  let hooksAddress = addressParam(event, 1);
  let marketAddress = addressParam(event, 2);
  let borrowerIdentityRegistryAddress = addressParam(event, 5);
  let borrowerIdentityRegistry = getOrCreateBorrowerIdentityRegistry(
    borrowerIdentityRegistryAddress,
    factory.archController
  );
  let template = getOrCreateHooksTemplate(
    event,
    templateAddress,
    factory.abiFamily
  );
  let hooks = HooksInstance.load(generateHooksInstanceId(hooksAddress));
  if (hooks == null) {
    recordIndexerDiagnostic(
      event,
      "MISSING_TEMPLATE_REGISTRATION",
      "Market deployment referenced a hooks instance that was not indexed",
      hooksAddress
    );
    return;
  }

  let marketId = generateMarketId(marketAddress);
  let deployed = new MarketDeployed(generateEventId(event));
  deployed.market = marketId;
  deployed.hooksFactory = factory.id;
  deployed.hooksTemplate = template.id;
  deployed.hooks = hooks.id;
  deployed.borrower = addressParam(event, 3);
  deployed.borrowerPrincipal = addressParam(event, 4);
  deployed.borrowerIdentityRegistry = borrowerIdentityRegistry.id;
  deployed.borrowerIdentityRegistryAddress =
    borrowerIdentityRegistryAddress;
  deployed.name = stringParam(event, 6);
  deployed.symbol = stringParam(event, 7);
  deployed.assetAddress = addressParam(event, 8);
  deployed.requestedHooks = bigIntParam(event, 9);
  deployed.finalHooks = bigIntParam(event, 10);
  deployed.blockNumber = event.block.number.toI32();
  deployed.blockTimestamp = event.block.timestamp.toI32();
  deployed.transactionHash = event.transaction.hash;
  deployed.blockLogIndex = event.logIndex.toI32();
  deployed.save();

  let pending = new PendingMarketDeployment(marketId);
  pending.factory = factory.id;
  pending.hooksTemplate = template.id;
  pending.hooks = hooks.id;
  pending.borrower = addressParam(event, 3);
  pending.borrowerPrincipal = addressParam(event, 4);
  pending.borrowerIdentityRegistryAddress =
    borrowerIdentityRegistryAddress;
  pending.name = stringParam(event, 6);
  pending.symbol = stringParam(event, 7);
  pending.assetAddress = addressParam(event, 8);
  pending.requestedHooks = bigIntParam(event, 9);
  pending.finalHooks = bigIntParam(event, 10);
  pending.deployedEvent = deployed.id;
  pending.hasDeploymentConfig = false;
  pending.hasHooksData = false;
  pending.hasRevolvingConfig = false;
  pending.save();
}

export function handleMarketDeploymentConfig(event: ethereum.Event): void {
  let marketAddress = addressParam(event, 0);
  let marketId = generateMarketId(marketAddress);
  let pending = PendingMarketDeployment.load(marketId);
  if (pending == null) {
    return;
  }
  let originationFeeAssetAddress = addressParam(event, 9);
  let config = new MarketDeploymentConfig(generateEventId(event));
  config.market = marketId;
  config.maxTotalSupply = bigIntParam(event, 1);
  config.annualInterestBips = bigIntParam(event, 2);
  config.delinquencyFeeBips = bigIntParam(event, 3);
  config.withdrawalBatchDuration = bigIntParam(event, 4);
  config.reserveRatioBips = bigIntParam(event, 5);
  config.delinquencyGracePeriod = bigIntParam(event, 6);
  config.feeRecipient = addressParam(event, 7);
  config.protocolFeeBips = bigIntParam(event, 8);
  config.originationFeeAssetAddress = originationFeeAssetAddress;
  config.originationFeeAsset = getOrCreateTokenId(
    originationFeeAssetAddress,
    event.block.timestamp
  );
  config.originationFeeAmount = bigIntParam(event, 10);
  config.blockNumber = event.block.number;
  config.blockTimestamp = event.block.timestamp;
  config.transactionHash = event.transaction.hash;
  config.blockLogIndex = event.logIndex;
  config.save();

  pending.maxTotalSupply = config.maxTotalSupply;
  pending.annualInterestBips = config.annualInterestBips;
  pending.delinquencyFeeBips = config.delinquencyFeeBips;
  pending.withdrawalBatchDuration = config.withdrawalBatchDuration;
  pending.reserveRatioBips = config.reserveRatioBips;
  pending.delinquencyGracePeriod = config.delinquencyGracePeriod;
  pending.feeRecipient = config.feeRecipient;
  pending.protocolFeeBips = config.protocolFeeBips;
  pending.originationFeeAssetAddress = originationFeeAssetAddress;
  pending.originationFeeAmount = config.originationFeeAmount;
  pending.hasDeploymentConfig = true;
  pending.save();
  finalizeMarketDeployment(event, pending);
}

export function handleMarketHooksData(event: ethereum.Event): void {
  let marketAddress = addressParam(event, 0);
  let marketId = generateMarketId(marketAddress);
  let pending = PendingMarketDeployment.load(marketId);
  if (pending == null) {
    return;
  }
  let hooksData = event.parameters[1].value.toBytes();
  let record = new MarketHooksData(generateEventId(event));
  record.market = marketId;
  record.hooksData = hooksData;
  record.blockNumber = event.block.number;
  record.blockTimestamp = event.block.timestamp;
  record.transactionHash = event.transaction.hash;
  record.blockLogIndex = event.logIndex;
  record.save();
  pending.hooksData = hooksData;
  pending.hasHooksData = true;
  pending.save();
  finalizeMarketDeployment(event, pending);
}

export function handleRevolvingMarketDeployed(event: ethereum.Event): void {
  let marketAddress = addressParam(event, 0);
  let marketId = generateMarketId(marketAddress);
  let pending = PendingMarketDeployment.load(marketId);
  if (pending == null) {
    return;
  }
  let commitmentFeeBips = bigIntParam(event, 1);
  let record = new RevolvingMarketDeployment(generateEventId(event));
  record.market = marketId;
  record.commitmentFeeBips = commitmentFeeBips;
  record.blockNumber = event.block.number;
  record.blockTimestamp = event.block.timestamp;
  record.transactionHash = event.transaction.hash;
  record.blockLogIndex = event.logIndex;
  record.save();
  pending.commitmentFeeBips = commitmentFeeBips;
  pending.hasRevolvingConfig = true;
  pending.save();
  finalizeMarketDeployment(event, pending);
}

function word(data: Bytes, index: i32): BigInt {
  let offset = index * 32;
  if (offset + 32 > data.length) {
    return BigInt.zero();
  }
  let value = BigInt.zero();
  for (let i = 0; i < 32; i++) {
    value = value.times(BigInt.fromI32(256)).plus(
      BigInt.fromI32(data[offset + i])
    );
  }
  return value;
}

function wordIsTrue(data: Bytes, index: i32): boolean {
  return word(data, index).bitAnd(BigInt.fromI32(1)).equals(BigInt.fromI32(1));
}

function flagBytes(hooksConfig: BigInt): Bytes {
  let encoded = hooksConfig.toHex().replace("0x", "").padStart(64, "0");
  return Bytes.fromHexString(encoded.slice(40, 64));
}

function decodeHooksConfig(
  pending: PendingMarketDeployment,
  hooks: HooksInstance
): void {
  let finalFlags = flagBytes(pending.finalHooks);
  let requestedFlags = flagBytes(pending.requestedHooks);
  let firstByte = finalFlags[0];
  let secondByte = finalFlags[1];
  let requestedFirstByte = requestedFlags[0];
  let hooksData = pending.hooksData as Bytes;
  let minimumDeposit: BigInt | null = null;
  let transfersDisabled = false;
  let fixedTermEndTime = 0;
  let allowClosureBeforeTerm = false;
  let allowTermReduction = false;
  let firstWithdrawalWindowStart = 0;
  let periodDuration = 0;
  let withdrawalWindowDuration = 0;
  if (hooks.kind == "OpenTerm") {
    minimumDeposit = word(hooksData, 0);
    transfersDisabled = wordIsTrue(hooksData, 1);
  } else if (hooks.kind == "FixedTerm") {
    fixedTermEndTime = word(hooksData, 0).toI32();
    minimumDeposit = word(hooksData, 1);
    transfersDisabled = wordIsTrue(hooksData, 2);
    allowClosureBeforeTerm = wordIsTrue(hooksData, 3);
    allowTermReduction = wordIsTrue(hooksData, 4);
  } else if (hooks.kind == "PeriodicTerm") {
    firstWithdrawalWindowStart = word(hooksData, 0).toI32();
    periodDuration = word(hooksData, 1).toI32();
    withdrawalWindowDuration = word(hooksData, 2).toI32();
    minimumDeposit = word(hooksData, 3);
    transfersDisabled = wordIsTrue(hooksData, 4);
  }

  createHooksConfig(generateHooksConfigId(Address.fromString(pending.id)), {
    market: pending.id,
    hooks: hooks.id,
    useOnDeposit: ((firstByte >> 7) & 1) == 1,
    useOnQueueWithdrawal: ((firstByte >> 6) & 1) == 1,
    useOnExecuteWithdrawal: ((firstByte >> 5) & 1) == 1,
    useOnTransfer: ((firstByte >> 4) & 1) == 1,
    useOnBorrow: ((firstByte >> 3) & 1) == 1,
    useOnRepay: ((firstByte >> 2) & 1) == 1,
    useOnCloseMarket: ((firstByte >> 1) & 1) == 1,
    useOnNukeFromOrbit: (firstByte & 1) == 1,
    useOnSetMaxTotalSupply: ((secondByte >> 7) & 1) == 1,
    useOnSetAnnualInterestAndReserveRatioBips:
      ((secondByte >> 6) & 1) == 1,
    useOnSetProtocolFeeBips: ((secondByte >> 5) & 1) == 1,
    depositRequiresAccess: ((requestedFirstByte >> 7) & 1) == 1,
    queueWithdrawalRequiresAccess:
      ((requestedFirstByte >> 6) & 1) == 1,
    transferRequiresAccess: ((requestedFirstByte >> 4) & 1) == 1,
    transfersDisabled: transfersDisabled,
    minimumDeposit: minimumDeposit,
    allowForceBuyBacks: false,
    fixedTermEndTime: fixedTermEndTime,
    allowClosureBeforeTerm: allowClosureBeforeTerm,
    allowTermReduction: allowTermReduction,
    firstWithdrawalWindowStart: firstWithdrawalWindowStart,
    periodDuration: periodDuration,
    withdrawalWindowDuration: withdrawalWindowDuration,
    periodicTermClosed: false,
    pendingAprChangeAnnualInterestBips: 0,
    pendingAprChangeProposalTimestamp: 0,
    pendingAprChangeResponseWindowStart: 0,
    pendingAprChangeResponseWindowEnd: 0,
  });
}

function finalizeMarketDeployment(
  event: ethereum.Event,
  pending: PendingMarketDeployment
): void {
  if (!pending.hasDeploymentConfig) return;
  if (!pending.hasHooksData) return;
  let factory = getOrCreateHooksFactory(
    Address.fromString(pending.factory),
    "Legacy"
  );
  if (factory.marketKind == "REVOLVING") {
    if (!pending.hasRevolvingConfig) return;
  }
  let hooks = HooksInstance.load(pending.hooks);
  if (hooks == null) {
    return;
  }
  let assetAddress = Address.fromBytes(pending.assetAddress);
  let asset = createTokenIfNotExists(assetAddress, event.block.timestamp);
  if (asset == null) {
    return;
  }
  let principal = getOrCreateBorrower(
    event,
    Address.fromBytes(pending.borrowerPrincipal)
  );
  let borrowerIdentityRegistryAddress = Address.fromBytes(
    pending.borrowerIdentityRegistryAddress
  );
  let borrowerIdentityRegistry = getOrCreateBorrowerIdentityRegistry(
    borrowerIdentityRegistryAddress,
    factory.archController
  );
  let borrowerAccount = BorrowerAccount.load(
    generateBorrowerAccountId(
      borrowerIdentityRegistry.id,
      Address.fromBytes(pending.borrower)
    )
  );
  let originationFeeAssetAddress = Address.fromBytes(
    pending.originationFeeAssetAddress as Bytes
  );
  let originationFeeAsset: string | null = null;
  if (!isNullAddress(originationFeeAssetAddress)) {
    originationFeeAsset = getOrCreateTokenId(
      originationFeeAssetAddress,
      event.block.timestamp
    );
  }
  let commitmentFeeBips = factory.marketKind == "REVOLVING"
    ? pending.commitmentFeeBips
    : null;
  let drawnAmount = factory.marketKind == "REVOLVING"
    ? BigInt.zero()
    : null;
  let deployed = MarketDeployed.load(pending.deployedEvent);
  let createdAt = event.block.timestamp.toI32();
  let createdAtBlock = event.block.number;
  let createdAtTimestamp = event.block.timestamp;
  let createdAtTransaction = event.transaction.hash;
  let createdAtLogIndex = event.logIndex;
  if (deployed != null) {
    createdAt = deployed.blockTimestamp;
    createdAtBlock = BigInt.fromI32(deployed.blockNumber);
    createdAtTimestamp = BigInt.fromI32(deployed.blockTimestamp);
    createdAtTransaction = deployed.transactionHash;
    createdAtLogIndex = BigInt.fromI32(deployed.blockLogIndex);
  }
  let market = createMarket(pending.id, {
    address: Address.fromString(pending.id),
    name: pending.name,
    symbol: pending.symbol,
    asset: asset.id,
    borrower: pending.borrower,
    borrowerAccount: borrowerAccount == null ? null : borrowerAccount.id,
    borrowerPrincipal: pending.borrowerPrincipal,
    borrowerProfile: principal.id,
    initialBorrower: pending.borrower,
    initialBorrowerPrincipal: pending.borrowerPrincipal,
    borrowerIdentityRegistry: borrowerIdentityRegistry.id,
    borrowerIdentityRegistryAddress: borrowerIdentityRegistryAddress,
    controller: null,
    annualInterestBips: (pending.annualInterestBips as BigInt).toI32(),
    decimals: asset.decimals,
    delinquencyGracePeriod:
      (pending.delinquencyGracePeriod as BigInt).toI32(),
    delinquencyFeeBips: (pending.delinquencyFeeBips as BigInt).toI32(),
    feeRecipient: pending.feeRecipient as Bytes,
    originationFeeAsset: originationFeeAsset,
    originationFeeAmount: pending.originationFeeAmount as BigInt,
    protocolFeeBips: (pending.protocolFeeBips as BigInt).toI32(),
    sentinel: factory.sentinel,
    scaleFactor: BigInt.fromI32(10).pow(27),
    totalAssets: BigInt.zero(),
    maxTotalSupply: pending.maxTotalSupply as BigInt,
    lastInterestAccruedTimestamp: event.block.timestamp.toI32(),
    lastInterestAccruedBlockNumber: event.block.number.toI32(),
    reserveRatioBips: (pending.reserveRatioBips as BigInt).toI32(),
    withdrawalBatchDuration:
      (pending.withdrawalBatchDuration as BigInt).toI32(),
    isRegistered: true,
    archController: factory.archController,
    marketKind: factory.marketKind,
    originKind: "HOOKS",
    generation: factory.generation,
    abiFamily: factory.abiFamily,
    eventGeneration: "V2_5",
    deployedEvent: pending.deployedEvent,
    createdAt: createdAt,
    createdAtBlock: createdAtBlock,
    createdAtTimestamp: createdAtTimestamp,
    createdAtTransaction: createdAtTransaction,
    createdAtLogIndex: createdAtLogIndex,
    hooks: hooks.id,
    hooksFactory: factory.id,
    commitmentFeeBips: commitmentFeeBips,
    drawnAmount: drawnAmount,
    requestedHooks: pending.requestedHooks,
    finalHooks: pending.finalHooks,
    hooksData: pending.hooksData,
    version: "V2",
    usdTotalsComplete: true,
    totalDebtUSD: BigDecimal.zero(),
    numCollateralContracts: 0,
  });
  decodeHooksConfig(pending, hooks);
  createInitialMarketSnapshot(event, market, "EVENT_DEPLOYMENT_SNAPSHOT");

  if (deployed != null) {
    recordMarketEventAt(
      market.id,
      "MARKET_DEPLOYED",
      deployed.id,
      BigInt.fromI32(deployed.blockNumber),
      BigInt.fromI32(deployed.blockTimestamp),
      deployed.transactionHash,
      BigInt.fromI32(deployed.blockLogIndex)
    );
  }
  let context = createFactoryChildContext(factory);
  context.setString(CONTEXT_TEMPLATE_REGISTRATION, hooks.templateRegistration);
  context.setString(CONTEXT_HOOKS_TEMPLATE, hooks.hooksTemplate);
  context.setString(CONTEXT_HOOKS_KIND, hooks.kind);
  MarketTemplate.createWithContext(Address.fromString(pending.id), context);
  hooks.numMarkets = hooks.numMarkets + 1;
  hooks.save();
  recordMarketCreated(pending.borrowerPrincipal, event.block.timestamp);
  store.remove("PendingMarketDeployment", pending.id);
}
