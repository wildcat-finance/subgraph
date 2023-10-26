import {
  BorrowerAdded as BorrowerAddedEvent,
  BorrowerRemoved as BorrowerRemovedEvent,
  ControllerAdded as ControllerAddedEvent,
  ControllerFactoryAdded as ControllerFactoryAddedEvent,
  ControllerFactoryRemoved as ControllerFactoryRemovedEvent,
  ControllerRemoved as ControllerRemovedEvent,
  MarketAdded as MarketAddedEvent,
  MarketRemoved as MarketRemovedEvent,
  OwnershipHandoverCanceled as OwnershipHandoverCanceledEvent,
  OwnershipHandoverRequested as OwnershipHandoverRequestedEvent,
  OwnershipTransferred as OwnershipTransferredEvent
} from "../generated/WildcatArchController/WildcatArchController"
import {
  BorrowerAdded,
  BorrowerRemoved,
  ControllerAdded,
  ControllerFactoryAdded,
  ControllerFactoryRemoved,
  ControllerRemoved,
  MarketAdded,
  MarketRemoved,
  OwnershipHandoverCanceled,
  OwnershipHandoverRequested,
  OwnershipTransferred
} from "../generated/schema"

export function handleBorrowerAdded(event: BorrowerAddedEvent): void {
  let entity = new BorrowerAdded(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.borrower = event.params.borrower

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleBorrowerRemoved(event: BorrowerRemovedEvent): void {
  let entity = new BorrowerRemoved(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.borrower = event.params.borrower

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleControllerAdded(event: ControllerAddedEvent): void {
  let entity = new ControllerAdded(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.controllerFactory = event.params.controllerFactory
  entity.controller = event.params.controller

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleControllerFactoryAdded(
  event: ControllerFactoryAddedEvent
): void {
  let entity = new ControllerFactoryAdded(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.controllerFactory = event.params.controllerFactory

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleControllerFactoryRemoved(
  event: ControllerFactoryRemovedEvent
): void {
  let entity = new ControllerFactoryRemoved(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.controllerFactory = event.params.controllerFactory

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleControllerRemoved(event: ControllerRemovedEvent): void {
  let entity = new ControllerRemoved(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.controller = event.params.controller

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleMarketAdded(event: MarketAddedEvent): void {
  let entity = new MarketAdded(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.controller = event.params.controller
  entity.market = event.params.market

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleMarketRemoved(event: MarketRemovedEvent): void {
  let entity = new MarketRemoved(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.market = event.params.market

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleOwnershipHandoverCanceled(
  event: OwnershipHandoverCanceledEvent
): void {
  let entity = new OwnershipHandoverCanceled(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.pendingOwner = event.params.pendingOwner

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleOwnershipHandoverRequested(
  event: OwnershipHandoverRequestedEvent
): void {
  let entity = new OwnershipHandoverRequested(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.pendingOwner = event.params.pendingOwner

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleOwnershipTransferred(
  event: OwnershipTransferredEvent
): void {
  let entity = new OwnershipTransferred(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.oldOwner = event.params.oldOwner
  entity.newOwner = event.params.newOwner

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}
