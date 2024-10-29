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
  createHooksInstance,
  createHooksConfig,
  createHooksFactory,
  createHooksInstanceDeployed,
  createHooksTemplate,
  createHooksTemplateAdded,
  createHooksTemplateDisabled,
  createHooksTemplateFeesUpdated,
  createMarket,
  createMarketDeployed,
  createToken,
  generateHooksInstanceId,
  generateHooksConfigId,
  generateHooksInstanceDeployedId,
  generateHooksTemplateAddedId,
  generateHooksTemplateDisabledId,
  generateHooksTemplateFeesUpdatedId,
  generateHooksTemplateId,
  generateMarketId,
  generateTokenId,
  getHooksTemplate,
  createRoleProviderAdded,
  generateRoleProviderId,
  createRoleProvider,
} from "../generated/UncrashableEntityHelpers";
import { IERC20 } from "../generated/HooksFactory/IERC20";
import { HooksFactory as HooksFactoryContract } from "../generated/HooksFactory/HooksFactory";
import { OpenTermHooks as IOpenTermHooks } from "../generated/HooksFactory/OpenTermHooks";
import { FixedTermHooks as IFixedTermHooks } from "../generated/HooksFactory/FixedTermHooks";
import { CombinedHooks as ICombinedHooks } from "../generated/HooksFactory/CombinedHooks";
import {
  HooksInstance,
  HooksConfig,
  HooksFactory,
  HooksTemplate,
  Token,
  RoleProvider,
} from "../generated/schema";
import { generateEventId, isNullAddress } from "./utils";
import {
  CombinedHooks,
  WildcatMarket as MarketTemplate,
} from "../generated/templates";
import { Address, BigInt, Bytes, ethereum, log } from "@graphprotocol/graph-ts";

function generateHooksInstanceEventId(hooks: HooksInstance): string {
  return "RECORD" + "-" + hooks.id + "-" + hooks.eventIndex.toString();
}

function generateRecordId(id: string, eventIndex: number): string {
  return "RECORD" + "-" + id + "-" + eventIndex.toString();
}

function getOrCreateHooksFactory(address: Address): HooksFactory {
  let hooksFactory = HooksFactory.load(address.toHex());
  if (hooksFactory == null) {
    const hooksFactoryContract = HooksFactoryContract.bind(address);
    return createHooksFactory(address.toHex(), {
      isRegistered: true,
      sentinel: hooksFactoryContract.sanctionsSentinel(),
      archController: hooksFactoryContract.archController().toHex(),
    });
  }
  return hooksFactory;
}

export function handleChangedSpherexEngineAddress(
  event: ChangedSpherexEngineAddressEvent
): void {}
export function handleChangedSpherexOperator(
  event: ChangedSpherexOperatorEvent
): void {}
export function handleHooksInstanceDeployed(
  event: HooksInstanceDeployedEvent
): void {
  const hooksFactory = getOrCreateHooksFactory(event.address);
  const hooksInstance = event.params.hooksInstance;
  const hooksTemplateId = generateHooksTemplateId(event.params.hooksTemplate);
  const hooksInstanceId = generateHooksInstanceId(hooksInstance);
  const hooksTemplate = getHooksTemplate(hooksTemplateId);
  log.warning("Hooks Template: {}", [hooksTemplateId]);
  log.warning("Hooks Instance: {}", [hooksInstanceId]);
  log.warning("Hooks name: {}", [hooksTemplate.name]);
  log.warning("Hooks name is ACH: {}", [
    hooksTemplate.name == "OpenTermHooks" ? "true" : "false",
  ]);
  const hooksContract = ICombinedHooks.bind(hooksInstance);
  const borrower = hooksContract.borrower();
  const name = hooksContract.name();
  let hooksWithProvider: HooksInstance | null = null;

  if (hooksTemplate.name == "OpenTermHooks") {
    hooksWithProvider = createHooksInstance(hooksInstanceId, {
      borrower: borrower,
      name: name,
      hooksFactory: hooksFactory.id,
      hooksTemplate: hooksTemplateId,
      kind: "OpenTerm",
    });
  } else if (hooksTemplate.name === "FixedTermHooks") {
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
    const pullProviders = hooksContract.getPullProviders();
    const pushProviders = hooksContract.getPushProviders();
    for (let i = 0; i < pullProviders.length; i++) {
      const pullProvider = pullProviders[i];
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
      const pushProvider = pushProviders[i];
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
    }
  );
  hooksFactory.eventIndex = hooksFactory.eventIndex + 1;
  hooksFactory.save();
  CombinedHooks.create(hooksInstance);
}

function createTokenIfNotExists(asset: Address): Token {
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
  if (isNullAddress(asset)) {
    return null;
  }
  return createTokenIfNotExists(asset).id;
}

export function handleHooksTemplateAdded(event: HooksTemplateAddedEvent): void {
  const hooksFactory = getOrCreateHooksFactory(event.address);
  const hooksTemplate = event.params.hooksTemplate;
  const hooksTemplateId = generateHooksTemplateId(hooksTemplate);
  createHooksTemplateAdded(
    generateHooksTemplateAddedId(hooksTemplate, hooksFactory.eventIndex),
    {
      blockNumber: event.block.number.toI32(),
      blockTimestamp: event.block.timestamp.toI32(),
      transactionHash: event.transaction.hash,
      hooksTemplate: hooksTemplateId,
      feeRecipient: event.params.feeRecipient,
      originationFeeAmount: event.params.originationFeeAmount,
      originationFeeAsset: getOrCreateTokenId(event.params.originationFeeAsset),
      protocolFeeBips: event.params.protocolFeeBips,
    }
  );

  createHooksTemplate(hooksTemplateId, {
    feeRecipient: event.params.feeRecipient,
    originationFeeAmount: event.params.originationFeeAmount,
    originationFeeAsset: getOrCreateTokenId(event.params.originationFeeAsset),
    protocolFeeBips: event.params.protocolFeeBips,
    hooksFactory: hooksFactory.id,
    name: event.params.name,
  });
  hooksFactory.eventIndex = hooksFactory.eventIndex + 1;
  hooksFactory.save();
}
export function handleHooksTemplateDisabled(
  event: HooksTemplateDisabledEvent
): void {
  const hooksFactory = getOrCreateHooksFactory(event.address);
  const hooksTemplate = event.params.hooksTemplate;
  const hooksTemplateId = generateHooksTemplateId(hooksTemplate);
  createHooksTemplateDisabled(
    generateHooksTemplateDisabledId(hooksTemplate, hooksFactory.eventIndex),
    {
      blockNumber: event.block.number.toI32(),
      blockTimestamp: event.block.timestamp.toI32(),
      transactionHash: event.transaction.hash,
      hooksTemplate: hooksTemplateId,
    }
  );
  hooksFactory.eventIndex = hooksFactory.eventIndex + 1;
  hooksFactory.save();
  const hooksTemplateEntity = getHooksTemplate(hooksTemplateId);
  hooksTemplateEntity.disabled = true;
  hooksTemplateEntity.save();
}
export function handleHooksTemplateFeesUpdated(
  event: HooksTemplateFeesUpdatedEvent
): void {
  const hooksFactory = getOrCreateHooksFactory(event.address);
  const hooksTemplate = event.params.hooksTemplate;
  const hooksTemplateId = generateHooksTemplateId(hooksTemplate);
  const hooksTemplateEntity = getHooksTemplate(hooksTemplateId);
  createHooksTemplateFeesUpdated(
    generateHooksTemplateFeesUpdatedId(hooksTemplate, hooksFactory.eventIndex),
    {
      blockNumber: event.block.number.toI32(),
      blockTimestamp: event.block.timestamp.toI32(),
      transactionHash: event.transaction.hash,
      hooksTemplate: hooksTemplateId,
      feeRecipient: event.params.feeRecipient,
      originationFeeAmount: event.params.originationFeeAmount,
      originationFeeAsset: getOrCreateTokenId(event.params.originationFeeAsset),
      protocolFeeBips: event.params.protocolFeeBips,
    }
  );
  hooksTemplateEntity.feeRecipient = event.params.feeRecipient;
  hooksTemplateEntity.originationFeeAmount = event.params.originationFeeAmount;
  hooksTemplateEntity.originationFeeAsset = getOrCreateTokenId(
    event.params.originationFeeAsset
  );
  hooksTemplateEntity.protocolFeeBips = event.params.protocolFeeBips;
  hooksTemplateEntity.save();
  hooksFactory.eventIndex = hooksFactory.eventIndex + 1;
  hooksFactory.save();
}
function decodeAndCreateRoleProvider(
  event: ethereum.Event,
  hooksAddress: Bytes,
  hooksInstanceId: string,
  eventIndex: number,
  encodedRoleProvider: BigInt
): RoleProvider {
  const nullProviderIndex = 2 ** 24 - 1;
  const hooksConfigBytes = encodedRoleProvider
    .toHex()
    .replace("0x", "")
    .padStart(64, "0");
  /*       _timeToLive := shr(0xe0, provider)
      _providerAddress := shr(0x60, shl(0x20, provider))
      _pullProviderIndex := shr(0xe8, shl(0xc0, provider))
      _pushProviderIndex := shr(0xe8, shl(0xd8, provider)) */
  const timeToLive = Bytes.fromHexString(hooksConfigBytes.slice(0, 8)).toI32();
  const providerAddress = Bytes.fromHexString(hooksConfigBytes.slice(8, 48));
  const pullProviderIndex = Bytes.fromHexString(
    hooksConfigBytes.slice(48, 54)
  ).toI32();
  const pushProviderIndex = Bytes.fromHexString(
    hooksConfigBytes.slice(54, 60)
  ).toI32();
  const isPullProvider = pullProviderIndex !== nullProviderIndex;
  const isPushProvider = pushProviderIndex !== nullProviderIndex;
  const providerId = generateRoleProviderId(hooksAddress, providerAddress);
  createRoleProviderAdded(generateRecordId(hooksInstanceId, eventIndex), {
    blockNumber: event.block.number.toI32(),
    blockTimestamp: event.block.timestamp.toI32(),
    eventIndex: eventIndex,
    isPullProvider: isPullProvider,
    isPushProvider: isPushProvider,
    provider: providerId,
    hooks: hooksInstanceId,
    pullProviderIndex: pullProviderIndex,
    pushProviderIndex: pushProviderIndex,
    timeToLive: timeToLive,
    transactionHash: event.transaction.hash,
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
  const hooksConfigBytes = hooksConfig
    .toHex()
    .replace("0x", "")
    .padEnd(64, "0");

  const hooksAddress = Bytes.fromHexString(hooksConfigBytes.slice(0, 40));
  const flagBytes = Bytes.fromHexString(hooksConfigBytes.slice(40, 64));
  const firstByte = flagBytes[0];
  const useOnDeposit = ((firstByte >> 7) & 1) == 1;
  const useOnQueueWithdrawal = ((firstByte >> 6) & 1) == 1;
  const useOnExecuteWithdrawal = ((firstByte >> 5) & 1) == 1;
  const useOnTransfer = ((firstByte >> 4) & 1) == 1;
  const useOnBorrow = ((firstByte >> 3) & 1) == 1;
  const useOnRepay = ((firstByte >> 2) & 1) == 1;
  const useOnCloseMarket = ((firstByte >> 1) & 1) == 1;
  const useOnNukeFromOrbit = (firstByte & 1) == 1;
  const secondByte = flagBytes[1];
  const useOnSetMaxTotalSupply = ((secondByte >> 7) & 1) == 1;
  const useOnSetAnnualInterestAndReserveRatioBips =
    ((secondByte >> 6) & 1) == 1;
  const useOnSetProtocolFeeBips = ((secondByte >> 5) & 1) == 1;
  const hooksContract = ICombinedHooks.bind(Address.fromBytes(hooksAddress));
  log.warning("Hooks Config: {}", [hooksConfigBytes]);
  log.warning("Hooks Address: {}", [hooksAddress.toHex()]);
  log.warning("Market: {}", [market.toHex()]);
  const versionString = hooksContract.version();
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
    const openTermHooksContract = IOpenTermHooks.bind(
      Address.fromBytes(hooksAddress)
    );
    const hookedMarket = openTermHooksContract.getHookedMarket(
      Address.fromBytes(market)
    );
    depositRequiresAccess = hookedMarket.depositRequiresAccess;
    transferRequiresAccess = hookedMarket.transferRequiresAccess;
    transfersDisabled = hookedMarket.transfersDisabled;
    allowForceBuyBacks = hookedMarket.allowForceBuyBacks;
    minimumDeposit = hookedMarket.minimumDeposit;
  } else {
    // @todo handle unknown hooks kind
    const fixedTermHooksContract = IFixedTermHooks.bind(
      Address.fromBytes(hooksAddress)
    );
    const hookedMarket = fixedTermHooksContract.getHookedMarket(
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

export function handleMarketDeployed(event: MarketDeployedEvent): void {
  const params = event.params;
  let asset = createTokenIfNotExists(params.asset);
  const marketId = generateMarketId(params.market);
  MarketTemplate.create(params.market);
  const marketDeployedId = generateEventId(event);
  createMarketDeployed(marketDeployedId, {
    blockNumber: event.block.number.toI32(),
    blockTimestamp: event.block.timestamp.toI32(),
    transactionHash: event.transaction.hash,
    market: marketId,
  });
  const hooksConfig = decodeAndCreateHooksConfig(
    params.market,
    marketId,
    params.hooks
  );
  const hooks = HooksInstance.load(hooksConfig.hooks);
  if (hooks == null) {
    return;
  }

  const hooksTemplate = HooksTemplate.load(hooks.hooksTemplate);
  if (hooksTemplate == null) {
    return;
  }
  const hooksFactory = getOrCreateHooksFactory(event.address);
  const version = "V2";

  createMarket(marketId, {
    name: params.name,
    symbol: params.symbol,
    asset: asset.id,
    borrower: hooks.borrower,
    controller: null,
    annualInterestBips: params.annualInterestBips.toI32(),
    decimals: asset.decimals,
    delinquencyGracePeriod: params.delinquencyGracePeriod.toI32(),
    delinquencyFeeBips: params.delinquencyFeeBips.toI32(),
    feeRecipient: hooksTemplate.feeRecipient,
    protocolFeeBips: hooksTemplate.protocolFeeBips,
    sentinel: hooksFactory.sentinel,
    scaleFactor: BigInt.fromI32(10).pow(27),
    maxTotalSupply: params.maxTotalSupply,
    lastInterestAccruedTimestamp: event.block.timestamp.toI32(),
    reserveRatioBips: params.reserveRatioBips.toI32(),
    withdrawalBatchDuration: params.withdrawalBatchDuration.toI32(),
    isRegistered: true,
    archController: hooksFactory.archController,
    deployedEvent: marketDeployedId,
    createdAt: event.block.timestamp.toI32(),
    hooks: hooks.id,
    hooksFactory: hooksFactory.id,
    version: version,
  });
}
