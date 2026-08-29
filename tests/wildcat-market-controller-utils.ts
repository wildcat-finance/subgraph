import { newMockEvent } from "matchstick-as";
import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import {
  LenderAuthorized,
  MarketDeployed,
} from "../generated/templates/WildcatMarketController/WildcatMarketController";

export function createLenderAuthorizedEvent(
  lender: Address
): LenderAuthorized {
  let event = changetype<LenderAuthorized>(newMockEvent());
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam("param0", ethereum.Value.fromAddress(lender))
  );
  return event;
}

export function createMarketDeployedEvent(
  controller: Address,
  market: Address,
  asset: Address
): MarketDeployed {
  let event = changetype<MarketDeployed>(newMockEvent());
  event.address = controller;
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam("market", ethereum.Value.fromAddress(market))
  );
  event.parameters.push(
    new ethereum.EventParam("name", ethereum.Value.fromString("V1 Market"))
  );
  event.parameters.push(
    new ethereum.EventParam("symbol", ethereum.Value.fromString("V1M"))
  );
  event.parameters.push(
    new ethereum.EventParam("asset", ethereum.Value.fromAddress(asset))
  );
  event.parameters.push(
    new ethereum.EventParam(
      "maxTotalSupply",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1_000_000))
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "annualInterestBips",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(500))
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "delinquencyFeeBips",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(100))
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "withdrawalBatchDuration",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(3600))
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "reserveRatioBips",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1000))
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "delinquencyGracePeriod",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(86400))
    )
  );
  return event;
}
