import { ethereum } from "@graphprotocol/graph-ts";
import {
  LenderWithdrawalStatus,
  WithdrawalBatch,
} from "../generated/schema";

export function saveWithdrawalBatch(
  event: ethereum.Event,
  batch: WithdrawalBatch
): void {
  batch.updatedAtBlock = event.block.number;
  batch.updatedAtTimestamp = event.block.timestamp;
  batch.updatedAtTransaction = event.transaction.hash;
  batch.updatedAtLogIndex = event.logIndex;
  batch.save();
}

export function saveLenderWithdrawalStatus(
  event: ethereum.Event,
  status: LenderWithdrawalStatus
): void {
  status.updatedAtBlock = event.block.number;
  status.updatedAtTimestamp = event.block.timestamp;
  status.updatedAtTransaction = event.transaction.hash;
  status.updatedAtLogIndex = event.logIndex;
  status.save();
}
