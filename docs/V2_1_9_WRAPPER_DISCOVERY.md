# v2.1.9 Sepolia wrapper discovery

This maintenance release adds ERC-4626 wrapper discovery, token metadata and
deployment provenance to the `v2.1.8` Sepolia lineage. It ports the same discovery
code and schema additions as `v2.0.31`, while retaining periodic-term hooks,
APR proposal state, force-buyback support and the existing Sepolia ABIs.

## Source and indexed data

Base: `v2.1.8` (`8fabe69ef29807354035a97798e3be781e1fd0db`). Discovery donor:
`v2.0.31` (`b7296fc146f224b5a4cfb0cc47e2c047d9ab58a7`).

The optional factory source handles
`WrapperDeployed(address indexed market, address indexed wrapper)`, adding:

- Nullable `Market.tokenWrapper`, plus `Wildcat4626Wrapper` with the raw market
  address, market-token metadata, wrapper-token metadata and factory link.
- `Wildcat4626WrapperFactory` with its on-chain `archController` and deployment
  event count, plus immutable `Wildcat4626WrapperDeployed` events recording block,
  timestamp, transaction hash and block log index.
- An internal `WrapperMarketIndex` lookup for attaching a wrapper observed before
  market creation. Both controller and hooks-factory paths reconcile the link,
  including periodic-term markets, without creating placeholder markets.

`marketToken` describes the rebasing market token; `token` describes the wrapper
share token. Neither is the market's underlying asset. New token records read
`name`, `symbol`, `decimals` and `isMock` with guarded calls. Reverted metadata
uses `Unknown Token <address>`, `UNKNOWN`, 18 decimals and `isMock: false`.
Existing token records and their pricing information are preserved.

Discovery does not call price-feed contracts or classify share tokens as dollar
stablecoins. Factory provenance requires a successful `archController()` call.
Holder balances, transfers, deposits, withdrawals, sweeps, principal accounting
and account-specific eligibility remain outside this discovery feature.

## Configuration and replay

`networks.json` enables only the legacy Sepolia wrapper factory:
`0x0566Fe57682164af689f1440cb3BCEedEe3bf843`, starting at block **10534112**.
It does not add the V2.5 wrapper factories to this lineage. Other network entries
omit the optional source; their maintenance release is `v2.0.31`.

Deploy a fresh index using the existing market start blocks and configured
wrapper start block. Grafting after historical wrapper deployments would omit
those events unless a separate backfill were performed. Historical RPC log scans
use inclusive ranges of at most 10,000 blocks.

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

Start with an empty cursor and continue with the last market ID in each page.
Wrappers outside the indexed market set remain discoverable through the wrapper
entity's raw `marketAddress`; its `market` relation is nullable.

The SDK discovery query `getTokenWrapperForMarket` and fragments
`TokenWrapperData`/`TokenData` at `wildcat-finance/wildcat.ts` commit
`fdc69f8a4c70f13d601d4a17d51389e172e86ade` fit this schema. That does not establish
compatibility with the full V2.5 SDK query surface. SDK release selection and
consumer endpoint routing are separate work.

## Validation

```sh
yarn install --frozen-lockfile
yarn test:wrapper-config
yarn test:deploy-args
yarn test:hinterlight-paths
yarn netconfig sepolia
yarn test -v 0.5.0
yarn build
```

Validation on 2026-10-08 passed Sepolia codegen/build, all **59** mapping tests,
network-switching checks, deploy-argument checks, Hinterlight path checks and
the price-feed ABI check. The mapping suite ran with Matchstick 0.5.0's Linux 20
binary in a Node 18 Debian Bullseye container with `libpq5`/`libssl1.1`, as the
host lacks the runner's legacy libraries. The locked project dependencies were
unchanged.

The schema comparison retained all **104** existing types and **1,117** fields.
The SDK discovery query and fragments validated against the entity schema with
the standard `market(id:)` query root. These are source checks; completed replay
and candidate endpoint parity require validation after deployment.

## Operator release steps

From this release branch after review:

```sh
git push -u origin release/v2.1.9
git tag -a v2.1.9 release/v2.1.9 -m "v2.1.9: Sepolia ERC-4626 wrapper discovery"
git push origin v2.1.9
yarn deploy:hinterlight:sepolia v2.1.9
yarn deploy:goldsky:sepolia v2.1.9
```

Both deployment scripts regenerate the Sepolia configuration and build before
deploying. Hinterlight requires `GRAPH_ACCESS_TOKEN`, `GRAPH_DEPLOY_KEY` and
`IPFS_BEARER_TOKEN` in the environment or ignored `.env`; Goldsky requires CLI
authentication. A separate worktree needs its own environment-file setup.

Wait for indexing to finish, check `_meta.hasIndexingErrors`, compare retained
queries against `v2.1.8` at a common block, and compare discovered associations
against factory logs and `wrapperForMarket` at that block. Keep `v2.5.15` on its
separate endpoint. Intended new routes:

- Hinterlight: `https://graph.hinterlight.net/sepolia/v2.1.9`
- Goldsky: `https://api.goldsky.com/api/public/project_cmheai1ym00jyx7p27qn46qtm/subgraphs/sepolia/v2.1.9/gn`
