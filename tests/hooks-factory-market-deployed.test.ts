import {
  assert,
  clearStore,
  createMockedFunction,
  describe,
  test,
} from "matchstick-as/assembly/index";
import { newMockEvent } from "matchstick-as";
import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import { MarketDeployed } from "../generated/HooksFactory/HooksFactory";
import {
  createHooksFactory,
  createHooksInstance,
  createHooksTemplate,
  createToken,
  generateHooksConfigId,
  generateHooksFactoryId,
  generateHooksInstanceId,
  generateHooksTemplateId,
  generateMarketId,
  generateTokenId,
} from "../generated/UncrashableEntityHelpers";
import { handleMarketDeployed } from "../src/hooks-factory";

let hooksFactoryAddress = Address.fromString(
  "0x0000000000000000000000000000000000001000"
);
let archControllerAddress = Address.fromString(
  "0x0000000000000000000000000000000000001001"
);
let sentinelAddress = Address.fromString(
  "0x0000000000000000000000000000000000001002"
);
let feeRecipientAddress = Address.fromString(
  "0x0000000000000000000000000000000000001003"
);
let borrowerAddress = Address.fromString(
  "0x0000000000000000000000000000000000001004"
);
let assetAddress = Address.fromString(
  "0x0000000000000000000000000000000000001005"
);
let periodicTemplateAddress = Address.fromString(
  "0x0000000000000000000000000000000000002000"
);
let fixedTemplateAddress = Address.fromString(
  "0x0000000000000000000000000000000000002001"
);
let unknownTemplateAddress = Address.fromString(
  "0x0000000000000000000000000000000000002002"
);
let periodicHooksAddress = Address.fromString(
  "0x0000000000000000000000000000000000003000"
);
let fixedHooksAddress = Address.fromString(
  "0x0000000000000000000000000000000000003002"
);
let unknownHooksAddress = Address.fromString(
  "0x0000000000000000000000000000000000003003"
);
let marketAddress = Address.fromString(
  "0x0000000000000000000000000000000000004000"
);

function singleTupleValue(tuple: ethereum.Tuple): Array<ethereum.Value> {
  let values = new Array<ethereum.Value>();
  values.push(ethereum.Value.fromTuple(tuple));
  return values;
}

function singleAddressArg(value: Address): Array<ethereum.Value> {
  let values = new Array<ethereum.Value>();
  values.push(ethereum.Value.fromAddress(value));
  return values;
}

function saveFixtures(
  hooksAddress: Address,
  hooksTemplateAddress: Address,
  hooksKind: string,
  templateName: string
): void {
  createToken(generateTokenId(assetAddress), {
    address: assetAddress,
    name: "Mock Asset",
    symbol: "MOCK",
    decimals: 18,
    isMock: true,
    isUsdStablecoin: false,
  });
  createHooksFactory(generateHooksFactoryId(hooksFactoryAddress), {
    archController: archControllerAddress.toHex(),
    isRegistered: true,
    sentinel: sentinelAddress,
  });
  createHooksTemplate(generateHooksTemplateId(hooksTemplateAddress), {
    name: templateName,
    feeRecipient: feeRecipientAddress,
    protocolFeeBips: 50,
    originationFeeAsset: null,
    originationFeeAmount: BigInt.zero(),
    hooksFactory: generateHooksFactoryId(hooksFactoryAddress),
  });
  createHooksInstance(generateHooksInstanceId(hooksAddress), {
    borrower: borrowerAddress,
    name: templateName,
    hooksFactory: generateHooksFactoryId(hooksFactoryAddress),
    hooksTemplate: generateHooksTemplateId(hooksTemplateAddress),
    kind: hooksKind,
  });
}

function createMarketDeployedEvent(
  hooksTemplateAddress: Address,
  hooksConfig: BigInt
): MarketDeployed {
  let event = changetype<MarketDeployed>(newMockEvent());
  event.address = hooksFactoryAddress;
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam(
      "hooksTemplate",
      ethereum.Value.fromAddress(hooksTemplateAddress)
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "market",
      ethereum.Value.fromAddress(marketAddress)
    )
  );
  event.parameters.push(
    new ethereum.EventParam("name", ethereum.Value.fromString("Wildcat Mock"))
  );
  event.parameters.push(
    new ethereum.EventParam("symbol", ethereum.Value.fromString("WMOCK"))
  );
  event.parameters.push(
    new ethereum.EventParam("asset", ethereum.Value.fromAddress(assetAddress))
  );
  event.parameters.push(
    new ethereum.EventParam(
      "maxTotalSupply",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1000000))
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "annualInterestBips",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1200))
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "delinquencyFeeBips",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(200))
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "withdrawalBatchDuration",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(86400))
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "reserveRatioBips",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1000))
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "delinquencyGracePeriod",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(604800))
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "hooks",
      ethereum.Value.fromUnsignedBigInt(hooksConfig)
    )
  );
  return event;
}

function mockVersion(hooksAddress: Address, version: string): void {
  createMockedFunction(
    hooksAddress,
    "version",
    "version():(string)"
  ).returns([ethereum.Value.fromString(version)]);
}

function mockMarketBalance(): void {
  createMockedFunction(
    assetAddress,
    "balanceOf",
    "balanceOf(address):(uint256)"
  )
    .withArgs(singleAddressArg(marketAddress))
    .returns([ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(123))]);
}

function mockPeriodicHookedMarket(): void {
  let hookedMarket = new ethereum.Tuple();
  hookedMarket.push(ethereum.Value.fromBoolean(true));
  hookedMarket.push(ethereum.Value.fromBoolean(false));
  hookedMarket.push(ethereum.Value.fromBoolean(true));
  hookedMarket.push(ethereum.Value.fromBoolean(true));
  hookedMarket.push(ethereum.Value.fromBoolean(true));
  hookedMarket.push(
    ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(25))
  );
  hookedMarket.push(
    ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1719792000))
  );
  hookedMarket.push(
    ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(7776000))
  );
  hookedMarket.push(
    ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(604800))
  );
  hookedMarket.push(ethereum.Value.fromBoolean(true));
  hookedMarket.push(ethereum.Value.fromBoolean(true));

  createMockedFunction(
    periodicHooksAddress,
    "getHookedMarket",
    "getHookedMarket(address):((bool,bool,bool,bool,bool,uint128,uint32,uint32,uint32,bool,bool))"
  )
    .withArgs(singleAddressArg(marketAddress))
    .returns(singleTupleValue(hookedMarket));
}

function mockFixedHookedMarket(): void {
  let hookedMarket = new ethereum.Tuple();
  hookedMarket.push(ethereum.Value.fromBoolean(true));
  hookedMarket.push(ethereum.Value.fromBoolean(true));
  hookedMarket.push(ethereum.Value.fromBoolean(false));
  hookedMarket.push(ethereum.Value.fromBoolean(true));
  hookedMarket.push(
    ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(50))
  );
  hookedMarket.push(
    ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1735689600))
  );
  hookedMarket.push(ethereum.Value.fromBoolean(true));
  hookedMarket.push(ethereum.Value.fromBoolean(true));
  hookedMarket.push(ethereum.Value.fromBoolean(false));
  hookedMarket.push(ethereum.Value.fromBoolean(true));

  createMockedFunction(
    fixedHooksAddress,
    "getHookedMarket",
    "getHookedMarket(address):((bool,bool,bool,bool,uint128,uint32,bool,bool,bool,bool))"
  )
    .withArgs(singleAddressArg(marketAddress))
    .returns(singleTupleValue(hookedMarket));
}

describe("hooks factory market deployment", () => {
  test("decodes and persists periodic term hooks config", () => {
    clearStore();
    saveFixtures(
      periodicHooksAddress,
      periodicTemplateAddress,
      "PeriodicTerm",
      "PeriodicTermHooks"
    );
    mockVersion(periodicHooksAddress, "PeriodicTermHooks");
    mockPeriodicHookedMarket();
    mockMarketBalance();

    handleMarketDeployed(
      createMarketDeployedEvent(
        periodicTemplateAddress,
        BigInt.fromString("973633883311512525315588250140672")
      )
    );

    let hooksConfigId = generateHooksConfigId(marketAddress);
    let marketId = generateMarketId(marketAddress);
    assert.entityCount("HooksConfig", 1);
    assert.fieldEquals(
      "HooksConfig",
      hooksConfigId,
      "hooks",
      generateHooksInstanceId(periodicHooksAddress)
    );
    assert.fieldEquals("HooksConfig", hooksConfigId, "market", marketId);
    assert.fieldEquals("HooksConfig", hooksConfigId, "useOnDeposit", "true");
    assert.fieldEquals(
      "HooksConfig",
      hooksConfigId,
      "useOnQueueWithdrawal",
      "true"
    );
    assert.fieldEquals(
      "HooksConfig",
      hooksConfigId,
      "useOnExecuteWithdrawal",
      "true"
    );
    assert.fieldEquals("HooksConfig", hooksConfigId, "useOnTransfer", "true");
    assert.fieldEquals("HooksConfig", hooksConfigId, "useOnBorrow", "true");
    assert.fieldEquals("HooksConfig", hooksConfigId, "useOnRepay", "true");
    assert.fieldEquals(
      "HooksConfig",
      hooksConfigId,
      "useOnCloseMarket",
      "false"
    );
    assert.fieldEquals(
      "HooksConfig",
      hooksConfigId,
      "useOnSetMaxTotalSupply",
      "true"
    );
    assert.fieldEquals(
      "HooksConfig",
      hooksConfigId,
      "useOnSetAnnualInterestAndReserveRatioBips",
      "true"
    );
    assert.fieldEquals(
      "HooksConfig",
      hooksConfigId,
      "depositRequiresAccess",
      "true"
    );
    assert.fieldEquals(
      "HooksConfig",
      hooksConfigId,
      "transferRequiresAccess",
      "false"
    );
    assert.fieldEquals(
      "HooksConfig",
      hooksConfigId,
      "queueWithdrawalRequiresAccess",
      "true"
    );
    assert.fieldEquals(
      "HooksConfig",
      hooksConfigId,
      "transfersDisabled",
      "true"
    );
    assert.fieldEquals("HooksConfig", hooksConfigId, "minimumDeposit", "25");
    assert.fieldEquals(
      "HooksConfig",
      hooksConfigId,
      "firstWithdrawalWindowStart",
      "1719792000"
    );
    assert.fieldEquals(
      "HooksConfig",
      hooksConfigId,
      "periodDuration",
      "7776000"
    );
    assert.fieldEquals(
      "HooksConfig",
      hooksConfigId,
      "withdrawalWindowDuration",
      "604800"
    );
    assert.fieldEquals(
      "HooksConfig",
      hooksConfigId,
      "periodicTermClosed",
      "true"
    );
    assert.fieldEquals(
      "HooksConfig",
      hooksConfigId,
      "pendingAprChangeAnnualInterestBips",
      "0"
    );
    assert.fieldEquals("Market", marketId, "totalAssets", "123");
    assert.fieldEquals(
      "HooksInstance",
      generateHooksInstanceId(periodicHooksAddress),
      "numMarkets",
      "1"
    );
  });

  test("preserves fixed term decoding through the explicit fixed branch", () => {
    clearStore();
    saveFixtures(
      fixedHooksAddress,
      fixedTemplateAddress,
      "FixedTerm",
      "FixedTermHooks"
    );
    mockVersion(fixedHooksAddress, "FixedTermHooks");
    mockFixedHookedMarket();
    mockMarketBalance();

    handleMarketDeployed(
      createMarketDeployedEvent(
        fixedTemplateAddress,
        BigInt.fromString("973792339636541053990775338041344")
      )
    );

    let hooksConfigId = generateHooksConfigId(marketAddress);
    assert.fieldEquals(
      "HooksConfig",
      hooksConfigId,
      "depositRequiresAccess",
      "false"
    );
    assert.fieldEquals(
      "HooksConfig",
      hooksConfigId,
      "transferRequiresAccess",
      "true"
    );
    assert.fieldEquals(
      "HooksConfig",
      hooksConfigId,
      "queueWithdrawalRequiresAccess",
      "true"
    );
    assert.fieldEquals(
      "HooksConfig",
      hooksConfigId,
      "transfersDisabled",
      "true"
    );
    assert.fieldEquals("HooksConfig", hooksConfigId, "minimumDeposit", "50");
    assert.fieldEquals(
      "HooksConfig",
      hooksConfigId,
      "fixedTermEndTime",
      "1735689600"
    );
    assert.fieldEquals(
      "HooksConfig",
      hooksConfigId,
      "allowClosureBeforeTerm",
      "true"
    );
    assert.fieldEquals(
      "HooksConfig",
      hooksConfigId,
      "allowTermReduction",
      "false"
    );
    assert.fieldEquals(
      "HooksConfig",
      hooksConfigId,
      "allowForceBuyBacks",
      "true"
    );
    assert.fieldEquals(
      "HooksConfig",
      hooksConfigId,
      "firstWithdrawalWindowStart",
      "0"
    );
  });

  test("keeps unknown hook versions neutral instead of decoding as fixed", () => {
    clearStore();
    saveFixtures(
      unknownHooksAddress,
      unknownTemplateAddress,
      "Unknown",
      "UnknownHooks"
    );
    mockVersion(unknownHooksAddress, "UnknownHooks");
    mockMarketBalance();

    handleMarketDeployed(
      createMarketDeployedEvent(
        unknownTemplateAddress,
        BigInt.fromString("973871567799055318328368881991680")
      )
    );

    let hooksConfigId = generateHooksConfigId(marketAddress);
    assert.entityCount("HooksConfig", 1);
    assert.fieldEquals(
      "HooksConfig",
      hooksConfigId,
      "depositRequiresAccess",
      "false"
    );
    assert.fieldEquals(
      "HooksConfig",
      hooksConfigId,
      "transferRequiresAccess",
      "false"
    );
    assert.fieldEquals(
      "HooksConfig",
      hooksConfigId,
      "queueWithdrawalRequiresAccess",
      "false"
    );
    assert.fieldEquals(
      "HooksConfig",
      hooksConfigId,
      "transfersDisabled",
      "false"
    );
    assert.fieldEquals("HooksConfig", hooksConfigId, "fixedTermEndTime", "0");
    assert.fieldEquals(
      "HooksConfig",
      hooksConfigId,
      "firstWithdrawalWindowStart",
      "0"
    );
    assert.fieldEquals("HooksConfig", hooksConfigId, "periodDuration", "0");
    assert.fieldEquals(
      "HooksConfig",
      hooksConfigId,
      "withdrawalWindowDuration",
      "0"
    );
    assert.fieldEquals(
      "HooksConfig",
      hooksConfigId,
      "periodicTermClosed",
      "false"
    );
  });
});
