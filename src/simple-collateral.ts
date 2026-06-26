import { BigInt } from "@graphprotocol/graph-ts";
import { CollateralDeposited, CollateralReclaimed, Liquidation, FullLiquidation, LiquidatedSharesReset } from "../generated/templates/SimpleMarketCollateralMultiParty/SimpleMarketCollateralMultiParty";
import { createSimpleCollateralContractDeposit, createSimpleCollateralContractLiquidatedSharesReset, createSimpleCollateralContractReclaim, createSimpleCollateralContractFullReset, getOrInitializeSimpleCollateralContractDepositor, getSimpleCollateralContract, getSimpleCollateralContractDepositor, createSimpleCollateralContractLiquidation } from "../generated/UncrashableEntityHelpers";
import { generateEventId } from "./utils";
import { SimpleCollateralContract } from "../generated/schema";

function generateCollateralEventId(collateral: SimpleCollateralContract): string {
    return "RECORD" + "-" + collateral.id + "-" + collateral.eventIndex.toString()
}

export function handleCollateralDeposited(event: CollateralDeposited): void {
    let collateralContract = getSimpleCollateralContract(event.address.toHex());
    let depositor = getOrInitializeSimpleCollateralContractDepositor(event.params.depositor.toHex(), {
        collateralContract: collateralContract.id,
        totalDeposited: event.params.depositAmount,
        totalReclaimed: BigInt.fromI32(0),
        shares: event.params.sharesMinted,
    });
    if (!depositor.wasCreated) {
        depositor.entity.totalDeposited = depositor.entity.totalDeposited.plus(event.params.depositAmount);
        depositor.entity.shares = depositor.entity.shares.plus(event.params.sharesMinted);
        depositor.entity.save();
    }
    createSimpleCollateralContractDeposit(generateCollateralEventId(collateralContract), {
        collateralContract: collateralContract.id,
        account: depositor.entity.id,
        amountDeposited: event.params.depositAmount,
        sharesMinted: event.params.sharesMinted,
        lastFullLiquidationIndex: event.params.lastFullLiquidationIndex.toI32(),
        depositIndex: collateralContract.depositIndex,
        eventIndex: collateralContract.eventIndex,
        blockNumber: event.block.number.toI32(),
        blockTimestamp: event.block.timestamp.toI32(),
        transactionHash: event.transaction.hash,
        blockLogIndex: event.logIndex.toI32(),
    });
    collateralContract.availableCollateral = collateralContract.availableCollateral.plus(event.params.depositAmount);
    collateralContract.totalDeposited = collateralContract.totalDeposited.plus(event.params.depositAmount);
    collateralContract.totalShares = collateralContract.totalShares.plus(event.params.sharesMinted);
    collateralContract.lastFullLiquidationIndex = event.params.lastFullLiquidationIndex.toI32();
    collateralContract.depositIndex = collateralContract.depositIndex + 1;
    collateralContract.eventIndex = collateralContract.eventIndex + 1;
    collateralContract.save();
}

export function handleCollateralReclaimed(event: CollateralReclaimed): void {
    let collateralContract = getSimpleCollateralContract(event.address.toHex());
    let depositor = getSimpleCollateralContractDepositor(event.params.reclaimant.toHex());
    depositor.shares = depositor.shares.minus(event.params.sharesBurned);
    depositor.totalReclaimed = depositor.totalReclaimed.plus(event.params.amountReclaimed);
    depositor.save();
    collateralContract.availableCollateral = collateralContract.availableCollateral.minus(event.params.amountReclaimed);
    collateralContract.totalReclaimed = collateralContract.totalReclaimed.plus(event.params.amountReclaimed);
    collateralContract.totalShares = collateralContract.totalShares.minus(event.params.sharesBurned);
    collateralContract.save();
    createSimpleCollateralContractReclaim(generateCollateralEventId(collateralContract), {
        collateralContract: collateralContract.id,
        account: depositor.id,
        amountReclaimed: event.params.amountReclaimed,
        sharesBurned: event.params.sharesBurned,
        eventIndex: collateralContract.eventIndex,
        blockNumber: event.block.number.toI32(),
        blockTimestamp: event.block.timestamp.toI32(),
        transactionHash: event.transaction.hash,
        blockLogIndex: event.logIndex.toI32(),
    });
}

export function handleLiquidation(event: Liquidation): void {
    let collateralContract = getSimpleCollateralContract(event.address.toHex());
    createSimpleCollateralContractLiquidation(generateCollateralEventId(collateralContract), {
        collateralContract: collateralContract.id,
        collateralLiquidated: event.params.collateralLiquidated,
        underlyingReceived: event.params.underlyingReceived,
        liquidator: event.params.liquidator,
        eventIndex: collateralContract.eventIndex,
        blockNumber: event.block.number.toI32(),
        blockTimestamp: event.block.timestamp.toI32(),
        transactionHash: event.transaction.hash,
        blockLogIndex: event.logIndex.toI32(),
    });
    collateralContract.eventIndex = collateralContract.eventIndex + 1;
    collateralContract.availableCollateral = collateralContract.availableCollateral.minus(event.params.collateralLiquidated);
    collateralContract.totalLiquidated = collateralContract.totalLiquidated.plus(event.params.collateralLiquidated);
    collateralContract.nextLiquidationTrigger = event.block.timestamp.plus(BigInt.fromI32(collateralContract.liquidationCooldown)).toI32();
    collateralContract.save();
}

export function handleFullLiquidation(event: FullLiquidation): void {
    let collateralContract = getSimpleCollateralContract(event.address.toHex());
    collateralContract.totalShares = BigInt.fromI32(0);
    collateralContract.lastFullLiquidationIndex = event.params.lastFullLiquidationIndex.toI32();
    collateralContract.save();
    createSimpleCollateralContractFullReset(generateCollateralEventId(collateralContract), {
        collateralContract: collateralContract.id,
        lastFullLiquidationIndex: event.params.lastFullLiquidationIndex.toI32(),
        eventIndex: collateralContract.eventIndex,
        blockNumber: event.block.number.toI32(),
        blockTimestamp: event.block.timestamp.toI32(),
        transactionHash: event.transaction.hash,
        blockLogIndex: event.logIndex.toI32(),
    });
}

export function handleLiquidatedSharesReset(event: LiquidatedSharesReset): void {
    let collateralContract = getSimpleCollateralContract(event.address.toHex());
    let depositor = getSimpleCollateralContractDepositor(event.params.account.toHex());
    depositor.shares = BigInt.fromI32(0);
    depositor.save();
    createSimpleCollateralContractLiquidatedSharesReset(
        generateCollateralEventId(collateralContract),
        {
            collateralContract: collateralContract.id,
            account: depositor.id,
            sharesReset: event.params.sharesReset,
            eventIndex: collateralContract.eventIndex,
            blockNumber: event.block.number.toI32(),
            blockTimestamp: event.block.timestamp.toI32(),
            transactionHash: event.transaction.hash,
            blockLogIndex: event.logIndex.toI32(),
        }
    );
}
