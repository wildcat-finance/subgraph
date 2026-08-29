import {
  assert,
  clearStore,
  dataSourceMock,
  describe,
  newMockEvent,
  test,
} from "matchstick-as/assembly";
import { Address, BigInt, DataSourceContext } from "@graphprotocol/graph-ts";
import {
  CONTEXT_DEPLOYMENT_ANALYTICS_ENABLED,
  CONTEXT_DEPLOYMENT_ARCH_CONTROLLER,
  CONTEXT_DEPLOYMENT_CHAIN_ID,
  CONTEXT_DEPLOYMENT_COLLATERAL_ENABLED,
  CONTEXT_DEPLOYMENT_CONFIG_DIGEST,
  CONTEXT_DEPLOYMENT_GRAPH_NETWORK,
  CONTEXT_DEPLOYMENT_NETWORK,
  CONTEXT_DEPLOYMENT_SANCTIONS_SENTINEL,
  CONTEXT_DEPLOYMENT_SCHEMA_RELEASE,
  CONTEXT_DEPLOYMENT_WRAPPERS_ENABLED,
  CONTEXT_PRICING_MODE,
  ensureIndexerDeployment,
} from "../src/deployment-context";

const ARCH_CONTROLLER = Address.fromString(
  "0x1000000000000000000000000000000000000001"
);
const SANCTIONS_SENTINEL = Address.fromString(
  "0x2000000000000000000000000000000000000002"
);

describe("deployment context", () => {
  test("persists the generated endpoint identity and first observation", () => {
    clearStore();
    let context = new DataSourceContext();
    context.setString(CONTEXT_DEPLOYMENT_NETWORK, "sepolia");
    context.setString(CONTEXT_DEPLOYMENT_GRAPH_NETWORK, "sepolia");
    context.setString(CONTEXT_DEPLOYMENT_CHAIN_ID, "11155111");
    context.setString(CONTEXT_DEPLOYMENT_SCHEMA_RELEASE, "2.5.0");
    context.setString(CONTEXT_DEPLOYMENT_CONFIG_DIGEST, "test-digest");
    context.setString(
      CONTEXT_DEPLOYMENT_ARCH_CONTROLLER,
      ARCH_CONTROLLER.toHexString()
    );
    context.setString(
      CONTEXT_DEPLOYMENT_SANCTIONS_SENTINEL,
      SANCTIONS_SENTINEL.toHexString()
    );
    context.setString(CONTEXT_DEPLOYMENT_ANALYTICS_ENABLED, "true");
    context.setString(CONTEXT_DEPLOYMENT_COLLATERAL_ENABLED, "false");
    context.setString(CONTEXT_DEPLOYMENT_WRAPPERS_ENABLED, "true");
    context.setString(CONTEXT_PRICING_MODE, "SYNTHETIC_TESTNET");
    dataSourceMock.setContext(context);

    let event = newMockEvent();
    event.block.number = BigInt.fromI32(42);
    event.block.timestamp = BigInt.fromI32(12345);
    event.logIndex = BigInt.fromI32(7);
    ensureIndexerDeployment(event);

    assert.entityCount("IndexerDeployment", 1);
    assert.fieldEquals("IndexerDeployment", "deployment", "chainId", "11155111");
    assert.fieldEquals("IndexerDeployment", "deployment", "network", "sepolia");
    assert.fieldEquals(
      "IndexerDeployment",
      "deployment",
      "graphNetwork",
      "sepolia"
    );
    assert.fieldEquals(
      "IndexerDeployment",
      "deployment",
      "schemaRelease",
      "2.5.0"
    );
    assert.fieldEquals(
      "IndexerDeployment",
      "deployment",
      "configDigest",
      "test-digest"
    );
    assert.fieldEquals(
      "IndexerDeployment",
      "deployment",
      "archController",
      ARCH_CONTROLLER.toHexString()
    );
    assert.fieldEquals(
      "IndexerDeployment",
      "deployment",
      "sanctionsSentinel",
      SANCTIONS_SENTINEL.toHexString()
    );
    assert.fieldEquals(
      "IndexerDeployment",
      "deployment",
      "analyticsEnabled",
      "true"
    );
    assert.fieldEquals(
      "IndexerDeployment",
      "deployment",
      "collateralEnabled",
      "false"
    );
    assert.fieldEquals(
      "IndexerDeployment",
      "deployment",
      "wrappersEnabled",
      "true"
    );
    assert.fieldEquals(
      "IndexerDeployment",
      "deployment",
      "pricingMode",
      "SYNTHETIC_TESTNET"
    );
    assert.fieldEquals(
      "IndexerDeployment",
      "deployment",
      "firstObservedBlock",
      "42"
    );
    assert.fieldEquals(
      "IndexerDeployment",
      "deployment",
      "firstObservedTimestamp",
      "12345"
    );
    assert.fieldEquals(
      "IndexerDeployment",
      "deployment",
      "firstObservedTransaction",
      event.transaction.hash.toHexString()
    );
    assert.fieldEquals(
      "IndexerDeployment",
      "deployment",
      "firstObservedLogIndex",
      "7"
    );
    dataSourceMock.resetValues();
  });
});
