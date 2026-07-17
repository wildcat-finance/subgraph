import { Address, BigInt } from "@graphprotocol/graph-ts";
import {
  CollateralContractCreated,
  ExchangeApproved,
  ExchangeRemoved,
  ExecutorApproved,
  ExecutorRemoved,
} from "../generated/WildcatMarketCollateralFactory/WildcatMarketCollateralFactory";
import { SimpleMarketCollateralMultiParty } from "../generated/templates/SimpleMarketCollateralMultiParty/SimpleMarketCollateralMultiParty";
import { SimpleMarketCollateralMultiParty as SimpleMarketCollateralMultiPartyTemplate } from "../generated/templates";
import {
  ApprovedCollateralExchange,
  ApprovedLiquidator,
  CollateralExchangeApproved,
  CollateralExchangeRemoved,
  LiquidatorApproved,
  LiquidatorRemoved,
  SimpleCollateralContract,
  SimpleCollateralContractCreated,
  Token,
} from "../generated/schema";
import {
  createToken,
  generateTokenId,
} from "../generated/UncrashableEntityHelpers";
import {
  generateFactoryAccountId,
  getOrCreateCollateralFactory,
  saveCollateralSnapshot,
} from "./collateral-domain";
import { createDeploymentChildContext } from "./deployment-context";
import { recordIndexerDiagnostic } from "./indexer-diagnostics";
import { observeCollateralMarketLink } from "./optional-market-links";
import { setupTokenPriceFeeds } from "./price-feeds";
import { readTokenMetadata } from "./token-metadata";
import { generateEventId } from "./utils";

function getOrCreateToken(address: Address): Token {
  let id = generateTokenId(address);
  let token = Token.load(id);
  if (token != null) {
    return token;
  }
  let metadata = readTokenMetadata(address);
  token = createToken(id, {
    address: address,
    name: metadata.name,
    symbol: metadata.symbol,
    decimals: metadata.decimals,
    isMock: metadata.isMock,
  });
  setupTokenPriceFeeds(token);
  return token;
}

export function handleCollateralContractCreated(
  event: CollateralContractCreated
): void {
  let factory = getOrCreateCollateralFactory(event);
  let collateralAsset = getOrCreateToken(event.params.collateralToken);
  let collateralId = event.params.collateralContract.toHexString();
  let collateral = SimpleCollateralContract.load(collateralId);
  if (collateral == null) {
    collateral = new SimpleCollateralContract(collateralId);
    collateral.address = event.params.collateralContract;
    collateral.factory = factory.id;
    collateral.market = null;
    collateral.marketAddress = event.params.associatedMarket;
    collateral.collateralAsset = collateralAsset.id;
    collateral.totalDeposited = BigInt.zero();
    collateral.totalReclaimed = BigInt.zero();
    collateral.totalLiquidated = BigInt.zero();
    collateral.totalShares = BigInt.zero();
    collateral.availableCollateral = BigInt.zero();
    collateral.lastFullLiquidationIndex = 0;
    collateral.depositIndex = 0;
    collateral.unset("liquidationCooldown");
    collateral.nextLiquidationTrigger = 0;
    collateral.eventIndex = 0;
    collateral.createdAtBlock = event.block.number;
    collateral.createdAtTimestamp = event.block.timestamp;
    collateral.createdAtTransaction = event.transaction.hash;
    collateral.createdAtLogIndex = event.logIndex;
  }

  let collateralContract = SimpleMarketCollateralMultiParty.bind(
    event.params.collateralContract
  );
  let cooldown = collateralContract.try_LIQUIDATION_COOLDOWN();
  if (cooldown.reverted) {
    recordIndexerDiagnostic(
      event,
      "COLLATERAL_COOLDOWN_UNAVAILABLE",
      "Collateral contract LIQUIDATION_COOLDOWN() reverted",
      event.params.collateralContract
    );
  } else {
    collateral.liquidationCooldown = cooldown.value.toI32();
  }
  collateral.save();

  let market = observeCollateralMarketLink(
    event.params.associatedMarket,
    collateral
  );
  if (market == null) {
    recordIndexerDiagnostic(
      event,
      "UNKNOWN_COLLATERAL_MARKET",
      "Collateral contract referenced a market not yet indexed",
      event.params.associatedMarket
    );
  }

  let created = new SimpleCollateralContractCreated(generateEventId(event));
  created.factory = factory.id;
  created.collateralContract = collateral.id;
  created.collateralContractAddress = event.params.collateralContract;
  created.collateralAsset = collateralAsset.id;
  created.market = market == null ? null : market.id;
  created.marketAddress = event.params.associatedMarket;
  created.blockNumber = event.block.number;
  created.blockTimestamp = event.block.timestamp;
  created.transactionHash = event.transaction.hash;
  created.blockLogIndex = event.logIndex;
  created.save();

  saveCollateralSnapshot(event, collateral, "EVENT_AND_CONTRACT_CALL");
  SimpleMarketCollateralMultiPartyTemplate.createWithContext(
    event.params.collateralContract,
    createDeploymentChildContext()
  );
}

export function handleExecutorApproved(event: ExecutorApproved): void {
  let factory = getOrCreateCollateralFactory(event);
  let id = generateFactoryAccountId(event.address, event.params.executor);
  let approved = ApprovedLiquidator.load(id);
  if (approved == null) {
    approved = new ApprovedLiquidator(id);
    approved.factory = factory.id;
    approved.liquidator = event.params.executor;
  }
  approved.isApproved = true;
  approved.save();

  let record = new LiquidatorApproved(generateEventId(event));
  record.liquidator = event.params.executor;
  record.blockTimestamp = event.block.timestamp.toI32();
  record.transactionHash = event.transaction.hash;
  record.blockLogIndex = event.logIndex.toI32();
  record.blockNumber = event.block.number.toI32();
  record.factory = factory.id;
  record.save();
}

export function handleExecutorRemoved(event: ExecutorRemoved): void {
  let factory = getOrCreateCollateralFactory(event);
  let id = generateFactoryAccountId(event.address, event.params.executor);
  let approved = ApprovedLiquidator.load(id);
  if (approved == null) {
    approved = new ApprovedLiquidator(id);
    approved.factory = factory.id;
    approved.liquidator = event.params.executor;
  }
  approved.isApproved = false;
  approved.save();

  let record = new LiquidatorRemoved(generateEventId(event));
  record.liquidator = event.params.executor;
  record.blockTimestamp = event.block.timestamp.toI32();
  record.transactionHash = event.transaction.hash;
  record.blockLogIndex = event.logIndex.toI32();
  record.blockNumber = event.block.number.toI32();
  record.factory = factory.id;
  record.save();
}

export function handleExchangeApproved(event: ExchangeApproved): void {
  let factory = getOrCreateCollateralFactory(event);
  let id = generateFactoryAccountId(event.address, event.params.exchange);
  let approved = ApprovedCollateralExchange.load(id);
  if (approved == null) {
    approved = new ApprovedCollateralExchange(id);
    approved.factory = factory.id;
    approved.exchange = event.params.exchange;
  }
  approved.isApproved = true;
  approved.save();

  let record = new CollateralExchangeApproved(generateEventId(event));
  record.exchange = event.params.exchange;
  record.blockTimestamp = event.block.timestamp.toI32();
  record.transactionHash = event.transaction.hash;
  record.blockLogIndex = event.logIndex.toI32();
  record.blockNumber = event.block.number.toI32();
  record.factory = factory.id;
  record.save();
}

export function handleExchangeRemoved(event: ExchangeRemoved): void {
  let factory = getOrCreateCollateralFactory(event);
  let id = generateFactoryAccountId(event.address, event.params.exchange);
  let approved = ApprovedCollateralExchange.load(id);
  if (approved == null) {
    approved = new ApprovedCollateralExchange(id);
    approved.factory = factory.id;
    approved.exchange = event.params.exchange;
  }
  approved.isApproved = false;
  approved.save();

  let record = new CollateralExchangeRemoved(generateEventId(event));
  record.exchange = event.params.exchange;
  record.blockTimestamp = event.block.timestamp.toI32();
  record.transactionHash = event.transaction.hash;
  record.blockLogIndex = event.logIndex.toI32();
  record.blockNumber = event.block.number.toI32();
  record.factory = factory.id;
  record.save();
}
