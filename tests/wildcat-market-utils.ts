import { newMockEvent } from "matchstick-as";
import { BigInt, ethereum } from "@graphprotocol/graph-ts";
import { AnnualInterestBipsUpdated } from "../generated/templates/WildcatMarket/WildcatMarket";

export function createAnnualInterestBipsUpdatedEvent(
  annualInterestBipsUpdated: BigInt
): AnnualInterestBipsUpdated {
  let event = changetype<AnnualInterestBipsUpdated>(newMockEvent());
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam(
      "annualInterestBipsUpdated",
      ethereum.Value.fromUnsignedBigInt(annualInterestBipsUpdated)
    )
  );
  return event;
}
