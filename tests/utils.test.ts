import { assert, describe, test } from "matchstick-as/assembly/index";
import { BigInt } from "@graphprotocol/graph-ts";
import { satSub } from "../src/utils";

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
});
