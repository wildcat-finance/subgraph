import { Address, BigInt, Bytes, ethereum, log } from "@graphprotocol/graph-ts";
import {
  ChangedSpherexEngineAddress as ChangedSpherexEngineAddressEvent,
  ChangedSpherexOperator as ChangedSpherexOperatorEvent,
  HooksInstanceDeployed as HooksInstanceDeployedEvent,
  HooksTemplateAdded as HooksTemplateAddedEvent,
  HooksTemplateDisabled as HooksTemplateDisabledEvent,
  HooksTemplateFeesUpdated as HooksTemplateFeesUpdatedEvent,
  MarketDeployed as MarketDeployedEvent,
  HooksFactory as HooksFactoryContract,
} from "../generated/HooksFactory/HooksFactory";
import {
  createHooksConfig,
  createHooksFactory,
  createHooksInstance,
  createHooksInstanceDeployed,
  createHooksTemplate,
  createHooksTemplateAdded,
  createHooksTemplateDisabled,
  createHooksTemplateFeesUpdated,
  createMarket,
  createMarketDeployed,
  createRoleProvider,
  createRoleProviderAdded,
  createToken,
  generateHooksConfigId,
  generateHooksInstanceDeployedId,
  generateHooksInstanceId,
  generateHooksTemplateAddedId,
  generateHooksTemplateDisabledId,
  generateHooksTemplateFeesUpdatedId,
  generateHooksTemplateId,
  generateMarketId,
  generateRoleProviderId,
  generateTokenId,
  getHooksTemplate,
} from "../generated/UncrashableEntityHelpers";
import { OpenTermHooks as IOpenTermHooks } from "../generated/HooksFactory/OpenTermHooks";
import { FixedTermHooks as IFixedTermHooks } from "../generated/HooksFactory/FixedTermHooks";
import { CombinedHooks } from "../generated/HooksFactory/CombinedHooks";
import { IWildcatMarketRevolving } from "../generated/HooksFactory/IWildcatMarketRevolving";
import { IERC20 } from "../generated/HooksFactory/IERC20";
import {
  HooksInstance,
  HooksConfig,
  HooksFactory,
  HooksTemplate,
  RoleProvider,
  Token,
} from "../generated/schema";
import { generateEventId, isNullAddress } from "./utils";
import {
  CombinedHooks as CombinedHooksTemplate,
  WildcatMarket as MarketTemplate,
} from "../generated/templates";

function generateRecordId(id: string, eventIndex: number): string {
  return "RECORD" + "-" + id + "-" + eventIndex.toString();
}

function getOrCreateHooksFactory(
  address: Address,
  marketType: string
): HooksFactory {
  let hooksFactory = HooksFactory.load(address.toHex());
  if (hooksFactory == null) {
    let hooksFactoryContract = HooksFactoryContract.bind(address);
    return createHooksFactory(address.toHex(), {
      isRegistered: true,
      sentinel: hooksFactoryContract.sanctionsSentinel(),
      archController: hooksFactoryContract.archController().toHex(),
      marketType: marketType,
    });
  }
  if (hooksFactory.marketType == null || hooksFactory.marketType != marketType) {
    hooksFactory.marketType = marketType;
    hooksFactory.save();
  }
  return hooksFactory;
}

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
  let hooksTemplate = getHooksTemplate(hooksTemplateId);
  log.warning("Hooks Template: {}", [hooksTemplateId]);
  log.warning("Hooks Instance: {}", [hooksInstanceId]);
  log.warning("Hooks name: {}", [hooksTemplate.name]);
  log.warning("Hooks name is ACH: {}", [
    hooksTemplate.name == "OpenTermHooks" ? "true" : "false",
  ]);
  let hooksContract = CombinedHooks.bind(hooksInstance);
  let borrower = hooksContract.borrower();
  let name = hooksContract.name();
  let hooksWithProvider: HooksInstance | null = null;

  if (hooksTemplate.name == "OpenTermHooks") {
    hooksWithProvider = createHooksInstance(hooksInstanceId, {
      borrower: borrower,
      name: name,
      hooksFactory: hooksFactory.id,
      hooksTemplate: hooksTemplateId,
      kind: "OpenTerm",
    });
  } else if (hooksTemplate.name == "FixedTermHooks") {
    hooksWithProvider = createHooksInstance(hooksInstanceId, {
      borrower: borrower,
      name: name,
      hooksFactory: hooksFactory.id,
      hooksTemplate: hooksTemplateId,
      kind: "FixedTerm",
    });
  } else {
    createHooksInstance(hooksInstanceId, {
      borrower: borrower,
      name: name,
      hooksFactory: hooksFactory.id,
      hooksTemplate: hooksTemplateId,
      kind: "Unknown",
    });
  }

  if (hooksWithProvider != null) {
    let eventIndex = 0;
    let pullProviders = hooksContract.getPullProviders();
    let pushProviders = hooksContract.getPushProviders();
    for (let i = 0; i < pullProviders.length; i++) {
      let pullProvider = pullProviders[i];
      decodeAndCreateRoleProvider(
        event,
        hooksInstance,
        hooksInstanceId,
        eventIndex,
        pullProvider
      );
      eventIndex = eventIndex + 1;
    }
    for (let i = 0; i < pushProviders.length; i++) {
      let pushProvider = pushProviders[i];
      decodeAndCreateRoleProvider(
        event,
        hooksInstance,
        hooksInstanceId,
        eventIndex,
        pushProvider
      );
      eventIndex = eventIndex + 1;
    }
    hooksWithProvider.eventIndex = eventIndex;
    hooksWithProvider.save();
  }

  createHooksInstanceDeployed(
    generateHooksInstanceDeployedId(hooksInstance, hooksFactory.eventIndex),
    {
      hooks: hooksInstanceId,
      hooksTemplate: hooksTemplateId,
      blockNumber: event.block.number.toI32(),
      blockTimestamp: event.block.timestamp.toI32(),
      transactionHash: event.transaction.hash,
      blockLogIndex: event.logIndex.toI32(),
    }
  );
  hooksFactory.eventIndex = hooksFactory.eventIndex + 1;
  hooksFactory.save();
  CombinedHooksTemplate.create(hooksInstance);
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

function createTokenIfNotExists(asset: Address): Token | null {
  if (isNullAddress(asset)) {
    return null;
  }
  let assetId = generateTokenId(asset);
  let token = Token.load(assetId);
  if (token == null) {
    let erc20 = IERC20.bind(asset);
    let result = erc20.try_isMock();
    let isMock = !result.reverted && result.value;
    return createToken(assetId, {
      address: asset,
      name: erc20.name(),
      symbol: erc20.symbol(),
      decimals: erc20.decimals(),
      isMock: isMock,
    });
  }
  return token;
}

function getOrCreateTokenId(asset: Address): string | null {
  let token = createTokenIfNotExists(asset);
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
  let hooksTemplateId = generateHooksTemplateId(hooksTemplate);
  createHooksTemplateAdded(
    generateHooksTemplateAddedId(hooksTemplate, hooksFactory.eventIndex),
    {
      blockNumber: event.block.number.toI32(),
      blockTimestamp: event.block.timestamp.toI32(),
      transactionHash: event.transaction.hash,
      blockLogIndex: event.logIndex.toI32(),
      hooksTemplate: hooksTemplateId,
      feeRecipient: feeRecipient,
      originationFeeAmount: originationFeeAmount,
      originationFeeAsset: getOrCreateTokenId(originationFeeAsset),
      // originationFeeAsset: event.params.originationFeeAsset,
      protocolFeeBips: protocolFeeBips,
    }
  );

  createHooksTemplate(hooksTemplateId, {
    feeRecipient: feeRecipient,
    originationFeeAmount: originationFeeAmount,
    // originationFeeAsset: getOrCreateTokenId(event.params.originationFeeAsset),

    // originationFeeAsset: event.params.originationFeeAsset,
    originationFeeAsset: getOrCreateTokenId(originationFeeAsset),
    protocolFeeBips: protocolFeeBips,
    hooksFactory: hooksFactory.id,
    name: name,
  });
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
  let hooksTemplateId = generateHooksTemplateId(hooksTemplate);
  createHooksTemplateDisabled(
    generateHooksTemplateDisabledId(hooksTemplate, hooksFactory.eventIndex),
    {
      blockNumber: event.block.number.toI32(),
      blockTimestamp: event.block.timestamp.toI32(),
      transactionHash: event.transaction.hash,
      blockLogIndex: event.logIndex.toI32(),
      hooksTemplate: hooksTemplateId,
    }
  );
  hooksFactory.eventIndex = hooksFactory.eventIndex + 1;
  hooksFactory.save();
  let hooksTemplateEntity = getHooksTemplate(hooksTemplateId);
  hooksTemplateEntity.disabled = true;
  hooksTemplateEntity.save();
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
  let hooksTemplateId = generateHooksTemplateId(hooksTemplate);
  let hooksTemplateEntity = getHooksTemplate(hooksTemplateId);
  createHooksTemplateFeesUpdated(
    generateHooksTemplateFeesUpdatedId(hooksTemplate, hooksFactory.eventIndex),
    {
      blockNumber: event.block.number.toI32(),
      blockTimestamp: event.block.timestamp.toI32(),
      transactionHash: event.transaction.hash,
      blockLogIndex: event.logIndex.toI32(),
      hooksTemplate: hooksTemplateId,
      feeRecipient: feeRecipient,
      originationFeeAmount: originationFeeAmount,
      originationFeeAsset: getOrCreateTokenId(originationFeeAsset),
      protocolFeeBips: protocolFeeBips,
    }
  );
  hooksTemplateEntity.feeRecipient = feeRecipient;
  hooksTemplateEntity.originationFeeAmount = originationFeeAmount;
  hooksTemplateEntity.originationFeeAsset = getOrCreateTokenId(originationFeeAsset);
  hooksTemplateEntity.protocolFeeBips = protocolFeeBips;
  hooksTemplateEntity.save();
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
function decodeAndCreateRoleProvider(
  event: ethereum.Event,
  hooksAddress: Bytes,
  hooksInstanceId: string,
  eventIndex: number,
  encodedRoleProvider: BigInt
): RoleProvider {
  let nullProviderIndex = 2 ** 24 - 1;
  let hooksConfigBytes = encodedRoleProvider
    .toHex()
    .replace("0x", "")
    .padStart(64, "0");

  let timeToLive = Bytes.fromHexString(hooksConfigBytes.slice(0, 8)).toI32();
  let providerAddress = Bytes.fromHexString(hooksConfigBytes.slice(8, 48));
  let pullProviderIndex = Bytes.fromHexString(
    hooksConfigBytes.slice(48, 54)
  ).toI32();
  let pushProviderIndex = Bytes.fromHexString(
    hooksConfigBytes.slice(54, 60)
  ).toI32();
  let isPullProvider = pullProviderIndex !== nullProviderIndex;
  let isPushProvider = pushProviderIndex !== nullProviderIndex;
  let providerId = generateRoleProviderId(hooksAddress, providerAddress);
  createRoleProviderAdded(generateRecordId(hooksInstanceId, eventIndex), {
    blockNumber: event.block.number.toI32(),
    blockTimestamp: event.block.timestamp.toI32(),
    eventIndex: eventIndex as i32,
    isPullProvider: isPullProvider,
    isPushProvider: isPushProvider,
    provider: providerId,
    hooks: hooksInstanceId,
    pullProviderIndex: pullProviderIndex,
    pushProviderIndex: pushProviderIndex,
    timeToLive: timeToLive,
    transactionHash: event.transaction.hash,
    blockLogIndex: event.logIndex.toI32(),
  });
  return createRoleProvider(providerId, {
    isApproved: true,
    isPullProvider: isPullProvider,
    isPushProvider: isPushProvider,
    hooks: hooksInstanceId,
    pullProviderIndex: pullProviderIndex,
    pushProviderIndex: pushProviderIndex,
    timeToLive: timeToLive,
    providerAddress: providerAddress,
  });
}

function decodeAndCreateHooksConfig(
  market: Bytes,
  marketId: string,
  hooksConfig: BigInt
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
  log.warning("Hooks Config: {}", [hooksConfigBytes]);
  log.warning("Hooks Address: {}", [hooksAddress.toHex()]);
  log.warning("Market: {}", [market.toHex()]);
  let versionString = hooksContract.version();
  let depositRequiresAccess: boolean = false;
  let transferRequiresAccess: boolean = false;
  let queueWithdrawalRequiresAccess: boolean = false;
  let transfersDisabled: boolean = false;
  let allowClosureBeforeTerm: boolean = false;
  let allowForceBuyBacks: boolean = false;
  let allowTermReduction: boolean = false;
  let fixedTermEndTime: i32 = 0;
  let minimumDeposit: BigInt | null = null;
  if (versionString == "OpenTermHooks") {
    let openTermHooksContract = IOpenTermHooks.bind(
      Address.fromBytes(hooksAddress)
    );
    let hookedMarket = openTermHooksContract.getHookedMarket(
      Address.fromBytes(market)
    );
    depositRequiresAccess = hookedMarket.depositRequiresAccess;
    transferRequiresAccess = hookedMarket.transferRequiresAccess;
    transfersDisabled = hookedMarket.transfersDisabled;
    allowForceBuyBacks = hookedMarket.allowForceBuyBacks;
    minimumDeposit = hookedMarket.minimumDeposit;
    queueWithdrawalRequiresAccess = useOnQueueWithdrawal;
  } else {
    // @todo handle unknown hooks kind
    let fixedTermHooksContract = IFixedTermHooks.bind(
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
  let asset = createTokenIfNotExists(assetAddress);
  if (asset != null) {
    let marketId = generateMarketId(market);
    MarketTemplate.create(market);
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
      hooksConfigValue
    );
    let hooks = HooksInstance.load(hooksConfig.hooks);
    if (hooks == null) {
      return;
    }

    let hooksTemplate = HooksTemplate.load(hooks.hooksTemplate);
    if (hooksTemplate == null) {
      return;
    }
    let hooksFactory = getOrCreateHooksFactory(event.address, marketType);
    let version = "V2";
    let commitmentFeeBips: BigInt | null = null;
    let drawnAmount: BigInt | null = null;
    if (marketType == "Revolving") {
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

    createMarket(marketId, {
      name: name,
      symbol: symbol,
      asset: asset.id,
      borrower: hooks.borrower,
      controller: null,
      annualInterestBips: annualInterestBips.toI32(),
      decimals: asset.decimals,
      delinquencyGracePeriod: delinquencyGracePeriod.toI32(),
      delinquencyFeeBips: delinquencyFeeBips.toI32(),
      feeRecipient: hooksTemplate.feeRecipient,
      protocolFeeBips: hooksTemplate.protocolFeeBips,
      sentinel: hooksFactory.sentinel,
      scaleFactor: BigInt.fromI32(10).pow(27),
      maxTotalSupply: maxTotalSupply,
      lastInterestAccruedTimestamp: event.block.timestamp.toI32(),
      lastInterestAccruedBlockNumber: event.block.number.toI32(),
      reserveRatioBips: reserveRatioBips.toI32(),
      withdrawalBatchDuration: withdrawalBatchDuration.toI32(),
      isRegistered: true,
      archController: hooksFactory.archController,
      deployedEvent: marketDeployedId,
      createdAt: event.block.timestamp.toI32(),
      hooks: hooks.id,
      hooksFactory: hooksFactory.id,
      marketType: hooksFactory.marketType,
      commitmentFeeBips: commitmentFeeBips,
      drawnAmount: drawnAmount,
      version: version,
      numCollateralContracts: 0,
    });
    hooks.numMarkets = hooks.numMarkets + 1;
    hooks.save();
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
