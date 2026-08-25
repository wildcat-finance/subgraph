import { assert, describe, test } from "matchstick-as/assembly/index";
import { BigInt } from "@graphprotocol/graph-ts";
import { Market } from "../generated/schema";
import { calculateLiquidityRequired, satSub } from "../src/utils";

const ROUNDING_REGRESSION_SCALE_FACTOR = BigInt.fromString(
  "4194304000000000000000000000000000"
);

function createLiquidityMarket(eventGeneration: string): Market {
  let market = new Market("liquidity-market");
  market.eventGeneration = eventGeneration;
  market.scaledTotalSupply = BigInt.fromI32(1);
  market.scaledPendingWithdrawals = BigInt.zero();
  market.reserveRatioBips = 4_999;
  market.scaleFactor = ROUNDING_REGRESSION_SCALE_FACTOR;
  market.pendingProtocolFees = BigInt.zero();
  market.normalizedUnclaimedWithdrawals = BigInt.zero();
  return market;
}

describe("Utility math helpers", () => {
  test("satSub returns positive difference when a is greater than b", () => {
    assert.bigIntEquals(
      satSub(BigInt.fromI32(10), BigInt.fromI32(4)),
      BigInt.fromI32(6)
    );
  });

  test("satSub returns zero when a equals b", () => {
    assert.bigIntEquals(
      satSub(BigInt.fromI32(7), BigInt.fromI32(7)),
      BigInt.zero()
    );
  });

  test("satSub saturates to zero when b is greater than a", () => {
    assert.bigIntEquals(
      satSub(BigInt.fromI32(3), BigInt.fromI32(9)),
      BigInt.zero()
    );
  });

  test("calculates V2.5 liquidity required in normalized space", () => {
    let market = createLiquidityMarket("V2_5");

    assert.bigIntEquals(
      calculateLiquidityRequired(market),
      BigInt.fromI32(2_096_733)
    );
  });

  test("preserves scaled-space liquidity rounding for legacy markets", () => {
    let market = createLiquidityMarket("LEGACY");

    assert.bigIntEquals(calculateLiquidityRequired(market), BigInt.zero());
  });
});
