# V2.5 Subgraph Configuration and Builds

The V2.5 subgraph uses one schema and mapping codebase with an explicit
descriptor for each chain. Generated manifests are outputs, not configuration
sources.

## Sources of truth

- `config/chains/<network>.json` contains chain identity, indexed factories,
  deployment-target metadata, optional modules, and provenance.
- `config/abi-families.json` maps an explicitly named ABI family to every ABI
  path the hooks-factory and dynamic-template mappings require.
- `config/manifest.base.yaml` contains structural data-source and template
  prototypes. It contains no deployment addresses.
- `config/uncrashable.base.yaml` contains the network-neutral helper-generator
  configuration retained during the mapping migration.

Do not edit `subgraph.yaml`, `uncrashable-config.yaml`, or `networks.json`
directly. `scripts/generate-manifest.js` renders all three deterministically.
`networks.json` remains a compatibility projection because the frozen protocol
inventory validator reads it.

## Factory concepts

These fields deliberately describe different things:

- `indexed` means the subgraph must retain visibility into markets created by
  the factory.
- `deploymentTarget` means the V2.5 release may use the factory for new market
  creation.
- `lifecycle` describes operator intent; it does not delete history.
- `compatibility.canonicalFactoryByMarketKind` chooses the stable generated
  binding and legacy `networks.json` alias. It does not follow
  `deploymentTarget` implicitly.
- `isRegistered` is observed on-chain state and belongs in indexed entities,
  not the chain descriptor.

Before deployment addresses exist, `deploymentTargetsReady` must be `false`
and no factory may set `deploymentTarget`. Once the V2.5 standard, revolving,
and wrapper addresses are final, set `deploymentTargetsReady` to `true`, select
exactly one target of each market kind, and select one wrapper target on chains
where wrappers are enabled.

## Commands

Validate descriptors and ABI files:

```sh
yarn config:validate
```

Generate one network's manifest, compatibility projection, and bindings:

```sh
yarn netconfig sepolia
```

Verify that the currently selected generated outputs are current:

```sh
yarn netconfig:check sepolia
```

Validate configuration, run deterministic generator and ABI tests, and compile
all supported chains:

```sh
yarn verify:all-networks
```

The all-network build snapshots and restores the selected generated manifest.
Each chain is built into `build/<network>/` because generated Graph bindings are
shared and therefore must be produced serially.

## V2.5 deployment handoff

After the protocol deployment ceremony produces final addresses and start
blocks:

1. Verify the protocol factory inventory and deployment files.
2. Add the standard, revolving, and wrapper V2.5 factory records to the relevant
   chain descriptor with exact generation and ABI-family metadata.
3. Keep every historical factory with markets as `indexed: true`, even if it is
   no longer registered or deployable.
4. Mark only the new V2.5 standard, revolving, and wrapper factories as
   deployment targets, and set `deploymentTargetsReady: true`.
5. Change compatibility aliases only when the generated binding alias and the
   frozen protocol compatibility projection should move to the new factory.
6. Run `yarn verify:all-networks`.
7. From `v2-protocol`, run the offline inventory validator against this
   subgraph directory for the affected network.

For example:

```sh
node scripts/validate-factory-inventory.js \
  --network sepolia \
  --subgraph-dir ../subgraph
```

## Current transitional constraint

The existing mapping still creates one `CombinedHooks` dynamic template, so all
indexed hooks factories on a chain must currently share a compatible dynamic
hooks ABI family. Configuration validation and generator tests fail instead of
silently mixing incompatible families. Generation-aware dynamic templates and
mapping context belong to the factory/hooks mapping phase of the refactor.
