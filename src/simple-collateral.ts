import { BigInt } from "@graphprotocol/graph-ts";
import {
  CollateralDeposited,
  CollateralReclaimed,
  FullLiquidation,
  LiquidatedSharesReset,
  Liquidation,
} from "../generated/templates/SimpleMarketCollateralMultiParty/SimpleMarketCollateralMultiParty";
import {
  SimpleCollateralContractDeposit,
  SimpleCollateralContractFullReset,
  SimpleCollateralContractLiquidatedSharesReset,
  SimpleCollateralContractLiquidation,
  SimpleCollateralContractReclaim,
} from "../generated/schema";
import {
  getOrCreateCollateralDepositor,
  loadCollateralContract,
  saveCollateralDepositor,
  saveCollateralSnapshot,
} from "./collateral-domain";
import { generateEventId } from "./utils";

export function handleCollateralDeposited(event: CollateralDeposited): void {
  let loaded = loadCollateralContract(event);
  if (loaded == null) {
    return;
  }
  let collateral = loaded;
  let depositor = getOrCreateCollateralDepositor(
    event,
    collateral,
    event.params.depositor
  );
  let eventIndex = collateral.eventIndex;

  depositor.totalDeposited = depositor.totalDeposited.plus(
    event.params.depositAmount
  );
  depositor.shares = depositor.shares.plus(event.params.sharesMinted);
  saveCollateralDepositor(event, depositor);

  let record = new SimpleCollateralContractDeposit(generateEventId(event));
  record.collateralContract = collateral.id;
  record.account = depositor.id;
  record.amountDeposited = event.params.depositAmount;
  record.sharesMinted = event.params.sharesMinted;
  record.lastFullLiquidationIndex =
    event.params.lastFullLiquidationIndex.toI32();
  record.depositIndex = collateral.depositIndex;
  record.eventIndex = eventIndex;
  record.blockNumber = event.block.number.toI32();
  record.blockTimestamp = event.block.timestamp.toI32();
  record.transactionHash = event.transaction.hash;
  record.blockLogIndex = event.logIndex.toI32();
  record.save();

  collateral.availableCollateral = collateral.availableCollateral.plus(
    event.params.depositAmount
  );
  collateral.totalDeposited = collateral.totalDeposited.plus(
    event.params.depositAmount
  );
  collateral.totalShares = collateral.totalShares.plus(
    event.params.sharesMinted
  );
  collateral.lastFullLiquidationIndex =
    event.params.lastFullLiquidationIndex.toI32();
  collateral.depositIndex = collateral.depositIndex + 1;
  collateral.eventIndex = eventIndex + 1;
  collateral.save();
  saveCollateralSnapshot(event, collateral);
}

export function handleCollateralReclaimed(event: CollateralReclaimed): void {
  let loaded = loadCollateralContract(event);
  if (loaded == null) {
    return;
  }
  let collateral = loaded;
  let depositor = getOrCreateCollateralDepositor(
    event,
    collateral,
    event.params.reclaimant
  );
  let eventIndex = collateral.eventIndex;

  depositor.shares = depositor.shares.minus(event.params.sharesBurned);
  depositor.totalReclaimed = depositor.totalReclaimed.plus(
    event.params.amountReclaimed
  );
  saveCollateralDepositor(event, depositor);

  let record = new SimpleCollateralContractReclaim(generateEventId(event));
  record.collateralContract = collateral.id;
  record.account = depositor.id;
  record.amountReclaimed = event.params.amountReclaimed;
  record.sharesBurned = event.params.sharesBurned;
  record.eventIndex = eventIndex;
  record.blockNumber = event.block.number.toI32();
  record.blockTimestamp = event.block.timestamp.toI32();
  record.transactionHash = event.transaction.hash;
  record.blockLogIndex = event.logIndex.toI32();
  record.save();

  collateral.availableCollateral = collateral.availableCollateral.minus(
    event.params.amountReclaimed
  );
  collateral.totalReclaimed = collateral.totalReclaimed.plus(
    event.params.amountReclaimed
  );
  collateral.totalShares = collateral.totalShares.minus(
    event.params.sharesBurned
  );
  collateral.eventIndex = eventIndex + 1;
  collateral.save();
  saveCollateralSnapshot(event, collateral);
}

export function handleLiquidation(event: Liquidation): void {
  let loaded = loadCollateralContract(event);
  if (loaded == null) {
    return;
  }
  let collateral = loaded;
  let eventIndex = collateral.eventIndex;

  let record = new SimpleCollateralContractLiquidation(generateEventId(event));
  record.collateralContract = collateral.id;
  record.collateralLiquidated = event.params.collateralLiquidated;
  record.underlyingReceived = event.params.underlyingReceived;
  record.liquidator = event.params.liquidator;
  record.eventIndex = eventIndex;
  record.blockNumber = event.block.number.toI32();
  record.blockTimestamp = event.block.timestamp.toI32();
  record.transactionHash = event.transaction.hash;
  record.blockLogIndex = event.logIndex.toI32();
  record.save();

  collateral.availableCollateral = collateral.availableCollateral.minus(
    event.params.collateralLiquidated
  );
  collateral.totalLiquidated = collateral.totalLiquidated.plus(
    event.params.collateralLiquidated
  );
  let cooldown = collateral.get("liquidationCooldown");
  if (cooldown != null) {
    collateral.nextLiquidationTrigger = event.block.timestamp
      .plus(BigInt.fromI32(cooldown.toI32()))
      .toI32();
  }
  collateral.eventIndex = eventIndex + 1;
  collateral.save();
  saveCollateralSnapshot(event, collateral);
}

export function handleFullLiquidation(event: FullLiquidation): void {
  let loaded = loadCollateralContract(event);
  if (loaded == null) {
    return;
  }
  let collateral = loaded;
  let eventIndex = collateral.eventIndex;

  let record = new SimpleCollateralContractFullReset(generateEventId(event));
  record.collateralContract = collateral.id;
  record.lastFullLiquidationIndex =
    event.params.lastFullLiquidationIndex.toI32();
  record.eventIndex = eventIndex;
  record.blockNumber = event.block.number.toI32();
  record.blockTimestamp = event.block.timestamp.toI32();
  record.transactionHash = event.transaction.hash;
  record.blockLogIndex = event.logIndex.toI32();
  record.save();

  collateral.totalShares = BigInt.zero();
  collateral.lastFullLiquidationIndex =
    event.params.lastFullLiquidationIndex.toI32();
  collateral.eventIndex = eventIndex + 1;
  collateral.save();
  saveCollateralSnapshot(event, collateral);
}

export function handleLiquidatedSharesReset(
  event: LiquidatedSharesReset
): void {
  let loaded = loadCollateralContract(event);
  if (loaded == null) {
    return;
  }
  let collateral = loaded;
  let depositor = getOrCreateCollateralDepositor(
    event,
    collateral,
    event.params.account
  );
  let eventIndex = collateral.eventIndex;

  depositor.shares = BigInt.zero();
  saveCollateralDepositor(event, depositor);

  let record = new SimpleCollateralContractLiquidatedSharesReset(
    generateEventId(event)
  );
  record.collateralContract = collateral.id;
  record.account = depositor.id;
  record.sharesReset = event.params.sharesReset;
  record.eventIndex = eventIndex;
  record.blockNumber = event.block.number.toI32();
  record.blockTimestamp = event.block.timestamp.toI32();
  record.transactionHash = event.transaction.hash;
  record.blockLogIndex = event.logIndex.toI32();
  record.save();

  collateral.eventIndex = eventIndex + 1;
  collateral.save();
  saveCollateralSnapshot(event, collateral);
}
