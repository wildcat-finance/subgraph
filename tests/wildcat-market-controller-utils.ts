import { newMockEvent } from "matchstick-as"
import { ethereum, Address, BigInt } from "@graphprotocol/graph-ts"
import {
  LenderAuthorized,
  LenderDeauthorized,
  MarketDeployed
} from "../generated/templates/WildcatMarketController/WildcatMarketController"

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

export function createMarketDeployedEvent(
  market: Address,
  asset: Address
): MarketDeployed {
  let marketDeployedEvent = changetype<MarketDeployed>(newMockEvent())

  marketDeployedEvent.parameters = new Array()

  marketDeployedEvent.parameters.push(
    new ethereum.EventParam("market", ethereum.Value.fromAddress(market))
  )
  marketDeployedEvent.parameters.push(
    new ethereum.EventParam("name", ethereum.Value.fromString("Test Market"))
  )
  marketDeployedEvent.parameters.push(
    new ethereum.EventParam("symbol", ethereum.Value.fromString("TMKT"))
  )
  marketDeployedEvent.parameters.push(
    new ethereum.EventParam("asset", ethereum.Value.fromAddress(asset))
  )
  marketDeployedEvent.parameters.push(
    new ethereum.EventParam(
      "maxTotalSupply",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1000000))
    )
  )
  marketDeployedEvent.parameters.push(
    new ethereum.EventParam(
      "annualInterestBips",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1000))
    )
  )
  marketDeployedEvent.parameters.push(
    new ethereum.EventParam(
      "delinquencyFeeBips",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(100))
    )
  )
  marketDeployedEvent.parameters.push(
    new ethereum.EventParam(
      "withdrawalBatchDuration",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(86400))
    )
  )
  marketDeployedEvent.parameters.push(
    new ethereum.EventParam(
      "reserveRatioBips",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(2000))
    )
  )
  marketDeployedEvent.parameters.push(
    new ethereum.EventParam(
      "delinquencyGracePeriod",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(3600))
    )
  )

  return marketDeployedEvent
}
