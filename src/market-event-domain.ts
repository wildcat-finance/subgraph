import { BigInt, Bytes, ethereum, log } from "@graphprotocol/graph-ts";
import {
  Market,
  MarketEvent,
  MarketEventCursor,
} from "../generated/schema";
import { generateEventId } from "./utils";

export function recordMarketEvent(
  event: ethereum.Event,
  market: Market,
  kind: string
): MarketEvent {
  return recordMarketEventForMarketId(event, market.id, kind);
}

export function recordMarketEventForMarketId(
  event: ethereum.Event,
  marketId: string,
  kind: string
): MarketEvent {
  return recordMarketEventAt(
    marketId,
    kind,
    generateEventId(event),
    event.block.number,
    event.block.timestamp,
    event.transaction.hash,
    event.logIndex
  );
}

export function recordMarketEventAt(
  marketId: string,
  kind: string,
  id: string,
  blockNumber: BigInt,
  blockTimestamp: BigInt,
  transactionHash: Bytes,
  logIndex: BigInt
): MarketEvent {
  if (MarketEvent.load(id) != null) {
    log.critical("Duplicate MarketEvent for trigger {}", [id]);
  }

  let cursor = MarketEventCursor.load(marketId);
  if (cursor == null) {
    cursor = new MarketEventCursor(marketId);
    cursor.market = marketId;
    cursor.nextSequence = 0;
  }

  let record = new MarketEvent(id);
  record.market = marketId;
  record.sequence = cursor.nextSequence;
  record.kind = kind;
  record.blockNumber = blockNumber;
  record.blockTimestamp = blockTimestamp;
  record.transactionHash = transactionHash;
  record.logIndex = logIndex;
  record.save();

  cursor.nextSequence = cursor.nextSequence + 1;
  cursor.save();
  return record;
}
