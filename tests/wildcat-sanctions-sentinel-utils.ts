import { newMockEvent } from "matchstick-as"
import { ethereum, Address } from "@graphprotocol/graph-ts"
import {
  NewSanctionsEscrow,
  SanctionOverride,
  SanctionOverrideRemoved
} from "../generated/WildcatSanctionsSentinel/WildcatSanctionsSentinel"

export function createNewSanctionsEscrowEvent(
  borrower: Address,
  account: Address,
  asset: Address
): NewSanctionsEscrow {
  let newSanctionsEscrowEvent = changetype<NewSanctionsEscrow>(newMockEvent())

  newSanctionsEscrowEvent.parameters = new Array()

  newSanctionsEscrowEvent.parameters.push(
    new ethereum.EventParam("borrower", ethereum.Value.fromAddress(borrower))
  )
  newSanctionsEscrowEvent.parameters.push(
    new ethereum.EventParam("account", ethereum.Value.fromAddress(account))
  )
  newSanctionsEscrowEvent.parameters.push(
    new ethereum.EventParam("asset", ethereum.Value.fromAddress(asset))
  )

  return newSanctionsEscrowEvent
}

export function createSanctionOverrideEvent(
  borrower: Address,
  account: Address
): SanctionOverride {
  let sanctionOverrideEvent = changetype<SanctionOverride>(newMockEvent())

  sanctionOverrideEvent.parameters = new Array()

  sanctionOverrideEvent.parameters.push(
    new ethereum.EventParam("borrower", ethereum.Value.fromAddress(borrower))
  )
  sanctionOverrideEvent.parameters.push(
    new ethereum.EventParam("account", ethereum.Value.fromAddress(account))
  )

  return sanctionOverrideEvent
}

export function createSanctionOverrideRemovedEvent(
  borrower: Address,
  account: Address
): SanctionOverrideRemoved {
  let sanctionOverrideRemovedEvent = changetype<SanctionOverrideRemoved>(
    newMockEvent()
  )

  sanctionOverrideRemovedEvent.parameters = new Array()

  sanctionOverrideRemovedEvent.parameters.push(
    new ethereum.EventParam("borrower", ethereum.Value.fromAddress(borrower))
  )
  sanctionOverrideRemovedEvent.parameters.push(
    new ethereum.EventParam("account", ethereum.Value.fromAddress(account))
  )

  return sanctionOverrideRemovedEvent
}
