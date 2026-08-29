import { Address, ethereum, log } from "@graphprotocol/graph-ts";
import { Market, MarketSnapshot } from "../generated/schema";
import { reconcileOptionalMarketLinks } from "./optional-market-links";
import { IWildcatMarketRevolving } from "../generated/templates/WildcatMarket/IWildcatMarketRevolving";

function copyMarketState(market: Market, snapshot: MarketSnapshot): void {
  snapshot.isClosed = market.isClosed;
  snapshot.totalAssets = market.totalAssets;
  snapshot.maxTotalSupply = market.maxTotalSupply;
  snapshot.protocolFeeBips = market.protocolFeeBips;
  snapshot.pendingProtocolFees = market.pendingProtocolFees;
  snapshot.normalizedUnclaimedWithdrawals =
    market.normalizedUnclaimedWithdrawals;
  snapshot.scaledTotalSupply = market.scaledTotalSupply;
  snapshot.scaledPendingWithdrawals = market.scaledPendingWithdrawals;
  snapshot.pendingWithdrawalExpiry = market.pendingWithdrawalExpiry;
  snapshot.isDelinquent = market.isDelinquent;
  snapshot.isIncurringPenalties = market.isIncurringPenalties;
  snapshot.timeDelinquent = market.timeDelinquent;
  snapshot.annualInterestBips = market.annualInterestBips;
  snapshot.commitmentFeeBips = market.commitmentFeeBips;
  snapshot.reserveRatioBips = market.reserveRatioBips;
  snapshot.drawnAmount = market.drawnAmount;
  snapshot.scaleFactor = market.scaleFactor;
  snapshot.lastInterestAccruedTimestamp =
    market.lastInterestAccruedTimestamp;
  snapshot.lastInterestAccruedBlockNumber =
    market.lastInterestAccruedBlockNumber;
  snapshot.originalAnnualInterestBips = market.originalAnnualInterestBips;
  snapshot.originalReserveRatioBips = market.originalReserveRatioBips;
  snapshot.temporaryReserveRatioExpiry = market.temporaryReserveRatioExpiry;
  snapshot.temporaryReserveRatioActive = market.temporaryReserveRatioActive;
}

function stampMarketSnapshot(
  event: ethereum.Event,
  snapshot: MarketSnapshot,
  source: string
): void {
  snapshot.source = source;
  snapshot.updatedAtBlock = event.block.number;
  snapshot.updatedAtTimestamp = event.block.timestamp;
  snapshot.updatedAtTransaction = event.transaction.hash;
  snapshot.updatedAtLogIndex = event.logIndex;
}

function refreshRevolvingState(market: Market): void {
  if (
    market.marketKind != "REVOLVING" ||
    market.eventGeneration == "V2_5"
  ) {
    return;
  }

  let contract = IWildcatMarketRevolving.bind(Address.fromBytes(market.address));
  let commitmentFeeBips = contract.try_commitmentFeeBips();
  if (!commitmentFeeBips.reverted) {
    market.commitmentFeeBips = commitmentFeeBips.value;
  }

  let drawnAmount = contract.try_drawnAmount();
  if (!drawnAmount.reverted) {
    market.drawnAmount = drawnAmount.value;
  }
}

export function createInitialMarketSnapshot(
  event: ethereum.Event,
  market: Market,
  source: string
): MarketSnapshot {
  reconcileOptionalMarketLinks(market);
  let snapshot = new MarketSnapshot(market.id);
  snapshot.market = market.id;
  copyMarketState(market, snapshot);
  stampMarketSnapshot(event, snapshot, source);
  snapshot.save();
  return snapshot;
}

function saveMarketAndSnapshotInternal(
  event: ethereum.Event,
  market: Market,
  includesContractCall: boolean
): void {
  let snapshot = MarketSnapshot.load(market.id);
  if (snapshot == null) {
    log.critical("Missing MarketSnapshot for market {}", [market.id]);
    return;
  }

  refreshRevolvingState(market);
  copyMarketState(market, snapshot);
  stampMarketSnapshot(
    event,
    snapshot,
    includesContractCall ||
      (market.marketKind == "REVOLVING" && market.eventGeneration != "V2_5")
      ? "EVENT_AND_CONTRACT_CALL"
      : "EVENT_PROJECTION"
  );
  market.save();
  snapshot.save();
}

export function saveMarketAndSnapshot(
  event: ethereum.Event,
  market: Market
): void {
  saveMarketAndSnapshotInternal(event, market, false);
}

export function saveMarketAndSnapshotWithContractCall(
  event: ethereum.Event,
  market: Market
): void {
  saveMarketAndSnapshotInternal(event, market, true);
}
