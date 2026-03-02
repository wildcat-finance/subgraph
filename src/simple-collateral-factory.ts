import { BigInt } from "@graphprotocol/graph-ts";
import { ApprovedLiquidator, Token } from "../generated/schema";
import { createSimpleCollateralContract, createToken, generateTokenId, createLiquidatorApproved, createLiquidatorRemoved,  getApprovedLiquidator, getOrInitializeApprovedLiquidator, getOrInitializeSimpleCollateralFactory, generateMarketId, getMarket, getOrInitializeApprovedCollateralExchange, createCollateralExchangeApproved, createCollateralExchangeRemoved, getApprovedCollateralExchange } from "../generated/UncrashableEntityHelpers";
import { CollateralContractCreated, ExecutorApproved, ExecutorRemoved, ExchangeRemoved, ExchangeApproved } from "../generated/WildcatMarketCollateralFactory/WildcatMarketCollateralFactory";
import { generateEventId } from "./utils";
import { setupTokenPriceFeeds } from "./price-feeds";
import { IERC20 } from "../generated/templates/SimpleMarketCollateralMultiParty/IERC20";
import { SimpleMarketCollateralMultiParty } from "../generated/templates/SimpleMarketCollateralMultiParty/SimpleMarketCollateralMultiParty";
import { SimpleMarketCollateralMultiParty as SimpleMarketCollateralMultiPartyTemplate } from "../generated/templates";

export function handleCollateralContractCreated(event: CollateralContractCreated): void {
    getOrInitializeSimpleCollateralFactory(event.address.toHex(), {});
    let collateralAssetId = generateTokenId(event.params.collateralToken);
    if (Token.load(collateralAssetId) == null) {
      let erc20 = IERC20.bind(event.params.collateralToken);
      let result = erc20.try_isMock();
      let isMock = !result.reverted && result.value;
      let newToken = createToken(collateralAssetId, {
        address: event.params.collateralToken,
        name: erc20.name(),
        symbol: erc20.symbol(),
        decimals: erc20.decimals(),
        isMock: isMock
      });
      setupTokenPriceFeeds(newToken);
    }
    let market = getMarket(generateMarketId(event.params.associatedMarket));
    market.numCollateralContracts = market.numCollateralContracts + 1;
    market.save();
    let collateralContract = SimpleMarketCollateralMultiParty.bind(event.params.collateralContract);
    let liquidationCooldown = collateralContract.LIQUIDATION_COOLDOWN();
    createSimpleCollateralContract(event.params.collateralContract.toHex(), {
        availableCollateral: BigInt.fromI32(0),
        collateralAsset: collateralAssetId,
        factory: event.address.toHex(),
        lastFullLiquidationIndex: 0,
        depositIndex: 0,
        totalDeposited: BigInt.fromI32(0),
        totalLiquidated: BigInt.fromI32(0),
        totalReclaimed: BigInt.fromI32(0),
        totalShares: BigInt.fromI32(0),
        market: event.params.associatedMarket.toHex(),
        liquidationCooldown: liquidationCooldown.toI32(),
        nextLiquidationTrigger: 0,
        eventIndex: 0,
    })
    SimpleMarketCollateralMultiPartyTemplate.create(event.params.collateralContract);
}

export function handleExecutorApproved(event: ExecutorApproved): void {
    getOrInitializeSimpleCollateralFactory(event.address.toHex(), {});
    let liquidatorApprovedEventId = generateEventId(event);
    let approvedLiquidatorId = event.params.executor.toHex();
    let approvedLiquidator = getOrInitializeApprovedLiquidator(approvedLiquidatorId, {
        isApproved: true,
        liquidator: event.params.executor,
        factory: event.address.toHex(),
    })
    if (!approvedLiquidator.wasCreated) {
        approvedLiquidator.entity.isApproved = true;
        approvedLiquidator.entity.save();
    }
    createLiquidatorApproved(liquidatorApprovedEventId, {
        liquidator: event.params.executor,
        blockTimestamp: event.block.timestamp.toI32(),
        transactionHash: event.transaction.hash,
        blockLogIndex: event.logIndex.toI32(),
        blockNumber: event.block.number.toI32(),
        factory: event.address.toHex(),
    })
}

export function handleExecutorRemoved(event: ExecutorRemoved): void {
    getOrInitializeSimpleCollateralFactory(event.address.toHex(), {});
    let liquidatorRemovedEventId = generateEventId(event);
    let approvedLiquidatorId = event.params.executor.toHex();
    let approvedLiquidator = getApprovedLiquidator(approvedLiquidatorId);
    approvedLiquidator.isApproved = false;
    approvedLiquidator.save();
    createLiquidatorRemoved(liquidatorRemovedEventId, {
        liquidator: event.params.executor,
        blockTimestamp: event.block.timestamp.toI32(),
        transactionHash: event.transaction.hash,
        blockLogIndex: event.logIndex.toI32(),
        blockNumber: event.block.number.toI32(),
        factory: event.address.toHex(),
    })
}

export function handleExchangeApproved(event: ExchangeApproved): void {
    getOrInitializeSimpleCollateralFactory(event.address.toHex(), {});
    let exchangeApprovedEventId = generateEventId(event);
    let approvedCollateralExchangeId = event.params.exchange.toHex();
    let approvedCollateralExchange = getOrInitializeApprovedCollateralExchange(approvedCollateralExchangeId, {
        isApproved: true,
        exchange: event.params.exchange,
        factory: event.address.toHex(),
    })
    if (!approvedCollateralExchange.wasCreated) {
        approvedCollateralExchange.entity.isApproved = true;
        approvedCollateralExchange.entity.save();
    }
    createCollateralExchangeApproved(exchangeApprovedEventId, {
        exchange: event.params.exchange,
        blockTimestamp: event.block.timestamp.toI32(),
        transactionHash: event.transaction.hash,
        blockLogIndex: event.logIndex.toI32(),
        blockNumber: event.block.number.toI32(),
        factory: event.address.toHex(),
    })
}

export function handleExchangeRemoved(event: ExchangeRemoved): void {
    getOrInitializeSimpleCollateralFactory(event.address.toHex(), {});
    let exchangeRemovedEventId = generateEventId(event);
    let approvedCollateralExchangeId = event.params.exchange.toHex();
    let approvedCollateralExchange = getApprovedCollateralExchange(approvedCollateralExchangeId);
    approvedCollateralExchange.isApproved = false;
    approvedCollateralExchange.save();
    createCollateralExchangeRemoved(exchangeRemovedEventId, {
        exchange: event.params.exchange,
        blockTimestamp: event.block.timestamp.toI32(),
        transactionHash: event.transaction.hash,
        blockLogIndex: event.logIndex.toI32(),
        blockNumber: event.block.number.toI32(),
        factory: event.address.toHex(),
    })
}