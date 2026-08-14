import { Address, BigDecimal, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import {
  ChangedSpherexEngineAddress as ChangedSpherexEngineAddressEvent,
  ChangedSpherexOperator as ChangedSpherexOperatorEvent,
  HooksInstanceDeployed as HooksInstanceDeployedEvent,
  HooksTemplateAdded as HooksTemplateAddedEvent,
  HooksTemplateDisabled as HooksTemplateDisabledEvent,
  HooksTemplateFeesUpdated as HooksTemplateFeesUpdatedEvent,
  MarketDeployed as MarketDeployedEvent,
} from "../generated/HooksFactory/HooksFactory";
import {
  createHooksConfig,
  createHooksInstance,
  createHooksInstanceDeployed,
  createMarket,
  createMarketDeployed,
  createRoleProvider,
  createToken,
  generateHooksConfigId,
  generateHooksInstanceDeployedId,
  generateHooksInstanceId,
  generateMarketId,
  generateRoleProviderId,
  generateTokenId,
} from "../generated/UncrashableEntityHelpers";
import { OpenTermHooksBase as IOpenTermHooksBase } from "../generated/HooksFactory/OpenTermHooksBase";
import { FixedTermHooksBase as IFixedTermHooksBase } from "../generated/HooksFactory/FixedTermHooksBase";
import { OpenTermHooksForceBuyBack as IOpenTermHooksForceBuyBack } from "../generated/HooksFactory/OpenTermHooksForceBuyBack";
import { FixedTermHooksForceBuyBack as IFixedTermHooksForceBuyBack } from "../generated/HooksFactory/FixedTermHooksForceBuyBack";
import { PeriodicTermHooks as IPeriodicTermHooks } from "../generated/HooksFactory/PeriodicTermHooks";
import { CombinedHooks } from "../generated/HooksFactory/CombinedHooks";
import { IWildcatMarketRevolving } from "../generated/HooksFactory/IWildcatMarketRevolving";
import { IERC20 } from "../generated/HooksFactory/IERC20";
import {
  HooksInstance,
  HooksConfig,
  HooksFactory,
  HooksTemplateRegistration,
  RoleProvider,
  Token,
} from "../generated/schema";
import { readTokenMetadata } from "./token-metadata";
import { generateEventId, isNullAddress } from "./utils";
import { setupTokenPriceFeeds } from "./price-feeds";
import { recordMarketCreated } from "./daily-stats";
import {
  CombinedHooks as CombinedHooksTemplate,
  WildcatMarket as MarketTemplate,
} from "../generated/templates";
import { getOrCreateHooksFactory } from "./factory-domain";
import {
  CONTEXT_HOOKS_KIND,
  CONTEXT_HOOKS_TEMPLATE,
  CONTEXT_TEMPLATE_REGISTRATION,
  createFactoryChildContext,
} from "./factory-context";
import {
  createTemplateRegistration,
  disableTemplateRegistration,
  generateHooksTemplateId,
  generateHooksTemplateRegistrationId,
  getOrCreateHooksTemplate,
  recordTemplateRegistrationEvent,
  updateTemplateRegistrationFees,
} from "./hooks-template-domain";
import { recordIndexerDiagnostic } from "./indexer-diagnostics";
import { createInitialMarketSnapshot } from "./market-domain";
import { recordMarketEvent } from "./market-event-domain";
import { getOrCreateBorrower } from "./borrower-domain";
import { getOrCreateRoleProviderInstance } from "./role-provider-domain";

export function handleChangedSpherexEngineAddress(
  event: ChangedSpherexEngineAddressEvent
): void {}
export function handleChangedSpherexOperator(
  event: ChangedSpherexOperatorEvent
): void {}
export function handleHooksInstanceDeployedForMarketType(
  event: ethereum.Event,
  hooksInstance: Address,
  hooksTemplateAddress: Address,
  marketType: string
): void {
  let hooksFactory = getOrCreateHooksFactory(event.address, marketType);
  let hooksTemplateId = generateHooksTemplateId(hooksTemplateAddress);
  let hooksInstanceId = generateHooksInstanceId(hooksInstance);
  let templateRegistration = HooksTemplateRegistration.load(
    generateHooksTemplateRegistrationId(event.address, hooksTemplateAddress)
  );
  if (templateRegistration == null) {
    recordIndexerDiagnostic(
      event,
      "MISSING_TEMPLATE_REGISTRATION",
      "Hooks instance deployment referenced a template that is not registered on this factory",
      hooksTemplateAddress
    );
    return;
  }
  let hooksContract = CombinedHooks.bind(hooksInstance);
  let borrower = hooksContract.borrower();
  let name = hooksContract.name();
  let hooksTemplate = getOrCreateHooksTemplate(
    event,
    hooksTemplateAddress,
    hooksFactory.abiFamily
  );
  let hooksWithProvider = createHooksInstance(hooksInstanceId, {
    address: hooksInstance,
    borrower: borrower,
    name: name,
    hooksFactory: hooksFactory.id,
    hooksTemplate: hooksTemplateId,
    templateRegistration: templateRegistration.id,
    kind: hooksTemplate.kind,
    marketKind: hooksFactory.marketKind,
    generation: hooksFactory.generation,
    abiFamily: hooksFactory.abiFamily,
    eventGeneration: hooksFactory.eventGeneration,
    administrator: borrower,
    deployer: event.transaction.from,
    version: hooksTemplate.version,
    providerMetadataState: "AVAILABLE",
    deployedAtBlock: event.block.number,
    deployedAtTimestamp: event.block.timestamp,
    deployedAtTransaction: event.transaction.hash,
    deployedAtLogIndex: event.logIndex,
  });

  let eventIndex = 0;
  let pullProviders = hooksContract.getPullProviders();
  let pushProviders = hooksContract.getPushProviders();
  for (let i = 0; i < pullProviders.length; i++) {
    let pullProvider = pullProviders[i];
    decodeAndCreateRoleProvider(
      hooksInstance,
      hooksInstanceId,
      pullProvider
    );
    eventIndex = eventIndex + 1;
  }
  for (let i = 0; i < pushProviders.length; i++) {
    let pushProvider = pushProviders[i];
    decodeAndCreateRoleProvider(
      hooksInstance,
      hooksInstanceId,
      pushProvider
    );
    eventIndex = eventIndex + 1;
  }
  hooksWithProvider.eventIndex = eventIndex;
  hooksWithProvider.save();

  createHooksInstanceDeployed(
    generateHooksInstanceDeployedId(hooksInstance, hooksFactory.eventIndex),
    {
      hooks: hooksInstanceId,
      hooksTemplate: hooksTemplateId,
      templateRegistration: templateRegistration.id,
      blockNumber: event.block.number.toI32(),
      blockTimestamp: event.block.timestamp.toI32(),
      transactionHash: event.transaction.hash,
      blockLogIndex: event.logIndex.toI32(),
      administrator: borrower,
      deployer: event.transaction.from,
      name: name,
      version: hooksTemplate.version,
    }
  );
  hooksFactory.eventIndex = hooksFactory.eventIndex + 1;
  hooksFactory.save();
  let context = createFactoryChildContext(hooksFactory);
  context.setString(CONTEXT_TEMPLATE_REGISTRATION, templateRegistration.id);
  context.setString(CONTEXT_HOOKS_TEMPLATE, hooksTemplate.id);
  context.setString(CONTEXT_HOOKS_KIND, hooksTemplate.kind);
  CombinedHooksTemplate.createWithContext(hooksInstance, context);
}

export function handleHooksInstanceDeployed(
  event: HooksInstanceDeployedEvent
): void {
  handleHooksInstanceDeployedForMarketType(
    event,
    event.params.hooksInstance,
    event.params.hooksTemplate,
    "Legacy"
  );
}

export function createTokenIfNotExists(
  asset: Address,
  timestamp: BigInt
): Token | null {
  if (isNullAddress(asset)) {
    return null;
  }
  let assetId = generateTokenId(asset);
  let token = Token.load(assetId);
  if (token == null) {
    let metadata = readTokenMetadata(asset);
    let newToken = createToken(assetId, {
      address: asset,
      name: metadata.name,
      symbol: metadata.symbol,
      decimals: metadata.decimals,
      isMock: metadata.isMock,
    });
    setupTokenPriceFeeds(newToken, timestamp);
    return newToken;
  }
  return token;
}

export function getOrCreateTokenId(
  asset: Address,
  timestamp: BigInt
): string | null {
  let token = createTokenIfNotExists(asset, timestamp);
  if (token == null) {
    return null;
  }
  return token.id;
}

export function handleHooksTemplateAddedForMarketType(
  event: ethereum.Event,
  hooksTemplate: Address,
  name: string,
  feeRecipient: Address,
  originationFeeAsset: Address,
  originationFeeAmount: BigInt,
  protocolFeeBips: i32,
  marketType: string
): void {
  let hooksFactory = getOrCreateHooksFactory(event.address, marketType);
  let originationFeeAssetId = getOrCreateTokenId(
    originationFeeAsset,
    event.block.timestamp
  );
  let template = getOrCreateHooksTemplate(
    event,
    hooksTemplate,
    hooksFactory.abiFamily
  );
  let registration = createTemplateRegistration(
    event,
    hooksFactory,
    template,
    name,
    feeRecipient,
    originationFeeAssetId,
    originationFeeAmount,
    protocolFeeBips
  );
  recordTemplateRegistrationEvent(event, registration, "ADDED");
  hooksFactory.eventIndex = hooksFactory.eventIndex + 1;
  hooksFactory.save();
}
export function handleHooksTemplateAdded(event: HooksTemplateAddedEvent): void {
  handleHooksTemplateAddedForMarketType(
    event,
    event.params.hooksTemplate,
    event.params.name,
    event.params.feeRecipient,
    event.params.originationFeeAsset,
    event.params.originationFeeAmount,
    event.params.protocolFeeBips,
    "Legacy"
  );
}
export function handleHooksTemplateDisabled(
  event: HooksTemplateDisabledEvent
): void {
  handleHooksTemplateDisabledForMarketType(
    event,
    event.params.hooksTemplate,
    "Legacy"
  );
}
export function handleHooksTemplateDisabledForMarketType(
  event: ethereum.Event,
  hooksTemplate: Address,
  marketType: string
): void {
  let hooksFactory = getOrCreateHooksFactory(event.address, marketType);
  let registration = HooksTemplateRegistration.load(
    generateHooksTemplateRegistrationId(event.address, hooksTemplate)
  );
  if (registration == null) {
    recordIndexerDiagnostic(
      event,
      "MISSING_TEMPLATE_REGISTRATION",
      "Template disable referenced a template that is not registered on this factory",
      hooksTemplate
    );
    return;
  }
  disableTemplateRegistration(event, registration);
  recordTemplateRegistrationEvent(event, registration, "DISABLED");
  hooksFactory.eventIndex = hooksFactory.eventIndex + 1;
  hooksFactory.save();
}
export function handleHooksTemplateFeesUpdatedForMarketType(
  event: ethereum.Event,
  hooksTemplate: Address,
  feeRecipient: Address,
  originationFeeAsset: Address,
  originationFeeAmount: BigInt,
  protocolFeeBips: i32,
  marketType: string
): void {
  let hooksFactory = getOrCreateHooksFactory(event.address, marketType);
  let originationFeeAssetId = getOrCreateTokenId(
    originationFeeAsset,
    event.block.timestamp
  );
  let registration = HooksTemplateRegistration.load(
    generateHooksTemplateRegistrationId(event.address, hooksTemplate)
  );
  if (registration == null) {
    recordIndexerDiagnostic(
      event,
      "MISSING_TEMPLATE_REGISTRATION",
      "Template fee update referenced a template that is not registered on this factory",
      hooksTemplate
    );
    return;
  }
  updateTemplateRegistrationFees(
    event,
    registration,
    feeRecipient,
    originationFeeAssetId,
    originationFeeAmount,
    protocolFeeBips
  );
  recordTemplateRegistrationEvent(event, registration, "FEES_UPDATED");
  hooksFactory.eventIndex = hooksFactory.eventIndex + 1;
  hooksFactory.save();
}
export function handleHooksTemplateFeesUpdated(
  event: HooksTemplateFeesUpdatedEvent
): void {
  handleHooksTemplateFeesUpdatedForMarketType(
    event,
    event.params.hooksTemplate,
    event.params.feeRecipient,
    event.params.originationFeeAsset,
    event.params.originationFeeAmount,
    event.params.protocolFeeBips,
    "Legacy"
  );
}
export function decodeAndCreateRoleProvider(
  hooksAddress: Bytes,
  hooksInstanceId: string,
  encodedRoleProvider: BigInt
): RoleProvider {
  let nullProviderIndex = 2 ** 24 - 1;
  let providerIndexMask = BigInt.fromI32(nullProviderIndex);
  let hooksConfigBytes = encodedRoleProvider
    .toHex()
    .replace("0x", "")
    .padStart(64, "0");

  let timeToLive = encodedRoleProvider.rightShift(224);
  let providerAddress = Bytes.fromHexString(hooksConfigBytes.slice(8, 48));
  let pullProviderIndex = encodedRoleProvider
    .rightShift(40)
    .bitAnd(providerIndexMask)
    .toI32();
  let pushProviderIndex = encodedRoleProvider
    .rightShift(16)
    .bitAnd(providerIndexMask)
    .toI32();
  let isPullProvider = pullProviderIndex !== nullProviderIndex;
  let isPushProvider = pushProviderIndex !== nullProviderIndex;
  let providerId = generateRoleProviderId(hooksAddress, providerAddress);
  let providerInstance = getOrCreateRoleProviderInstance(providerAddress);
  return createRoleProvider(providerId, {
    isApproved: true,
    isPullProvider: isPullProvider,
    isPushProvider: isPushProvider,
    hooks: hooksInstanceId,
    pullProviderIndex: pullProviderIndex,
    pushProviderIndex: pushProviderIndex,
    timeToLive: timeToLive,
    providerAddress: providerAddress,
    providerInstance: providerInstance.id,
  });
}

function decodeAndCreateHooksConfig(
  market: Bytes,
  marketId: string,
  hooksConfig: BigInt,
  hookedMarketAbi: string
): HooksConfig {
  let hooksConfigBytes = hooksConfig
    .toHex()
    .replace("0x", "")
    .padStart(64, "0");

  let hooksAddress = Bytes.fromHexString(hooksConfigBytes.slice(0, 40));
  let flagBytes = Bytes.fromHexString(hooksConfigBytes.slice(40, 64));
  let firstByte = flagBytes[0];
  let useOnDeposit = ((firstByte >> 7) & 1) == 1;
  let useOnQueueWithdrawal = ((firstByte >> 6) & 1) == 1;
  let useOnExecuteWithdrawal = ((firstByte >> 5) & 1) == 1;
  let useOnTransfer = ((firstByte >> 4) & 1) == 1;
  let useOnBorrow = ((firstByte >> 3) & 1) == 1;
  let useOnRepay = ((firstByte >> 2) & 1) == 1;
  let useOnCloseMarket = ((firstByte >> 1) & 1) == 1;
  let useOnNukeFromOrbit = (firstByte & 1) == 1;
  let secondByte = flagBytes[1];
  let useOnSetMaxTotalSupply = ((secondByte >> 7) & 1) == 1;
  let useOnSetAnnualInterestAndReserveRatioBips = ((secondByte >> 6) & 1) == 1;
  let useOnSetProtocolFeeBips = ((secondByte >> 5) & 1) == 1;
  let hooksContract = CombinedHooks.bind(Address.fromBytes(hooksAddress));
  let versionResult = hooksContract.try_version();
  let versionString = versionResult.reverted ? "Unknown" : versionResult.value;
  let depositRequiresAccess: boolean = false;
  let transferRequiresAccess: boolean = false;
  let queueWithdrawalRequiresAccess: boolean = false;
  let transfersDisabled: boolean = false;
  let allowClosureBeforeTerm: boolean = false;
  let allowForceBuyBacks: boolean = false;
  let allowTermReduction: boolean = false;
  let fixedTermEndTime: i32 = 0;
  let firstWithdrawalWindowStart: i32 = 0;
  let periodDuration: i32 = 0;
  let withdrawalWindowDuration: i32 = 0;
  let periodicTermClosed: boolean = false;
  let minimumDeposit: BigInt | null = null;
  let pendingAprChangeAnnualInterestBips: i32 = 0;
  let pendingAprChangeProposalTimestamp: i32 = 0;
  let pendingAprChangeResponseWindowStart: i32 = 0;
  let pendingAprChangeResponseWindowEnd: i32 = 0;
  if (versionString == "OpenTermHooks") {
    if (hookedMarketAbi == "FORCE_BUYBACK") {
      let openTermHooksContract = IOpenTermHooksForceBuyBack.bind(
        Address.fromBytes(hooksAddress)
      );
      let hookedMarket = openTermHooksContract.getHookedMarket(
        Address.fromBytes(market)
      );
      depositRequiresAccess = hookedMarket.depositRequiresAccess;
      transferRequiresAccess = hookedMarket.transferRequiresAccess;
      transfersDisabled = hookedMarket.transfersDisabled;
      minimumDeposit = hookedMarket.minimumDeposit;
      allowForceBuyBacks = hookedMarket.allowForceBuyBacks;
    } else {
      let openTermHooksContract = IOpenTermHooksBase.bind(
        Address.fromBytes(hooksAddress)
      );
      let hookedMarket = openTermHooksContract.getHookedMarket(
        Address.fromBytes(market)
      );
      depositRequiresAccess = hookedMarket.depositRequiresAccess;
      transferRequiresAccess = hookedMarket.transferRequiresAccess;
      transfersDisabled = hookedMarket.transfersDisabled;
      minimumDeposit = hookedMarket.minimumDeposit;
    }
    queueWithdrawalRequiresAccess = useOnQueueWithdrawal;
  } else if (versionString == "FixedTermHooks") {
    if (hookedMarketAbi == "FORCE_BUYBACK") {
      let fixedTermHooksContract = IFixedTermHooksForceBuyBack.bind(
        Address.fromBytes(hooksAddress)
      );
      let hookedMarket = fixedTermHooksContract.getHookedMarket(
        Address.fromBytes(market)
      );
      depositRequiresAccess = hookedMarket.depositRequiresAccess;
      transferRequiresAccess = hookedMarket.transferRequiresAccess;
      queueWithdrawalRequiresAccess = hookedMarket.withdrawalRequiresAccess;
      transfersDisabled = hookedMarket.transfersDisabled;
      allowClosureBeforeTerm = hookedMarket.allowClosureBeforeTerm;
      allowTermReduction = hookedMarket.allowTermReduction;
      fixedTermEndTime = hookedMarket.fixedTermEndTime.toI32();
      minimumDeposit = hookedMarket.minimumDeposit;
      allowForceBuyBacks = hookedMarket.allowForceBuyBacks;
    } else {
      let fixedTermHooksContract = IFixedTermHooksBase.bind(
        Address.fromBytes(hooksAddress)
      );
      let hookedMarket = fixedTermHooksContract.getHookedMarket(
        Address.fromBytes(market)
      );
      depositRequiresAccess = hookedMarket.depositRequiresAccess;
      transferRequiresAccess = hookedMarket.transferRequiresAccess;
      queueWithdrawalRequiresAccess = hookedMarket.withdrawalRequiresAccess;
      transfersDisabled = hookedMarket.transfersDisabled;
      allowClosureBeforeTerm = hookedMarket.allowClosureBeforeTerm;
      allowTermReduction = hookedMarket.allowTermReduction;
      fixedTermEndTime = hookedMarket.fixedTermEndTime.toI32();
      minimumDeposit = hookedMarket.minimumDeposit;
    }
  } else if (versionString == "PeriodicTermHooks") {
    let periodicTermHooksContract = IPeriodicTermHooks.bind(
      Address.fromBytes(hooksAddress)
    );
    let hookedMarket = periodicTermHooksContract.getHookedMarket(
      Address.fromBytes(market)
    );
    depositRequiresAccess = hookedMarket.depositRequiresAccess;
    transferRequiresAccess = hookedMarket.transferRequiresAccess;
    queueWithdrawalRequiresAccess = hookedMarket.withdrawalRequiresAccess;
    transfersDisabled = hookedMarket.transfersDisabled;
    firstWithdrawalWindowStart = hookedMarket.firstWithdrawalWindowStart.toI32();
    periodDuration = hookedMarket.periodDuration.toI32();
    withdrawalWindowDuration = hookedMarket.withdrawalWindowDuration.toI32();
    periodicTermClosed = hookedMarket.isClosed;
    minimumDeposit = hookedMarket.minimumDeposit;
  }

  return createHooksConfig(generateHooksConfigId(market), {
    hooks: hooksAddress.toHex(),
    market: marketId,
    useOnDeposit: useOnDeposit,
    useOnQueueWithdrawal: useOnQueueWithdrawal,
    useOnExecuteWithdrawal: useOnExecuteWithdrawal,
    useOnTransfer: useOnTransfer,
    useOnBorrow: useOnBorrow,
    useOnRepay: useOnRepay,
    useOnCloseMarket: useOnCloseMarket,
    useOnNukeFromOrbit: useOnNukeFromOrbit,
    useOnSetMaxTotalSupply: useOnSetMaxTotalSupply,
    useOnSetAnnualInterestAndReserveRatioBips: useOnSetAnnualInterestAndReserveRatioBips,
    useOnSetProtocolFeeBips: useOnSetProtocolFeeBips,
    depositRequiresAccess: depositRequiresAccess,
    transferRequiresAccess: transferRequiresAccess,
    queueWithdrawalRequiresAccess: queueWithdrawalRequiresAccess,
    transfersDisabled: transfersDisabled,
    allowClosureBeforeTerm: allowClosureBeforeTerm,
    allowForceBuyBacks: allowForceBuyBacks,
    allowTermReduction: allowTermReduction,
    fixedTermEndTime: fixedTermEndTime,
    minimumDeposit: minimumDeposit,
    firstWithdrawalWindowStart: firstWithdrawalWindowStart,
    periodDuration: periodDuration,
    withdrawalWindowDuration: withdrawalWindowDuration,
    periodicTermClosed: periodicTermClosed,
    pendingAprChangeAnnualInterestBips: pendingAprChangeAnnualInterestBips,
    pendingAprChangeProposalTimestamp: pendingAprChangeProposalTimestamp,
    pendingAprChangeResponseWindowStart: pendingAprChangeResponseWindowStart,
    pendingAprChangeResponseWindowEnd: pendingAprChangeResponseWindowEnd,
  });
}

export function handleMarketDeployedForMarketType(
  event: ethereum.Event,
  market: Address,
  hooksConfigValue: BigInt,
  name: string,
  symbol: string,
  assetAddress: Address,
  maxTotalSupply: BigInt,
  annualInterestBips: BigInt,
  delinquencyFeeBips: BigInt,
  withdrawalBatchDuration: BigInt,
  reserveRatioBips: BigInt,
  delinquencyGracePeriod: BigInt,
  marketType: string
): void {
  let asset = createTokenIfNotExists(assetAddress, event.block.timestamp);
  if (asset != null) {
    let marketId = generateMarketId(market);
    let hooksFactory = getOrCreateHooksFactory(event.address, marketType);
    let marketDeployedId = generateEventId(event);
    createMarketDeployed(marketDeployedId, {
      blockNumber: event.block.number.toI32(),
      blockTimestamp: event.block.timestamp.toI32(),
      transactionHash: event.transaction.hash,
      blockLogIndex: event.logIndex.toI32(),
      market: marketId,
    });
    let hooksConfig = decodeAndCreateHooksConfig(
      market,
      marketId,
      hooksConfigValue,
      hooksFactory.hookedMarketAbi
    );
    let hooks = HooksInstance.load(hooksConfig.hooks);
    if (hooks == null) {
      return;
    }

    let templateRegistration = HooksTemplateRegistration.load(
      hooks.templateRegistration
    );
    if (templateRegistration == null) {
      recordIndexerDiagnostic(
        event,
        "MISSING_TEMPLATE_REGISTRATION",
        "Market deployment referenced a hooks instance without a template registration",
        Address.fromBytes(hooksFactory.address)
      );
      return;
    }
    let feeRecipient = templateRegistration.feeRecipient;
    let protocolFeeBips = templateRegistration.protocolFeeBips;
    let version = "V2";
    let borrowerProfile = getOrCreateBorrower(
      event,
      Address.fromBytes(hooks.borrower)
    );
    let commitmentFeeBips: BigInt | null = null;
    let drawnAmount: BigInt | null = null;
    if (hooksFactory.marketKind == "REVOLVING") {
      let revolvingMarket = IWildcatMarketRevolving.bind(market);
      let commitmentFeeBipsResult = revolvingMarket.try_commitmentFeeBips();
      if (!commitmentFeeBipsResult.reverted) {
        commitmentFeeBips = commitmentFeeBipsResult.value;
      }

      let drawnAmountResult = revolvingMarket.try_drawnAmount();
      if (!drawnAmountResult.reverted) {
        drawnAmount = drawnAmountResult.value;
      }
    }

    let marketEntity = createMarket(marketId, {
      address: market,
      name: name,
      symbol: symbol,
      asset: asset.id,
      borrower: hooks.borrower,
      borrowerPrincipal: hooks.borrower,
      initialBorrower: hooks.borrower,
      initialBorrowerPrincipal: hooks.borrower,
      borrowerProfile: borrowerProfile.id,
      controller: null,
      annualInterestBips: annualInterestBips.toI32(),
      decimals: asset.decimals,
      delinquencyGracePeriod: delinquencyGracePeriod.toI32(),
      delinquencyFeeBips: delinquencyFeeBips.toI32(),
      feeRecipient: feeRecipient,
      originationFeeAsset: templateRegistration.originationFeeAsset,
      originationFeeAmount: templateRegistration.originationFeeAmount,
      protocolFeeBips: protocolFeeBips,
      sentinel: hooksFactory.sentinel,
      scaleFactor: BigInt.fromI32(10).pow(27),
      totalAssets: IERC20.bind(assetAddress).balanceOf(market),
      maxTotalSupply: maxTotalSupply,
      lastInterestAccruedTimestamp: event.block.timestamp.toI32(),
      lastInterestAccruedBlockNumber: event.block.number.toI32(),
      reserveRatioBips: reserveRatioBips.toI32(),
      withdrawalBatchDuration: withdrawalBatchDuration.toI32(),
      isRegistered: true,
      archController: hooksFactory.archController,
      marketKind: hooksFactory.marketKind,
      originKind: "HOOKS",
      generation: hooksFactory.generation,
      abiFamily: hooksFactory.abiFamily,
      eventGeneration: hooksFactory.eventGeneration,
      deployedEvent: marketDeployedId,
      createdAt: event.block.timestamp.toI32(),
      createdAtBlock: event.block.number,
      createdAtTimestamp: event.block.timestamp,
      createdAtTransaction: event.transaction.hash,
      createdAtLogIndex: event.logIndex,
      hooks: hooks.id,
      hooksFactory: hooksFactory.id,
      commitmentFeeBips: commitmentFeeBips,
      drawnAmount: drawnAmount,
      version: version,
      usdTotalsComplete: true,
      totalDebtUSD: BigDecimal.zero(),
      numCollateralContracts: 0,
    });
    createInitialMarketSnapshot(
      event,
      marketEntity,
      "EVENT_AND_CONTRACT_CALL"
    );
    recordMarketEvent(event, marketEntity, "MARKET_DEPLOYED");
    let context = createFactoryChildContext(hooksFactory);
    context.setString(CONTEXT_TEMPLATE_REGISTRATION, templateRegistration.id);
    context.setString(CONTEXT_HOOKS_TEMPLATE, hooks.hooksTemplate);
    context.setString(CONTEXT_HOOKS_KIND, hooks.kind);
    MarketTemplate.createWithContext(market, context);
    hooks.numMarkets = hooks.numMarkets + 1;
    hooks.save();

    recordMarketCreated(hooks.borrower, event.block.timestamp);
  }
}
export function handleMarketDeployed(event: MarketDeployedEvent): void {
  handleMarketDeployedForMarketType(
    event,
    event.params.market,
    event.params.hooks,
    event.params.name,
    event.params.symbol,
    event.params.asset,
    event.params.maxTotalSupply,
    event.params.annualInterestBips,
    event.params.delinquencyFeeBips,
    event.params.withdrawalBatchDuration,
    event.params.reserveRatioBips,
    event.params.delinquencyGracePeriod,
    "Legacy"
  );
}
