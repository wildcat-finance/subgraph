import { Address, ethereum } from "@graphprotocol/graph-ts";
import { Borrower } from "../generated/schema";

export function getOrCreateBorrower(
  event: ethereum.Event,
  address: Address
): Borrower {
  let id = address.toHexString();
  let borrower = Borrower.load(id);
  if (borrower == null) {
    borrower = new Borrower(id);
    borrower.address = address;
    borrower.firstSeenBlock = event.block.number;
    borrower.firstSeenTimestamp = event.block.timestamp;
    borrower.firstSeenTransaction = event.transaction.hash;
    borrower.firstSeenLogIndex = event.logIndex;
  }

  borrower.lastSeenBlock = event.block.number;
  borrower.lastSeenTimestamp = event.block.timestamp;
  borrower.lastSeenTransaction = event.transaction.hash;
  borrower.lastSeenLogIndex = event.logIndex;
  borrower.save();
  return borrower;
}
