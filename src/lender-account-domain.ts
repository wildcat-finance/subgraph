import { ethereum, log } from "@graphprotocol/graph-ts";
import { LenderAccount, LenderAccountSnapshot } from "../generated/schema";

function copyLenderAccountState(
  account: LenderAccount,
  snapshot: LenderAccountSnapshot
): void {
  snapshot.scaledBalance = account.scaledBalance;
  snapshot.role = account.role;
  snapshot.totalDeposited = account.totalDeposited;
  snapshot.lastScaleFactor = account.lastScaleFactor;
  snapshot.lastUpdatedTimestamp = account.lastUpdatedTimestamp;
  snapshot.lastUpdatedBlockNumber = account.lastUpdatedBlockNumber;
  snapshot.totalInterestEarned = account.totalInterestEarned;
  snapshot.numPendingWithdrawalBatches = account.numPendingWithdrawalBatches;
}

function stampLenderAccountSnapshot(
  event: ethereum.Event,
  snapshot: LenderAccountSnapshot
): void {
  snapshot.source = "EVENT_PROJECTION";
  snapshot.updatedAtBlock = event.block.number;
  snapshot.updatedAtTimestamp = event.block.timestamp;
  snapshot.updatedAtTransaction = event.transaction.hash;
  snapshot.updatedAtLogIndex = event.logIndex;
}

export function createInitialLenderAccountSnapshot(
  event: ethereum.Event,
  account: LenderAccount
): LenderAccountSnapshot {
  let snapshot = new LenderAccountSnapshot(account.id);
  snapshot.account = account.id;
  copyLenderAccountState(account, snapshot);
  stampLenderAccountSnapshot(event, snapshot);
  snapshot.save();
  return snapshot;
}

export function saveLenderAccountAndSnapshot(
  event: ethereum.Event,
  account: LenderAccount
): void {
  let snapshot = LenderAccountSnapshot.load(account.id);
  if (snapshot == null) {
    log.critical("Missing LenderAccountSnapshot for account {}", [account.id]);
    return;
  }

  copyLenderAccountState(account, snapshot);
  stampLenderAccountSnapshot(event, snapshot);
  account.save();
  snapshot.save();
}
