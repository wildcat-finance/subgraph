# V2.5 Subgraph Refactor Proposal

Status: accepted architecture; implementation in progress on
`feat/subgraph-refactor`.

## Executive decision

Build a clean V2.5 subgraph rather than extending the current schema and mapping
structure.

The replacement should:

1. index every configured Wildcat factory and market generation that consumers
   must still be able to discover;
2. identify only the new V2.5 standard and revolving factories as deployment
   targets;
3. keep factory generation, market implementation, and hook behavior as separate
   concepts;
4. use the subgraph for discovery, relationships, history, aggregates, and
   explicitly staleable snapshots;
5. use the lens or direct RPC reads as the authority for mutable state; and
6. use one schema and mapping codebase for all chains, deployed as a separate
   endpoint per chain.

This is a V2.5 cleanup, not a new protocol version. The current `v2-protocol`
contracts are treated as frozen inputs.

The intended read path is:

```text
                         historical discovery / events / aggregates
chain events -> V2.5 subgraph ----------------------------------------> SDK
       |                                                               |
       +---------------- current lens and contract reads ---------------+
                                                                       |
                                              app and other consumers <-+
```

The intended factory split is:

```text
all configured generations -> indexed for existing-market visibility
V2.5 standard factory      -> only target for new standard markets
V2.5 revolving factory     -> only target for new revolving markets
```

ArchController registration is observed on-chain state. It is not the source of
truth for which factory a current SDK release should use for new deployments.

### What this proposal asks us to approve

There are six architectural decisions. The remainder of the document is an
implementation plan for them.

1. Make a clean GraphQL/schema break for V2.5.
2. Index historical factories, but never confuse that with deployment
   eligibility.
3. Model market implementation, hook behavior, and code generation separately.
4. Treat mutable graph data as a stamped cache and lens/RPC data as live
   authority.
5. Use one schema/codebase with one explicit descriptor and endpoint per chain.
6. Migrate core discovery and history first, then analytics and consumers, and
   cut over through a parallel Sepolia endpoint.

## Fixed constraints

These are inputs to the design, not open questions:

- `v2-protocol` is frozen for this work.
- Existing factory and market contracts remain useful for reading and operating
  their existing deployments.
- The protocol's current removal and registration behavior is unchanged.
- There is no production V2.5 subgraph schema to preserve, so GraphQL compatibility
  with the current endpoint may be intentionally broken.
- Historical production markets must remain visible after the eventual mainnet
  cutover, even when their factories are no longer deployment targets.
- The SDK must expose only V2.5 factories to create-market flows.
- The SDK may still use historical factories to find and hydrate existing markets.
- Indexed mutable state can lag. It must not be the sole source for transaction
  preparation, safety checks, or a screen that claims to be live.
- Multichain support means one implementation and one stable schema, with a
  separately configured and deployed endpoint for each chain.

## Non-goals

- Changing protocol contracts, factory registration mechanics, or removal
  behavior.
- Replacing the lens with the subgraph for live state.
- Preserving the current generated helpers, manifest scripts, or GraphQL schema.
- Creating a single cross-chain GraphQL endpoint.
- Redesigning the SDK public API beyond the factory separation and query changes
  required by the new schema.
- Moving analytics to another repository as part of the first cut.
- Upgrading Graph tooling merely because the indexer is being refactored. Any
  toolchain upgrade should be a separate, justified decision.

## The conceptual model

The current implementation overloads several concepts. The replacement should
make the following distinctions explicit.

### 1. Indexed factory versus deployment factory

An indexed factory is a source of historical or current markets that the system
must surface. A deployment factory is the one selected by a particular SDK
release to create new markets.

Those are separate sets:

| Factory family | Indexed | V2.5 deployment target | Purpose |
| --- | --- | --- | --- |
| V1 controller factories | Yes, where configured | No | Existing V1 markets and history |
| Pre-V2.5 standard hooks factories | Yes, where configured | No | Existing standard markets and history |
| Pre-V2.5 revolving hooks factories | Yes, when they exist | No | Existing revolving markets and history |
| V2.5 standard hooks factory | Yes | Standard only | New patched standard markets |
| V2.5 revolving hooks factory | Yes | Revolving only | New patched revolving markets |

The protocol inventory currently calls the standard implementation `legacy`.
The subgraph should normalize this to `STANDARD`; `legacy` describes age and is
therefore the wrong long-term name for a market implementation family.

`deploymentTarget` is release configuration. `isRegistered` is indexed
ArchController state. Deregistration can prevent future deployment without
removing the factory or its markets from historical queries.

For transaction preparation, the SDK should select a configured deployment
target and verify relevant live registration or contract state. It should not
discover a deployment target by asking for every currently registered factory.

### 2. Market implementation versus hook behavior

These are orthogonal axes:

- market implementation: `STANDARD` or `REVOLVING`;
- hook behavior: `OPEN_TERM`, `FIXED_TERM`, `PERIODIC_TERM`, or a future hook
  family; and
- generation: the deployed code/config generation, such as `v2.1` or `v2.5`.

A periodic hook template registered with both standard and revolving factories
is one hook behavior available to two market implementations. It is not a third
market implementation. A future hook family should require an adapter and
projector for its own data, not another rewrite of the factory model.

### 3. Template code versus factory registration

A template address identifies deployable hook code. Fees, display name,
enabled/disabled status, and registration history belong to the relationship
between a particular factory and that template.

The core relationship should therefore be:

```text
HooksFactory --< HooksTemplateRegistration >-- HooksTemplate
```

This prevents one factory's update or disable event from overwriting another
factory's view of the same template.

### 4. Immutable identity versus mutable snapshot

`Market` should describe origin and immutable identity. `MarketSnapshot` should
contain cached mutable state and state exactly when it was observed.

This makes stale data visible in the schema instead of presenting it as if it
were timeless market metadata.

## Data authority contract

The SDK and app should use each data source according to the following contract.

| Capability | Authority | Subgraph role |
| --- | --- | --- |
| Discover markets, borrowers, hooks, factories, wrappers, and collateral relationships | Subgraph | Primary query surface |
| Identify the exact factory and code generation that created a market | Subgraph event history/config | Primary query surface |
| Market, lender, withdrawal, and factory event history | Subgraph | Primary query surface |
| Cumulative/event-derived analytics | Subgraph | Primary query surface, with provenance |
| Lists, filtering, sorting, and dashboards | Subgraph snapshots | Fast initial view; expose freshness |
| Current market supply, assets, scale factor, APR, reserve ratio, fees, closure, delinquency, coverage, and withdrawal state | V2.5 lens/direct RPC | Subgraph may cache but is not authoritative |
| Current lender balances, status, authorization, and allowance | Lens/token/direct RPC | Subgraph may cache but is not authoritative |
| Current revolving drawn amount and other mutable RCF fields | V2.5 lens/direct RPC | Subgraph may cache but is not authoritative |
| Current template availability, fee settings, borrower eligibility, and other transaction inputs | Relevant factory/lens/direct RPC | Subgraph is discovery and fallback only |
| Select the factory for a new market | SDK V2.5 release configuration | Subgraph may expose metadata but does not choose |

Every mutable snapshot entity must include at least:

- `updatedAtBlock`;
- `updatedAtTimestamp`; and
- enough provenance to tell whether it came from an event projection or a
  contract call in a mapping.

Consumer policy should be simple:

- lists may render indexed snapshots and then refresh visible items;
- detail pages should fetch live lens data;
- transaction modals must fetch live data before calculating or validating an
  action; and
- no authorization or solvency decision may rely only on a subgraph snapshot.

This preserves the pattern already present in the SDK: market and lender data
can be hydrated from GraphQL, while `Market.update`, bulk market live-data calls,
and lender-status live-data calls replace mutable fields from the V2.5 lens.

## Proposed schema

This is a conceptual schema, not final GraphQL syntax. Field names can be refined
while writing the schema, but entity ownership should remain stable.

### Deployment metadata

`IndexerDeployment`

- singleton ID;
- chain ID and Graph network name;
- schema release (`2.5`);
- normalized configuration digest;
- configured ArchController and sanctions sentinel;
- enabled optional projections;
- deployment/build provenance.

The Graph's `_meta` query remains the authority for indexed head and block hash.
Consumers can combine `_meta` with snapshot block fields to reason about
freshness.

### Factories and registration

`ControllerFactory`

- preserves the V1 factory/controller relationship;
- remains separate because V1 controllers and V2 hooks instances are different
  domain objects.

`HooksFactory`

- exact address;
- `marketKind: STANDARD | REVOLVING`;
- generation string;
- ABI/interface family;
- configured start block;
- `indexed` and `deploymentTarget` configuration flags;
- observed ArchController registration state and the block where it changed.

`FactoryRegistrationEvent`

- immutable add/remove history from ArchController;
- preserves history even after current registration state changes.

Registration events from an unknown factory should create a visible unclassified
factory/diagnostic record. They should not silently disappear or be guessed into
the wrong ABI family.

### Hook templates and instances

`HooksTemplate`

- template address/code identity;
- hook kind;
- generation/template version;
- ABI/interface family.

`HooksTemplateRegistration`

- ID derived from factory and template addresses;
- factory and template relationship;
- factory-provided name;
- origination and protocol fee configuration;
- current enabled/disabled state;
- created and last-updated block metadata.

`HooksTemplateRegistrationEvent`

- immutable add, fee-update, name-update, enable, and disable history.

`HooksInstance`

- exact address;
- borrower;
- originating factory;
- template registration/template;
- hook kind and generation;
- immutable deployment metadata;
- hook-specific configuration relation.

Hook kind must come from a configured template/interface descriptor or a
versioned on-chain discriminator. It must not be inferred only from a mutable
display name. Unknown templates should remain queryable as `UNKNOWN`.

### Markets and accounts

`Market`

- exact address and contract version;
- `marketKind` and generation;
- exact controller factory/controller or hooks factory/hooks instance origin;
- borrower and asset;
- immutable market configuration;
- creation block, transaction, and log index;
- current visibility/registration observations without deleting history.

`MarketSnapshot`

- one-to-one mutable cache for a market;
- shared standard-market state;
- nullable revolving-only state;
- `updatedAtBlock` and `updatedAtTimestamp`.

`LenderAccountSnapshot`

- market/account identity;
- cached balances and withdrawal status;
- freshness fields;
- never treated as an authorization source.

`WithdrawalBatch`, `LenderWithdrawalStatus`, and immutable typed event entities
should remain distinct. Event IDs should be based on transaction hash and log
index. If the SDK needs a single per-market timeline, retain an explicit monotonic
market event index as a projection rather than encoding order in entity IDs.

### Optional protocol surfaces

Wrappers, collateral modules, sanctions escrows, and price observations should
be their own modules and entities. A chain without one of those modules should
return empty or nullable data under the same schema, not use a different schema.

## Mapping architecture

Mappings should be organized around domain transitions, not around one giant
file per deployed contract.

Suggested layout:

```text
abis/
  <contract-or-interface-family>/<generation>.json
config/
  chains/<network>.json
scripts/
  generate-manifest.js
  validate-config.js
src/
  adapters/               # ABI-family event normalization
  domain/                 # IDs, constructors, required/optional loads
  mappings/               # thin Graph event entry points
  projectors/core/        # factories, hooks, markets, accounts, withdrawals
  projectors/analytics/   # daily stats, volume, price-derived projections
tests/
  fixtures/
  mappings/
  config/
```

The exact number of files is not a goal. The boundaries are:

1. an ABI adapter understands one event/interface generation;
2. a domain projector owns the entity transition;
3. optional analytics consumes normalized event data; and
4. a Graph event handler only translates event/context and invokes those pieces.

For example, old and V2.5 `HooksTemplateAdded` events may have different ABI
bindings, but both adapters should produce the same normalized template
registration input for the core projector.

### ABI routing

ABI selection should be by exact contract/interface family and generation, not
by network.

- Every configured static factory data source names its ABI family.
- Dynamic hooks and market templates receive factory generation, market kind,
  and ABI family through data-source context.
- V2.5 OpenTerm, FixedTerm, and PeriodicTerm bindings are copied from the frozen
  protocol artifacts and checked by event-signature tests.
- Historical ABI families remain only when a configured chain needs them.
- A chain may use several generations simultaneously without copying an entire
  network-specific ABI directory.

### Entity lifecycle and failures

Replace the generated `UncrashableEntityHelpers` pattern with three explicit
operations:

- a constructor used only at the domain event that creates the entity;
- `loadRequired`, which reports a precise invariant failure; and
- `loadOptional`, used only where absence is valid.

Do not fabricate fully populated entities with `UNINITIALISED` fields. Where
historical ordering can legitimately expose a reference before its creation
event, use a purpose-specific unresolved observation/diagnostic and reconcile it
deterministically. Unexpected events should be visible and testable rather than
silently producing plausible but false state.

## Multichain configuration and manifests

Maintain one checked-in normalized descriptor per chain. A descriptor should
contain only deployment facts and explicitly selected projections, for example:

```json
{
  "chainId": 1,
  "graphNetwork": "mainnet",
  "schemaRelease": "2.5",
  "anchors": {
    "archController": "0x...",
    "sanctionsSentinel": "0x..."
  },
  "factories": [
    {
      "address": "0x...",
      "startBlock": 0,
      "marketKind": "STANDARD",
      "generation": "v2.1",
      "abiFamily": "hooks-factory-v2.1",
      "indexed": true,
      "deploymentTarget": false
    },
    {
      "address": "0x...",
      "startBlock": 0,
      "marketKind": "STANDARD",
      "generation": "v2.5",
      "abiFamily": "hooks-factory-v2.5-standard",
      "indexed": true,
      "deploymentTarget": true
    }
  ],
  "wrappers": [],
  "collateral": [],
  "pricing": []
}
```

The protocol deployment handoff/inventory is the upstream source for new V2.5
addresses and ABI provenance. The subgraph's normalized descriptor is checked in
so the subgraph remains independently reproducible. Its provenance and digest
should make drift detectable.

The SDK's checked-in release configuration and the subgraph descriptor may use
different shapes, but their V2.5 factory addresses and market kinds must be
validated against the same protocol handoff. Cross-repository validation should
fail if either consumer assigns a different deployment target or generation.

A structural generator should produce the disposable `subgraph.yaml` manifest.
The build and deploy commands should always regenerate and validate it; the
manifest must not depend on a developer remembering a sequence of string
replacement commands.

Use one static data source per known historical or deployment factory. This is
intentional: it gives each source an exact start block, generation, market kind,
and ABI family. Dynamic data sources created by those factories inherit the same
context.

Address-only entity IDs remain acceptable because each endpoint is chain-scoped.
The SDK should use `chainId:address` when it needs a cross-chain identity.

## Analytics boundary

Keep core indexing and analytics in the same repository and schema during the
refactor, but put them behind separate projectors and tests.

Core indexing is release-gating:

- factory/template/market discovery;
- immutable relationships;
- events and withdrawal state;
- lender projections; and
- snapshot freshness.

Analytics follows core parity:

- cumulative and daily aggregates;
- price-derived USD values;
- utilization and volume projections; and
- any app-specific historical series.

Hardcoded chain addresses and synthetic testnet prices should move into chain
configuration. Price-derived entities should record source and observation time.
Whether analytics is eventually deployed as a separate endpoint is an operational
decision that can be made after parity; the initial refactor should not force it.

## SDK and app migration contract

The current SDK and app are reference consumers, not a schema that the new
subgraph must imitate internally.

The SDK should expose two deliberately different factory capabilities:

- `getDeploymentFactory(chainId, marketKind)` returns only the configured V2.5
  factory for that market implementation; and
- `getIndexedFactories(chainId)` returns all configured generations needed for
  historical discovery and direct reads.

Exact API names are negotiable; the separation is not.

Create-market and deployable-template flows use only the deployment factory for
the selected market kind. Market lists, borrower portfolios, lender portfolios,
history, and exact-origin lookup may include every indexed factory.

Migration work must cover both consumer paths:

1. SDK GraphQL documents and generated types; and
2. direct app GraphQL documents, polling, subscriptions, and analytics queries.

The app currently contains direct subgraph access, so updating only the SDK is
not sufficient. Moving a query behind the SDK is appropriate when it creates one
canonical domain API; it should not become a mandatory rewrite of every app data
hook.

The SDK's existing V2.5 lens refresh behavior should be made an explicit policy
and regression-tested. Indexed data provides initial hydration; live lens data
replaces mutable fields before detail views and actions rely on them.

## Implementation plan

Each phase should land as a reviewable change with its own acceptance gate. Do
not run the old and new entity models side-by-side inside one mapping indefinitely;
deploy the replacement as a new endpoint and keep the old endpoint as rollback.

### Phase 0: Ratify the contract and fixtures

Deliverables:

- approve the distinctions and authority table in this document;
- inventory every SDK and app capability that currently queries the subgraph;
- enumerate all factory, market, hook, wrapper, and collateral generations that
  each chain must index;
- capture representative event fixtures from old standard, V2.5 standard, and
  V2.5 revolving deployments; and
- define parity queries and expected results at fixed blocks.

Gate: no required consumer capability or historical generation is unclassified.

### Phase 1: Clean scaffold, configuration, and manifest

Deliverables:

- new core schema containing deployment metadata and factory identity;
- normalized chain descriptors;
- versioned ABI-family directories sourced from protocol artifacts;
- deterministic config validation and structural manifest generation; and
- one command that validates config, generates bindings, tests, and builds every
  supported chain.

Gate: Mainnet, Sepolia, Plasma mainnet, and Plasma testnet produce the same
GraphQL schema and independently reproducible manifests/builds.

### Phase 2: Registries, factories, and templates

Deliverables:

- correct V1 controller-factory indexing;
- generic ArchController add/remove observations for configured hooks factories;
- all configured hooks factory generations;
- factory-scoped template registrations and immutable registration history; and
- independent `deploymentTarget` and `isRegistered` state.

Gate: two factories may register the same template with different fees, names,
or enabled state without overwriting one another. Deregistration changes current
status but does not remove indexed history.

### Phase 3: Hooks instances and market discovery

Deliverables:

- thin ABI adapters for each required factory/hooks generation;
- standard and revolving hooks instances;
- exact factory/template origin for each hooks instance;
- V1, standard V2, and revolving V2 market creation; and
- immutable market identity plus an explicitly stamped initial snapshot.

Gate: every fixture resolves to the correct market implementation, hook kind,
factory generation, borrower, asset, and deployment transaction.

### Phase 4: Market events, withdrawals, and lender projections

Deliverables:

- normalized standard and revolving event projections;
- market event timeline and cumulative counters;
- withdrawal batches and lender withdrawal status;
- account snapshots with freshness; and
- lens-parity fields required for list hydration.

Gate: historical queries match the old endpoint at the same finalized block, and
snapshot consumers can determine exactly how stale every mutable record is.

### Phase 5: Wrappers, collateral, sanctions, and analytics

Deliverables:

- wrapper and collateral discovery needed by the SDK/app;
- sanctions escrow visibility;
- separated daily/cumulative analytics projectors;
- chain-configured price sources with provenance; and
- identical schema behavior when an optional module is absent.

Gate: the agreed visibility matrix is complete on every chain; unsupported
features yield empty/null results rather than a different schema or build.

### Phase 6: SDK and app migration

Deliverables:

- V2.5 GraphQL documents and generated SDK types;
- explicit deployment-factory versus indexed-factory APIs;
- SDK hydration followed by live lens refresh where required;
- migrated direct app queries; and
- removal of obsolete per-schema feature routing after every supported endpoint
  has cut over.

Gate: create-market surfaces can select only the V2.5 standard or V2.5 revolving
factory, while all configured historical markets remain discoverable. No action
flow makes a safety decision from a graph snapshot alone.

### Phase 7: Sepolia parity and cutover

Deliverables:

- deploy the replacement under a new Sepolia endpoint;
- reindex from configured historical start blocks;
- run parity queries at the same finalized block;
- exercise standard and revolving market creation and lifecycle events;
- point a test SDK/app build to the new endpoint; and
- document rollback to the existing endpoint.

Gate: parity and live-refresh checks pass, then the V2.5 Sepolia endpoint becomes
canonical. Repeat the same process for each subsequent chain; do not infer
mainnet readiness solely from Sepolia success.

## Required regression matrix

At minimum, automated mapping/config tests should cover:

- a V1 controller factory and market;
- an older standard V2 hooks factory and market;
- the V2.5 standard factory and market;
- the V2.5 revolving factory and market;
- a synthetic older revolving generation, even if no production instance exists
  yet;
- OpenTerm, FixedTerm, and PeriodicTerm hook templates under both market
  implementations where the protocol permits them;
- the same template registered on two factories with different fees and disabled
  state;
- factory deregistration while existing markets remain queryable;
- an unknown registered factory/template producing an explicit diagnostic;
- out-of-order or missing-reference behavior without fabricated market data;
- withdrawal lifecycle and lender aggregation;
- wrapper, collateral, and sanctions discovery where configured;
- all supported chain descriptors building against the same schema; and
- event signatures for every retained ABI family, especially the V2.5 OpenTerm,
  FixedTerm, and PeriodicTerm ABIs.

Consumer tests should additionally prove:

- market list hydration works from snapshots;
- detail and action flows refresh through the V2.5 lens;
- a deliberately stale indexed snapshot is replaced by live values;
- create-market never selects a historical factory; and
- historical markets remain visible after their factory is no longer registered
  or is not a deployment target.

## Definition of done

The refactor is complete when:

- one schema and one mapping implementation build for every supported chain;
- chain configuration is explicit, validated, and reproducible;
- all intended historical market generations are queryable;
- only the V2.5 standard and revolving factories are exposed for new deployment;
- factory-scoped template state cannot overwrite another factory's state;
- market implementation, hook behavior, and code generation are independent;
- mutable indexed records expose freshness and are not used as live authority;
- SDK and app parity covers discovery, history, wrappers, collateral, withdrawals,
  portfolios, and agreed analytics;
- ABI-family and mapping regression tests pass;
- build/deploy no longer requires manual manifest surgery or network-wide ABI
  swapping;
- obsolete schema-feature forks and legacy GraphQL documents are removed only
  after all supported endpoints have cut over; and
- previous endpoints remain available through the agreed rollback window.

## Principal risks and controls

| Risk | Control |
| --- | --- |
| Full historical reindex exposes event-ordering assumptions | Fixed-block fixtures, explicit entity creation rules, and comparison at identical finalized blocks |
| A factory is assigned the wrong ABI family | Config validation, artifact provenance, signature tests, and first-event smoke checks |
| Clean schema breaks an untracked app query | Consumer inventory in Phase 0 and repository-wide query search before schema lock |
| Analytics expands the release-critical rewrite | Land core parity first; keep analytics in a separate projector and gate |
| Snapshot data is mistaken for live state | Separate snapshot entities, required freshness fields, and lens-refresh consumer tests |
| Mainnet historical behavior differs from Sepolia | Mainnet fixed-block parity before endpoint cutover |
| The refactor becomes a general tooling upgrade | Keep the current toolchain unless a measured blocker justifies a separately reviewed upgrade |

## Current-code evidence motivating the rewrite

The proposal is based on the current V2.5 repositories, particularly:

- `schema.graphql`: global `HooksTemplate` state overlaps with the correctly
  factory-scoped `FactoryHooksTemplate` relationship, and `MarketType.Legacy`
  conflates implementation with generation;
- `src/hooks-factory.ts`: template add/update/disable handlers mutate global
  template fields, allowing factories to overwrite one another
  (`handleHooksTemplateAdded`, `handleHooksTemplateFeesUpdated`, and
  `handleHooksTemplateDisabled`);
- `src/wildcat-arch-controller.ts`: controller-factory handling is specialized
  around the older factory shape rather than recording generic registry state
  (`handleControllerFactoryAdded` and `handleControllerFactoryRemoved`);
- `generated/UncrashableEntityHelpers.ts`: placeholder construction hides entity
  lifecycle and missing-reference errors;
- `scripts/set-addresses.js` and `network-specific-abis/`: manifest and ABI routing
  are organized by network even when multiple generations coexist on one chain;
- `src/wildcat-market.ts`, `src/daily-stats.ts`, and `src/price-feeds.ts`: core
  state projection, analytics, and chain-specific pricing are intertwined;
- `../wildcat.ts/src/market.ts` (`Market.update`, `updateWithLiveData`, and
  `refreshMarketsV2LiveData`) and `../wildcat.ts/src/internal/market-lens.ts`:
  the SDK already has focused V2.5 lens refresh paths for mutable market data;
- `../wildcat.ts/src/account/index.ts`: lender-status live data already has a
  bulk lens path;
- `../wildcat.ts/src/gql/getAllHooksTemplates.ts`: current template discovery
  uses the broad indexed-factory set, which must be narrowed for deployment
  surfaces; and
- `../wildcat-app-v2/src/graphql` plus app analytics hooks: the app still has direct
  subgraph consumers that must be included in migration planning.

These files are evidence for the boundaries above, not an instruction to port
their current internal structure into the replacement.
