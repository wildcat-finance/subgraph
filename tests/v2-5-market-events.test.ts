import {
  assert,
  clearStore,
  describe,
  test,
} from "matchstick-as/assembly";
import { Address, BigInt } from "@graphprotocol/graph-ts";
import {
  AnnualInterestAndReserveRatioBipsUpdated,
  Borrow,
  BorrowerTransferCancelled,
  BorrowerTransferRequested,
  DrawnAmountUpdated,
} from "../generated/templates/WildcatMarketV2_5/WildcatMarketV2_5";
import { generateMarketId } from "../generated/UncrashableEntityHelpers";
import {
  handleAnnualInterestAndReserveRatioBipsUpdated,
  handleBorrow,
  handleBorrowerTransferCancelled,
  handleBorrowerTransferRequested,
  handleDrawnAmountUpdated,
} from "../src/wildcat-market-v2-5";
import { generateEventId } from "../src/utils";
import {
  createV25Event,
  pushAddress,
  pushBigInt,
  seedV25Market,
} from "./v2-5-test-utils";

const MARKET = Address.fromString(
  "0x000000000000000000000000000000000000f001"
);
const ASSET = Address.fromString(
  "0x000000000000000000000000000000000000f002"
);
const REGISTRY = Address.fromString(
  "0x000000000000000000000000000000000000f003"
);
const BORROWER = Address.fromString(
  "0x000000000000000000000000000000000000f004"
);
const PENDING_BORROWER = Address.fromString(
  "0x000000000000000000000000000000000000f005"
);

describe("v2.5 market events", () => {
  test("preserves borrower transfer request and cancellation history", () => {
    clearStore();
    let deployment = createV25Event(MARKET, 1);
    seedV25Market(
      deployment,
      MARKET,
      ASSET,
      BORROWER,
      BORROWER,
      REGISTRY
    );

    let requested = changetype<BorrowerTransferRequested>(
      createV25Event(MARKET, 2)
    );
    pushAddress(requested, "borrower", BORROWER);
    pushAddress(requested, "previousPendingBorrower", Address.zero());
    pushAddress(requested, "pendingBorrower", PENDING_BORROWER);
    pushAddress(requested, "borrowerPrincipal", BORROWER);
    pushAddress(
      requested,
      "previousPendingBorrowerPrincipal",
      Address.zero()
    );
    pushAddress(
      requested,
      "pendingBorrowerPrincipal",
      PENDING_BORROWER
    );
    handleBorrowerTransferRequested(requested);

    assert.fieldEquals(
      "Market",
      generateMarketId(MARKET),
      "pendingBorrower",
      PENDING_BORROWER.toHexString()
    );
    assert.fieldEquals(
      "Market",
      generateMarketId(MARKET),
      "borrower",
      BORROWER.toHexString()
    );

    let cancelled = changetype<BorrowerTransferCancelled>(
      createV25Event(MARKET, 3)
    );
    pushAddress(cancelled, "borrower", BORROWER);
    pushAddress(
      cancelled,
      "cancelledPendingBorrower",
      PENDING_BORROWER
    );
    pushAddress(cancelled, "borrowerPrincipal", BORROWER);
    pushAddress(
      cancelled,
      "cancelledPendingBorrowerPrincipal",
      PENDING_BORROWER
    );
    handleBorrowerTransferCancelled(cancelled);

    assert.fieldEquals(
      "Market",
      generateMarketId(MARKET),
      "pendingBorrower",
      "null"
    );
    assert.fieldEquals(
      "Market",
      generateMarketId(MARKET),
      "pendingBorrowerPrincipal",
      "null"
    );
    assert.fieldEquals(
      "Market",
      generateMarketId(MARKET),
      "borrower",
      BORROWER.toHexString()
    );
    assert.entityCount("MarketBorrowerChange", 2);
  });

  test("indexes draw proceeds separately from drawn principal", () => {
    clearStore();
    let deployment = createV25Event(MARKET, 1);
    seedV25Market(
      deployment,
      MARKET,
      ASSET,
      BORROWER,
      BORROWER,
      REGISTRY,
      null,
      "REVOLVING"
    );

    let borrow = changetype<Borrow>(createV25Event(MARKET, 2));
    pushAddress(borrow, "borrower", BORROWER);
    pushBigInt(borrow, "assetAmount", BigInt.fromI32(400));
    handleBorrow(borrow);

    let drawn = changetype<DrawnAmountUpdated>(
      createV25Event(MARKET, 3)
    );
    pushBigInt(drawn, "previousDrawnAmount", BigInt.zero());
    pushBigInt(drawn, "newDrawnAmount", BigInt.fromI32(200));
    handleDrawnAmountUpdated(drawn);

    assert.fieldEquals(
      "Borrow",
      "RECORD-".concat(generateMarketId(MARKET)).concat("-0"),
      "assetAmount",
      "400"
    );
    assert.fieldEquals(
      "Market",
      generateMarketId(MARKET),
      "drawnAmount",
      "200"
    );
    assert.entityCount("Borrow", 1);
    assert.entityCount("DrawnAmountUpdate", 1);
    assert.entityCount("MarketEvent", 2);
  });

  test("indexes both sides of a combined APR and reserve-ratio update", () => {
    clearStore();
    let deployment = createV25Event(MARKET, 1);
    seedV25Market(
      deployment,
      MARKET,
      ASSET,
      BORROWER,
      BORROWER,
      REGISTRY
    );

    let update = changetype<AnnualInterestAndReserveRatioBipsUpdated>(
      createV25Event(MARKET, 2)
    );
    pushAddress(update, "caller", BORROWER);
    pushBigInt(update, "previousAnnualInterestBips", BigInt.fromI32(500));
    pushBigInt(update, "newAnnualInterestBips", BigInt.fromI32(450));
    pushBigInt(update, "previousReserveRatioBips", BigInt.fromI32(1_000));
    pushBigInt(update, "newReserveRatioBips", BigInt.fromI32(1_500));
    handleAnnualInterestAndReserveRatioBipsUpdated(update);

    assert.fieldEquals(
      "AnnualInterestBipsUpdated",
      "RECORD-".concat(generateMarketId(MARKET)).concat("-0"),
      "oldAnnualInterestBips",
      "500"
    );
    assert.fieldEquals(
      "AnnualInterestBipsUpdated",
      "RECORD-".concat(generateMarketId(MARKET)).concat("-0"),
      "caller",
      BORROWER.toHexString()
    );
    assert.fieldEquals(
      "ReserveRatioBipsUpdated",
      generateEventId(update),
      "newReserveRatioBips",
      "1500"
    );
    assert.fieldEquals(
      "MarketEvent",
      generateEventId(update),
      "kind",
      "ANNUAL_INTEREST_AND_RESERVE_RATIO_BIPS_UPDATED"
    );
  });
});
