import {
  assert,
  clearStore,
  dataSourceMock,
  describe,
  newMockEvent,
  test,
} from "matchstick-as/assembly";
import {
  Address,
  BigInt,
  DataSourceContext,
  ethereum,
} from "@graphprotocol/graph-ts";
import { Token } from "../generated/schema";
import { generateTokenId } from "../generated/UncrashableEntityHelpers";
import {
  CONTEXT_PRICING_MODE,
  CONTEXT_PRICING_SYNTHETIC_PRICES,
} from "../src/deployment-context";
import {
  ensureTokenDailyPrice,
  setupTokenPriceFeeds,
} from "../src/price-feeds";

const USDC = Address.fromString(
  "0x1000000000000000000000000000000000000001"
);
const WETH = Address.fromString(
  "0x2000000000000000000000000000000000000002"
);

function setSyntheticPricingContext(): void {
  let context = new DataSourceContext();
  context.setString(CONTEXT_PRICING_MODE, "SYNTHETIC_TESTNET");
  context.setString(
    CONTEXT_PRICING_SYNTHETIC_PRICES,
    "USDC=1=true,WETH=2000=false"
  );
  dataSourceMock.setContext(context);
}

function seedToken(address: Address, name: string, symbol: string): Token {
  let token = new Token(generateTokenId(address));
  token.address = address;
  token.name = name;
  token.symbol = symbol;
  token.decimals = 18;
  token.isMock = false;
  token.isUsdStablecoin = false;
  token.save();
  return token;
}

function createObservationEvent(): ethereum.Event {
  let event = newMockEvent();
  event.block.number = BigInt.fromI32(42);
  event.block.timestamp = BigInt.fromI32(172923);
  event.logIndex = BigInt.fromI32(7);
  return event;
}

describe("configured price observations", () => {
  test("records synthetic USD pegs with exact observation provenance", () => {
    clearStore();
    setSyntheticPricingContext();

    let token = seedToken(USDC, "USD Coin", "USDC");
    setupTokenPriceFeeds(token);
    let event = createObservationEvent();
    ensureTokenDailyPrice(token.id, event);

    let observationId = "TKNPRICE-" + USDC.toHexString() + "-172800";
    assert.fieldEquals("Token", token.id, "isUsdStablecoin", "true");
    assert.fieldEquals(
      "Token",
      token.id,
      "priceSource",
      "SYNTHETIC_TESTNET"
    );
    assert.fieldEquals("TokenDailyPrice", observationId, "priceUSD", "1");
    assert.fieldEquals(
      "TokenDailyPrice",
      observationId,
      "source",
      "SYNTHETIC_TESTNET"
    );
    assert.fieldEquals("TokenDailyPrice", observationId, "observedAtBlock", "42");
    assert.fieldEquals(
      "TokenDailyPrice",
      observationId,
      "observedAtTimestamp",
      "172923"
    );
    assert.fieldEquals(
      "TokenDailyPrice",
      observationId,
      "observedAtTransaction",
      event.transaction.hash.toHexString()
    );
    assert.fieldEquals("TokenDailyPrice", observationId, "observedAtLogIndex", "7");
    dataSourceMock.resetValues();
  });

  test("records configured non-peg synthetic prices without marking stablecoin", () => {
    clearStore();
    setSyntheticPricingContext();

    let token = seedToken(WETH, "Wrapped Ether", "WETH");
    setupTokenPriceFeeds(token);
    let event = createObservationEvent();
    ensureTokenDailyPrice(token.id, event);

    let observationId = "TKNPRICE-" + WETH.toHexString() + "-172800";
    assert.fieldEquals("Token", token.id, "isUsdStablecoin", "false");
    assert.fieldEquals(
      "Token",
      token.id,
      "priceSource",
      "SYNTHETIC_TESTNET"
    );
    assert.fieldEquals("TokenDailyPrice", observationId, "priceUSD", "2000");
    assert.fieldEquals(
      "TokenDailyPrice",
      observationId,
      "source",
      "SYNTHETIC_TESTNET"
    );
    dataSourceMock.resetValues();
  });
});
