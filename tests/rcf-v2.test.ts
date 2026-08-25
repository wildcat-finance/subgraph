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
  handleHooksTemplateDisabledForMarketType,
  handleHooksTemplateAddedForMarketType,
  handleMarketDeployedForMarketType,
} from "../src/hooks-factory";
import { handleBorrow, handleDebtRepaid, handleMarketClosed, handleStateUpdated } from "../src/wildcat-market";
import { createInitialMarketSnapshot } from "../src/market-domain";
import { MarketDeployed } from "../generated/HooksFactory/HooksFactory";
import { Borrow, DebtRepaid, MarketClosed, StateUpdated } from "../generated/templates/WildcatMarket/WildcatMarket";
import {
  ArchController,
  HooksFactory,
  HooksInstance,
  HooksTemplate,
  HooksTemplateRegistration,
  Market,
  Token,
} from "../generated/schema";
import {
  createBorrowEvent,
  createDebtRepaidEvent,
  createMarketClosedEvent,
  createStateUpdatedEvent,
} from "./wildcat-market-utils";
import {
  generateHooksConfigId,
  generateTokenId,
} from "../generated/UncrashableEntityHelpers";

const ZERO_ADDRESS = addressFrom("0x0000000000000000000000000000000000000000");
const LEGACY_FACTORY_ADDRESS = addressFrom("0x1000000000000000000000000000000000000001");
const REVOLVING_FACTORY_ADDRESS = addressFrom("0x2000000000000000000000000000000000000002");
const ARCH_CONTROLLER_ADDRESS = addressFrom("0x3000000000000000000000000000000000000003");
const HOOKS_TEMPLATE_ADDRESS = addressFrom("0x4000000000000000000000000000000000000004");
const ASSET_ADDRESS = addressFrom("0x5000000000000000000000000000000000000005");
const LEGACY_MARKET_ADDRESS = addressFrom("0x6000000000000000000000000000000000000006");
const REVOLVING_MARKET_ADDRESS = addressFrom("0x7000000000000000000000000000000000000007");
const REPAYER_ADDRESS = addressFrom("0x8000000000000000000000000000000000000008");
const RAY = BigInt.fromString("1000000000000000000000000000");

function addressFrom(hex: string): Address {
  return Address.fromBytes(Bytes.fromHexString(hex));
}

function getTemplateRegistrationId(factoryAddress: Address): string {
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
  token.lastPriceFeedSearchDay = -1;
  token.save();
}

function seedHooksFactory(address: Address, marketType: string): void {
  let hooksFactory = new HooksFactory(address.toHexString());
  hooksFactory.address = address;
  hooksFactory.label = "test";
  hooksFactory.archController = ARCH_CONTROLLER_ADDRESS.toHexString();
  hooksFactory.marketKind = marketType == "Revolving" ? "REVOLVING" : "STANDARD";
  hooksFactory.generation = "test";
  hooksFactory.abiFamily = "test";
  hooksFactory.eventGeneration = "LEGACY";
  hooksFactory.hookedMarketAbi = "BASE";
  hooksFactory.configuredStartBlock = BigInt.zero();
  hooksFactory.indexed = true;
  hooksFactory.deploymentTarget = false;
  hooksFactory.lifecycle = "ACTIVE";
  hooksFactory.configured = true;
  hooksFactory.isRegistered = true;
  hooksFactory.eventIndex = 0;
  hooksFactory.sentinel = address;
  hooksFactory.save();
}

function seedHooksTemplate(): void {
  let hooksTemplate = new HooksTemplate(HOOKS_TEMPLATE_ADDRESS.toHexString());
  hooksTemplate.address = HOOKS_TEMPLATE_ADDRESS;
  hooksTemplate.kind = "OpenTerm";
  hooksTemplate.version = "OpenTermHooks";
  hooksTemplate.abiFamily = "test";
  hooksTemplate.save();
}

function seedTemplateRegistration(factoryAddress: Address, protocolFeeBips: i32): void {
  let registration = new HooksTemplateRegistration(
    getTemplateRegistrationId(factoryAddress)
  );
  registration.hooksFactory = factoryAddress.toHexString();
  registration.hooksTemplate = HOOKS_TEMPLATE_ADDRESS.toHexString();
  registration.templateAddress = HOOKS_TEMPLATE_ADDRESS;
  registration.name = "OpenTermHooks";
  registration.feeRecipient = factoryAddress;
  registration.protocolFeeBips = protocolFeeBips;
  registration.originationFeeAmount = BigInt.zero();
  registration.originationFeeAsset = null;
  registration.isEnabled = true;
  registration.createdAtBlock = BigInt.zero();
  registration.createdAtTimestamp = BigInt.zero();
  registration.createdAtTransaction = Bytes.fromHexString("0x00");
  registration.createdAtLogIndex = BigInt.zero();
  registration.updatedAtBlock = BigInt.zero();
  registration.updatedAtTimestamp = BigInt.zero();
  registration.updatedAtTransaction = Bytes.fromHexString("0x00");
  registration.updatedAtLogIndex = BigInt.zero();
  registration.save();
}

function seedHooksInstance(factoryAddress: Address): void {
  let hooksInstance = new HooksInstance(ZERO_ADDRESS.toHexString());
  hooksInstance.address = ZERO_ADDRESS;
  hooksInstance.name = "OpenTermHooks";
  hooksInstance.kind = "OpenTerm";
  hooksInstance.marketKind = "STANDARD";
  hooksInstance.generation = "test";
  hooksInstance.abiFamily = "test";
  hooksInstance.eventGeneration = "LEGACY";
  hooksInstance.borrower = factoryAddress;
  hooksInstance.administrator = factoryAddress;
  hooksInstance.deployer = factoryAddress;
  hooksInstance.version = "OpenTermHooks";
  hooksInstance.providerMetadataState = "UNKNOWN";
  hooksInstance.hooksTemplate = HOOKS_TEMPLATE_ADDRESS.toHexString();
  hooksInstance.templateRegistration = getTemplateRegistrationId(factoryAddress);
  hooksInstance.hooksFactory = factoryAddress.toHexString();
  hooksInstance.eventIndex = 0;
  hooksInstance.numMarkets = 0;
  hooksInstance.deployedAtBlock = BigInt.zero();
  hooksInstance.deployedAtTimestamp = BigInt.zero();
  hooksInstance.deployedAtTransaction = Bytes.fromHexString("0x00");
  hooksInstance.deployedAtLogIndex = BigInt.zero();
  hooksInstance.save();
}

function seedMarket(address: Address, marketKind: string): void {
  let market = new Market(address.toHexString());
  market.address = address;
  market.archController = ARCH_CONTROLLER_ADDRESS.toHexString();
  market.isRegistered = true;
  market.version = "V2";
  market.marketKind = marketKind;
  market.originKind = "HOOKS";
  market.generation = "test";
  market.abiFamily = "test";
  market.eventGeneration = "LEGACY";
  market.borrower = LEGACY_FACTORY_ADDRESS;
  market.borrowerPrincipal = LEGACY_FACTORY_ADDRESS;
  market.initialBorrower = LEGACY_FACTORY_ADDRESS;
  market.initialBorrowerPrincipal = LEGACY_FACTORY_ADDRESS;
  market.sentinel = LEGACY_FACTORY_ADDRESS;
  market.feeRecipient = LEGACY_FACTORY_ADDRESS;
  market.originationFeeAmount = BigInt.zero();
  market.name = "Mock Market";
  market.symbol = "mMOCK";
  market.decimals = 18;
  market.protocolFeeBips = 25;
  market.delinquencyGracePeriod = 86400;
  market.delinquencyFeeBips = 100;
  market.asset = generateTokenId(ASSET_ADDRESS);
  market.withdrawalBatchDuration = 3600;
  market.isClosed = false;
  market.totalAssets = BigInt.zero();
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
  market.usdTotalsComplete = true;
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
  market.createdAtBlock = BigInt.fromI32(1);
  market.createdAtTimestamp = BigInt.fromI32(1);
  market.createdAtTransaction = Bytes.fromHexString("0x00");
  market.createdAtLogIndex = BigInt.zero();
  market.deployedEvent = "DEPLOYED";
  market.commitmentFeeBips = null;
  market.drawnAmount = null;
  market.save();
  createInitialMarketSnapshot(
    changetype<ethereum.Event>(newMockEvent()),
    market,
    marketKind == "REVOLVING"
      ? "EVENT_AND_CONTRACT_CALL"
      : "EVENT_PROJECTION"
  );
}

function createHooksMarketDeployedEvent(
  factoryAddress: Address,
  marketAddress: Address,
  assetAddress: Address
): MarketDeployed {
  createMockedFunction(
    assetAddress,
    "balanceOf",
    "balanceOf(address):(uint256)"
  )
    .withArgs([ethereum.Value.fromAddress(marketAddress)])
    .returns([ethereum.Value.fromUnsignedBigInt(BigInt.zero())]);
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

function mockOpenTermHooksWithForceBuyBack(marketAddress: Address): void {
  createMockedFunction(ZERO_ADDRESS, "version", "version():(string)").returns([
    ethereum.Value.fromString("OpenTermHooks"),
  ]);

  let hookedMarket = new ethereum.Tuple();
  hookedMarket.push(ethereum.Value.fromBoolean(true));
  hookedMarket.push(ethereum.Value.fromBoolean(false));
  hookedMarket.push(ethereum.Value.fromBoolean(false));
  hookedMarket.push(ethereum.Value.fromUnsignedBigInt(BigInt.zero()));
  hookedMarket.push(ethereum.Value.fromBoolean(false));
  hookedMarket.push(ethereum.Value.fromBoolean(true));

  createMockedFunction(
    ZERO_ADDRESS,
    "getHookedMarket",
    "getHookedMarket(address):((bool,bool,bool,uint128,bool,bool))"
  )
    .withArgs([ethereum.Value.fromAddress(marketAddress)])
    .returns([ethereum.Value.fromTuple(hookedMarket)]);
}

function mockOpenTermTemplate(): void {
  createMockedFunction(
    HOOKS_TEMPLATE_ADDRESS,
    "version",
    "version():(string)"
  ).returns([ethereum.Value.fromString("OpenTermHooks")]);
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
  seedTemplateRegistration(factoryAddress, 25);
  seedHooksInstance(factoryAddress);
}

describe("RCF v2 subgraph regression coverage", () => {
  test("shared template address keeps factory-scoped fee state", () => {
    resetStore();
    seedArchController();
    seedHooksFactory(LEGACY_FACTORY_ADDRESS, "Legacy");
    seedHooksFactory(REVOLVING_FACTORY_ADDRESS, "Revolving");
    mockOpenTermTemplate();

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
    revolvingEvent.logIndex = BigInt.fromI32(2);
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

    let legacyScopedTemplateId = getTemplateRegistrationId(
      LEGACY_FACTORY_ADDRESS
    );
    let revolvingScopedTemplateId = getTemplateRegistrationId(
      REVOLVING_FACTORY_ADDRESS
    );

    assert.fieldEquals(
      "HooksTemplateRegistration",
      legacyScopedTemplateId,
      "hooksFactory",
      LEGACY_FACTORY_ADDRESS.toHexString()
    );
    assert.fieldEquals(
      "HooksTemplateRegistration",
      legacyScopedTemplateId,
      "protocolFeeBips",
      "25"
    );
    assert.fieldEquals(
      "HooksTemplateRegistration",
      revolvingScopedTemplateId,
      "hooksFactory",
      REVOLVING_FACTORY_ADDRESS.toHexString()
    );
    assert.fieldEquals(
      "HooksTemplateRegistration",
      revolvingScopedTemplateId,
      "protocolFeeBips",
      "125"
    );
    assert.entityCount("HooksTemplate", 1);
    assert.entityCount("HooksTemplateRegistration", 2);
    assert.entityCount("HooksTemplateRegistrationEvent", 2);
    assert.fieldEquals(
      "HooksTemplate",
      HOOKS_TEMPLATE_ADDRESS.toHexString(),
      "abiFamily",
      "test"
    );

    resetStore();
  });

  test("disabling a shared template is isolated to one factory", () => {
    resetStore();
    seedArchController();
    seedHooksFactory(LEGACY_FACTORY_ADDRESS, "Legacy");
    seedHooksFactory(REVOLVING_FACTORY_ADDRESS, "Revolving");
    seedHooksTemplate();
    seedTemplateRegistration(LEGACY_FACTORY_ADDRESS, 25);
    seedTemplateRegistration(REVOLVING_FACTORY_ADDRESS, 125);

    let disabledEvent = newMockEvent();
    disabledEvent.address = LEGACY_FACTORY_ADDRESS;
    handleHooksTemplateDisabledForMarketType(
      disabledEvent,
      HOOKS_TEMPLATE_ADDRESS,
      "Legacy"
    );

    assert.fieldEquals(
      "HooksTemplateRegistration",
      getTemplateRegistrationId(LEGACY_FACTORY_ADDRESS),
      "isEnabled",
      "false"
    );
    assert.fieldEquals(
      "HooksTemplateRegistration",
      getTemplateRegistrationId(REVOLVING_FACTORY_ADDRESS),
      "isEnabled",
      "true"
    );
    assert.entityCount("HooksTemplateRegistrationEvent", 1);

    resetStore();
  });

  test("market deploy uses factory-scoped template fee state", () => {
    resetStore();
    seedArchController();
    seedToken(ASSET_ADDRESS);
    seedHooksFactory(REVOLVING_FACTORY_ADDRESS, "Revolving");
    seedHooksTemplate();
    seedTemplateRegistration(REVOLVING_FACTORY_ADDRESS, 125);
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
      "marketKind",
      "STANDARD"
    );
    assert.fieldEquals(
      "Market",
      LEGACY_MARKET_ADDRESS.toHexString(),
      "originKind",
      "HOOKS"
    );
    assert.fieldEquals(
      "Market",
      LEGACY_MARKET_ADDRESS.toHexString(),
      "generation",
      "test"
    );
    assert.fieldEquals(
      "Market",
      LEGACY_MARKET_ADDRESS.toHexString(),
      "borrowerProfile",
      LEGACY_FACTORY_ADDRESS.toHexString()
    );
    assert.fieldEquals(
      "Borrower",
      LEGACY_FACTORY_ADDRESS.toHexString(),
      "address",
      LEGACY_FACTORY_ADDRESS.toHexString()
    );
    assert.fieldEquals(
      "BorrowerStats",
      "BORROWER-STATS-" + LEGACY_FACTORY_ADDRESS.toHexString(),
      "profile",
      LEGACY_FACTORY_ADDRESS.toHexString()
    );
    assert.fieldEquals(
      "ProtocolDailyStats",
      "PROTOCOL-0",
      "numMarkets",
      "1"
    );
    assert.fieldEquals(
      "BorrowerDailyStats",
      "BORROWER-DAILY-" + LEGACY_FACTORY_ADDRESS.toHexString() + "-0",
      "numMarkets",
      "1"
    );
    assert.fieldEquals(
      "Market",
      LEGACY_MARKET_ADDRESS.toHexString(),
      "asset",
      generateTokenId(ASSET_ADDRESS)
    );
    assert.fieldEquals(
      "MarketSnapshot",
      LEGACY_MARKET_ADDRESS.toHexString(),
      "source",
      "EVENT_AND_CONTRACT_CALL"
    );
    assert.fieldEquals(
      "HooksConfig",
      generateHooksConfigId(LEGACY_MARKET_ADDRESS),
      "allowForceBuyBacks",
      "false"
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

  test("force-buyback hooked-market ABI retains historical config", () => {
    resetStore();
    seedDeployContext(LEGACY_FACTORY_ADDRESS, "Legacy");
    let factory = HooksFactory.load(LEGACY_FACTORY_ADDRESS.toHexString());
    if (factory != null) {
      factory.hookedMarketAbi = "FORCE_BUYBACK";
      factory.save();
    }
    mockOpenTermHooksWithForceBuyBack(LEGACY_MARKET_ADDRESS);

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
      generateHooksConfigId(LEGACY_MARKET_ADDRESS),
      "allowForceBuyBacks",
      "true"
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
      "marketKind",
      "REVOLVING"
    );
    assert.fieldEquals(
      "Market",
      REVOLVING_MARKET_ADDRESS.toHexString(),
      "createdAt",
      event.block.timestamp.toString()
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
    assert.fieldEquals(
      "MarketSnapshot",
      REVOLVING_MARKET_ADDRESS.toHexString(),
      "source",
      "EVENT_AND_CONTRACT_CALL"
    );
    assert.fieldEquals(
      "MarketSnapshot",
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
    seedMarket(REVOLVING_MARKET_ADDRESS, "REVOLVING");
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
    assert.fieldEquals(
      "Market",
      REVOLVING_MARKET_ADDRESS.toHexString(),
      "usdTotalsComplete",
      "false"
    );
    assert.fieldEquals("ProtocolStats", "PROTOCOL_STATS", "usdTotalsComplete", "false");
    assert.fieldEquals(
      "BorrowerStats",
      "BORROWER-STATS-" + LEGACY_FACTORY_ADDRESS.toHexString(),
      "usdTotalsComplete",
      "false"
    );
    assert.fieldEquals(
      "ProtocolDailyStats",
      "PROTOCOL-0",
      "dayUsdTotalsComplete",
      "false"
    );
    assert.fieldEquals(
      "MarketDailyStats",
      REVOLVING_MARKET_ADDRESS.toHexString() + "-0",
      "dayUsdTotalsComplete",
      "false"
    );

    resetStore();
  });

  test("debt repaid refreshes revolving market state", () => {
    resetStore();
    seedArchController();
    seedToken(ASSET_ADDRESS);
    seedMarket(REVOLVING_MARKET_ADDRESS, "REVOLVING");
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
    seedMarket(LEGACY_MARKET_ADDRESS, "STANDARD");

    let event = createStateUpdatedEvent(RAY, false);
    event.address = LEGACY_MARKET_ADDRESS;
    createMockedFunction(
      ASSET_ADDRESS,
      "balanceOf",
      "balanceOf(address):(uint256)"
    )
      .withArgs([ethereum.Value.fromAddress(LEGACY_MARKET_ADDRESS)])
      .returns([ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(12_345))]);

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
    assert.fieldEquals(
      "MarketSnapshot",
      LEGACY_MARKET_ADDRESS.toHexString(),
      "scaleFactor",
      RAY.toString()
    );
    assert.fieldEquals(
      "Market",
      LEGACY_MARKET_ADDRESS.toHexString(),
      "totalAssets",
      "12345"
    );
    assert.fieldEquals(
      "MarketSnapshot",
      LEGACY_MARKET_ADDRESS.toHexString(),
      "totalAssets",
      "12345"
    );
    assert.fieldEquals(
      "MarketSnapshot",
      LEGACY_MARKET_ADDRESS.toHexString(),
      "source",
      "EVENT_AND_CONTRACT_CALL"
    );
    assert.fieldEquals(
      "Market",
      LEGACY_MARKET_ADDRESS.toHexString(),
      "totalDebtUSD",
      "null"
    );

    resetStore();
  });

  test("state updates retain exact zero USD debt without a price", () => {
    resetStore();
    seedArchController();
    seedToken(ASSET_ADDRESS);
    seedMarket(LEGACY_MARKET_ADDRESS, "STANDARD");
    let market = Market.load(LEGACY_MARKET_ADDRESS.toHexString());
    if (market != null) {
      market.scaledTotalSupply = BigInt.zero();
      market.save();
    }

    let event = createStateUpdatedEvent(BigInt.fromI32(1), false);
    event.address = LEGACY_MARKET_ADDRESS;
    createMockedFunction(
      ASSET_ADDRESS,
      "balanceOf",
      "balanceOf(address):(uint256)"
    )
      .withArgs([ethereum.Value.fromAddress(LEGACY_MARKET_ADDRESS)])
      .returns([ethereum.Value.fromUnsignedBigInt(BigInt.zero())]);

    handleStateUpdated(event);

    assert.fieldEquals(
      "Market",
      LEGACY_MARKET_ADDRESS.toHexString(),
      "totalDebtUSD",
      "0"
    );

    resetStore();
  });

  test("market daily price recovers when pricing becomes available later", () => {
    resetStore();
    seedArchController();
    seedToken(ASSET_ADDRESS);
    seedMarket(LEGACY_MARKET_ADDRESS, "STANDARD");

    let first = createBorrowEvent(BigInt.fromI32(1));
    first.address = LEGACY_MARKET_ADDRESS;
    handleBorrow(first);
    assert.fieldEquals(
      "MarketDailyStats",
      LEGACY_MARKET_ADDRESS.toHexString() + "-0",
      "usdPrice",
      "null"
    );

    let token = Token.load(generateTokenId(ASSET_ADDRESS));
    if (token != null) {
      token.isUsdStablecoin = true;
      token.priceSource = "USD_PEG";
      token.save();
    }
    let second = createDebtRepaidEvent(REPAYER_ADDRESS, BigInt.fromI32(1));
    second.address = LEGACY_MARKET_ADDRESS;
    second.logIndex = BigInt.fromI32(2);
    handleDebtRepaid(second);

    assert.fieldEquals(
      "MarketDailyStats",
      LEGACY_MARKET_ADDRESS.toHexString() + "-0",
      "usdPrice",
      "1"
    );

    resetStore();
  });

  test("market close clears revolving drawn amount and APR weighting", () => {
    resetStore();
    seedArchController();
    seedToken(ASSET_ADDRESS);
    seedMarket(REVOLVING_MARKET_ADDRESS, "REVOLVING");
    mockRevolvingState(REVOLVING_MARKET_ADDRESS, 150, 0);

    let market = Market.load(REVOLVING_MARKET_ADDRESS.toHexString());
    if (market != null) {
      market.commitmentFeeBips = BigInt.fromI32(150);
      market.drawnAmount = BigInt.fromI32(4000);
      market.timeDelinquent = 90_000;
      market.isIncurringPenalties = true;
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
    assert.fieldEquals(
      "Market",
      REVOLVING_MARKET_ADDRESS.toHexString(),
      "annualInterestBips",
      "0"
    );
    assert.fieldEquals(
      "Market",
      REVOLVING_MARKET_ADDRESS.toHexString(),
      "reserveRatioBips",
      "10000"
    );
    assert.fieldEquals(
      "Market",
      REVOLVING_MARKET_ADDRESS.toHexString(),
      "timeDelinquent",
      "0"
    );
    assert.fieldEquals(
      "Market",
      REVOLVING_MARKET_ADDRESS.toHexString(),
      "isIncurringPenalties",
      "false"
    );
    assert.fieldEquals(
      "MarketSnapshot",
      REVOLVING_MARKET_ADDRESS.toHexString(),
      "annualInterestBips",
      "0"
    );
    assert.fieldEquals(
      "MarketSnapshot",
      REVOLVING_MARKET_ADDRESS.toHexString(),
      "reserveRatioBips",
      "10000"
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
