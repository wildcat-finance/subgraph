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
  createAccessControlHooks,
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
  generateAccessControlHooksId,
  generateHooksConfigId,
  generateHooksInstanceDeployedId,
  generateHooksTemplateAddedId,
  generateHooksTemplateDisabledId,
  generateHooksTemplateFeesUpdatedId,
  generateHooksTemplateId,
  generateMarketId,
  generateTokenId,
  getHooksTemplate,
} from "../generated/UncrashableEntityHelpers";
import { IERC20 } from "../generated/HooksFactory/IERC20";
import { HooksFactory as HooksFactoryContract } from "../generated/HooksFactory/HooksFactory";
import { AccessControlHooks as IAccessControlHooks } from "../generated/HooksFactory/AccessControlHooks";
import {
  AccessControlHooks,
  HooksConfig,
  HooksFactory,
  HooksTemplate,
  Token,
} from "../generated/schema";
import { generateEventId } from "./utils";
import {
  AccessControlHooks as AccessControlHooksTemplate,
  WildcatMarket as MarketTemplate,
} from "../generated/templates";
import { Address, BigInt, Bytes, log } from "@graphprotocol/graph-ts";

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
  const hooksInstanceId = generateAccessControlHooksId(hooksInstance);
  const hooksTemplate = getHooksTemplate(hooksTemplateId);
  log.warning("Hooks Template: {}", [hooksTemplateId]);
  log.warning("Hooks Instance: {}", [hooksInstanceId]);
  log.warning("Hooks name: {}", [hooksTemplate.name]);
  log.warning("Hooks name is ACH: {}", [
    hooksTemplate.name == "SingleBorrowerAccessControlHooks" ? "true" : "false",
  ]);
  if (hooksTemplate.name == "SingleBorrowerAccessControlHooks") {
    const hooksContract = IAccessControlHooks.bind(hooksInstance);
    createAccessControlHooks(hooksInstanceId, {
      borrower: hooksContract.borrower(),
      hooksFactory: hooksFactory.id,
      hooksTemplate: hooksTemplateId,
    });
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
  AccessControlHooksTemplate.create(hooksInstance);
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
      originationFeeAsset: event.params.originationFeeAsset,
      protocolFeeBips: event.params.protocolFeeBips,
    }
  );

  createHooksTemplate(hooksTemplateId, {
    feeRecipient: event.params.feeRecipient,
    originationFeeAmount: event.params.originationFeeAmount,
    originationFeeAsset: event.params.originationFeeAsset,
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
      originationFeeAsset: event.params.originationFeeAsset,
      protocolFeeBips: event.params.protocolFeeBips,
    }
  );
  hooksTemplateEntity.feeRecipient = event.params.feeRecipient;
  hooksTemplateEntity.originationFeeAmount = event.params.originationFeeAmount;
  hooksTemplateEntity.originationFeeAsset = event.params.originationFeeAsset;
  hooksTemplateEntity.protocolFeeBips = event.params.protocolFeeBips;
  hooksTemplateEntity.save();
  hooksFactory.eventIndex = hooksFactory.eventIndex + 1;
  hooksFactory.save();
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
  const accessControlHooks = IAccessControlHooks.bind(
    Address.fromBytes(hooksAddress)
  );
  log.warning("Hooks Config: {}", [hooksConfigBytes]);
  log.warning("Hooks Address: {}", [hooksAddress.toHex()]);
  log.warning("Market: {}", [market.toHex()]);

  const hookedMarket = accessControlHooks.getHookedMarket(
    Address.fromBytes(market)
  );

  return createHooksConfig(generateHooksConfigId(market), {
    depositRequiresAccess: hookedMarket.depositRequiresAccess,
    queueWithdrawalRequiresAccess: useOnQueueWithdrawal,
    transferRequiresAccess: hookedMarket.transferRequiresAccess,
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
  });
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
  const hooks = AccessControlHooks.load(hooksConfig.hooks);
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
    minimumDeposit: null,
    version: version,
  });
}
