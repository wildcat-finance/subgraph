import { newMockEvent } from "matchstick-as";
import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import {
  Deposit,
  TokensSwept,
  Transfer,
  Withdraw,
} from "../generated/templates/Wildcat4626Wrapper/Wildcat4626Wrapper";

export function createWrapperDepositEvent(
  by: Address,
  owner: Address,
  assets: BigInt,
  shares: BigInt
): Deposit {
  let event = changetype<Deposit>(newMockEvent());
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam("by", ethereum.Value.fromAddress(by))
  );
  event.parameters.push(
    new ethereum.EventParam("owner", ethereum.Value.fromAddress(owner))
  );
  event.parameters.push(
    new ethereum.EventParam(
      "assets",
      ethereum.Value.fromUnsignedBigInt(assets)
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "shares",
      ethereum.Value.fromUnsignedBigInt(shares)
    )
  );
  return event;
}

export function createWrapperTransferEvent(
  from: Address,
  to: Address,
  shares: BigInt
): Transfer {
  let event = changetype<Transfer>(newMockEvent());
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam("from", ethereum.Value.fromAddress(from))
  );
  event.parameters.push(
    new ethereum.EventParam("to", ethereum.Value.fromAddress(to))
  );
  event.parameters.push(
    new ethereum.EventParam(
      "amount",
      ethereum.Value.fromUnsignedBigInt(shares)
    )
  );
  return event;
}

export function createWrapperWithdrawEvent(
  by: Address,
  to: Address,
  owner: Address,
  assets: BigInt,
  shares: BigInt
): Withdraw {
  let event = changetype<Withdraw>(newMockEvent());
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam("by", ethereum.Value.fromAddress(by))
  );
  event.parameters.push(
    new ethereum.EventParam("to", ethereum.Value.fromAddress(to))
  );
  event.parameters.push(
    new ethereum.EventParam("owner", ethereum.Value.fromAddress(owner))
  );
  event.parameters.push(
    new ethereum.EventParam(
      "assets",
      ethereum.Value.fromUnsignedBigInt(assets)
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "shares",
      ethereum.Value.fromUnsignedBigInt(shares)
    )
  );
  return event;
}

export function createWrapperTokensSweptEvent(
  token: Address,
  to: Address,
  amount: BigInt
): TokensSwept {
  let event = changetype<TokensSwept>(newMockEvent());
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam("token", ethereum.Value.fromAddress(token))
  );
  event.parameters.push(
    new ethereum.EventParam("to", ethereum.Value.fromAddress(to))
  );
  event.parameters.push(
    new ethereum.EventParam(
      "amount",
      ethereum.Value.fromUnsignedBigInt(amount)
    )
  );
  return event;
}
