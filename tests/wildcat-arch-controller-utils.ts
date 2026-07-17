import { newMockEvent } from "matchstick-as";
import { Address, ethereum } from "@graphprotocol/graph-ts";
import {
  BorrowerAdded,
  BorrowerRemoved,
  ControllerFactoryAdded,
  ControllerFactoryRemoved,
} from "../generated/WildcatArchController/WildcatArchController";

export function createBorrowerAddedEvent(borrower: Address): BorrowerAdded {
  let event = changetype<BorrowerAdded>(newMockEvent());
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam("borrower", ethereum.Value.fromAddress(borrower))
  );
  return event;
}

export function createBorrowerRemovedEvent(borrower: Address): BorrowerRemoved {
  let event = changetype<BorrowerRemoved>(newMockEvent());
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam("borrower", ethereum.Value.fromAddress(borrower))
  );
  return event;
}

export function createControllerFactoryAddedEvent(
  factory: Address
): ControllerFactoryAdded {
  let event = changetype<ControllerFactoryAdded>(newMockEvent());
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam(
      "controllerFactory",
      ethereum.Value.fromAddress(factory)
    )
  );
  return event;
}

export function createControllerFactoryRemovedEvent(
  factory: Address
): ControllerFactoryRemoved {
  let event = changetype<ControllerFactoryRemoved>(newMockEvent());
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam(
      "controllerFactory",
      ethereum.Value.fromAddress(factory)
    )
  );
  return event;
}
