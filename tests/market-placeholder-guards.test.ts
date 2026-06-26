import {
  assert,
  clearStore,
  describe,
  newMockEvent,
  test,
} from "matchstick-as/assembly/index";
import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import {
  MarketRemoved,
} from "../generated/WildcatArchController/WildcatArchController";
import {
  AccountMadeFirstDeposit,
  TemporaryExcessReserveRatioActivated,
} from "../generated/templates/CombinedHooks/CombinedHooks";
import { handleAccountMadeFirstDeposit, handleTemporaryExcessReserveRatioActivated } from "../src/hooks-instance";
import { handleMarketRemoved } from "../src/wildcat-arch-controller";

function addressFrom(hex: string): Address {
  return Address.fromString(hex);
}

function createMarketRemovedEvent(market: Address): MarketRemoved {
  let event = changetype<MarketRemoved>(newMockEvent());
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam("market", ethereum.Value.fromAddress(market))
  );
  return event;
}

function createAccountMadeFirstDepositEvent(
  market: Address,
  accountAddress: Address
): AccountMadeFirstDeposit {
  let event = changetype<AccountMadeFirstDeposit>(newMockEvent());
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam("market", ethereum.Value.fromAddress(market))
  );
  event.parameters.push(
    new ethereum.EventParam(
      "accountAddress",
      ethereum.Value.fromAddress(accountAddress)
    )
  );
  return event;
}

function createTemporaryExcessReserveRatioActivatedEvent(
  market: Address,
  originalReserveRatioBips: i32,
  temporaryReserveRatioBips: i32,
  temporaryReserveRatioExpiry: i32
): TemporaryExcessReserveRatioActivated {
  let event =
    changetype<TemporaryExcessReserveRatioActivated>(newMockEvent());
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam("market", ethereum.Value.fromAddress(market))
  );
  event.parameters.push(
    new ethereum.EventParam(
      "originalReserveRatioBips",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(originalReserveRatioBips))
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "temporaryReserveRatioBips",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(temporaryReserveRatioBips))
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "temporaryReserveRatioExpiry",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(temporaryReserveRatioExpiry))
    )
  );
  return event;
}

describe("Market placeholder guards", () => {
  test("handleMarketRemoved skips unknown markets", () => {
    clearStore();

    let market = addressFrom("0x1000000000000000000000000000000000000001");
    let event = createMarketRemovedEvent(market);
    handleMarketRemoved(event);

    assert.entityCount("Market", 0);
    assert.entityCount("MarketRemoved", 0);
  });

  test("handleAccountMadeFirstDeposit skips unknown markets", () => {
    clearStore();

    let market = addressFrom("0x2000000000000000000000000000000000000002");
    let lender = addressFrom("0x3000000000000000000000000000000000000003");
    let event = createAccountMadeFirstDepositEvent(market, lender);
    handleAccountMadeFirstDeposit(event);

    assert.entityCount("Market", 0);
    assert.entityCount("KnownLenderStatus", 0);
    assert.entityCount("AccountMadeFirstDeposit", 0);
  });

  test("handleTemporaryExcessReserveRatioActivated skips unknown markets", () => {
    clearStore();

    let market = addressFrom("0x4000000000000000000000000000000000000004");
    let event = createTemporaryExcessReserveRatioActivatedEvent(
      market,
      1_000,
      1_500,
      1_700_000_000
    );
    handleTemporaryExcessReserveRatioActivated(event);

    assert.entityCount("Market", 0);
  });
});
