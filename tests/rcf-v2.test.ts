import {
  assert,
  clearStore,
  createMockedFunction,
  describe,
  newMockEvent,
  test,
} from "matchstick-as/assembly/index";
import { Address, BigDecimal, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import {
  handleHooksTemplateAddedForMarketType,
  handleMarketDeployedForMarketType,
} from "../src/hooks-factory";
import { handleBorrow, handleDebtRepaid, handleMarketClosed, handleStateUpdated } from "../src/wildcat-market";
import { MarketDeployed } from "../generated/HooksFactory/HooksFactory";
import { Borrow, DebtRepaid, MarketClosed, StateUpdated } from "../generated/templates/WildcatMarket/WildcatMarket";
import {
  ArchController,
  FactoryHooksTemplate,
  HooksFactory,
  HooksInstance,
  HooksTemplate,
  Market,
  Token,
} from "../generated/schema";
import {
  createBorrowEvent,
  createDebtRepaidEvent,
  createMarketClosedEvent,
  createStateUpdatedEvent,
} from "./wildcat-market-utils";
import { generateTokenId } from "../generated/UncrashableEntityHelpers";

const ZERO_ADDRESS = addressFrom("0x0000000000000000000000000000000000000000");
const LEGACY_FACTORY_ADDRESS = addressFrom("0x1000000000000000000000000000000000000001");
const REVOLVING_FACTORY_ADDRESS = addressFrom("0x2000000000000000000000000000000000000002");
const ARCH_CONTROLLER_ADDRESS = addressFrom("0x3000000000000000000000000000000000000003");
const HOOKS_TEMPLATE_ADDRESS = addressFrom("0x4000000000000000000000000000000000000004");
const ASSET_ADDRESS = addressFrom("0x5000000000000000000000000000000000000005");
const LEGACY_MARKET_ADDRESS = addressFrom("0x6000000000000000000000000000000000000006");
const REVOLVING_MARKET_ADDRESS = addressFrom("0x7000000000000000000000000000000000000007");
const REPAYER_ADDRESS = addressFrom("0x8000000000000000000000000000000000000008");

function addressFrom(hex: string): Address {
  return Address.fromBytes(Bytes.fromHexString(hex));
}

function getFactoryHooksTemplateId(factoryAddress: Address): string {
  return factoryAddress.toHexString() + "-" + HOOKS_TEMPLATE_ADDRESS.toHexString();
}

function resetStore(): void {
  clearStore();
}

function seedArchController(): void {
  let archController = new ArchController(ARCH_CONTROLLER_ADDRESS.toHexString());
  archController.save();
}

function seedToken(address: Address): void {
  let token = new Token(generateTokenId(address));
  token.address = address;
  token.name = "Mock Asset";
  token.symbol = "MOCK";
  token.decimals = 18;
  token.isMock = false;
  token.isUsdStablecoin = false;
  token.save();
}

function seedHooksFactory(address: Address, marketType: string): void {
  let hooksFactory = new HooksFactory(address.toHexString());
  hooksFactory.archController = ARCH_CONTROLLER_ADDRESS.toHexString();
  hooksFactory.marketType = marketType;
  hooksFactory.isRegistered = true;
  hooksFactory.eventIndex = 0;
  hooksFactory.sentinel = address;
  hooksFactory.save();
}

function seedHooksTemplate(): void {
  let hooksTemplate = new HooksTemplate(HOOKS_TEMPLATE_ADDRESS.toHexString());
  hooksTemplate.name = "OpenTermHooks";
  hooksTemplate.feeRecipient = LEGACY_FACTORY_ADDRESS;
  hooksTemplate.protocolFeeBips = 25;
  hooksTemplate.originationFeeAmount = BigInt.zero();
  hooksTemplate.hooksFactory = LEGACY_FACTORY_ADDRESS.toHexString();
  hooksTemplate.disabled = false;
  hooksTemplate.save();
}

function seedFactoryHooksTemplate(factoryAddress: Address, protocolFeeBips: i32): void {
  let factoryHooksTemplate = new FactoryHooksTemplate(
    getFactoryHooksTemplateId(factoryAddress)
  );
  factoryHooksTemplate.hooksFactory = factoryAddress.toHexString();
  factoryHooksTemplate.hooksTemplate = HOOKS_TEMPLATE_ADDRESS.toHexString();
  factoryHooksTemplate.templateAddress = HOOKS_TEMPLATE_ADDRESS;
  factoryHooksTemplate.name = "OpenTermHooks";
  factoryHooksTemplate.feeRecipient = factoryAddress;
  factoryHooksTemplate.protocolFeeBips = protocolFeeBips;
  factoryHooksTemplate.originationFeeAmount = BigInt.zero();
  factoryHooksTemplate.originationFeeAsset = null;
  factoryHooksTemplate.disabled = false;
  factoryHooksTemplate.save();
}

function seedHooksInstance(factoryAddress: Address): void {
  let hooksInstance = new HooksInstance(ZERO_ADDRESS.toHexString());
  hooksInstance.name = "OpenTermHooks";
  hooksInstance.kind = "OpenTerm";
  hooksInstance.borrower = factoryAddress;
  hooksInstance.hooksTemplate = HOOKS_TEMPLATE_ADDRESS.toHexString();
  hooksInstance.factoryHooksTemplate = getFactoryHooksTemplateId(factoryAddress);
  hooksInstance.hooksFactory = factoryAddress.toHexString();
  hooksInstance.eventIndex = 0;
  hooksInstance.numMarkets = 0;
  hooksInstance.save();
}

function seedMarket(address: Address, marketType: string | null): void {
  let market = new Market(address.toHexString());
  market.archController = ARCH_CONTROLLER_ADDRESS.toHexString();
  market.isRegistered = true;
  market.version = "V2";
  market.marketType = marketType;
  market.borrower = LEGACY_FACTORY_ADDRESS;
  market.sentinel = LEGACY_FACTORY_ADDRESS;
  market.feeRecipient = LEGACY_FACTORY_ADDRESS;
  market.name = "Mock Market";
  market.symbol = "mMOCK";
  market.decimals = 18;
  market.protocolFeeBips = 25;
  market.delinquencyGracePeriod = 86400;
  market.delinquencyFeeBips = 100;
  market.asset = generateTokenId(ASSET_ADDRESS);
  market.withdrawalBatchDuration = 3600;
  market.isClosed = false;
  market.maxTotalSupply = BigInt.fromI32(1_000_000);
  market.pendingProtocolFees = BigInt.zero();
  market.normalizedUnclaimedWithdrawals = BigInt.zero();
  market.scaledTotalSupply = BigInt.fromI32(10_000);
  market.scaledPendingWithdrawals = BigInt.zero();
  market.pendingWithdrawalExpiry = BigInt.zero();
  market.isDelinquent = false;
  market.isIncurringPenalties = false;
  market.timeDelinquent = 0;
  market.annualInterestBips = 500;
  market.reserveRatioBips = 1000;
  market.scaleFactor = BigInt.fromString("1000000000000000000000000000");
  market.lastInterestAccruedTimestamp = 1;
  market.lastInterestAccruedBlockNumber = 1;
  market.originalAnnualInterestBips = 500;
  market.originalReserveRatioBips = 1000;
  market.temporaryReserveRatioExpiry = 0;
  market.temporaryReserveRatioActive = false;
  market.totalBorrowed = BigInt.zero();
  market.totalRepaid = BigInt.zero();
  market.totalBaseInterestAccrued = BigInt.zero();
  market.totalDelinquencyFeesAccrued = BigInt.zero();
  market.totalProtocolFeesAccrued = BigInt.zero();
  market.totalDeposited = BigInt.zero();
  market.totalWithdrawalsRequested = BigInt.zero();
  market.totalWithdrawalsExecuted = BigInt.zero();
  market.totalBorrowedUSD = BigDecimal.zero();
  market.totalRepaidUSD = BigDecimal.zero();
  market.totalBaseInterestAccruedUSD = BigDecimal.zero();
  market.totalDelinquencyFeesAccruedUSD = BigDecimal.zero();
  market.totalProtocolFeesAccruedUSD = BigDecimal.zero();
  market.totalDepositedUSD = BigDecimal.zero();
  market.totalWithdrawalsRequestedUSD = BigDecimal.zero();
  market.totalWithdrawalsExecutedUSD = BigDecimal.zero();
  market.totalDebtUSD = BigDecimal.zero();
  market.eventIndex = 0;
  market.delinquencyStatusChangedIndex = 0;
  market.borrowIndex = 0;
  market.depositIndex = 0;
  market.feesCollectedIndex = 0;
  market.debtRepaidIndex = 0;
  market.maxTotalSupplyUpdatedIndex = 0;
  market.annualInterestBipsUpdatedIndex = 0;
  market.withdrawalRequestsIndex = 0;
  market.protocolFeeBipsUpdatedIndex = 0;
  market.forceBuyBackIndex = 0;
  market.fixedTermUpdatedIndex = 0;
  market.minimumDepositUpdatedIndex = 0;
  market.numCollateralContracts = 0;
  market.createdAt = 1;
  market.deployedEvent = "DEPLOYED";
  market.commitmentFeeBips = null;
  market.drawnAmount = null;
  market.save();
}

function createHooksMarketDeployedEvent(
  factoryAddress: Address,
  marketAddress: Address,
  assetAddress: Address
): MarketDeployed {
  let event = changetype<MarketDeployed>(newMockEvent());
  event.address = factoryAddress;
  event.parameters = new Array();

  event.parameters.push(
    new ethereum.EventParam(
      "hooksTemplate",
      ethereum.Value.fromAddress(HOOKS_TEMPLATE_ADDRESS)
    )
  );
  event.parameters.push(
    new ethereum.EventParam("market", ethereum.Value.fromAddress(marketAddress))
  );
  event.parameters.push(
    new ethereum.EventParam("name", ethereum.Value.fromString("Mock Market"))
  );
  event.parameters.push(
    new ethereum.EventParam("symbol", ethereum.Value.fromString("mMOCK"))
  );
  event.parameters.push(
    new ethereum.EventParam("asset", ethereum.Value.fromAddress(assetAddress))
  );
  event.parameters.push(
    new ethereum.EventParam(
      "maxTotalSupply",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1_000_000))
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "annualInterestBips",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(500))
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "delinquencyFeeBips",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(100))
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "withdrawalBatchDuration",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(3600))
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
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(86400))
    )
  );
  event.parameters.push(
    new ethereum.EventParam("hooks", ethereum.Value.fromUnsignedBigInt(BigInt.zero()))
  );

  return event;
}

function mockOpenTermHooks(marketAddress: Address): void {
  createMockedFunction(ZERO_ADDRESS, "version", "version():(string)").returns([
    ethereum.Value.fromString("OpenTermHooks"),
  ]);

  let hookedMarket = new ethereum.Tuple();
  hookedMarket.push(ethereum.Value.fromBoolean(true));
  hookedMarket.push(ethereum.Value.fromBoolean(false));
  hookedMarket.push(ethereum.Value.fromBoolean(false));
  hookedMarket.push(ethereum.Value.fromUnsignedBigInt(BigInt.zero()));
  hookedMarket.push(ethereum.Value.fromBoolean(false));

  createMockedFunction(
    ZERO_ADDRESS,
    "getHookedMarket",
    "getHookedMarket(address):((bool,bool,bool,uint128,bool))"
  )
    .withArgs([ethereum.Value.fromAddress(marketAddress)])
    .returns([ethereum.Value.fromTuple(hookedMarket)]);
}

function mockUnknownHooks(): void {
  createMockedFunction(ZERO_ADDRESS, "version", "version():(string)").returns([
    ethereum.Value.fromString("AuctionHooks"),
  ]);
}

function mockRevolvingState(
  marketAddress: Address,
  commitmentFeeBips: i32,
  drawnAmount: i32
): void {
  createMockedFunction(
    marketAddress,
    "commitmentFeeBips",
    "commitmentFeeBips():(uint256)"
  ).returns([ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(commitmentFeeBips))]);

  createMockedFunction(
    marketAddress,
    "drawnAmount",
    "drawnAmount():(uint256)"
  ).returns([ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(drawnAmount))]);
}

function seedDeployContext(factoryAddress: Address, marketType: string): void {
  seedArchController();
  seedToken(ASSET_ADDRESS);
  seedHooksFactory(factoryAddress, marketType);
  seedHooksTemplate();
  seedFactoryHooksTemplate(factoryAddress, 25);
  seedHooksInstance(factoryAddress);
}

describe("RCF v2 subgraph regression coverage", () => {
  test("shared template address keeps factory-scoped fee state", () => {
    resetStore();
    seedArchController();
    seedHooksFactory(LEGACY_FACTORY_ADDRESS, "Legacy");
    seedHooksFactory(REVOLVING_FACTORY_ADDRESS, "Revolving");

    let legacyEvent = newMockEvent();
    legacyEvent.address = LEGACY_FACTORY_ADDRESS;
    handleHooksTemplateAddedForMarketType(
      legacyEvent,
      HOOKS_TEMPLATE_ADDRESS,
      "OpenTermHooks",
      LEGACY_FACTORY_ADDRESS,
      ZERO_ADDRESS,
      BigInt.zero(),
      25,
      "Legacy"
    );

    let revolvingEvent = newMockEvent();
    revolvingEvent.address = REVOLVING_FACTORY_ADDRESS;
    handleHooksTemplateAddedForMarketType(
      revolvingEvent,
      HOOKS_TEMPLATE_ADDRESS,
      "OpenTermHooks",
      REVOLVING_FACTORY_ADDRESS,
      ZERO_ADDRESS,
      BigInt.zero(),
      125,
      "Revolving"
    );

    let legacyScopedTemplateId = getFactoryHooksTemplateId(
      LEGACY_FACTORY_ADDRESS
    );
    let revolvingScopedTemplateId = getFactoryHooksTemplateId(
      REVOLVING_FACTORY_ADDRESS
    );

    assert.fieldEquals(
      "FactoryHooksTemplate",
      legacyScopedTemplateId,
      "hooksFactory",
      LEGACY_FACTORY_ADDRESS.toHexString()
    );
    assert.fieldEquals(
      "FactoryHooksTemplate",
      legacyScopedTemplateId,
      "protocolFeeBips",
      "25"
    );
    assert.fieldEquals(
      "FactoryHooksTemplate",
      revolvingScopedTemplateId,
      "hooksFactory",
      REVOLVING_FACTORY_ADDRESS.toHexString()
    );
    assert.fieldEquals(
      "FactoryHooksTemplate",
      revolvingScopedTemplateId,
      "protocolFeeBips",
      "125"
    );

    resetStore();
  });

  test("template add repairs placeholder factory-scoped template metadata", () => {
    resetStore();
    seedArchController();
    seedHooksFactory(LEGACY_FACTORY_ADDRESS, "Legacy");

    let placeholder = new FactoryHooksTemplate(
      getFactoryHooksTemplateId(LEGACY_FACTORY_ADDRESS)
    );
    placeholder.hooksFactory = LEGACY_FACTORY_ADDRESS.toHexString();
    placeholder.hooksTemplate = HOOKS_TEMPLATE_ADDRESS.toHexString();
    placeholder.templateAddress = HOOKS_TEMPLATE_ADDRESS;
    placeholder.name = "";
    placeholder.feeRecipient = ZERO_ADDRESS;
    placeholder.protocolFeeBips = 0;
    placeholder.originationFeeAmount = BigInt.zero();
    placeholder.originationFeeAsset = null;
    placeholder.disabled = false;
    placeholder.save();

    let event = newMockEvent();
    event.address = LEGACY_FACTORY_ADDRESS;
    handleHooksTemplateAddedForMarketType(
      event,
      HOOKS_TEMPLATE_ADDRESS,
      "OpenTermHooks",
      LEGACY_FACTORY_ADDRESS,
      ZERO_ADDRESS,
      BigInt.zero(),
      25,
      "Legacy"
    );

    let repairedId = getFactoryHooksTemplateId(LEGACY_FACTORY_ADDRESS);
    assert.fieldEquals(
      "FactoryHooksTemplate",
      repairedId,
      "name",
      "OpenTermHooks"
    );
    assert.fieldEquals(
      "FactoryHooksTemplate",
      repairedId,
      "hooksFactory",
      LEGACY_FACTORY_ADDRESS.toHexString()
    );
    assert.fieldEquals(
      "FactoryHooksTemplate",
      repairedId,
      "protocolFeeBips",
      "25"
    );

    resetStore();
  });

  test("market deploy uses factory-scoped template fee state", () => {
    resetStore();
    seedArchController();
    seedToken(ASSET_ADDRESS);
    seedHooksFactory(REVOLVING_FACTORY_ADDRESS, "Revolving");
    seedHooksTemplate();
    seedFactoryHooksTemplate(REVOLVING_FACTORY_ADDRESS, 125);
    seedHooksInstance(REVOLVING_FACTORY_ADDRESS);
    mockOpenTermHooks(REVOLVING_MARKET_ADDRESS);
    mockRevolvingState(REVOLVING_MARKET_ADDRESS, 125, 4000);

    let event = createHooksMarketDeployedEvent(
      REVOLVING_FACTORY_ADDRESS,
      REVOLVING_MARKET_ADDRESS,
      ASSET_ADDRESS
    );

    handleMarketDeployedForMarketType(
      event,
      event.params.market,
      event.params.hooks,
      event.params.name,
      event.params.symbol,
      event.params.asset,
      event.params.maxTotalSupply,
      event.params.annualInterestBips,
      event.params.delinquencyFeeBips,
      event.params.withdrawalBatchDuration,
      event.params.reserveRatioBips,
      event.params.delinquencyGracePeriod,
      "Revolving"
    );

    assert.fieldEquals(
      "Market",
      REVOLVING_MARKET_ADDRESS.toHexString(),
      "protocolFeeBips",
      "125"
    );
    assert.fieldEquals(
      "Market",
      REVOLVING_MARKET_ADDRESS.toHexString(),
      "feeRecipient",
      REVOLVING_FACTORY_ADDRESS.toHexString()
    );

    resetStore();
  });

  test("legacy deploy leaves revolving fields unset", () => {
    resetStore();
    seedDeployContext(LEGACY_FACTORY_ADDRESS, "Legacy");
    mockOpenTermHooks(LEGACY_MARKET_ADDRESS);

    let event = createHooksMarketDeployedEvent(
      LEGACY_FACTORY_ADDRESS,
      LEGACY_MARKET_ADDRESS,
      ASSET_ADDRESS
    );

    handleMarketDeployedForMarketType(
      event,
      event.params.market,
      event.params.hooks,
      event.params.name,
      event.params.symbol,
      event.params.asset,
      event.params.maxTotalSupply,
      event.params.annualInterestBips,
      event.params.delinquencyFeeBips,
      event.params.withdrawalBatchDuration,
      event.params.reserveRatioBips,
      event.params.delinquencyGracePeriod,
      "Legacy"
    );

    assert.fieldEquals(
      "Market",
      LEGACY_MARKET_ADDRESS.toHexString(),
      "marketType",
      "Legacy"
    );
    assert.fieldEquals(
      "Market",
      LEGACY_MARKET_ADDRESS.toHexString(),
      "commitmentFeeBips",
      "null"
    );
    assert.fieldEquals(
      "Market",
      LEGACY_MARKET_ADDRESS.toHexString(),
      "drawnAmount",
      "null"
    );

    resetStore();
  });

  test("revolving deploy populates commitment fee and drawn amount", () => {
    resetStore();
    seedDeployContext(REVOLVING_FACTORY_ADDRESS, "Revolving");
    mockOpenTermHooks(REVOLVING_MARKET_ADDRESS);
    mockRevolvingState(REVOLVING_MARKET_ADDRESS, 125, 4000);

    let event = createHooksMarketDeployedEvent(
      REVOLVING_FACTORY_ADDRESS,
      REVOLVING_MARKET_ADDRESS,
      ASSET_ADDRESS
    );

    handleMarketDeployedForMarketType(
      event,
      event.params.market,
      event.params.hooks,
      event.params.name,
      event.params.symbol,
      event.params.asset,
      event.params.maxTotalSupply,
      event.params.annualInterestBips,
      event.params.delinquencyFeeBips,
      event.params.withdrawalBatchDuration,
      event.params.reserveRatioBips,
      event.params.delinquencyGracePeriod,
      "Revolving"
    );

    assert.fieldEquals(
      "Market",
      REVOLVING_MARKET_ADDRESS.toHexString(),
      "marketType",
      "Revolving"
    );
    assert.fieldEquals(
      "Market",
      REVOLVING_MARKET_ADDRESS.toHexString(),
      "commitmentFeeBips",
      "125"
    );
    assert.fieldEquals(
      "Market",
      REVOLVING_MARKET_ADDRESS.toHexString(),
      "drawnAmount",
      "4000"
    );

    resetStore();
  });

  test("borrow refreshes revolving market state", () => {
    resetStore();
    seedArchController();
    seedToken(ASSET_ADDRESS);
    seedMarket(REVOLVING_MARKET_ADDRESS, "Revolving");
    mockRevolvingState(REVOLVING_MARKET_ADDRESS, 175, 9000);

    let event = createBorrowEvent(BigInt.fromI32(250));
    event.address = REVOLVING_MARKET_ADDRESS;

    handleBorrow(event);

    assert.fieldEquals(
      "Market",
      REVOLVING_MARKET_ADDRESS.toHexString(),
      "totalBorrowed",
      "250"
    );
    assert.fieldEquals(
      "Market",
      REVOLVING_MARKET_ADDRESS.toHexString(),
      "commitmentFeeBips",
      "175"
    );
    assert.fieldEquals(
      "Market",
      REVOLVING_MARKET_ADDRESS.toHexString(),
      "drawnAmount",
      "9000"
    );

    resetStore();
  });

  test("debt repaid refreshes revolving market state", () => {
    resetStore();
    seedArchController();
    seedToken(ASSET_ADDRESS);
    seedMarket(REVOLVING_MARKET_ADDRESS, "Revolving");
    mockRevolvingState(REVOLVING_MARKET_ADDRESS, 210, 4500);

    let event = createDebtRepaidEvent(REPAYER_ADDRESS, BigInt.fromI32(125));
    event.address = REVOLVING_MARKET_ADDRESS;

    handleDebtRepaid(event);

    assert.fieldEquals(
      "Market",
      REVOLVING_MARKET_ADDRESS.toHexString(),
      "totalRepaid",
      "125"
    );
    assert.fieldEquals(
      "Market",
      REVOLVING_MARKET_ADDRESS.toHexString(),
      "commitmentFeeBips",
      "210"
    );
    assert.fieldEquals(
      "Market",
      REVOLVING_MARKET_ADDRESS.toHexString(),
      "drawnAmount",
      "4500"
    );

    resetStore();
  });

  test("state updates skip revolving sync for legacy markets", () => {
    resetStore();
    seedArchController();
    seedToken(ASSET_ADDRESS);
    seedMarket(LEGACY_MARKET_ADDRESS, "Legacy");

    let event = createStateUpdatedEvent(BigInt.fromI32(1), false);
    event.address = LEGACY_MARKET_ADDRESS;

    handleStateUpdated(event);

    assert.fieldEquals(
      "Market",
      LEGACY_MARKET_ADDRESS.toHexString(),
      "commitmentFeeBips",
      "null"
    );
    assert.fieldEquals(
      "Market",
      LEGACY_MARKET_ADDRESS.toHexString(),
      "drawnAmount",
      "null"
    );

    resetStore();
  });

  test("market close clears revolving drawn amount and APR weighting", () => {
    resetStore();
    seedArchController();
    seedToken(ASSET_ADDRESS);
    seedMarket(REVOLVING_MARKET_ADDRESS, "Revolving");
    mockRevolvingState(REVOLVING_MARKET_ADDRESS, 150, 0);

    let market = Market.load(REVOLVING_MARKET_ADDRESS.toHexString());
    if (market != null) {
      market.commitmentFeeBips = BigInt.fromI32(150);
      market.drawnAmount = BigInt.fromI32(4000);
      market.save();
    }

    let event = createMarketClosedEvent(BigInt.fromI32(2)) as MarketClosed;
    event.address = REVOLVING_MARKET_ADDRESS;

    handleMarketClosed(event);

    assert.fieldEquals(
      "Market",
      REVOLVING_MARKET_ADDRESS.toHexString(),
      "isClosed",
      "true"
    );
    assert.fieldEquals(
      "Market",
      REVOLVING_MARKET_ADDRESS.toHexString(),
      "drawnAmount",
      "0"
    );
    assert.fieldEquals(
      "Market",
      REVOLVING_MARKET_ADDRESS.toHexString(),
      "commitmentFeeBips",
      "150"
    );

    resetStore();
  });

  test("unknown hook versions do not decode as fixed term hooks", () => {
    resetStore();
    seedDeployContext(LEGACY_FACTORY_ADDRESS, "Legacy");
    mockUnknownHooks();

    let event = createHooksMarketDeployedEvent(
      LEGACY_FACTORY_ADDRESS,
      LEGACY_MARKET_ADDRESS,
      ASSET_ADDRESS
    );

    handleMarketDeployedForMarketType(
      event,
      event.params.market,
      event.params.hooks,
      event.params.name,
      event.params.symbol,
      event.params.asset,
      event.params.maxTotalSupply,
      event.params.annualInterestBips,
      event.params.delinquencyFeeBips,
      event.params.withdrawalBatchDuration,
      event.params.reserveRatioBips,
      event.params.delinquencyGracePeriod,
      "Legacy"
    );

    assert.fieldEquals(
      "HooksConfig",
      "HOOKSCONFIG-" + LEGACY_MARKET_ADDRESS.toHexString(),
      "queueWithdrawalRequiresAccess",
      "false"
    );
    assert.fieldEquals(
      "HooksConfig",
      "HOOKSCONFIG-" + LEGACY_MARKET_ADDRESS.toHexString(),
      "fixedTermEndTime",
      "0"
    );

    resetStore();
  });
});
