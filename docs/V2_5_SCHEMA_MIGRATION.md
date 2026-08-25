# V2.5 Subgraph Schema Migration

Status: subgraph implementation complete; SDK and app source migrations
complete; deployed endpoint cutover pending.

That status includes the v2.5.9 identity, authority, and event-history additions
on the coordinated subgraph and SDK branches. The final Sepolia deployment
targets are configured; hosted endpoint cutover remains pending. See
`docs/V2_5_9_EVENT_MODEL.md`.

The V2.5 endpoint is a clean schema deployment. It does not attempt to remain
query-compatible with earlier V2 endpoints. Historical factories and markets
remain indexed, but consumers must migrate the relationships below before they
target the new endpoint.

This document records intentional breakpoints. A field absent from this ledger
should be treated as a possible regression, not as an implied cleanup.

## Consumer authority boundary

The subgraph owns discovery, provenance, relationships, immutable history,
cumulative analytics, and freshness-stamped snapshots. Lens or direct RPC owns
transaction inputs and state that must be current, including balances,
liquidity, APR, delinquency, withdrawal availability, and authorization.

Consumers may hydrate a list from `MarketSnapshot`, `LenderAccountSnapshot`, or
`SimpleCollateralContractSnapshot`, but must use their block/timestamp stamps
and replace mutable values with live reads where correctness depends on the
latest block.

## Factory and template migration

The old model placed mutable display and fee state on both a global template
and `FactoryHooksTemplate`. That was ambiguous when the same template address
was registered on multiple factories.

| Previous query surface | V2.5 query surface |
| --- | --- |
| `FactoryHooksTemplate` | `HooksTemplateRegistration` |
| `factoryHooksTemplates` | `hooksTemplateRegistrations` |
| `HooksInstance.factoryHooksTemplate` | `HooksInstance.templateRegistration` |
| `HooksInstanceDeployed.factoryHooksTemplate` | `HooksInstanceDeployed.templateRegistration` |
| `FactoryHooksTemplate.templateAddress` | `HooksTemplateRegistration.hooksTemplate.address` |
| `FactoryHooksTemplate.disabled` | `!HooksTemplateRegistration.isEnabled` |
| `HooksFactory.factoryHooksTemplates` | `HooksFactory.templateRegistrations` |
| `HooksFactory.hooksTemplates` | registrations followed through `hooksTemplate` |
| `HooksTemplate.factoryHooksTemplates` | `HooksTemplate.registrations` |
| `HooksTemplate.name` and fee fields | the corresponding fields on `HooksTemplateRegistration` |
| `HooksTemplate.hooksFactory` | `HooksTemplate.registrations.hooksFactory` |

`HooksTemplate` now represents bytecode/interface identity only: address, hook
kind, version, and ABI family. `HooksTemplateRegistration` represents mutable
state for one factory/template pair: name, fees, enabled state, timestamps, and
change history.

The standalone `HooksTemplateAdded`, `HooksTemplateDisabled`, and
`HooksTemplateFeesUpdated` entities are replaced by
`HooksTemplateRegistrationEvent`. Use its `change` discriminator (`ADDED`,
`DISABLED`, or `FEES_UPDATED`) for historical queries.

## Multiple factories and market identity

| Previous query surface | V2.5 query surface |
| --- | --- |
| `ArchController.hooksFactory` | `ArchController.hooksFactories` or `factoryRegistrations` |
| `HooksFactory.marketType` | `HooksFactory.marketKind` |
| `Market.marketType` | `Market.marketKind` |

`marketKind` uses `STANDARD`, `REVOLVING`, or `UNKNOWN`. SDK-facing legacy
names may remain a presentation/API concern, but factory selection must no
longer assume one global hooks factory.

Use `indexed`, `deploymentTarget`, `lifecycle`, and observed registration state
for their distinct purposes:

- `indexed` preserves visibility into a factory's historical markets;
- `deploymentTarget` identifies a configured create-market target;
- `lifecycle` records release/operator intent; and
- `isRegistered` plus `FactoryRegistration` records observed ArchController
  state.

Every V2.5 market exposes `address`, `marketKind`, `originKind`, `generation`,
`abiFamily`, exact creation coordinates, and its originating controller or
hooks factory. `Market.createdAt` remains available for existing analytics
sorting; `createdAtTimestamp` is the canonical full-width creation timestamp.

## Sanctions event correction

`SanctionedAccountAssetsQueuedForWithdrawal.amount` is removed because it does
not exist in the V2.5 protocol event. Query the exact emitted fields instead:

- `expiry`;
- `scaledAmount`; and
- `normalizedAmount`.

`SanctionsEscrow` and `SanctionOverrideStatus` provide first-class current
relationships while the original immutable event entities preserve history.

## Collateral depositor identity

`SimpleCollateralContractDepositor.id` is now scoped as
`<collateral-contract-address>-<account-address>`. This prevents one account's
positions in different collateral contracts from overwriting each other.

Consumers must select `SimpleCollateralContractDepositor.address` when they
need the wallet address. They must not parse or present the entity ID as an
address. The SDK fragment currently selecting only `id` must add `address`
before moving to the V2.5 endpoint.

## Pricing and analytics

`TokenDailyPrice` retains `token`, `timestamp`, and `priceUSD` and adds explicit
source and observation provenance. It is immutable and represents the first
price observation used for a token on a UTC day. `feed0` and `feed1` retain the
exact Chainlink path used for that observation even if the token's configured
path changes later. `Token.priceSource` describes the currently configured
price path. `Token.lastPriceFeedSearchDay` exposes the UTC day of the latest
dynamic discovery attempt for operational diagnostics.

Mainnet uses configured Chainlink sources. Sepolia uses explicitly configured
synthetic testnet pricing. Plasma Mainnet and Plasma Testnet use address-scoped
`USD_PEG` configuration and never fall through to Ethereum Chainlink sources.
Chains with `pricingMode: NONE` leave activity unpriced rather than fabricating
zero-value USD activity.

Chainlink observations now validate each feed's own decimals and
`latestRoundData`: answers must be positive, complete, non-future, and no more
than seven days old. Dead or missing paths are cleared and discovery retries on
the next UTC day.

`Market.totalDebtUSD` is nullable. A value of `0` means the indexed debt is
actually zero; `null` means nonzero debt could not be priced. `Market`,
`ProtocolStats`, `BorrowerStats`, and `LenderStats` expose
`usdTotalsComplete`; their daily entities expose `dayUsdTotalsComplete` and
`cumulativeUsdTotalsComplete`. Once an unpriced nonzero flow occurs, the
affected cumulative flag remains false for that deployment. Daily flags apply
to that UTC bucket. Consumers must not interpret a numeric USD aggregate as
complete unless its corresponding flag is true.

`Market.totalAssets` and `MarketSnapshot.totalAssets` expose the asset balance
observed on each `StateUpdated`.

## Role-provider lifecycle

`RoleProvider.addedEvent` and `removedEvent` are nullable pointers to the most
recent actual lifecycle events. `addedEvents` and `removedEvents` retain the
complete indexed remove/re-add history. Provider arrays read while indexing a
hooks instance initialize current provider state but no longer create synthetic
`RoleProviderAdded` entities.

`Borrower` is the canonical address identity joining registration, markets,
`BorrowerStats`, `BorrowerDailyStats`, and sanctions data. Existing borrower
analytics fields remain available. `IndexerDeployment` exposes the chain,
schema release, configuration digest, optional-module flags, and pricing mode
for endpoint introspection.

## Consumer cutover status

`wildcat.ts@feat/sdk-refactor` completed the required source migration:

1. replaced `FactoryHooksTemplateData` with a
   `HooksTemplateRegistration` fragment;
2. updated hooks-instance and market fragments to follow
   `templateRegistration`;
3. replaced subgraph `marketType` reads with `marketKind` and SDK-owned public
   domain types;
4. queried all indexed factories for discovery but uses only configured current
   deployment targets for market creation;
5. added collateral depositor `address`; and
6. overlaid freshness-sensitive snapshot values with named lens/RPC live reads.

`wildcat-app-v2@feat/app-refactor` now consumes the SDK-owned market, hooks,
withdrawal, profile, and analytics models. It retains only documented
app-owned notification/subscription/discovery GraphQL escape hatches.
`Market.createdAt` remains intentionally available for compatibility.

The remaining cutover work is to deploy the hosted endpoint, refresh SDK
endpoint metadata, and run fixed-block/live SDK and app smoke against the
deployed V2.5 graph.

## Cutover gate

Do not point the released SDK or app at a V2.5 endpoint until:

1. SDK GraphQL code generation succeeds against this schema;
2. representative V1, historical V2 standard, V2.5 standard, and V2.5
   revolving market fixtures hydrate correctly;
3. factory-template queries prove same-template-address isolation;
4. borrower analytics and collateral account fixtures pass;
5. lens/RPC overlays replace freshness-sensitive values; and
6. fixed-block parity checks confirm historical markets remain discoverable.

Items 1-5 have local schema/fixture evidence on the refactor branches. Item 6
and hosted endpoint validation remain deployment gates and must be repeated
against the actual release endpoint.
