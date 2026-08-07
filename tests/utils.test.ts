import { assert, describe, test } from "matchstick-as/assembly";
import { BigInt } from "@graphprotocol/graph-ts";
import { satSub } from "../src/utils";

describe("utility math helpers", () => {
  test("satSub returns the positive difference", () => {
    assert.bigIntEquals(
      satSub(BigInt.fromI32(10), BigInt.fromI32(4)),
      BigInt.fromI32(6)
    );
  });

  test("satSub returns zero for equal values", () => {
    assert.bigIntEquals(
      satSub(BigInt.fromI32(7), BigInt.fromI32(7)),
      BigInt.zero()
    );
  });

  test("satSub saturates at zero", () => {
    assert.bigIntEquals(
      satSub(BigInt.fromI32(3), BigInt.fromI32(9)),
      BigInt.zero()
    );
  });
});
