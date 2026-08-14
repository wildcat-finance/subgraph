# V2.5 Subgraph Configuration and Builds

The hard-cut v2.5 event-generation path and its remaining protocol dependency are documented in `docs/V2_5_9_EVENT_MODEL.md`.

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
`networks.json` remains a compatibility projection for legacy tooling; it is
not the source for the refactored schema or deployment-target authority.

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

The schema preserves the same ownership boundary:

- `HooksFactory` combines immutable/configured factory identity with current
  observed registration state, while retaining the block where that state
  changed;
- `FactoryRegistration` and `FactoryRegistrationEvent` are the canonical
  current state and immutable ArchController add/remove history for controller,
  hooks, and unknown factory addresses;
- `HooksTemplate` is bytecode/interface identity only; and
- `HooksTemplateRegistration` owns the display name, fee configuration,
  enabled state, timestamps, and immutable change history for one
  factory/template pair;
- `HooksInstance` records the exact factory generation, market kind, ABI family,
  and deployment log that created it;
- `Market` now records immutable origin and deployment identity; its legacy
  mutable fields remain during the event-projector migration; and
- `MarketSnapshot` is the explicitly stamped replacement cache. Lens/RPC
  remains the live authority for action inputs.

Mappings must not reconstruct a missing template registration from global
template state. Unknown factories/templates and missing references are recorded
as `IndexerDiagnostic` entities.

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
   On Sepolia, existing pre-V2.5 hooks factories use the
   `hooks-shared-current` / `FORCE_BUYBACK` tuple family; new V2.5 factories use
   the `hooks-sepolia-current` / `BASE` tuple family.
3. Keep every historical factory with markets as `indexed: true`, even if it is
   no longer registered or deployable.
4. Mark only the new V2.5 standard, revolving, and wrapper factories as
   deployment targets, and set `deploymentTargetsReady: true`.
5. Change compatibility aliases only when the generated binding alias and the
   frozen protocol compatibility projection should move to the new factory.
6. Run `yarn verify:all-networks`.
7. Compare every hooks/wrapper generation, start block, indexing policy, and
   selected deployment target against the completed protocol
   `handoff-v2-5.json`, then record that review with the deployment artifacts.

There is currently no checked-in cross-repo validator for step 7. The older
`scripts/validate-factory-inventory.js` command referenced by this guide is no
longer present. Until a replacement is added, the protocol handoff plus
`yarn verify:all-networks` and an explicit reviewed diff are the gate; do not
claim automated cross-repo coverage.

## Current transitional constraint

Static factory sources carry checked-in factory metadata, and dynamic hooks and
market sources inherit the originating factory address, generation, market
kind, ABI family, hooked-market tuple adapter, and template registration through
data-source context.

The `BASE` and `FORCE_BUYBACK` hooked-market tuple shapes have separate minimal
ABI bindings, so historical factories and V2.5 factories can coexist on one
chain without network-wide ABI swapping. The single `CombinedHooks` and market
dynamic templates still require their core event/call ABIs to match. Config
validation permits different adapter families but fails if those core ABI paths
diverge.
