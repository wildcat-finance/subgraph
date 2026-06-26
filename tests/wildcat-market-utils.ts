import { newMockEvent } from "matchstick-as";
import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import {
  AnnualInterestBipsUpdated,
  Borrow,
  DebtRepaid,
  MarketClosed,
  StateUpdated,
} from "../generated/templates/WildcatMarket/WildcatMarket";

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

export function createBorrowEvent(assetAmount: BigInt): Borrow {
  let event = changetype<Borrow>(newMockEvent());
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam(
      "assetAmount",
      ethereum.Value.fromUnsignedBigInt(assetAmount)
    )
  );
  return event;
}

export function createDebtRepaidEvent(
  from: Address,
  assetAmount: BigInt
): DebtRepaid {
  let event = changetype<DebtRepaid>(newMockEvent());
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam("from", ethereum.Value.fromAddress(from))
  );
  event.parameters.push(
    new ethereum.EventParam(
      "assetAmount",
      ethereum.Value.fromUnsignedBigInt(assetAmount)
    )
  );
  return event;
}

export function createMarketClosedEvent(timestamp: BigInt): MarketClosed {
  let event = changetype<MarketClosed>(newMockEvent());
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam(
      "timestamp",
      ethereum.Value.fromUnsignedBigInt(timestamp)
    )
  );
  return event;
}

export function createStateUpdatedEvent(
  scaleFactor: BigInt,
  isDelinquent: boolean
): StateUpdated {
  let event = changetype<StateUpdated>(newMockEvent());
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam(
      "scaleFactor",
      ethereum.Value.fromUnsignedBigInt(scaleFactor)
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "isDelinquent",
      ethereum.Value.fromBoolean(isDelinquent)
    )
  );
  return event;
}
