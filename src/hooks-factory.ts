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
  getOrInitializeHooksFactory,
  getOrInitializeHooksInstanceDeployed,
} from "../generated/UncrashableEntityHelpers";
import { IERC20 } from "../generated/HooksFactory/IERC20";
import { AccessControlHooks as IAccessControlHooks } from "../generated/HooksFactory/AccessControlHooks";
import { Token } from "../generated/schema";
import { generateEventId } from "./utils";
import { WildcatMarket as MarketTemplate } from "../generated/templates";
import { Address, BigInt, Bytes } from "@graphprotocol/graph-ts";

export function handleChangedSpherexEngineAddress(
  event: ChangedSpherexEngineAddressEvent
): void {}
export function handleChangedSpherexOperator(
  event: ChangedSpherexOperatorEvent
): void {}
export function handleHooksInstanceDeployed(
  event: HooksInstanceDeployedEvent
): void {
  const hooksFactory = getOrInitializeHooksFactory(event.address.toHex(), {
    isRegistered: true,
  });
  const hooksInstance = event.params.hooksInstance;
  const hooksTemplate = event.params.hooksTemplate;
  const hooksTemplateId = generateHooksTemplateId(hooksTemplate);
  const hooksInstanceId = generateAccessControlHooksId(hooksInstance);
  createHooksInstanceDeployed(
    generateHooksInstanceDeployedId(
      hooksInstance,
      hooksFactory.entity.eventIndex
    ),
    {
      hooks: hooksInstanceId,
      hooksTemplate: hooksTemplateId,
      blockNumber: event.block.number.toI32(),
      blockTimestamp: event.block.timestamp.toI32(),
      transactionHash: event.transaction.hash,
    }
  );
  hooksFactory.entity.eventIndex = hooksFactory.entity.eventIndex + 1;
  hooksFactory.entity.save();
}
export function handleHooksTemplateAdded(event: HooksTemplateAddedEvent): void {
  const hooksFactory = getOrInitializeHooksFactory(event.address.toHex(), {
    isRegistered: true,
  });
  const hooksTemplate = event.params.hooksTemplate;
  const hooksTemplateId = generateHooksTemplateId(hooksTemplate);
  createHooksTemplateAdded(
    generateHooksTemplateAddedId(hooksTemplate, hooksFactory.entity.eventIndex),
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
    hooksFactory: hooksFactory.entity.id,
    name: event.params.name,
  });
  hooksFactory.entity.eventIndex = hooksFactory.entity.eventIndex + 1;
  hooksFactory.entity.save();
}
export function handleHooksTemplateDisabled(
  event: HooksTemplateDisabledEvent
): void {
  const hooksFactory = getOrInitializeHooksFactory(event.address.toHex(), {
    isRegistered: true,
  });
  const hooksTemplate = event.params.hooksTemplate;
  const hooksTemplateId = generateHooksTemplateId(hooksTemplate);
  createHooksTemplateDisabled(
    generateHooksTemplateDisabledId(
      hooksTemplate,
      hooksFactory.entity.eventIndex
    ),
    {
      blockNumber: event.block.number.toI32(),
      blockTimestamp: event.block.timestamp.toI32(),
      transactionHash: event.transaction.hash,
      hooksTemplate: hooksTemplateId,
    }
  );
  hooksFactory.entity.eventIndex = hooksFactory.entity.eventIndex + 1;
  hooksFactory.entity.save();
  const hooksTemplateEntity = getHooksTemplate(hooksTemplateId);
  hooksTemplateEntity.disabled = true;
  hooksTemplateEntity.save();
}
export function handleHooksTemplateFeesUpdated(
  event: HooksTemplateFeesUpdatedEvent
): void {
  const hooksFactory = getOrInitializeHooksFactory(event.address.toHex(), {
    isRegistered: true,
  });
  const hooksTemplate = event.params.hooksTemplate;
  const hooksTemplateId = generateHooksTemplateId(hooksTemplate);
  const hooksTemplateEntity = getHooksTemplate(hooksTemplateId);
  createHooksTemplateFeesUpdated(
    generateHooksTemplateFeesUpdatedId(
      hooksTemplate,
      hooksFactory.entity.eventIndex
    ),
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
  hooksFactory.entity.eventIndex = hooksFactory.entity.eventIndex + 1;
  hooksFactory.entity.save();
}

function decodeAndCreateHooksConfig(
  market: Bytes,
  marketId: string,
  hooksConfig: BigInt
) {
  const hooksConfigBytes = hooksConfig
    .toHex()
    .replace("0x", "")
    .padStart(64, "0");
  const hooksAddress = Bytes.fromHexString(hooksConfigBytes.slice(0, 40));
  const useOnDeposit = hooksConfigBytes.slice(40, 42) == "00";
  const useOnQueueWithdrawal = hooksConfigBytes.slice(42, 44) == "00";
  const useOnExecuteWithdrawal = hooksConfigBytes.slice(44, 46) == "00";
  const useOnTransfer = hooksConfigBytes.slice(46, 48) == "00";
  const useOnBorrow = hooksConfigBytes.slice(48, 50) == "00";
  const useOnRepay = hooksConfigBytes.slice(50, 52) == "00";
  const useOnCloseMarket = hooksConfigBytes.slice(52, 54) == "00";
  const useOnNukeFromOrbit = hooksConfigBytes.slice(54, 56) == "00";
  const useOnSetMaxTotalSupply = hooksConfigBytes.slice(56, 58) == "00";
  const useOnSetAnnualInterestAndReserveRatioBips =
    hooksConfigBytes.slice(58, 60) == "00";
  const useOnSetProtocolFeeBips = hooksConfigBytes.slice(60, 62) == "00";
  const accessControlHooks = IAccessControlHooks.bind(hooksAddress);
  const hookedMarket = accessControlHooks.getHookedMarket(market)

  createHooksConfig(generateHooksConfigId(market), {
    depositRequiresAccess: hookedMarket.depositRequiresAccess,
    queueWithdrawalRequiresAccess: null,
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

export function handleMarketDeployed(event: MarketDeployedEvent): void {
  const hooksConfig = event.params.hooks;
  let assetId = generateTokenId(event.params.asset);
  if (Token.load(assetId) == null) {
    let erc20 = IERC20.bind(event.params.asset);
    let result = erc20.try_isMock();
    // let isMock = !result.reverted && result.value;
    createToken(assetId, {
      address: event.params.asset,
      name: erc20.name(),
      symbol: erc20.symbol(),
      decimals: erc20.decimals(),
      isMock: true,
    });
  }
  const marketId = generateMarketId(event.params.market);
  MarketTemplate.create(event.params.market);
  const marketDeployedId = generateEventId(event);
  createMarketDeployed(marketDeployedId, {
    blockNumber: event.block.number.toI32(),
    blockTimestamp: event.block.timestamp.toI32(),
    transactionHash: event.transaction.hash,
    market: marketId,
  });

  createMarket(marketId, {
    name: event.params.name,
    symbol: event.params.symbol,
    asset: assetId,
    borrower: event.params.borrower,
    controller: controller.id,
    annualInterestBips: event.params.annualInterestBips.toI32(),
    decimals: contract.decimals(),
    delinquencyGracePeriod: event.params.delinquencyGracePeriod.toI32(),
    delinquencyFeeBips: event.params.delinquencyFeeBips.toI32(),
    feeRecipient: controllerFactory.feeRecipient,
    protocolFeeBips: controllerFactory.protocolFeeBips,
    sentinel: controllerFactory.sentinel,
    scaleFactor: BigInt.fromI32(10).pow(27),
    maxTotalSupply: event.params.maxTotalSupply,
    lastInterestAccruedTimestamp: event.block.timestamp.toI32(),
    reserveRatioBips: event.params.reserveRatioBips.toI32(),
    withdrawalBatchDuration: event.params.withdrawalBatchDuration.toI32(),
    isRegistered: true,
    archController: controller.archController,
    deployedEvent: marketDeployedId,
    createdAt: event.block.timestamp.toI32(),
    hooks: null,
    hooksConfig: null,
    hooksFactory: null,
    minimumDeposit: null,
    version: "",
  });
}
