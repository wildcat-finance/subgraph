import {
  Address,
  BigInt,
  DataSourceContext,
  dataSource,
  ethereum,
} from "@graphprotocol/graph-ts";
import { IndexerDeployment } from "../generated/schema";

export const CONTEXT_DEPLOYMENT_NETWORK = "deploymentNetwork";
export const CONTEXT_DEPLOYMENT_GRAPH_NETWORK = "deploymentGraphNetwork";
export const CONTEXT_DEPLOYMENT_CHAIN_ID = "deploymentChainId";
export const CONTEXT_DEPLOYMENT_SCHEMA_RELEASE = "deploymentSchemaRelease";
export const CONTEXT_DEPLOYMENT_CONFIG_DIGEST = "deploymentConfigDigest";
export const CONTEXT_DEPLOYMENT_ARCH_CONTROLLER = "deploymentArchController";
export const CONTEXT_DEPLOYMENT_SANCTIONS_SENTINEL =
  "deploymentSanctionsSentinel";
export const CONTEXT_DEPLOYMENT_ANALYTICS_ENABLED =
  "deploymentAnalyticsEnabled";
export const CONTEXT_DEPLOYMENT_COLLATERAL_ENABLED =
  "deploymentCollateralEnabled";
export const CONTEXT_DEPLOYMENT_WRAPPERS_ENABLED =
  "deploymentWrappersEnabled";

export const CONTEXT_PRICING_MODE = "pricingMode";
export const CONTEXT_PRICING_FEED_REGISTRY = "pricingFeedRegistry";
export const CONTEXT_PRICING_USD_DENOMINATION = "pricingUsdDenomination";
export const CONTEXT_PRICING_ETH_DENOMINATION = "pricingEthDenomination";
export const CONTEXT_PRICING_BTC_DENOMINATION = "pricingBtcDenomination";
export const CONTEXT_PRICING_ETH_USD_FEED = "pricingEthUsdFeed";
export const CONTEXT_PRICING_BTC_USD_FEED = "pricingBtcUsdFeed";
export const CONTEXT_PRICING_STABLECOINS = "pricingStablecoins";
export const CONTEXT_PRICING_DIRECT_FEEDS = "pricingDirectFeeds";
export const CONTEXT_PRICING_SYNTHETIC_PRICES = "pricingSyntheticPrices";

const DEPLOYMENT_CONTEXT_KEYS = [
  CONTEXT_DEPLOYMENT_NETWORK,
  CONTEXT_DEPLOYMENT_GRAPH_NETWORK,
  CONTEXT_DEPLOYMENT_CHAIN_ID,
  CONTEXT_DEPLOYMENT_SCHEMA_RELEASE,
  CONTEXT_DEPLOYMENT_CONFIG_DIGEST,
  CONTEXT_DEPLOYMENT_ARCH_CONTROLLER,
  CONTEXT_DEPLOYMENT_SANCTIONS_SENTINEL,
  CONTEXT_DEPLOYMENT_ANALYTICS_ENABLED,
  CONTEXT_DEPLOYMENT_COLLATERAL_ENABLED,
  CONTEXT_DEPLOYMENT_WRAPPERS_ENABLED,
  CONTEXT_PRICING_MODE,
  CONTEXT_PRICING_FEED_REGISTRY,
  CONTEXT_PRICING_USD_DENOMINATION,
  CONTEXT_PRICING_ETH_DENOMINATION,
  CONTEXT_PRICING_BTC_DENOMINATION,
  CONTEXT_PRICING_ETH_USD_FEED,
  CONTEXT_PRICING_BTC_USD_FEED,
  CONTEXT_PRICING_STABLECOINS,
  CONTEXT_PRICING_DIRECT_FEEDS,
  CONTEXT_PRICING_SYNTHETIC_PRICES,
];

export function contextString(key: string): string | null {
  let context = dataSource.context();
  if (!context.isSet(key)) {
    return null;
  }
  return context.getString(key);
}

export function createDeploymentChildContext(): DataSourceContext {
  let parent = dataSource.context();
  let child = new DataSourceContext();
  for (let i = 0; i < DEPLOYMENT_CONTEXT_KEYS.length; i++) {
    let key = DEPLOYMENT_CONTEXT_KEYS[i];
    if (parent.isSet(key)) {
      child.setString(key, parent.getString(key));
    }
  }
  return child;
}

export function copyDeploymentContext(target: DataSourceContext): void {
  let parent = dataSource.context();
  for (let i = 0; i < DEPLOYMENT_CONTEXT_KEYS.length; i++) {
    let key = DEPLOYMENT_CONTEXT_KEYS[i];
    if (parent.isSet(key)) {
      target.setString(key, parent.getString(key));
    }
  }
}

export function ensureIndexerDeployment(
  event: ethereum.Event
): IndexerDeployment | null {
  let existing = IndexerDeployment.load("deployment");
  if (existing != null) {
    return existing;
  }

  let network = contextString(CONTEXT_DEPLOYMENT_NETWORK);
  let graphNetwork = contextString(CONTEXT_DEPLOYMENT_GRAPH_NETWORK);
  let chainId = contextString(CONTEXT_DEPLOYMENT_CHAIN_ID);
  let schemaRelease = contextString(CONTEXT_DEPLOYMENT_SCHEMA_RELEASE);
  let digest = contextString(CONTEXT_DEPLOYMENT_CONFIG_DIGEST);
  let archController = contextString(CONTEXT_DEPLOYMENT_ARCH_CONTROLLER);
  let sanctionsSentinel = contextString(
    CONTEXT_DEPLOYMENT_SANCTIONS_SENTINEL
  );
  let analyticsEnabled = contextString(
    CONTEXT_DEPLOYMENT_ANALYTICS_ENABLED
  );
  let collateralEnabled = contextString(
    CONTEXT_DEPLOYMENT_COLLATERAL_ENABLED
  );
  let wrappersEnabled = contextString(CONTEXT_DEPLOYMENT_WRAPPERS_ENABLED);
  let pricingMode = contextString(CONTEXT_PRICING_MODE);
  if (
    network == null ||
    graphNetwork == null ||
    chainId == null ||
    schemaRelease == null ||
    digest == null ||
    archController == null ||
    sanctionsSentinel == null ||
    analyticsEnabled == null ||
    collateralEnabled == null ||
    wrappersEnabled == null ||
    pricingMode == null
  ) {
    return null;
  }

  let deployment = new IndexerDeployment("deployment");
  deployment.chainId = BigInt.fromString(chainId as string);
  deployment.network = network as string;
  deployment.graphNetwork = graphNetwork as string;
  deployment.schemaRelease = schemaRelease as string;
  deployment.configDigest = digest as string;
  deployment.archController = Address.fromString(archController as string);
  deployment.sanctionsSentinel = Address.fromString(
    sanctionsSentinel as string
  );
  deployment.analyticsEnabled = (analyticsEnabled as string) == "true";
  deployment.collateralEnabled = (collateralEnabled as string) == "true";
  deployment.wrappersEnabled = (wrappersEnabled as string) == "true";
  deployment.pricingMode = pricingMode as string;
  deployment.firstObservedBlock = event.block.number;
  deployment.firstObservedTimestamp = event.block.timestamp;
  deployment.firstObservedTransaction = event.transaction.hash;
  deployment.firstObservedLogIndex = event.logIndex;
  deployment.save();
  return deployment;
}
