import { Address, ethereum } from "@graphprotocol/graph-ts";
import {
  NewSanctionsEscrow as NewSanctionsEscrowEvent,
  SanctionOverride as SanctionOverrideEvent,
  SanctionOverrideRemoved as SanctionOverrideRemovedEvent,
  WildcatSanctionsSentinel,
} from "../generated/WildcatSanctionsSentinel/WildcatSanctionsSentinel";
import {
  NewSanctionsEscrow,
  SanctionOverride,
  SanctionOverrideRemoved,
  SanctionOverrideStatus,
  SanctionsEscrow,
} from "../generated/schema";
import { getOrCreateBorrower } from "./borrower-domain";
import { ensureIndexerDeployment } from "./deployment-context";
import { recordIndexerDiagnostic } from "./indexer-diagnostics";
import { generateEventId } from "./utils";

function overrideStatusId(borrower: Address, account: Address): string {
  return borrower.toHexString() + "-" + account.toHexString();
}

function updateOverrideStatus(
  event: ethereum.Event,
  borrowerAddress: Address,
  account: Address,
  isOverridden: boolean
): SanctionOverrideStatus {
  let borrower = getOrCreateBorrower(event, borrowerAddress);
  let id = overrideStatusId(borrowerAddress, account);
  let status = SanctionOverrideStatus.load(id);
  if (status == null) {
    status = new SanctionOverrideStatus(id);
    status.borrower = borrower.id;
    status.borrowerAddress = borrowerAddress;
    status.account = account;
  }
  status.isOverridden = isOverridden;
  status.updatedAtBlock = event.block.number;
  status.updatedAtTimestamp = event.block.timestamp;
  status.updatedAtTransaction = event.transaction.hash;
  status.updatedAtLogIndex = event.logIndex;
  status.save();
  return status as SanctionOverrideStatus;
}

export function handleNewSanctionsEscrow(
  event: NewSanctionsEscrowEvent
): void {
  ensureIndexerDeployment(event);
  let borrower = getOrCreateBorrower(event, event.params.borrower);
  let escrowResult = WildcatSanctionsSentinel.bind(
    event.address
  ).try_getEscrowAddress(
    event.params.borrower,
    event.params.account,
    event.params.asset
  );

  let escrow: SanctionsEscrow | null = null;
  if (escrowResult.reverted) {
    recordIndexerDiagnostic(
      event,
      "SANCTIONS_ESCROW_ADDRESS_UNAVAILABLE",
      "Sanctions escrow creation was observed but getEscrowAddress() reverted",
      event.params.account
    );
  } else {
    let address = escrowResult.value;
    escrow = SanctionsEscrow.load(address.toHexString());
    if (escrow == null) {
      escrow = new SanctionsEscrow(address.toHexString());
      escrow.address = address;
      escrow.sentinel = event.address;
      escrow.borrower = borrower.id;
      escrow.borrowerAddress = event.params.borrower;
      escrow.account = event.params.account;
      escrow.asset = event.params.asset;
      escrow.deployedAtBlock = event.block.number;
      escrow.deployedAtTimestamp = event.block.timestamp;
      escrow.deployedAtTransaction = event.transaction.hash;
      escrow.deployedAtLogIndex = event.logIndex;
      escrow.save();
    }
  }

  let entity = new NewSanctionsEscrow(generateEventId(event));
  entity.escrow = escrow == null ? null : escrow.id;
  entity.borrowerProfile = borrower.id;
  entity.borrower = event.params.borrower;
  entity.account = event.params.account;
  entity.asset = event.params.asset;
  entity.blockNumber = event.block.number.toI32();
  entity.blockTimestamp = event.block.timestamp.toI32();
  entity.transactionHash = event.transaction.hash;
  entity.blockLogIndex = event.logIndex.toI32();
  entity.save();
}

export function handleSanctionOverride(event: SanctionOverrideEvent): void {
  ensureIndexerDeployment(event);
  let borrower = getOrCreateBorrower(event, event.params.borrower);
  let status = updateOverrideStatus(
    event,
    event.params.borrower,
    event.params.account,
    true
  );
  let entity = new SanctionOverride(generateEventId(event));
  entity.status = status.id;
  entity.borrowerProfile = borrower.id;
  entity.borrower = event.params.borrower;
  entity.account = event.params.account;
  entity.blockNumber = event.block.number.toI32();
  entity.blockTimestamp = event.block.timestamp.toI32();
  entity.transactionHash = event.transaction.hash;
  entity.blockLogIndex = event.logIndex.toI32();
  entity.save();
}

export function handleSanctionOverrideRemoved(
  event: SanctionOverrideRemovedEvent
): void {
  ensureIndexerDeployment(event);
  let borrower = getOrCreateBorrower(event, event.params.borrower);
  let status = updateOverrideStatus(
    event,
    event.params.borrower,
    event.params.account,
    false
  );
  let entity = new SanctionOverrideRemoved(generateEventId(event));
  entity.status = status.id;
  entity.borrowerProfile = borrower.id;
  entity.borrower = event.params.borrower;
  entity.account = event.params.account;
  entity.blockNumber = event.block.number.toI32();
  entity.blockTimestamp = event.block.timestamp.toI32();
  entity.transactionHash = event.transaction.hash;
  entity.blockLogIndex = event.logIndex.toI32();
  entity.save();
}
