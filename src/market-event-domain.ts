import { ethereum, log } from "@graphprotocol/graph-ts";
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
  let id = generateEventId(event);
  if (MarketEvent.load(id) != null) {
    log.critical("Duplicate MarketEvent for trigger {}", [id]);
  }

  let cursor = MarketEventCursor.load(market.id);
  if (cursor == null) {
    cursor = new MarketEventCursor(market.id);
    cursor.market = market.id;
    cursor.nextSequence = 0;
  }

  let record = new MarketEvent(id);
  record.market = market.id;
  record.sequence = cursor.nextSequence;
  record.kind = kind;
  record.blockNumber = event.block.number;
  record.blockTimestamp = event.block.timestamp;
  record.transactionHash = event.transaction.hash;
  record.logIndex = event.logIndex;
  record.save();

  cursor.nextSequence = cursor.nextSequence + 1;
  cursor.save();
  return record;
}
