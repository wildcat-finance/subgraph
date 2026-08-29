import { newMockEvent } from "matchstick-as/assembly";
import {
  Address,
  BigDecimal,
  BigInt,
  Bytes,
  ethereum,
} from "@graphprotocol/graph-ts";
import {
  ArchController,
  BorrowerIdentityRegistry,
  HooksFactory,
  HooksInstance,
  HooksTemplate,
  HooksTemplateRegistration,
  Market,
  Token,
} from "../generated/schema";
import {
  createMarket,
  generateHooksInstanceId,
  generateMarketId,
  generateTokenId,
} from "../generated/UncrashableEntityHelpers";
import { getOrCreateBorrower } from "../src/borrower-domain";
import {
  getOrCreateBorrowerStats,
  getOrCreateProtocolStats,
} from "../src/daily-stats";
import { createInitialMarketSnapshot } from "../src/market-domain";

export const TEST_ARCH_CONTROLLER = Address.fromString(
  "0x000000000000000000000000000000000000a001"
);

export function createV25Event(
  emitter: Address,
  logIndex: i32
): ethereum.Event {
  let event = changetype<ethereum.Event>(newMockEvent());
  event.address = emitter;
  event.block.number = BigInt.fromI32(100);
  event.block.timestamp = BigInt.fromI32(1_000);
  event.logIndex = BigInt.fromI32(logIndex);
  event.parameters = new Array<ethereum.EventParam>();
  return event;
}

export function pushAddress(
  event: ethereum.Event,
  name: string,
  value: Address
): void {
  event.parameters.push(
    new ethereum.EventParam(name, ethereum.Value.fromAddress(value))
  );
}

export function pushBigInt(
  event: ethereum.Event,
  name: string,
  value: BigInt
): void {
  event.parameters.push(
    new ethereum.EventParam(name, ethereum.Value.fromUnsignedBigInt(value))
  );
}

export function pushString(
  event: ethereum.Event,
  name: string,
  value: string
): void {
  event.parameters.push(
    new ethereum.EventParam(name, ethereum.Value.fromString(value))
  );
}

export function seedArchController(): void {
  let archController = new ArchController(TEST_ARCH_CONTROLLER.toHexString());
  archController.save();
}

export function seedToken(address: Address): Token {
  let token = new Token(generateTokenId(address));
  token.address = address;
  token.name = "USD Coin";
  token.symbol = "USDC";
  token.decimals = 6;
  token.isMock = false;
  token.isUsdStablecoin = true;
  token.priceSource = "USD_PEG";
  token.lastPriceFeedSearchDay = -1;
  token.save();
  return token;
}

export function seedV25Factory(
  address: Address,
  marketKind: string
): HooksFactory {
  seedArchController();
  let factory = new HooksFactory(address.toHexString());
  factory.address = address;
  factory.label = "v2.5-test";
  factory.archController = TEST_ARCH_CONTROLLER.toHexString();
  factory.marketKind = marketKind;
  factory.generation = "v2.5";
  factory.abiFamily = "hooks-v2-5";
  factory.eventGeneration = "V2_5";
  factory.hookedMarketAbi = "BASE";
  factory.configuredStartBlock = BigInt.zero();
  factory.indexed = true;
  factory.deploymentTarget = true;
  factory.lifecycle = "ACTIVE";
  factory.configured = true;
  factory.isRegistered = true;
  factory.eventIndex = 0;
  factory.sentinel = Address.fromString(
    "0x000000000000000000000000000000000000a002"
  );
  factory.save();
  return factory;
}

export function seedV25Hooks(
  factoryAddress: Address,
  templateAddress: Address,
  hooksAddress: Address,
  administrator: Address
): HooksInstance {
  let template = new HooksTemplate(templateAddress.toHexString());
  template.address = templateAddress;
  template.kind = "OpenTerm";
  template.version = "OpenTermHooks";
  template.abiFamily = "hooks-v2-5";
  template.save();

  let registrationId = factoryAddress
    .toHexString()
    .concat("-")
    .concat(templateAddress.toHexString());
  let registration = new HooksTemplateRegistration(registrationId);
  registration.hooksFactory = factoryAddress.toHexString();
  registration.hooksTemplate = template.id;
  registration.templateAddress = templateAddress;
  registration.name = "OpenTermHooks";
  registration.feeRecipient = administrator;
  registration.protocolFeeBips = 50;
  registration.originationFeeAmount = BigInt.zero();
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

  let hooks = new HooksInstance(generateHooksInstanceId(hooksAddress));
  hooks.address = hooksAddress;
  hooks.name = "OpenTermHooks";
  hooks.kind = "OpenTerm";
  let factory = HooksFactory.load(factoryAddress.toHexString());
  hooks.marketKind = factory == null ? "STANDARD" : factory.marketKind;
  hooks.generation = "v2.5";
  hooks.abiFamily = "hooks-v2-5";
  hooks.eventGeneration = "V2_5";
  hooks.borrower = administrator;
  hooks.administrator = administrator;
  hooks.deployer = administrator;
  hooks.version = "OpenTermHooks";
  hooks.providerMetadataState = "AVAILABLE";
  hooks.hooksTemplate = template.id;
  hooks.templateRegistration = registration.id;
  hooks.hooksFactory = factoryAddress.toHexString();
  hooks.eventIndex = 0;
  hooks.numMarkets = 0;
  hooks.deployedAtBlock = BigInt.zero();
  hooks.deployedAtTimestamp = BigInt.zero();
  hooks.deployedAtTransaction = Bytes.fromHexString("0x00");
  hooks.deployedAtLogIndex = BigInt.zero();
  hooks.save();
  return hooks;
}

export function seedV25Market(
  event: ethereum.Event,
  marketAddress: Address,
  assetAddress: Address,
  borrower: Address,
  principal: Address,
  registryAddress: Address,
  borrowerAccount: string | null = null,
  marketKind: string = "STANDARD"
): Market {
  seedArchController();
  let token = seedToken(assetAddress);
  let registry = BorrowerIdentityRegistry.load(registryAddress.toHexString());
  if (registry == null) {
    registry = new BorrowerIdentityRegistry(registryAddress.toHexString());
    registry.address = registryAddress;
    registry.archController = TEST_ARCH_CONTROLLER.toHexString();
    registry.eventIndex = 0;
    registry.save();
  }
  let profile = getOrCreateBorrower(event, principal);
  let market = createMarket(generateMarketId(marketAddress), {
    address: marketAddress,
    archController: TEST_ARCH_CONTROLLER.toHexString(),
    isRegistered: true,
    version: "V2",
    marketKind,
    originKind: "HOOKS",
    generation: "v2.5",
    abiFamily: "hooks-v2-5",
    eventGeneration: "V2_5",
    controller: null,
    hooksFactory: null,
    hooks: null,
    borrower,
    borrowerAccount,
    borrowerPrincipal: principal,
    borrowerProfile: profile.id,
    initialBorrower: borrower,
    initialBorrowerPrincipal: principal,
    borrowerIdentityRegistry: (registry as BorrowerIdentityRegistry).id,
    borrowerIdentityRegistryAddress: registryAddress,
    sentinel: Address.zero(),
    feeRecipient: Address.zero(),
    originationFeeAsset: null,
    originationFeeAmount: BigInt.zero(),
    requestedHooks: null,
    finalHooks: null,
    hooksData: null,
    name: "v2.5 test market",
    symbol: "mUSDC",
    decimals: token.decimals,
    protocolFeeBips: 50,
    delinquencyGracePeriod: 86_400,
    delinquencyFeeBips: 100,
    asset: token.id,
    withdrawalBatchDuration: 3_600,
    totalAssets: BigInt.zero(),
    maxTotalSupply: BigInt.fromI32(1_000_000),
    annualInterestBips: 500,
    commitmentFeeBips: marketKind == "REVOLVING" ? BigInt.fromI32(100) : null,
    reserveRatioBips: 1_000,
    drawnAmount: marketKind == "REVOLVING" ? BigInt.zero() : null,
    scaleFactor: BigInt.fromString("1000000000000000000000000000"),
    lastInterestAccruedTimestamp: event.block.timestamp.toI32(),
    lastInterestAccruedBlockNumber: event.block.number.toI32(),
    usdTotalsComplete: true,
    totalDebtUSD: BigDecimal.zero(),
    tokenWrapper: null,
    numCollateralContracts: 0,
    createdAt: event.block.timestamp.toI32(),
    createdAtBlock: event.block.number,
    createdAtTimestamp: event.block.timestamp,
    createdAtTransaction: event.transaction.hash,
    createdAtLogIndex: event.logIndex,
    deployedEvent: "v2.5-test-deployment",
  });
  createInitialMarketSnapshot(event, market, "EVENT_DEPLOYMENT_SNAPSHOT");
  let borrowerStats = getOrCreateBorrowerStats(principal);
  borrowerStats.numMarkets = 1;
  borrowerStats.save();
  getOrCreateProtocolStats().save();
  return market;
}
