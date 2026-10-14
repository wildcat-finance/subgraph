# Ink Sepolia deployment

Base: `v2.1.9` / `fd71e960e6b547abb04351c4c23a4e9db28b3ed1`.
Release: `ink-sepolia/v2.1.9`. No schema or mapping changes; no version bump.
Network key and public subgraph name: `ink-sepolia` (chain `763373`).

## Prepare

- [ ] Work in the `subgraph-ink` worktree on `release/ink`.
- [ ] Configure Hinterlight's Graph Node network as `ink-sepolia`, using
  `https://rpc.wildcat.finance/763373` with the required gateway authentication.
  Check historical `eth_call` and log access. RPC failover is gateway-managed;
  GraphQL query routing is separate. [Goldsky supports Ink Sepolia](https://docs.goldsky.com/chains/ink).
- [ ] Set these in this worktree's ignored `.env` for Hinterlight:

```dotenv
GRAPH_ACCESS_TOKEN=
GRAPH_DEPLOY_KEY=
IPFS_BEARER_TOKEN=
```

- [ ] Authenticate Goldsky: `goldsky login` (correct Foundation project).
- [ ] Install and check:

```sh
yarn install --frozen-lockfile
yarn test:wrapper-config
yarn test:deploy-args
yarn test:hinterlight-paths
yarn netconfig ink-sepolia
yarn build
```

The generator selects legacy hooks ABIs and the no-collateral Plasma template.
It rewrites tracked ABI/mapping/manifest files; these are generated network
selections, not new protocol logic. `yarn netconfig sepolia` restores the
branch's default selection.

Validation (2026-10-14): builds and all 61 mapping tests passed with both Ink
and Ethereum Sepolia selections; network-switching and deployment-argument
checks passed. No Ink subgraph has been deployed by this preparation.

## Deploy

- [ ] Deploy both providers (each command regenerates Ink config and builds):

```sh
yarn deploy:hinterlight:ink-sepolia v2.1.9
yarn deploy:goldsky:ink-sepolia v2.1.9
```

- [ ] Save each deployment CID and query URL. Do not overwrite an existing
  version with different content; use a new label if the source changes.
- [ ] Wait for both to sync without indexing errors. Run on each endpoint:

```graphql
{
  _meta { deployment block { number hash } hasIndexingErrors }
  archControllers { id }
  hooksFactories {
    id isRegistered sentinel archController { id }
    hooksTemplates { id name disabled protocolFeeBips feeRecipient }
  }
  markets { id }
  wildcat4626Wrappers { id marketAddress }
}
```

- [ ] Expect one ArchController, one registered HooksFactory, and two enabled
  templates (`OpenTermHooks`, `FixedTermHooks`), both at 500 bps. Compare IDs to
  `networks.json` and the protocol inventory. Empty markets/wrappers are valid
  until created; the wrapper-factory entity appears on its first deployment event.
- [ ] Compare provider results at the same block. Route the gateway/SDK only
  after parity; those changes are separate from this deployment.

## Indexed roots

Addresses and inclusive start blocks are in `networks.json`. Verified against
live creation receipts on 2026-10-14 and protocol inventory
`sepolia-continuation-20261014T072841Z`:

| Contract | Start block |
| --- | ---: |
| WildcatArchController | 62931617 |
| WildcatSanctionsSentinel | 62960398 |
| HooksFactory | 62960474 |
| Wildcat4626WrapperFactory | 62960519 |

This indexes the protocol sentinel, not the external sanctions-source list.
Sanctions seeding/keeper, token USD prices, and SDK/app/gateway updates remain
separate work. Unconfigured Ink tokens have no USD price, not an assumed $1.
Ink mainnet awaits its own deployed addresses and start blocks.
