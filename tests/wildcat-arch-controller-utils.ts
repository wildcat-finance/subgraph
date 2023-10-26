import { newMockEvent } from "matchstick-as"
import { ethereum, Address } from "@graphprotocol/graph-ts"
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
} from "../generated/WildcatArchController/WildcatArchController"

export function createBorrowerAddedEvent(borrower: Address): BorrowerAdded {
  let borrowerAddedEvent = changetype<BorrowerAdded>(newMockEvent())

  borrowerAddedEvent.parameters = new Array()

  borrowerAddedEvent.parameters.push(
    new ethereum.EventParam("borrower", ethereum.Value.fromAddress(borrower))
  )

  return borrowerAddedEvent
}

export function createBorrowerRemovedEvent(borrower: Address): BorrowerRemoved {
  let borrowerRemovedEvent = changetype<BorrowerRemoved>(newMockEvent())

  borrowerRemovedEvent.parameters = new Array()

  borrowerRemovedEvent.parameters.push(
    new ethereum.EventParam("borrower", ethereum.Value.fromAddress(borrower))
  )

  return borrowerRemovedEvent
}

export function createControllerAddedEvent(
  controllerFactory: Address,
  controller: Address
): ControllerAdded {
  let controllerAddedEvent = changetype<ControllerAdded>(newMockEvent())

  controllerAddedEvent.parameters = new Array()

  controllerAddedEvent.parameters.push(
    new ethereum.EventParam(
      "controllerFactory",
      ethereum.Value.fromAddress(controllerFactory)
    )
  )
  controllerAddedEvent.parameters.push(
    new ethereum.EventParam(
      "controller",
      ethereum.Value.fromAddress(controller)
    )
  )

  return controllerAddedEvent
}

export function createControllerFactoryAddedEvent(
  controllerFactory: Address
): ControllerFactoryAdded {
  let controllerFactoryAddedEvent = changetype<ControllerFactoryAdded>(
    newMockEvent()
  )

  controllerFactoryAddedEvent.parameters = new Array()

  controllerFactoryAddedEvent.parameters.push(
    new ethereum.EventParam(
      "controllerFactory",
      ethereum.Value.fromAddress(controllerFactory)
    )
  )

  return controllerFactoryAddedEvent
}

export function createControllerFactoryRemovedEvent(
  controllerFactory: Address
): ControllerFactoryRemoved {
  let controllerFactoryRemovedEvent = changetype<ControllerFactoryRemoved>(
    newMockEvent()
  )

  controllerFactoryRemovedEvent.parameters = new Array()

  controllerFactoryRemovedEvent.parameters.push(
    new ethereum.EventParam(
      "controllerFactory",
      ethereum.Value.fromAddress(controllerFactory)
    )
  )

  return controllerFactoryRemovedEvent
}

export function createControllerRemovedEvent(
  controller: Address
): ControllerRemoved {
  let controllerRemovedEvent = changetype<ControllerRemoved>(newMockEvent())

  controllerRemovedEvent.parameters = new Array()

  controllerRemovedEvent.parameters.push(
    new ethereum.EventParam(
      "controller",
      ethereum.Value.fromAddress(controller)
    )
  )

  return controllerRemovedEvent
}

export function createMarketAddedEvent(
  controller: Address,
  market: Address
): MarketAdded {
  let marketAddedEvent = changetype<MarketAdded>(newMockEvent())

  marketAddedEvent.parameters = new Array()

  marketAddedEvent.parameters.push(
    new ethereum.EventParam(
      "controller",
      ethereum.Value.fromAddress(controller)
    )
  )
  marketAddedEvent.parameters.push(
    new ethereum.EventParam("market", ethereum.Value.fromAddress(market))
  )

  return marketAddedEvent
}

export function createMarketRemovedEvent(market: Address): MarketRemoved {
  let marketRemovedEvent = changetype<MarketRemoved>(newMockEvent())

  marketRemovedEvent.parameters = new Array()

  marketRemovedEvent.parameters.push(
    new ethereum.EventParam("market", ethereum.Value.fromAddress(market))
  )

  return marketRemovedEvent
}

export function createOwnershipHandoverCanceledEvent(
  pendingOwner: Address
): OwnershipHandoverCanceled {
  let ownershipHandoverCanceledEvent = changetype<OwnershipHandoverCanceled>(
    newMockEvent()
  )

  ownershipHandoverCanceledEvent.parameters = new Array()

  ownershipHandoverCanceledEvent.parameters.push(
    new ethereum.EventParam(
      "pendingOwner",
      ethereum.Value.fromAddress(pendingOwner)
    )
  )

  return ownershipHandoverCanceledEvent
}

export function createOwnershipHandoverRequestedEvent(
  pendingOwner: Address
): OwnershipHandoverRequested {
  let ownershipHandoverRequestedEvent = changetype<OwnershipHandoverRequested>(
    newMockEvent()
  )

  ownershipHandoverRequestedEvent.parameters = new Array()

  ownershipHandoverRequestedEvent.parameters.push(
    new ethereum.EventParam(
      "pendingOwner",
      ethereum.Value.fromAddress(pendingOwner)
    )
  )

  return ownershipHandoverRequestedEvent
}

export function createOwnershipTransferredEvent(
  oldOwner: Address,
  newOwner: Address
): OwnershipTransferred {
  let ownershipTransferredEvent = changetype<OwnershipTransferred>(
    newMockEvent()
  )

  ownershipTransferredEvent.parameters = new Array()

  ownershipTransferredEvent.parameters.push(
    new ethereum.EventParam("oldOwner", ethereum.Value.fromAddress(oldOwner))
  )
  ownershipTransferredEvent.parameters.push(
    new ethereum.EventParam("newOwner", ethereum.Value.fromAddress(newOwner))
  )

  return ownershipTransferredEvent
}
