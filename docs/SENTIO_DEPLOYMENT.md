# Sentio subgraph deployment

The repository wraps Sentio's raw Graph CLI deployment command with short,
per-chain Yarn aliases. A development machine with Yarn installed can invoke
the aliases directly. The gateway VPS intentionally has no host Node/Yarn
toolchain, so `scripts/yarn-docker` runs the same commands in the repository's
pinned Node image without installing system packages.

## One-time setup

Create these Sentio Subgraph projects under the `wildcat` owner:

- `mainnet`
- `sepolia`
- `plasma-mainnet`
- `plasma-testnet`

Store the Sentio API key in the repository's ignored `.env` file:

```dotenv
SENTIO_API_KEY=replace-with-the-api-key
```

Do not commit the key. The deploy script loads `.env`, validates that the key
exists, and passes it to the Graph CLI through the environment.

## Deploy a release

Pass the exact immutable release label as the only argument:

```bash
yarn deploy:mainnet-sentio v2.0.22.3
yarn deploy:sepolia-sentio v2.1.2.3
yarn deploy:plasma-mainnet-sentio v2.0.22.3
yarn deploy:plasma-testnet-sentio v2.0.22.3
```

On a machine without Yarn, prefix the same alias with the Docker wrapper:

```bash
scripts/yarn-docker deploy:sepolia-sentio v2.5.6
```

The wrapper mounts only this repository, runs as the invoking UID/GID to avoid
root-owned build output, and reads the same ignored `.env` file. It will use
Docker directly when permitted or passwordless `sudo docker` on the gateway
VPS.

Sepolia may retain several releases in parallel. Deploy each one with its own
label; for example:

```bash
yarn deploy:sepolia-sentio v2.5.6
```

The explicit label is mandatory for Sentio. It is not inferred from
`package.json`: release names are opaque deployment identities, and labels
such as `v2.0.22.3` cannot be derived safely from package version `2.0.22`.

Each alias performs the following steps:

1. generates the selected network manifest and code;
2. builds the subgraph; and
3. runs the equivalent of:

```bash
graph deploy \
  --node https://app.sentio.xyz/api/v1/graph-node \
  --ipfs https://app.sentio.xyz/api/v1/ipfs \
  wildcat/<chain-project> \
  --version-label <exact-release-label> \
  --deploy-key "$SENTIO_API_KEY"
```

After deployment, retain the unique `Queries (HTTP)` URL printed by Sentio.
That immutable endpoint, rather than a dashboard alias, is what the gateway
admits for the exact `(chainId, releaseName)` pair.

Do not use Sentio's `--continue-from` hot-swap option for a new Wildcat release
identity. New release labels receive independent deployments and complete
syncs; older endpoints remain available until explicitly retired.

Before deploying, verify that `HEAD` is the exact source commit intended for
the release label. The label passed to Sentio does not select or validate the
checked-out source code.
