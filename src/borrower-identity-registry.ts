import { Address, ethereum } from "@graphprotocol/graph-ts";
import {
  ArchController,
  BorrowerAccount,
  BorrowerAccountFactory,
  BorrowerAccountFactoryChange,
  BorrowerAccountPrincipalChange,
  BorrowerIdentityRegistry,
} from "../generated/schema";
import { getOrCreateBorrower } from "./borrower-domain";
import { generateBorrowerAccountId } from "./borrower-identity-domain";
import {
  CONTEXT_DEPLOYMENT_ARCH_CONTROLLER,
  contextString,
} from "./deployment-context";
import { generateEventId } from "./utils";

function addressParam(event: ethereum.Event, index: i32): Address {
  return event.parameters[index].value.toAddress();
}

function getOrCreateRegistry(event: ethereum.Event): BorrowerIdentityRegistry {
  let id = event.address.toHexString();
  let registry = BorrowerIdentityRegistry.load(id);
  if (registry == null) {
    let configuredArchController = contextString(
      CONTEXT_DEPLOYMENT_ARCH_CONTROLLER
    );
    let archControllerAddress = configuredArchController == null
      ? Address.zero()
      : Address.fromString(configuredArchController as string);
    let archControllerId = archControllerAddress.toHexString();
    let archController = ArchController.load(archControllerId);
    if (archController == null) {
      archController = new ArchController(archControllerId);
      archController.save();
    }
    registry = new BorrowerIdentityRegistry(id);
    registry.address = event.address;
    registry.archController = archController.id;
    registry.eventIndex = 0;
    registry.save();
  }
  return registry;
}

function getOrCreateAccountFactory(
  registry: BorrowerIdentityRegistry,
  address: Address
): BorrowerAccountFactory {
  let id = registry.id.concat("-").concat(address.toHexString());
  let accountFactory = BorrowerAccountFactory.load(id);
  if (accountFactory == null) {
    accountFactory = new BorrowerAccountFactory(id);
    accountFactory.registry = registry.id;
    accountFactory.address = address;
    accountFactory.isApproved = false;
    accountFactory.save();
  }
  return accountFactory;
}

function incrementRegistryEventIndex(account: BorrowerAccount): void {
  let registry = BorrowerIdentityRegistry.load(account.registry);
  if (registry == null) {
    return;
  }
  registry.eventIndex = registry.eventIndex + 1;
  registry.save();
}

function handleAccountFactoryChange(
  event: ethereum.Event,
  isApproved: boolean
): void {
  let registry = getOrCreateRegistry(event);
  let administrator = addressParam(event, 0);
  let factoryAddress = addressParam(event, 1);
  let accountFactory = getOrCreateAccountFactory(registry, factoryAddress);
  accountFactory.isApproved = isApproved;
  accountFactory.save();

  let change = new BorrowerAccountFactoryChange(generateEventId(event));
  change.registry = registry.id;
  change.accountFactory = accountFactory.id;
  change.administrator = administrator;
  change.isApproved = isApproved;
  change.blockNumber = event.block.number;
  change.blockTimestamp = event.block.timestamp;
  change.transactionHash = event.transaction.hash;
  change.blockLogIndex = event.logIndex;
  change.save();
  registry.eventIndex = registry.eventIndex + 1;
  registry.save();
}

export function handleAccountFactoryAdded(event: ethereum.Event): void {
  handleAccountFactoryChange(event, true);
}

export function handleAccountFactoryRemoved(event: ethereum.Event): void {
  handleAccountFactoryChange(event, false);
}

export function handleBorrowerAccountRegistered(event: ethereum.Event): void {
  let registry = getOrCreateRegistry(event);
  let accountAddress = addressParam(event, 0);
  let principalAddress = addressParam(event, 1);
  let accountFactory = getOrCreateAccountFactory(
    registry,
    addressParam(event, 2)
  );
  let principal = getOrCreateBorrower(event, principalAddress);
  let account = new BorrowerAccount(
    generateBorrowerAccountId(registry.id, accountAddress)
  );
  account.address = accountAddress;
  account.registry = registry.id;
  account.accountFactory = accountFactory.id;
  account.principal = principal.id;
  account.principalAddress = principalAddress;
  account.registeredAtBlock = event.block.number;
  account.registeredAtTimestamp = event.block.timestamp;
  account.registeredAtTransaction = event.transaction.hash;
  account.registeredAtLogIndex = event.logIndex;
  account.save();

  let change = new BorrowerAccountPrincipalChange(generateEventId(event));
  change.account = account.id;
  change.kind = "REGISTERED";
  change.newPrincipal = principal.id;
  change.newPrincipalAddress = principalAddress;
  change.blockNumber = event.block.number;
  change.blockTimestamp = event.block.timestamp;
  change.transactionHash = event.transaction.hash;
  change.blockLogIndex = event.logIndex;
  change.save();
  registry.eventIndex = registry.eventIndex + 1;
  registry.save();
}

export function handleBorrowerAccountPrincipalTransferRequested(
  event: ethereum.Event
): void {
  let account = BorrowerAccount.load(
    generateBorrowerAccountId(
      event.address.toHexString(),
      addressParam(event, 0)
    )
  );
  if (account == null) {
    return;
  }
  let currentPrincipalAddress = addressParam(event, 1);
  let previousPendingPrincipalAddress = addressParam(event, 2);
  let pendingPrincipalAddress = addressParam(event, 3);
  let currentPrincipal = getOrCreateBorrower(event, currentPrincipalAddress);
  let pendingPrincipal = getOrCreateBorrower(event, pendingPrincipalAddress);
  let change = new BorrowerAccountPrincipalChange(generateEventId(event));
  change.account = account.id;
  change.kind = "TRANSFER_REQUESTED";
  change.currentPrincipal = currentPrincipal.id;
  change.currentPrincipalAddress = currentPrincipalAddress;
  if (!previousPendingPrincipalAddress.equals(Address.zero())) {
    let previousPendingPrincipal = getOrCreateBorrower(
      event,
      previousPendingPrincipalAddress
    );
    change.previousPendingPrincipal = previousPendingPrincipal.id;
    change.previousPendingPrincipalAddress = previousPendingPrincipalAddress;
  }
  change.pendingPrincipal = pendingPrincipal.id;
  change.pendingPrincipalAddress = pendingPrincipalAddress;
  change.blockNumber = event.block.number;
  change.blockTimestamp = event.block.timestamp;
  change.transactionHash = event.transaction.hash;
  change.blockLogIndex = event.logIndex;
  change.save();
  account.pendingPrincipal = pendingPrincipal.id;
  account.pendingPrincipalAddress = pendingPrincipalAddress;
  account.save();
  incrementRegistryEventIndex(account);
}

export function handleBorrowerAccountPrincipalTransferCancelled(
  event: ethereum.Event
): void {
  let account = BorrowerAccount.load(
    generateBorrowerAccountId(
      event.address.toHexString(),
      addressParam(event, 0)
    )
  );
  if (account == null) {
    return;
  }
  let currentPrincipalAddress = addressParam(event, 1);
  let cancelledPendingPrincipalAddress = addressParam(event, 2);
  let change = new BorrowerAccountPrincipalChange(generateEventId(event));
  change.account = account.id;
  change.kind = "TRANSFER_CANCELLED";
  change.currentPrincipal = getOrCreateBorrower(
    event,
    currentPrincipalAddress
  ).id;
  change.currentPrincipalAddress = currentPrincipalAddress;
  change.cancelledPendingPrincipal = getOrCreateBorrower(
    event,
    cancelledPendingPrincipalAddress
  ).id;
  change.cancelledPendingPrincipalAddress =
    cancelledPendingPrincipalAddress;
  change.blockNumber = event.block.number;
  change.blockTimestamp = event.block.timestamp;
  change.transactionHash = event.transaction.hash;
  change.blockLogIndex = event.logIndex;
  change.save();
  account.unset("pendingPrincipal");
  account.unset("pendingPrincipalAddress");
  account.save();
  incrementRegistryEventIndex(account);
}

export function handleBorrowerAccountPrincipalTransferred(
  event: ethereum.Event
): void {
  let account = BorrowerAccount.load(
    generateBorrowerAccountId(
      event.address.toHexString(),
      addressParam(event, 0)
    )
  );
  if (account == null) {
    return;
  }
  let previousPrincipalAddress = addressParam(event, 1);
  let newPrincipalAddress = addressParam(event, 2);
  let previousPrincipal = getOrCreateBorrower(
    event,
    previousPrincipalAddress
  );
  let newPrincipal = getOrCreateBorrower(event, newPrincipalAddress);
  let change = new BorrowerAccountPrincipalChange(generateEventId(event));
  change.account = account.id;
  change.kind = "TRANSFERRED";
  change.previousPrincipal = previousPrincipal.id;
  change.previousPrincipalAddress = previousPrincipalAddress;
  change.newPrincipal = newPrincipal.id;
  change.newPrincipalAddress = newPrincipalAddress;
  change.blockNumber = event.block.number;
  change.blockTimestamp = event.block.timestamp;
  change.transactionHash = event.transaction.hash;
  change.blockLogIndex = event.logIndex;
  change.save();
  account.principal = newPrincipal.id;
  account.principalAddress = newPrincipalAddress;
  account.unset("pendingPrincipal");
  account.unset("pendingPrincipalAddress");
  account.save();
  incrementRegistryEventIndex(account);
}
