# v2.0.31 wrapper discovery

This maintenance release adds ERC-4626 wrapper discovery to the `v2.0.30`
lineage. Consumers can find a registered market's wrapper, read both tokens'
metadata, and identify the factory and deployment transaction through GraphQL.
Existing schema fields retain their types and behavior.

## Indexed data

The optional `Wildcat4626WrapperFactory` source handles
`WrapperDeployed(address indexed market, address indexed wrapper)`. It adds:

- Nullable `Market.tokenWrapper` and a `Wildcat4626Wrapper` entity with the
  raw market address, market and wrapper token metadata, and factory link.
- `Wildcat4626WrapperFactory` with its on-chain `archController` and deployment
  event count, plus immutable `Wildcat4626WrapperDeployed` events with block,
  timestamp, transaction hash and block log index.
- An internal `WrapperMarketIndex` lookup so a wrapper observed before its
  market is indexed can be linked during either controller or hooks-factory
  market creation. Discovery never creates a placeholder market.

`marketToken` describes the rebasing market token; `token` describes the wrapper
share token. Neither is the market's underlying asset. New token records read
`name`, `symbol`, `decimals` and `isMock` with guarded calls. Reverted metadata
uses `Unknown Token <address>`, `UNKNOWN`, 18 decimals and `isMock: false`.
Existing token records, including pricing information, are preserved.

Discovery does not call price-feed contracts or classify share tokens as dollar
stablecoins. It leaves price-feed lookup to the existing pricing path if a token
is subsequently used as a market asset. Factory provenance requires a successful
`archController()` call; an unavailable historical call is not replaced with a
zero address.

This release does not index wrapper holder balances, transfers, deposits,
withdrawals, sweeps or principal accounting. A wrapper association also does
not establish whether a particular account can deposit, transfer or unwrap.

## Network configuration and replay

`networks.json` configures the mainnet factory
`0xEA6DE11f8F3F83c79bD9d8Db5517fCFDf2Bb148a` at block **24750455**. The generator
includes the source only when the selected network has a
`Wildcat4626WrapperFactory` entry. Plasma mainnet and testnet receive the schema
without a wrapper source because no factory is configured for them.

Deploy as a fresh index using the existing market start blocks and the configured
wrapper start block. A graft after historical wrapper deployments would omit
those events unless a separate backfill were performed.

The separate Sepolia `v2.1.8` lineage needs its own `v2.1.9` backport. This release
does not add a Sepolia wrapper source or replace that lineage's capabilities.

## Consumer query

```graphql
query WrappedMarkets($after: ID!) {
  markets(
    first: 1000
    orderBy: id
    orderDirection: asc
    where: { id_gt: $after, isRegistered: true, tokenWrapper_not: null }
  ) {
    id
    name
    tokenWrapper {
      address
      marketAddress
      marketToken { id address name symbol decimals isMock }
      token { id address name symbol decimals isMock }
      factory { id address }
      deployedEvent { blockNumber blockTimestamp transactionHash }
    }
  }
}
```

Start with an empty cursor, then continue with the last market ID in each page.
`isRegistered` matches the discovery intent of `getRegisteredMarkets`.
Wrappers for markets outside the indexed set remain discoverable through the
wrapper entity's raw `marketAddress`; its `market` link is nullable.

The SDK's `TokenWrapperData` fragment and `getTokenWrapperForMarket` query at
`wildcat-finance/wildcat.ts` commit
`fdc69f8a4c70f13d601d4a17d51389e172e86ade` use this supported subset. Wrapper
account and activity queries require the broader V2.5 subsystem. Consumers must
select the new versioned endpoint; existing SDK RPC calls do not change merely
because the endpoint gains these fields.

## Validation and release

From this repository:

```sh
yarn install --frozen-lockfile
yarn test:wrapper-config
yarn test:deploy-args
yarn test:hinterlight-paths
yarn netconfig mainnet
yarn test -v 0.5.0
yarn build
yarn netconfig plasma-mainnet
yarn build
yarn netconfig plasma-testnet
yarn build
yarn netconfig mainnet
yarn build
```

`graph test` requires a compatible Matchstick 0.5.0 host. Validation on
2026-10-08 used its Linux 20 binary in a Node 18 Debian Bullseye container with
`libpq5` and `libssl1.1`; all 46 mapping tests passed. Mainnet and both Plasma
codegen/builds, network-switching checks, deploy-argument checks and price-feed
ABI checks passed. The schema comparison retained all 101 existing types and
1,072 fields, and the SDK discovery query/fragments validated against the new
entity schema with the standard `market(id:)` root. This is source validation;
candidate endpoint replay and parity checks remain deployment acceptance work.

For the operator, after source review and release publication:

```sh
yarn deploy:goldsky:mainnet v2.0.31
# If advancing the Plasma endpoints to the same maintenance schema:
yarn deploy:goldsky:plasma-mainnet v2.0.31
yarn deploy:goldsky:plasma-testnet v2.0.31
```

Each deploy command regenerates the selected network and builds it. Wait for
indexing to finish, check `_meta.hasIndexingErrors`, compare existing queries to
`v2.0.30` at a common block, and compare wrapper associations with factory logs
and `wrapperForMarket` at that block before consumer cutover. Historical RPC
log scans should use inclusive ranges of at most 10,000 blocks.
