import {
  assert,
  clearStore,
  describe,
  test,
} from "matchstick-as/assembly";
import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import { generateMarketId } from "../generated/UncrashableEntityHelpers";
import {
  handleMarketDeployed,
  handleMarketDeploymentConfig,
  handleMarketHooksData,
  handleRevolvingMarketDeployed,
} from "../src/hooks-factory-v2-5";
import {
  createV25Event,
  pushAddress,
  pushBigInt,
  pushString,
  seedToken,
  seedV25Factory,
  seedV25Hooks,
} from "./v2-5-test-utils";

const STANDARD_FACTORY = Address.fromString(
  "0x000000000000000000000000000000000000e001"
);
const REVOLVING_FACTORY = Address.fromString(
  "0x000000000000000000000000000000000000e002"
);
const TEMPLATE = Address.fromString(
  "0x000000000000000000000000000000000000e003"
);
const STANDARD_HOOKS = Address.fromString(
  "0x000000000000000000000000000000000000e004"
);
const REVOLVING_HOOKS = Address.fromString(
  "0x000000000000000000000000000000000000e005"
);
const STANDARD_MARKET = Address.fromString(
  "0x000000000000000000000000000000000000e006"
);
const REVOLVING_MARKET = Address.fromString(
  "0x000000000000000000000000000000000000e007"
);
const BORROWER = Address.fromString(
  "0x000000000000000000000000000000000000e008"
);
const REGISTRY = Address.fromString(
  "0x000000000000000000000000000000000000e009"
);
const ASSET = Address.fromString(
  "0x000000000000000000000000000000000000e00a"
);
const FEE_RECIPIENT = Address.fromString(
  "0x000000000000000000000000000000000000e00b"
);

function marketDeployedEvent(
  factory: Address,
  hooks: Address,
  market: Address,
  logIndex: i32
): ethereum.Event {
  let event = createV25Event(factory, logIndex);
  pushAddress(event, "hooksTemplate", TEMPLATE);
  pushAddress(event, "hooksInstance", hooks);
  pushAddress(event, "market", market);
  pushAddress(event, "borrower", BORROWER);
  pushAddress(event, "borrowerPrincipal", BORROWER);
  pushAddress(event, "borrowerIdentityRegistry", REGISTRY);
  pushString(event, "name", "v2.5 test market");
  pushString(event, "symbol", "mUSDC");
  pushAddress(event, "asset", ASSET);
  pushBigInt(event, "requestedHooks", BigInt.zero());
  pushBigInt(event, "hooks", BigInt.zero());
  return event;
}

function deploymentConfigEvent(
  factory: Address,
  market: Address,
  logIndex: i32
): ethereum.Event {
  let event = createV25Event(factory, logIndex);
  pushAddress(event, "market", market);
  pushBigInt(event, "maxTotalSupply", BigInt.fromI32(1_000_000));
  pushBigInt(event, "annualInterestBips", BigInt.fromI32(500));
  pushBigInt(event, "delinquencyFeeBips", BigInt.fromI32(100));
  pushBigInt(event, "withdrawalBatchDuration", BigInt.fromI32(3_600));
  pushBigInt(event, "reserveRatioBips", BigInt.fromI32(1_000));
  pushBigInt(event, "delinquencyGracePeriod", BigInt.fromI32(86_400));
  pushAddress(event, "feeRecipient", FEE_RECIPIENT);
  pushBigInt(event, "protocolFeeBips", BigInt.fromI32(50));
  pushAddress(event, "originationFeeAsset", Address.zero());
  pushBigInt(event, "originationFeeAmount", BigInt.zero());
  return event;
}

function hooksDataEvent(
  factory: Address,
  market: Address,
  logIndex: i32
): ethereum.Event {
  let event = createV25Event(factory, logIndex);
  pushAddress(event, "market", market);
  event.parameters.push(
    new ethereum.EventParam(
      "hooksData",
      ethereum.Value.fromBytes(
        Bytes.fromHexString(
          "0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"
        )
      )
    )
  );
  return event;
}

describe("v2.5 market deployment events", () => {
  test("finalizes standard deployment regardless of bundle event order", () => {
    clearStore();
    seedV25Factory(STANDARD_FACTORY, "STANDARD");
    seedV25Hooks(STANDARD_FACTORY, TEMPLATE, STANDARD_HOOKS, BORROWER);
    seedToken(ASSET);

    handleMarketDeployed(
      marketDeployedEvent(STANDARD_FACTORY, STANDARD_HOOKS, STANDARD_MARKET, 1)
    );
    handleMarketHooksData(
      hooksDataEvent(STANDARD_FACTORY, STANDARD_MARKET, 2)
    );
    assert.notInStore("Market", generateMarketId(STANDARD_MARKET));

    handleMarketDeploymentConfig(
      deploymentConfigEvent(STANDARD_FACTORY, STANDARD_MARKET, 3)
    );

    assert.fieldEquals(
      "Market",
      generateMarketId(STANDARD_MARKET),
      "borrower",
      BORROWER.toHexString()
    );
    assert.fieldEquals(
      "Market",
      generateMarketId(STANDARD_MARKET),
      "borrowerPrincipal",
      BORROWER.toHexString()
    );
    assert.fieldEquals(
      "Market",
      generateMarketId(STANDARD_MARKET),
      "borrowerIdentityRegistryAddress",
      REGISTRY.toHexString()
    );
    assert.fieldEquals(
      "Market",
      generateMarketId(STANDARD_MARKET),
      "eventGeneration",
      "V2_5"
    );
    assert.fieldEquals(
      "Market",
      generateMarketId(STANDARD_MARKET),
      "createdAtLogIndex",
      "1"
    );
    assert.notInStore(
      "PendingMarketDeployment",
      generateMarketId(STANDARD_MARKET)
    );
    assert.entityCount("MarketDeployed", 1);
    assert.entityCount("MarketDeploymentConfig", 1);
    assert.entityCount("MarketHooksData", 1);
  });

  test("waits for revolving configuration before finalizing", () => {
    clearStore();
    seedV25Factory(REVOLVING_FACTORY, "REVOLVING");
    seedV25Hooks(REVOLVING_FACTORY, TEMPLATE, REVOLVING_HOOKS, BORROWER);
    seedToken(ASSET);

    handleMarketDeployed(
      marketDeployedEvent(
        REVOLVING_FACTORY,
        REVOLVING_HOOKS,
        REVOLVING_MARKET,
        1
      )
    );
    let revolving = createV25Event(REVOLVING_FACTORY, 2);
    pushAddress(revolving, "market", REVOLVING_MARKET);
    pushBigInt(revolving, "commitmentFeeBips", BigInt.fromI32(100));
    handleRevolvingMarketDeployed(revolving);
    handleMarketDeploymentConfig(
      deploymentConfigEvent(REVOLVING_FACTORY, REVOLVING_MARKET, 3)
    );
    assert.notInStore("Market", generateMarketId(REVOLVING_MARKET));

    handleMarketHooksData(
      hooksDataEvent(REVOLVING_FACTORY, REVOLVING_MARKET, 4)
    );

    assert.fieldEquals(
      "Market",
      generateMarketId(REVOLVING_MARKET),
      "marketKind",
      "REVOLVING"
    );
    assert.fieldEquals(
      "Market",
      generateMarketId(REVOLVING_MARKET),
      "commitmentFeeBips",
      "100"
    );
    assert.fieldEquals(
      "Market",
      generateMarketId(REVOLVING_MARKET),
      "drawnAmount",
      "0"
    );
    assert.notInStore(
      "PendingMarketDeployment",
      generateMarketId(REVOLVING_MARKET)
    );
    assert.entityCount("RevolvingMarketDeployment", 1);
  });
});
