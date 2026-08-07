import {
  assert,
  clearStore,
  dataSourceMock,
  describe,
  test
} from "matchstick-as/assembly/index";
import { createMockedFunction } from "matchstick-as";
import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import {
  createController,
  createControllerFactory,
  generateControllerId,
  generateLenderAuthorizationId,
  generateMarketId,
  generateProtocolStatsId,
  generateTokenId
} from "../generated/UncrashableEntityHelpers";
import {
  handleLenderAuthorized,
  handleMarketDeployed
} from "../src/wildcat-market-controller";
import { generateEventId } from "../src/utils";
import {
  createLenderAuthorizedEvent,
  createMarketDeployedEvent
} from "./wildcat-market-controller-utils";

describe("WildcatMarketController", () => {
  test("authorizing a lender updates current and historical state", () => {
    clearStore();

    let lender = Address.fromString(
      "0x0000000000000000000000000000000000000001"
    );
    let event = createLenderAuthorizedEvent(lender);
    let controllerId = generateControllerId(event.address);
    createController(controllerId, {
      borrower: Address.zero(),
      controllerFactory: "test-controller-factory",
      archController: "test-arch-controller",
      isRegistered: true
    });

    handleLenderAuthorized(event);

    let authorizationId = generateLenderAuthorizationId(event.address, lender);
    assert.fieldEquals(
      "LenderAuthorization",
      authorizationId,
      "controller",
      controllerId
    );
    assert.fieldEquals(
      "LenderAuthorization",
      authorizationId,
      "authorized",
      "true"
    );
    assert.fieldEquals(
      "LenderAuthorizationChange",
      generateEventId(event),
      "authorization",
      authorizationId
    );
    assert.fieldEquals(
      "LenderAuthorizationChange",
      generateEventId(event),
      "authorized",
      "true"
    );
  });

  test("uses the asset contract result for controller-created token isMock", () => {
    clearStore();
    dataSourceMock.setNetwork("plasma-testnet");

    let controllerAddress = Address.fromString(
      "0x0000000000000000000000000000000000005101"
    );
    let factoryAddress = Address.fromString(
      "0x0000000000000000000000000000000000005102"
    );
    let marketAddress = Address.fromString(
      "0x0000000000000000000000000000000000005103"
    );
    let assetAddress = Address.fromString(
      "0x0000000000000000000000000000000000005104"
    );
    createControllerFactory(factoryAddress.toHex(), {
      sentinel: Address.zero(),
      originationFeeAsset: null,
      constraints: "test-constraints",
      archController: "test-arch-controller",
      isRegistered: true
    });
    createController(generateControllerId(controllerAddress), {
      borrower: Address.zero(),
      controllerFactory: factoryAddress.toHex(),
      archController: "test-arch-controller",
      isRegistered: true
    });

    createMockedFunction(assetAddress, "isMock", "isMock():(bool)")
      .withArgs([])
      .returns([ethereum.Value.fromBoolean(false)]);
    createMockedFunction(assetAddress, "name", "name():(string)")
      .withArgs([])
      .returns([ethereum.Value.fromString("Real Token")]);
    createMockedFunction(assetAddress, "symbol", "symbol():(string)")
      .withArgs([])
      .returns([ethereum.Value.fromString("REAL")]);
    createMockedFunction(assetAddress, "decimals", "decimals():(uint8)")
      .withArgs([])
      .returns([
        ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(18))
      ]);
    createMockedFunction(
      assetAddress,
      "balanceOf",
      "balanceOf(address):(uint256)"
    )
      .withArgs([ethereum.Value.fromAddress(marketAddress)])
      .returns([ethereum.Value.fromUnsignedBigInt(BigInt.zero())]);
    createMockedFunction(marketAddress, "decimals", "decimals():(uint8)")
      .withArgs([])
      .returns([
        ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(18))
      ]);

    let event = createMarketDeployedEvent(marketAddress, assetAddress);
    event.address = controllerAddress;
    handleMarketDeployed(event);

    assert.fieldEquals(
      "Token",
      generateTokenId(assetAddress),
      "isMock",
      "false"
    );
    assert.fieldEquals(
      "Market",
      generateMarketId(marketAddress),
      "asset",
      generateTokenId(assetAddress)
    );
    assert.fieldEquals(
      "Market",
      generateMarketId(marketAddress),
      "totalDebtUSD",
      "0"
    );
    assert.fieldEquals(
      "ProtocolStats",
      generateProtocolStatsId(),
      "numMarkets",
      "1"
    );
  });
});
