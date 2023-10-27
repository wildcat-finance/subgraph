import {
  NewSanctionsEscrow as NewSanctionsEscrowEvent,
  SanctionOverride as SanctionOverrideEvent,
  SanctionOverrideRemoved as SanctionOverrideRemovedEvent,
} from "../generated/WildcatSanctionsSentinel/WildcatSanctionsSentinel";
import {
  NewSanctionsEscrow,
  SanctionOverride,
  SanctionOverrideRemoved,
} from "../generated/schema";
import { generateEventId } from "./utils";

export function handleNewSanctionsEscrow(event: NewSanctionsEscrowEvent): void {
  let entity = new NewSanctionsEscrow(generateEventId(event));
  entity.borrower = event.params.borrower;
  entity.account = event.params.account;
  entity.asset = event.params.asset;

  entity.blockNumber = event.block.number.toI32();
  entity.blockTimestamp = event.block.timestamp.toI32();
  entity.transactionHash = event.transaction.hash;

  entity.save();
}

export function handleSanctionOverride(event: SanctionOverrideEvent): void {
  let entity = new SanctionOverride(generateEventId(event));
  entity.borrower = event.params.borrower;
  entity.account = event.params.account;

  entity.blockNumber = event.block.number.toI32();
  entity.blockTimestamp = event.block.timestamp.toI32();
  entity.transactionHash = event.transaction.hash;

  entity.save();
}

export function handleSanctionOverrideRemoved(
  event: SanctionOverrideRemovedEvent
): void {
  let entity = new SanctionOverrideRemoved(generateEventId(event));
  entity.borrower = event.params.borrower;
  entity.account = event.params.account;

  entity.blockNumber = event.block.number.toI32();
  entity.blockTimestamp = event.block.timestamp.toI32();
  entity.transactionHash = event.transaction.hash;

  entity.save();
}
