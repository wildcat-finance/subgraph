import { newMockEvent } from "matchstick-as";
import { Address, ethereum } from "@graphprotocol/graph-ts";
import { HooksInstanceDeployed } from "../generated/HooksFactory/HooksFactory";

export function createHooksInstanceDeployedEvent(
  hooksInstance: Address,
  hooksTemplate: Address
): HooksInstanceDeployed {
  let event = changetype<HooksInstanceDeployed>(newMockEvent());
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam(
      "hooksInstance",
      ethereum.Value.fromAddress(hooksInstance)
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "hooksTemplate",
      ethereum.Value.fromAddress(hooksTemplate)
    )
  );
  return event;
}
