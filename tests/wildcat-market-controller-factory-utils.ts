import { newMockEvent } from "matchstick-as";
import { Address, ethereum } from "@graphprotocol/graph-ts";
import { NewController } from "../generated/templates/WildcatMarketControllerFactory/WildcatMarketControllerFactory";

export function createNewControllerEvent(
  borrower: Address,
  controller: Address,
  namePrefix: string,
  symbolPrefix: string
): NewController {
  let event = changetype<NewController>(newMockEvent());
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam("borrower", ethereum.Value.fromAddress(borrower))
  );
  event.parameters.push(
    new ethereum.EventParam("controller", ethereum.Value.fromAddress(controller))
  );
  event.parameters.push(
    new ethereum.EventParam("namePrefix", ethereum.Value.fromString(namePrefix))
  );
  event.parameters.push(
    new ethereum.EventParam(
      "symbolPrefix",
      ethereum.Value.fromString(symbolPrefix)
    )
  );
  return event;
}
