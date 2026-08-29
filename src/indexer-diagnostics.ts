import { Address, ethereum } from "@graphprotocol/graph-ts";
import { IndexerDiagnostic } from "../generated/schema";
import { generateEventId } from "./utils";

export function recordIndexerDiagnostic(
  event: ethereum.Event,
  kind: string,
  message: string,
  relatedAddress: Address | null = null
): void {
  let diagnostic = new IndexerDiagnostic(generateEventId(event) + "-" + kind);
  diagnostic.kind = kind;
  diagnostic.message = message;
  diagnostic.contractAddress = event.address;
  diagnostic.relatedAddress = relatedAddress;
  diagnostic.blockNumber = event.block.number;
  diagnostic.blockTimestamp = event.block.timestamp;
  diagnostic.transactionHash = event.transaction.hash;
  diagnostic.blockLogIndex = event.logIndex;
  diagnostic.save();
}
