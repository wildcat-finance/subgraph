import { newMockEvent } from "matchstick-as";
import { Address, ethereum } from "@graphprotocol/graph-ts";
import { NewSanctionsEscrow } from "../generated/WildcatSanctionsSentinel/WildcatSanctionsSentinel";

export function createNewSanctionsEscrowEvent(
  borrower: Address,
  account: Address,
  asset: Address
): NewSanctionsEscrow {
  let event = changetype<NewSanctionsEscrow>(newMockEvent());
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam("borrower", ethereum.Value.fromAddress(borrower))
  );
  event.parameters.push(
    new ethereum.EventParam("account", ethereum.Value.fromAddress(account))
  );
  event.parameters.push(
    new ethereum.EventParam("asset", ethereum.Value.fromAddress(asset))
  );
  return event;
}
