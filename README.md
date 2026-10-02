# Deploying the subgraph

Run these commands from `mono/subgraph`. On a fresh checkout, install dependencies
with `yarn install --frozen-lockfile` first. The examples below publish
`v2.5.13` to Sepolia; use the intended release label for later deployments.

## Goldsky

With the `goldsky` CLI installed, log in using the intended project's API key
from Goldsky's project settings, then deploy:

```sh
goldsky login
yarn deploy:goldsky:sepolia v2.5.13
```

Login is only needed when credentials are missing or you are switching projects.
The deployed name is `sepolia/v2.5.13`. Use the query URL from the CLI output
or Goldsky dashboard.

## Hinterlight

Put the existing credentials in this directory's gitignored `.env`, or export
them in your shell. The deploy script loads `.env` automatically and requires
all three variables:

| Variable | Used for |
| --- | --- |
| `GRAPH_ACCESS_TOKEN` | Creating the subgraph on `graph.hinterlight.net` |
| `GRAPH_DEPLOY_KEY` | Deploying to `graph.hinterlight.net` |
| `IPFS_BEARER_TOKEN` | `Authorization: Bearer …` when uploading to `ipfs.hinterlight.net` |

```sh
yarn deploy:hinterlight:sepolia v2.5.13
```

The script creates the subgraph if needed, uploads it, and prints its public
query URL: `https://graph.hinterlight.net/sepolia/v2.5.13`.
It converts the internal Graph Node name to `sepolia/v2-5-13` automatically;
keep the dotted version in the command and public URL.

## Checks and other networks

Both deploy commands regenerate the selected network's manifest and bindings,
then build before publishing. For the full local release checks:

```sh
yarn netconfig sepolia
yarn verify:all-networks
yarn netconfig:check sepolia
```

Deployment requires an explicit version label and `deploymentTargetsReady: true`
in the selected chain descriptor. A successful upload still needs to finish
indexing: check `_meta { block { number } hasIndexingErrors }` on each endpoint
and wait for it to catch up without indexing errors before switching consumers.

The same shortcuts exist for `mainnet`, `plasma-mainnet`, and `plasma-testnet`;
replace `sepolia` in the script name only when that network's release is ready.

See [package.json](./package.json) for shortcuts,
[scripts/deploy.js](./scripts/deploy.js) for credentials and deployment behavior,
[configuration and builds](./docs/CONFIGURATION_AND_BUILDS.md) for network setup,
and the [V2.5.13 release notes](./docs/V2_5_13_PROTOCOL_COMPATIBILITY.md)
for the Sepolia V2.5.5 handoff.
