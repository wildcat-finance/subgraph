import {
  assert,
  clearStore,
  createMockedFunction,
  dataSourceMock,
  describe,
  newMockEvent,
  test,
} from "matchstick-as/assembly";
import {
  Address,
  BigDecimal,
  BigInt,
  DataSourceContext,
  ethereum,
} from "@graphprotocol/graph-ts";
import {
  CollateralContractCreated,
  ExchangeApproved,
  ExecutorApproved,
} from "../generated/WildcatMarketCollateralFactory/WildcatMarketCollateralFactory";
import {
  CollateralDeposited,
  CollateralReclaimed,
  FullLiquidation,
  LiquidatedSharesReset,
  Liquidation,
} from "../generated/templates/SimpleMarketCollateralMultiParty/SimpleMarketCollateralMultiParty";
import { Token } from "../generated/schema";
import {
  createMarket,
  generateMarketId,
  generateTokenId,
} from "../generated/UncrashableEntityHelpers";
import {
  generateCollateralDepositorId,
  generateFactoryAccountId,
} from "../src/collateral-domain";
import {
  CONTEXT_MODULE_FACTORY_DEPLOYMENT_TARGET,
  CONTEXT_MODULE_FACTORY_GENERATION,
  CONTEXT_MODULE_FACTORY_INDEXED,
  CONTEXT_MODULE_FACTORY_LABEL,
  CONTEXT_MODULE_FACTORY_LIFECYCLE,
  CONTEXT_MODULE_FACTORY_START_BLOCK,
} from "../src/optional-module-context";
import { reconcileOptionalMarketLinks } from "../src/optional-market-links";
import {
  handleCollateralContractCreated,
  handleExchangeApproved,
  handleExecutorApproved,
} from "../src/simple-collateral-factory";
import {
  handleCollateralDeposited,
  handleCollateralReclaimed,
  handleFullLiquidation,
  handleLiquidatedSharesReset,
  handleLiquidation,
} from "../src/simple-collateral";
import { generateEventId } from "../src/utils";

const FACTORY = Address.fromString(
  "0x1000000000000000000000000000000000000001"
);
const SECOND_FACTORY = Address.fromString(
  "0x1000000000000000000000000000000000000002"
);
const COLLATERAL = Address.fromString(
  "0x2000000000000000000000000000000000000001"
);
const COLLATERAL_ASSET = Address.fromString(
  "0x3000000000000000000000000000000000000001"
);
const MARKET = Address.fromString(
  "0x4000000000000000000000000000000000000001"
);
const ACCOUNT = Address.fromString(
  "0x5000000000000000000000000000000000000001"
);
const EXECUTOR = Address.fromString(
  "0x6000000000000000000000000000000000000001"
);
const EXCHANGE = Address.fromString(
  "0x7000000000000000000000000000000000000001"
);

function setCollateralFactoryContext(): void {
  let context = new DataSourceContext();
  context.setString(CONTEXT_MODULE_FACTORY_LABEL, "collateral-v1");
  context.setString(CONTEXT_MODULE_FACTORY_GENERATION, "v1");
  context.setString(CONTEXT_MODULE_FACTORY_START_BLOCK, "123");
  context.setString(CONTEXT_MODULE_FACTORY_INDEXED, "true");
  context.setString(CONTEXT_MODULE_FACTORY_DEPLOYMENT_TARGET, "false");
  context.setString(CONTEXT_MODULE_FACTORY_LIFECYCLE, "ACTIVE");
  dataSourceMock.setContext(context);
}

function positionEvent(
  event: ethereum.Event,
  address: Address,
  logIndex: i32
): void {
  event.address = address;
  event.block.number = BigInt.fromI32(42);
  event.block.timestamp = BigInt.fromI32(1000 + logIndex);
  event.logIndex = BigInt.fromI32(logIndex);
}

function seedCollateralAsset(): void {
  let token = new Token(generateTokenId(COLLATERAL_ASSET));
  token.address = COLLATERAL_ASSET;
  token.name = "Collateral";
  token.symbol = "COLL";
  token.decimals = 18;
  token.isMock = false;
  token.isUsdStablecoin = false;
  token.lastPriceFeedSearchDay = -1;
  token.save();
}

function createCollateralContractCreatedEvent(): CollateralContractCreated {
  let event = changetype<CollateralContractCreated>(newMockEvent());
  positionEvent(event, FACTORY, 0);
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam(
      "collateralContract",
      ethereum.Value.fromAddress(COLLATERAL)
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "collateralToken",
      ethereum.Value.fromAddress(COLLATERAL_ASSET)
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "associatedMarket",
      ethereum.Value.fromAddress(MARKET)
    )
  );
  return event;
}

function createCollateralDepositedEvent(): CollateralDeposited {
  let event = changetype<CollateralDeposited>(newMockEvent());
  positionEvent(event, COLLATERAL, 1);
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam("depositor", ethereum.Value.fromAddress(ACCOUNT))
  );
  event.parameters.push(
    new ethereum.EventParam(
      "depositAmount",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(100))
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "sharesMinted",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(50))
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "lastFullLiquidationIndex",
      ethereum.Value.fromUnsignedBigInt(BigInt.zero())
    )
  );
  return event;
}

function createCollateralReclaimedEvent(): CollateralReclaimed {
  let event = changetype<CollateralReclaimed>(newMockEvent());
  positionEvent(event, COLLATERAL, 2);
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam("reclaimant", ethereum.Value.fromAddress(ACCOUNT))
  );
  event.parameters.push(
    new ethereum.EventParam(
      "sharesBurned",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(10))
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "amountReclaimed",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(20))
    )
  );
  return event;
}

function createLiquidationEvent(): Liquidation {
  let event = changetype<Liquidation>(newMockEvent());
  positionEvent(event, COLLATERAL, 3);
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam("liquidator", ethereum.Value.fromAddress(EXECUTOR))
  );
  event.parameters.push(
    new ethereum.EventParam(
      "collateralLiquidated",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(30))
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "underlyingReceived",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(25))
    )
  );
  return event;
}

function createFullLiquidationEvent(): FullLiquidation {
  let event = changetype<FullLiquidation>(newMockEvent());
  positionEvent(event, COLLATERAL, 4);
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam(
      "lastFullLiquidationIndex",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1))
    )
  );
  return event;
}

function createLiquidatedSharesResetEvent(): LiquidatedSharesReset {
  let event = changetype<LiquidatedSharesReset>(newMockEvent());
  positionEvent(event, COLLATERAL, 5);
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam("account", ethereum.Value.fromAddress(ACCOUNT))
  );
  event.parameters.push(
    new ethereum.EventParam(
      "sharesReset",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(40))
    )
  );
  return event;
}

function createExecutorApprovedEvent(
  factory: Address,
  logIndex: i32
): ExecutorApproved {
  let event = changetype<ExecutorApproved>(newMockEvent());
  positionEvent(event, factory, logIndex);
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam("executor", ethereum.Value.fromAddress(EXECUTOR))
  );
  return event;
}

function createExchangeApprovedEvent(
  factory: Address,
  logIndex: i32
): ExchangeApproved {
  let event = changetype<ExchangeApproved>(newMockEvent());
  positionEvent(event, factory, logIndex);
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam("exchange", ethereum.Value.fromAddress(EXCHANGE))
  );
  return event;
}

describe("simple collateral", () => {
  test("retains discovery and stamps the complete collateral lifecycle", () => {
    clearStore();
    setCollateralFactoryContext();
    seedCollateralAsset();
    createMockedFunction(
      COLLATERAL,
      "LIQUIDATION_COOLDOWN",
      "LIQUIDATION_COOLDOWN():(uint32)"
    ).returns([
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(60)),
    ]);

    let created = createCollateralContractCreatedEvent();
    handleCollateralContractCreated(created);

    assert.fieldEquals(
      "SimpleCollateralFactory",
      FACTORY.toHexString(),
      "generation",
      "v1"
    );
    assert.fieldEquals(
      "SimpleCollateralContract",
      COLLATERAL.toHexString(),
      "marketAddress",
      MARKET.toHexString()
    );
    assert.fieldEquals(
      "SimpleCollateralContract",
      COLLATERAL.toHexString(),
      "liquidationCooldown",
      "60"
    );
    assert.fieldEquals(
      "SimpleCollateralMarketIndex",
      MARKET.toHexString(),
      "marketAddress",
      MARKET.toHexString()
    );
    assert.entityCount("SimpleCollateralContractCreated", 1);
    assert.entityCount("IndexerDiagnostic", 1);

    let deposit = createCollateralDepositedEvent();
    let reclaim = createCollateralReclaimedEvent();
    let liquidation = createLiquidationEvent();
    let full = createFullLiquidationEvent();
    let reset = createLiquidatedSharesResetEvent();
    handleCollateralDeposited(deposit);
    handleCollateralReclaimed(reclaim);
    handleLiquidation(liquidation);
    handleFullLiquidation(full);
    handleLiquidatedSharesReset(reset);

    let depositorId = generateCollateralDepositorId(COLLATERAL, ACCOUNT);
    assert.fieldEquals(
      "SimpleCollateralContractDepositor",
      depositorId,
      "address",
      ACCOUNT.toHexString()
    );
    assert.fieldEquals(
      "SimpleCollateralContractDepositor",
      depositorId,
      "shares",
      "0"
    );
    assert.fieldEquals(
      "SimpleCollateralContractDepositor",
      depositorId,
      "totalDeposited",
      "100"
    );
    assert.fieldEquals(
      "SimpleCollateralContractDepositor",
      depositorId,
      "totalReclaimed",
      "20"
    );
    assert.fieldEquals(
      "SimpleCollateralContract",
      COLLATERAL.toHexString(),
      "totalDeposited",
      "100"
    );
    assert.fieldEquals(
      "SimpleCollateralContract",
      COLLATERAL.toHexString(),
      "totalReclaimed",
      "20"
    );
    assert.fieldEquals(
      "SimpleCollateralContract",
      COLLATERAL.toHexString(),
      "totalLiquidated",
      "30"
    );
    assert.fieldEquals(
      "SimpleCollateralContract",
      COLLATERAL.toHexString(),
      "availableCollateral",
      "50"
    );
    assert.fieldEquals(
      "SimpleCollateralContract",
      COLLATERAL.toHexString(),
      "nextLiquidationTrigger",
      "1063"
    );
    assert.fieldEquals(
      "SimpleCollateralContract",
      COLLATERAL.toHexString(),
      "eventIndex",
      "5"
    );
    assert.fieldEquals(
      "SimpleCollateralContractSnapshot",
      COLLATERAL.toHexString(),
      "updatedAtLogIndex",
      "5"
    );
    assert.fieldEquals(
      "SimpleCollateralContractSnapshot",
      COLLATERAL.toHexString(),
      "eventIndex",
      "5"
    );
    assert.fieldEquals(
      "SimpleCollateralContractDeposit",
      generateEventId(deposit),
      "eventIndex",
      "0"
    );
    assert.fieldEquals(
      "SimpleCollateralContractReclaim",
      generateEventId(reclaim),
      "eventIndex",
      "1"
    );
    assert.fieldEquals(
      "SimpleCollateralContractLiquidation",
      generateEventId(liquidation),
      "eventIndex",
      "2"
    );
    assert.fieldEquals(
      "SimpleCollateralContractFullReset",
      generateEventId(full),
      "eventIndex",
      "3"
    );
    assert.fieldEquals(
      "SimpleCollateralContractLiquidatedSharesReset",
      generateEventId(reset),
      "eventIndex",
      "4"
    );

    let market = createMarket(generateMarketId(MARKET), {
      address: MARKET,
      archController: "arch-controller",
      isRegistered: true,
      version: "V2",
      marketKind: "STANDARD",
      originKind: "HOOKS",
      generation: "test",
      abiFamily: "test",
      controller: null,
      hooksFactory: null,
      hooks: null,
      borrower: Address.zero(),
      borrowerProfile: null,
      sentinel: Address.zero(),
      feeRecipient: Address.zero(),
      name: "market",
      symbol: "mCOLL",
      decimals: 18,
      protocolFeeBips: 0,
      delinquencyGracePeriod: 0,
      delinquencyFeeBips: 0,
      asset: generateTokenId(COLLATERAL_ASSET),
      withdrawalBatchDuration: 3600,
      totalAssets: BigInt.zero(),
      maxTotalSupply: BigInt.fromI32(1_000_000),
      annualInterestBips: 500,
      commitmentFeeBips: null,
      reserveRatioBips: 1000,
      drawnAmount: null,
      scaleFactor: BigInt.fromString("1000000000000000000000000000"),
      lastInterestAccruedTimestamp: 0,
      lastInterestAccruedBlockNumber: 0,
      usdTotalsComplete: true,
      totalDebtUSD: BigDecimal.zero(),
      tokenWrapper: null,
      numCollateralContracts: 0,
      createdAt: 1000,
      createdAtBlock: BigInt.fromI32(42),
      createdAtTimestamp: BigInt.fromI32(1000),
      createdAtTransaction: created.transaction.hash,
      createdAtLogIndex: BigInt.zero(),
      deployedEvent: "deployed",
    });
    reconcileOptionalMarketLinks(market);
    assert.fieldEquals(
      "SimpleCollateralContract",
      COLLATERAL.toHexString(),
      "market",
      MARKET.toHexString()
    );
    assert.fieldEquals(
      "Market",
      MARKET.toHexString(),
      "numCollateralContracts",
      "1"
    );
    dataSourceMock.resetValues();
  });

  test("scopes executor and exchange state to each factory", () => {
    clearStore();
    setCollateralFactoryContext();
    handleExecutorApproved(createExecutorApprovedEvent(FACTORY, 1));
    handleExecutorApproved(createExecutorApprovedEvent(SECOND_FACTORY, 2));
    handleExchangeApproved(createExchangeApprovedEvent(FACTORY, 3));
    handleExchangeApproved(createExchangeApprovedEvent(SECOND_FACTORY, 4));

    assert.entityCount("ApprovedLiquidator", 2);
    assert.entityCount("ApprovedCollateralExchange", 2);
    assert.fieldEquals(
      "ApprovedLiquidator",
      generateFactoryAccountId(FACTORY, EXECUTOR),
      "factory",
      FACTORY.toHexString()
    );
    assert.fieldEquals(
      "ApprovedLiquidator",
      generateFactoryAccountId(SECOND_FACTORY, EXECUTOR),
      "factory",
      SECOND_FACTORY.toHexString()
    );
    assert.fieldEquals(
      "ApprovedCollateralExchange",
      generateFactoryAccountId(FACTORY, EXCHANGE),
      "factory",
      FACTORY.toHexString()
    );
    assert.fieldEquals(
      "ApprovedCollateralExchange",
      generateFactoryAccountId(SECOND_FACTORY, EXCHANGE),
      "factory",
      SECOND_FACTORY.toHexString()
    );
    dataSourceMock.resetValues();
  });
});
