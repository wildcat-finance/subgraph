import { newMockEvent } from "matchstick-as";
import { Address, ethereum } from "@graphprotocol/graph-ts";
import {
  BorrowerAdded,
  BorrowerRemoved,
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
