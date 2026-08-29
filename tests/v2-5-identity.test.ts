import {
  assert,
  clearStore,
  dataSourceMock,
  describe,
  test,
} from "matchstick-as/assembly";
import {
  Address,
  BigInt,
  DataSourceContext,
} from "@graphprotocol/graph-ts";
import { BorrowerTransferred } from "../generated/templates/WildcatMarketV2_5/WildcatMarketV2_5";
import {
  generateBorrowerStatsId,
  generateMarketId,
  generateProtocolStatsId,
} from "../generated/UncrashableEntityHelpers";
import {
  handleAccountFactoryAdded,
  handleBorrowerAccountPrincipalTransferRequested,
  handleBorrowerAccountPrincipalTransferred,
  handleBorrowerAccountRegistered,
} from "../src/borrower-identity-registry";
import { handleBorrowerTransferred } from "../src/wildcat-market-v2-5";
import { getOrCreateBorrower } from "../src/borrower-domain";
import {
  getOrCreateBorrowerStats,
  getOrCreateProtocolStats,
} from "../src/daily-stats";
import { CONTEXT_DEPLOYMENT_ARCH_CONTROLLER } from "../src/deployment-context";
import { generateBorrowerAccountId } from "../src/borrower-identity-domain";
import {
  TEST_ARCH_CONTROLLER,
  createV25Event,
  pushAddress,
  seedV25Market,
} from "./v2-5-test-utils";

const REGISTRY = Address.fromString(
  "0x000000000000000000000000000000000000b001"
);
const OTHER_REGISTRY = Address.fromString(
  "0x000000000000000000000000000000000000b008"
);
const ACCOUNT_FACTORY = Address.fromString(
  "0x000000000000000000000000000000000000b002"
);
const ACCOUNT = Address.fromString(
  "0x000000000000000000000000000000000000b003"
);
const PRINCIPAL_P = Address.fromString(
  "0x000000000000000000000000000000000000b004"
);
const PRINCIPAL_Q = Address.fromString(
  "0x000000000000000000000000000000000000b005"
);
const MARKET = Address.fromString(
  "0x000000000000000000000000000000000000b006"
);
const ASSET = Address.fromString(
  "0x000000000000000000000000000000000000b007"
);

function setRegistryContext(): void {
  let context = new DataSourceContext();
  context.setString(
    CONTEXT_DEPLOYMENT_ARCH_CONTROLLER,
    TEST_ARCH_CONTROLLER.toHexString()
  );
  dataSourceMock.setContext(context);
}

function registerAccountAt(
  registry: Address,
  principal: Address,
  firstLogIndex: i32
): void {
  let factoryAdded = createV25Event(registry, firstLogIndex);
  pushAddress(factoryAdded, "administrator", TEST_ARCH_CONTROLLER);
  pushAddress(factoryAdded, "accountFactory", ACCOUNT_FACTORY);
  handleAccountFactoryAdded(factoryAdded);

  let registered = createV25Event(registry, firstLogIndex + 1);
  pushAddress(registered, "account", ACCOUNT);
  pushAddress(registered, "principal", principal);
  pushAddress(registered, "accountFactory", ACCOUNT_FACTORY);
  handleBorrowerAccountRegistered(registered);
}

describe("v2.5 borrower identity", () => {
  test("keeps account principal migration separate from market transfer", () => {
    clearStore();
    setRegistryContext();
    registerAccountAt(REGISTRY, PRINCIPAL_P, 1);

    let deployment = createV25Event(MARKET, 3);
    seedV25Market(
      deployment,
      MARKET,
      ASSET,
      ACCOUNT,
      PRINCIPAL_P,
      REGISTRY,
      generateBorrowerAccountId(REGISTRY.toHexString(), ACCOUNT)
    );

    let requested = createV25Event(REGISTRY, 4);
    pushAddress(requested, "account", ACCOUNT);
    pushAddress(requested, "currentPrincipal", PRINCIPAL_P);
    pushAddress(requested, "previousPendingPrincipal", Address.zero());
    pushAddress(requested, "pendingPrincipal", PRINCIPAL_Q);
    handleBorrowerAccountPrincipalTransferRequested(requested);

    let accepted = createV25Event(REGISTRY, 5);
    pushAddress(accepted, "account", ACCOUNT);
    pushAddress(accepted, "previousPrincipal", PRINCIPAL_P);
    pushAddress(accepted, "newPrincipal", PRINCIPAL_Q);
    handleBorrowerAccountPrincipalTransferred(accepted);

    assert.fieldEquals(
      "BorrowerAccount",
      generateBorrowerAccountId(REGISTRY.toHexString(), ACCOUNT),
      "principalAddress",
      PRINCIPAL_Q.toHexString()
    );
    assert.fieldEquals(
      "Market",
      generateMarketId(MARKET),
      "borrowerPrincipal",
      PRINCIPAL_P.toHexString()
    );

    let marketTransfer = changetype<BorrowerTransferred>(
      createV25Event(MARKET, 6)
    );
    pushAddress(marketTransfer, "previousBorrower", ACCOUNT);
    pushAddress(marketTransfer, "newBorrower", ACCOUNT);
    pushAddress(
      marketTransfer,
      "previousBorrowerPrincipal",
      PRINCIPAL_P
    );
    pushAddress(marketTransfer, "newBorrowerPrincipal", PRINCIPAL_Q);
    handleBorrowerTransferred(marketTransfer);

    assert.fieldEquals(
      "Market",
      generateMarketId(MARKET),
      "borrower",
      ACCOUNT.toHexString()
    );
    assert.fieldEquals(
      "Market",
      generateMarketId(MARKET),
      "borrowerPrincipal",
      PRINCIPAL_Q.toHexString()
    );
    assert.fieldEquals(
      "Market",
      generateMarketId(MARKET),
      "borrowerAccount",
      generateBorrowerAccountId(REGISTRY.toHexString(), ACCOUNT)
    );
    assert.fieldEquals(
      "Market",
      generateMarketId(MARKET),
      "borrowerIdentityRegistryAddress",
      REGISTRY.toHexString()
    );
    assert.entityCount("BorrowerAccountPrincipalChange", 3);
    assert.entityCount("MarketBorrowerChange", 1);
    assert.fieldEquals(
      "BorrowerIdentityRegistry",
      REGISTRY.toHexString(),
      "eventIndex",
      "4"
    );

    assert.fieldEquals(
      "Market",
      generateMarketId(MARKET),
      "pendingBorrower",
      "null"
    );
    assert.fieldEquals(
      "Market",
      generateMarketId(MARKET),
      "pendingBorrowerPrincipal",
      "null"
    );
    dataSourceMock.resetValues();
  });

  test("keeps the same account address distinct across registries", () => {
    clearStore();
    setRegistryContext();
    registerAccountAt(REGISTRY, PRINCIPAL_P, 1);
    registerAccountAt(OTHER_REGISTRY, PRINCIPAL_Q, 3);

    assert.entityCount("BorrowerAccount", 2);
    assert.fieldEquals(
      "BorrowerAccount",
      generateBorrowerAccountId(REGISTRY.toHexString(), ACCOUNT),
      "principalAddress",
      PRINCIPAL_P.toHexString()
    );
    assert.fieldEquals(
      "BorrowerAccount",
      generateBorrowerAccountId(OTHER_REGISTRY.toHexString(), ACCOUNT),
      "principalAddress",
      PRINCIPAL_Q.toHexString()
    );
    dataSourceMock.resetValues();
  });

  test("moves active borrower counts without changing the market registry", () => {
    clearStore();
    let deployment = createV25Event(MARKET, 1);
    let market = seedV25Market(
      deployment,
      MARKET,
      ASSET,
      PRINCIPAL_P,
      PRINCIPAL_P,
      REGISTRY
    );
    market.scaledTotalSupply = BigInt.fromI32(1);
    market.save();

    let previousStats = getOrCreateBorrowerStats(PRINCIPAL_P);
    previousStats.numActiveMarkets = 1;
    previousStats.save();
    getOrCreateBorrower(deployment, PRINCIPAL_Q);
    let newStats = getOrCreateBorrowerStats(PRINCIPAL_Q);
    newStats.numMarkets = 1;
    newStats.numActiveMarkets = 1;
    newStats.save();
    let protocolStats = getOrCreateProtocolStats();
    protocolStats.numMarkets = 2;
    protocolStats.numActiveMarkets = 2;
    protocolStats.numActiveBorrowers = 2;
    protocolStats.save();

    let transferred = changetype<BorrowerTransferred>(
      createV25Event(MARKET, 2)
    );
    pushAddress(transferred, "previousBorrower", PRINCIPAL_P);
    pushAddress(transferred, "newBorrower", PRINCIPAL_Q);
    pushAddress(transferred, "previousBorrowerPrincipal", PRINCIPAL_P);
    pushAddress(transferred, "newBorrowerPrincipal", PRINCIPAL_Q);
    handleBorrowerTransferred(transferred);

    assert.fieldEquals(
      "BorrowerStats",
      generateBorrowerStatsId(PRINCIPAL_P),
      "numActiveMarkets",
      "0"
    );
    assert.fieldEquals(
      "BorrowerStats",
      generateBorrowerStatsId(PRINCIPAL_Q),
      "numActiveMarkets",
      "2"
    );
    assert.fieldEquals(
      "ProtocolStats",
      generateProtocolStatsId(),
      "numActiveBorrowers",
      "1"
    );
    assert.fieldEquals(
      "Market",
      generateMarketId(MARKET),
      "borrowerIdentityRegistryAddress",
      REGISTRY.toHexString()
    );
  });
});
