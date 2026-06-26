import { newMockEvent } from "matchstick-as";
import { Address, ethereum } from "@graphprotocol/graph-ts";
import { LenderAuthorized } from "../generated/templates/WildcatMarketController/WildcatMarketController";

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
