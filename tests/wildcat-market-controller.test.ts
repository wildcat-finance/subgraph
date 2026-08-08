import {
  assert,
  clearStore,
  createMockedFunction,
  describe,
  test,
} from "matchstick-as/assembly";
import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import {
  createController,
  createControllerFactory,
  createToken,
  generateControllerFactoryId,
  generateControllerId,
  generateLenderAuthorizationId,
  generateMarketId,
  generateTokenId,
} from "../generated/UncrashableEntityHelpers";
import {
  handleLenderAuthorized,
  handleMarketDeployed,
} from "../src/wildcat-market-controller";
import {
  createLenderAuthorizedEvent,
  createMarketDeployedEvent,
} from "./wildcat-market-controller-utils";

let lender = Address.fromString(
  "0x0000000000000000000000000000000000000003"
);
let controllerFactory = Address.fromString(
  "0x0000000000000000000000000000000000000004"
);
let controller = Address.fromString(
  "0x0000000000000000000000000000000000000005"
);
let market = Address.fromString(
  "0x0000000000000000000000000000000000000006"
);
let asset = Address.fromString(
  "0x0000000000000000000000000000000000000007"
);
let borrower = Address.fromString(
  "0x0000000000000000000000000000000000000008"
);

describe("wildcat market controller", () => {
  test("tracks lender authorizations", () => {
    clearStore();

    let event = createLenderAuthorizedEvent(lender);
    createController(generateControllerId(event.address), {
      borrower: Address.zero(),
      controllerFactory: "controller-factory",
      archController: "arch-controller",
      isRegistered: true,
    });

    handleLenderAuthorized(event);

    let authorizationId = generateLenderAuthorizationId(event.address, lender);
    assert.entityCount("LenderAuthorization", 1);
    assert.entityCount("LenderAuthorizationChange", 1);
    assert.fieldEquals(
      "LenderAuthorization",
      authorizationId,
      "authorized",
      "true"
    );
    assert.fieldEquals(
      "LenderAuthorization",
      authorizationId,
      "lender",
      lender.toHex()
    );
  });

  test("records exact V1 market origin and an initial snapshot", () => {
    clearStore();

    createControllerFactory(generateControllerFactoryId(controllerFactory), {
      address: controllerFactory,
      generation: "v1",
      abiFamily: "controller-factory-v1",
      sentinel: Address.zero(),
      originationFeeAsset: null,
      constraints: "constraints",
      archController: "arch-controller",
      isRegistered: true,
    });
    createController(generateControllerId(controller), {
      borrower: borrower,
      controllerFactory: generateControllerFactoryId(controllerFactory),
      archController: "arch-controller",
      isRegistered: true,
    });
    createToken(generateTokenId(asset), {
      address: asset,
      name: "Asset",
      symbol: "AST",
      decimals: 6,
      isMock: false,
    });
    createMockedFunction(market, "decimals", "decimals():(uint8)").returns([
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(6)),
    ]);
    createMockedFunction(asset, "balanceOf", "balanceOf(address):(uint256)")
      .withArgs([ethereum.Value.fromAddress(market)])
      .returns([ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1234))]);

    let event = createMarketDeployedEvent(controller, market, asset);
    handleMarketDeployed(event);

    let id = generateMarketId(market);
    assert.fieldEquals("Market", id, "address", market.toHexString());
    assert.fieldEquals("Market", id, "marketKind", "STANDARD");
    assert.fieldEquals("Market", id, "originKind", "CONTROLLER");
    assert.fieldEquals("Market", id, "generation", "v1");
    assert.fieldEquals("Market", id, "abiFamily", "controller-market-v1");
    assert.fieldEquals("Market", id, "borrower", borrower.toHexString());
    assert.fieldEquals("Market", id, "borrowerProfile", borrower.toHexString());
    assert.fieldEquals("Market", id, "createdAt", event.block.timestamp.toString());
    assert.fieldEquals("Borrower", borrower.toHexString(), "address", borrower.toHexString());
    assert.fieldEquals(
      "BorrowerStats",
      "BORROWER-STATS-" + borrower.toHexString(),
      "profile",
      borrower.toHexString()
    );
    assert.fieldEquals(
      "ProtocolDailyStats",
      "PROTOCOL-0",
      "numMarkets",
      "1"
    );
    assert.fieldEquals(
      "BorrowerDailyStats",
      "BORROWER-DAILY-" + borrower.toHexString() + "-0",
      "numMarkets",
      "1"
    );
    assert.fieldEquals(
      "Market",
      id,
      "controller",
      generateControllerId(controller)
    );
    assert.fieldEquals("Market", id, "asset", generateTokenId(asset));
    assert.fieldEquals("Market", id, "totalAssets", "1234");
    assert.fieldEquals(
      "Market",
      id,
      "createdAtTransaction",
      event.transaction.hash.toHexString()
    );
    assert.fieldEquals(
      "MarketSnapshot",
      id,
      "source",
      "EVENT_AND_CONTRACT_CALL"
    );
    assert.fieldEquals("MarketSnapshot", id, "annualInterestBips", "500");
  });
});
