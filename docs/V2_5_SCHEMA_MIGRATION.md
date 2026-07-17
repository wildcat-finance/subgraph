# V2.5 Subgraph Schema Migration

Status: subgraph implementation complete; SDK and app migration pending.

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
price observation used for a token on a UTC day. `Token.priceSource` describes
the configured price path.

Mainnet uses configured Chainlink sources. Sepolia uses explicitly configured
synthetic testnet pricing. Chains with `pricingMode: NONE` leave activity
unpriced rather than fabricating zero-value USD activity.

`Borrower` is the canonical address identity joining registration, markets,
`BorrowerStats`, `BorrowerDailyStats`, and sanctions data. Existing borrower
analytics fields remain available. `IndexerDeployment` exposes the chain,
schema release, configuration digest, optional-module flags, and pricing mode
for endpoint introspection.

## Known consumer cutover work

The current SDK GraphQL documents intentionally do not validate against this
schema yet. Its migration must, at minimum:

1. replace `FactoryHooksTemplateData` with a
   `HooksTemplateRegistration` fragment;
2. update hooks-instance and market fragments to follow
   `templateRegistration`;
3. replace subgraph `marketType` reads with `marketKind` while preserving any
   desired public SDK compatibility mapping;
4. query all indexed factories for discovery but use only configured current
   deployment targets for market creation;
5. add collateral depositor `address`; and
6. overlay freshness-sensitive snapshot values with lens/RPC data.

The app's direct borrower analytics query still sorts and reads
`Market.createdAt`; that compatibility field is intentionally retained. Direct
borrower stats, daily stats, and token-price fields are also retained. The app
should move through the updated SDK where practical, and direct queries should
be validated against the deployed V2.5 endpoint before endpoint cutover.

## Cutover gate

Do not point the released SDK or app at a V2.5 endpoint until:

1. SDK GraphQL code generation succeeds against this schema;
2. representative V1, historical V2 standard, V2.5 standard, and V2.5
   revolving market fixtures hydrate correctly;
3. factory-template queries prove same-template-address isolation;
4. borrower analytics and collateral account fixtures pass;
5. lens/RPC overlays replace freshness-sensitive values; and
6. fixed-block parity checks confirm historical markets remain discoverable.
