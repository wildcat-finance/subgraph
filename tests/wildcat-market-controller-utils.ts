import { newMockEvent } from "matchstick-as"
import { ethereum, Address } from "@graphprotocol/graph-ts"
import {
  LenderAuthorized,
  LenderDeauthorized,
  MarketDeployed
} from "../generated/WildcatMarketController/WildcatMarketController"

export function createLenderAuthorizedEvent(param0: Address): LenderAuthorized {
  let lenderAuthorizedEvent = changetype<LenderAuthorized>(newMockEvent())

  lenderAuthorizedEvent.parameters = new Array()

  lenderAuthorizedEvent.parameters.push(
    new ethereum.EventParam("param0", ethereum.Value.fromAddress(param0))
  )

  return lenderAuthorizedEvent
}

export function createLenderDeauthorizedEvent(
  param0: Address
): LenderDeauthorized {
  let lenderDeauthorizedEvent = changetype<LenderDeauthorized>(newMockEvent())

  lenderDeauthorizedEvent.parameters = new Array()

  lenderDeauthorizedEvent.parameters.push(
    new ethereum.EventParam("param0", ethereum.Value.fromAddress(param0))
  )

  return lenderDeauthorizedEvent
}

export function createMarketDeployedEvent(market: Address): MarketDeployed {
  let marketDeployedEvent = changetype<MarketDeployed>(newMockEvent())

  marketDeployedEvent.parameters = new Array()

  marketDeployedEvent.parameters.push(
    new ethereum.EventParam("market", ethereum.Value.fromAddress(market))
  )

  return marketDeployedEvent
}
