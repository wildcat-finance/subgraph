import { Address, BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import { assert, clearStore, createMockedFunction, describe, test } from "matchstick-as/assembly/index";
import { createMarket, createToken, generateTokenId } from "../generated/UncrashableEntityHelpers";
import { Market, Wildcat4626Wrapper } from "../generated/schema";
import { handleWrapperDeployed } from "../src/wildcat-4626-wrapper-factory";
import { reconcileWrapperMarketLink } from "../src/wrapper-market-links";
import { generateEventId } from "../src/utils";
import {
  ARCH_CONTROLLER_ADDRESS, MARKET_ADDRESS, WRAPPER_ADDRESS, WRAPPER_FACTORY_ADDRESS,
  createWrapperDeployedEvent,
} from "./wildcat-4626-wrapper-utils";

function seedMarket(): void {
  createMarket(MARKET_ADDRESS.toHexString(), {
    archController: ARCH_CONTROLLER_ADDRESS.toHexString(),
    isRegistered: true,
    version: "V2",
    borrower: Address.zero(),
    sentinel: Address.zero(),
    feeRecipient: Address.zero(),
    name: "Market USDC",
    symbol: "mUSDC",
    decimals: 6,
    protocolFeeBips: 0,
    delinquencyGracePeriod: 0,
    delinquencyFeeBips: 0,
    asset: "asset-token",
    withdrawalBatchDuration: 3600,
    totalAssets: BigInt.zero(),
    maxTotalSupply: BigInt.fromI32(1000000),
    annualInterestBips: 500,
    reserveRatioBips: 1000,
    scaleFactor: BigInt.fromString("1000000000000000000000000000"),
    lastInterestAccruedTimestamp: 1,
    lastInterestAccruedBlockNumber: 1,
    usdTotalsComplete: true,
    totalDebtUSD: BigDecimal.zero(),
    numCollateralContracts: 0,
    createdAt: 1,
    deployedEvent: "market-deployed",
  });
}

describe("legacy wrapper discovery", () => {
  test("records the market association, token metadata, and deployment provenance", () => {
    clearStore();
    seedMarket();
    let event = createWrapperDeployedEvent();
    handleWrapperDeployed(event);
    let wrapperId = WRAPPER_ADDRESS.toHexString();
    let marketId = MARKET_ADDRESS.toHexString();
    assert.entityCount("Wildcat4626Wrapper", 1);
    assert.fieldEquals("Market", marketId, "tokenWrapper", wrapperId);
    assert.fieldEquals("Wildcat4626Wrapper", wrapperId, "market", marketId);
    assert.fieldEquals("Wildcat4626Wrapper", wrapperId, "marketAddress", marketId);
    assert.fieldEquals("Wildcat4626Wrapper", wrapperId, "factory", WRAPPER_FACTORY_ADDRESS.toHexString());
    assert.fieldEquals("Wildcat4626Wrapper", wrapperId, "marketToken", generateTokenId(MARKET_ADDRESS));
    assert.fieldEquals("Wildcat4626Wrapper", wrapperId, "token", generateTokenId(WRAPPER_ADDRESS));
    assert.fieldEquals("Wildcat4626Wrapper", wrapperId, "blockNumber", "24750460");
    assert.fieldEquals("Wildcat4626Wrapper", wrapperId, "blockTimestamp", "1770000000");
    assert.fieldEquals("Wildcat4626Wrapper", wrapperId, "blockLogIndex", "7");
    assert.fieldEquals("Wildcat4626Wrapper", wrapperId, "transactionHash", event.transaction.hash.toHexString());
    assert.fieldEquals("Wildcat4626WrapperFactory", WRAPPER_FACTORY_ADDRESS.toHexString(), "archController", ARCH_CONTROLLER_ADDRESS.toHexString());
    assert.fieldEquals("Wildcat4626WrapperDeployed", generateEventId(event), "wrapper", wrapperId);
    assert.fieldEquals("Wildcat4626WrapperDeployed", generateEventId(event), "market", marketId);
    assert.fieldEquals("Token", generateTokenId(WRAPPER_ADDRESS), "name", "Wrapped Market USDC");
    assert.fieldEquals("Token", generateTokenId(WRAPPER_ADDRESS), "decimals", "6");
    assert.fieldEquals("Token", generateTokenId(MARKET_ADDRESS), "isUsdStablecoin", "false");
    assert.fieldEquals("Token", generateTokenId(WRAPPER_ADDRESS), "isUsdStablecoin", "false");
    assert.fieldEquals("Token", generateTokenId(WRAPPER_ADDRESS), "lastPriceFeedSearchDay", "-1");
    assert.fieldEquals("Token", generateTokenId(WRAPPER_ADDRESS), "isMock", "false");
  });

  test("retains an unknown market without creating a placeholder, then links it", () => {
    clearStore();
    let event = createWrapperDeployedEvent();
    handleWrapperDeployed(event);
    assert.entityCount("Market", 0);
    let wrapper = Wildcat4626Wrapper.load(WRAPPER_ADDRESS.toHexString())!;
    assert.assertTrue(wrapper.market == null);
    assert.fieldEquals("Wildcat4626WrapperDeployed", generateEventId(event), "marketAddress", MARKET_ADDRESS.toHexString());
    seedMarket();
    // Both real market-creation paths invoke the same reconciliation helper.
    let market = Market.load(MARKET_ADDRESS.toHexString())!;
    reconcileWrapperMarketLink(market);
    reconcileWrapperMarketLink(market);
    assert.fieldEquals("Market", market.id, "tokenWrapper", wrapper.id);
    assert.fieldEquals("Wildcat4626Wrapper", wrapper.id, "market", market.id);
    assert.entityCount("Market", 1);
    assert.entityCount("Wildcat4626WrapperDeployed", 1);
  });

  test("preserves discovery when token metadata calls revert", () => {
    clearStore();
    let event = createWrapperDeployedEvent();
    for (let i = 0; i < 2; i++) {
      let address = i == 0 ? MARKET_ADDRESS : WRAPPER_ADDRESS;
      createMockedFunction(address, "name", "name():(string)").reverts();
      createMockedFunction(address, "symbol", "symbol():(string)").reverts();
      createMockedFunction(address, "decimals", "decimals():(uint8)").reverts();
    }
    handleWrapperDeployed(event);
    assert.entityCount("Wildcat4626Wrapper", 1);
    assert.fieldEquals("Token", generateTokenId(WRAPPER_ADDRESS), "symbol", "UNKNOWN");
    assert.fieldEquals("Token", generateTokenId(WRAPPER_ADDRESS), "name", "Unknown Token " + WRAPPER_ADDRESS.toHexString());
    assert.fieldEquals("Token", generateTokenId(WRAPPER_ADDRESS), "decimals", "18");
  });

  test("preserves existing token metadata and prices and ignores a repeated event", () => {
    clearStore();
    let token = createToken(generateTokenId(MARKET_ADDRESS), {
      address: MARKET_ADDRESS, name: "Existing", symbol: "EXIST", decimals: 8,
      isMock: true, isUsdStablecoin: false,
    });
    token.lastPriceFeedSearchDay = 123;
    token.priceFeed0 = Address.fromString("0x3000000000000000000000000000000000000003");
    token.save();
    let event = createWrapperDeployedEvent();
    handleWrapperDeployed(event);
    handleWrapperDeployed(event);
    assert.fieldEquals("Token", token.id, "name", "Existing");
    assert.fieldEquals("Token", token.id, "decimals", "8");
    assert.fieldEquals("Token", token.id, "lastPriceFeedSearchDay", "123");
    assert.fieldEquals("Token", token.id, "priceFeed0", "0x3000000000000000000000000000000000000003");
    assert.entityCount("Wildcat4626Wrapper", 1);
    assert.entityCount("Wildcat4626WrapperDeployed", 1);
    assert.fieldEquals("Wildcat4626WrapperFactory", WRAPPER_FACTORY_ADDRESS.toHexString(), "eventIndex", "1");
  });
});
