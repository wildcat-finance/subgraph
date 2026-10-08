import { Address, BigInt, ByteArray, ethereum } from "@graphprotocol/graph-ts";
import { assert, clearStore, createMockedFunction, describe, newMockEvent, test } from "matchstick-as/assembly/index";
import { MarketDeployed } from "../generated/HooksFactory/HooksFactory";
import {
  createHooksFactory, createHooksInstance, createHooksTemplate, createToken,
  generateHooksInstanceId, generateHooksTemplateId, generateTokenId,
} from "../generated/UncrashableEntityHelpers";
import { handleMarketDeployed } from "../src/hooks-factory";
import { handleWrapperDeployed } from "../src/wildcat-4626-wrapper-factory";
import {
  ARCH_CONTROLLER_ADDRESS, MARKET_ADDRESS, WRAPPER_ADDRESS, createWrapperDeployedEvent,
} from "./wildcat-4626-wrapper-utils";

describe("hooks market wrapper reconciliation", () => {
  test("market creation attaches a previously observed wrapper", () => {
    clearStore();
    let factory = Address.fromString("0x6000000000000000000000000000000000000006");
    let hooks = Address.fromString("0x7000000000000000000000000000000000000007");
    let template = Address.fromString("0x8000000000000000000000000000000000000008");
    let asset = Address.fromString("0x9000000000000000000000000000000000000009");
    createHooksFactory(factory.toHexString(), {
      archController: ARCH_CONTROLLER_ADDRESS.toHexString(),
      sentinel: Address.zero(), isRegistered: true,
    });
    createHooksTemplate(generateHooksTemplateId(template), {
      name: "OpenTermHooks", feeRecipient: Address.zero(), protocolFeeBips: 0,
      originationFeeAsset: null, originationFeeAmount: BigInt.zero(),
      hooksFactory: factory.toHexString(),
    });
    createHooksInstance(generateHooksInstanceId(hooks), {
      name: "Open term", kind: "OpenTerm", borrower: Address.zero(),
      hooksTemplate: generateHooksTemplateId(template), hooksFactory: factory.toHexString(),
    });
    createToken(generateTokenId(asset), {
      address: asset, name: "USDC", symbol: "USDC", decimals: 6,
      isMock: false, isUsdStablecoin: false,
    });
    createMockedFunction(hooks, "version", "version():(string)")
      .returns([ethereum.Value.fromString("OpenTermHooks")]);
    let hookedMarket = new ethereum.Tuple();
    hookedMarket.push(ethereum.Value.fromBoolean(true));
    hookedMarket.push(ethereum.Value.fromBoolean(false));
    hookedMarket.push(ethereum.Value.fromBoolean(false));
    hookedMarket.push(ethereum.Value.fromUnsignedBigInt(BigInt.zero()));
    hookedMarket.push(ethereum.Value.fromBoolean(false));
    hookedMarket.push(ethereum.Value.fromBoolean(true));
    createMockedFunction(hooks, "getHookedMarket", "getHookedMarket(address):((bool,bool,bool,uint128,bool,bool))")
      .withArgs([ethereum.Value.fromAddress(MARKET_ADDRESS)])
      .returns([ethereum.Value.fromTuple(hookedMarket)]);
    createMockedFunction(asset, "balanceOf", "balanceOf(address):(uint256)")
      .withArgs([ethereum.Value.fromAddress(MARKET_ADDRESS)])
      .returns([ethereum.Value.fromUnsignedBigInt(BigInt.zero())]);

    handleWrapperDeployed(createWrapperDeployedEvent());
    assert.entityCount("Market", 0);
    let event = changetype<MarketDeployed>(newMockEvent());
    event.address = factory;
    let hooksBytes = ByteArray.fromHexString(hooks.toHexString());
    hooksBytes.reverse();
    let packedHooks = BigInt.fromUnsignedBytes(hooksBytes).leftShift(96);
    event.parameters = [
      new ethereum.EventParam("hooksTemplate", ethereum.Value.fromAddress(template)),
      new ethereum.EventParam("market", ethereum.Value.fromAddress(MARKET_ADDRESS)),
      new ethereum.EventParam("name", ethereum.Value.fromString("Market USDC")),
      new ethereum.EventParam("symbol", ethereum.Value.fromString("mUSDC")),
      new ethereum.EventParam("asset", ethereum.Value.fromAddress(asset)),
      new ethereum.EventParam("maxTotalSupply", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1000000))),
      new ethereum.EventParam("annualInterestBips", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(500))),
      new ethereum.EventParam("delinquencyFeeBips", ethereum.Value.fromUnsignedBigInt(BigInt.zero())),
      new ethereum.EventParam("withdrawalBatchDuration", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(3600))),
      new ethereum.EventParam("reserveRatioBips", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1000))),
      new ethereum.EventParam("delinquencyGracePeriod", ethereum.Value.fromUnsignedBigInt(BigInt.zero())),
      new ethereum.EventParam("hooks", ethereum.Value.fromUnsignedBigInt(packedHooks)),
    ];
    handleMarketDeployed(event);
    assert.fieldEquals("Market", MARKET_ADDRESS.toHexString(), "tokenWrapper", WRAPPER_ADDRESS.toHexString());
    assert.fieldEquals("Wildcat4626Wrapper", WRAPPER_ADDRESS.toHexString(), "market", MARKET_ADDRESS.toHexString());
    assert.fieldEquals("Market", MARKET_ADDRESS.toHexString(), "version", "V2");
    assert.fieldEquals("Market", MARKET_ADDRESS.toHexString(), "numCollateralContracts", "0");
  });
});
