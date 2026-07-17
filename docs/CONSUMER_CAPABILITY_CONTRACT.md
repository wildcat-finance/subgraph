# V2.5 Subgraph Consumer Capability Contract

Status: accepted refactor input.

The implemented old-to-new query mappings and consumer cutover obligations are
recorded in `docs/V2_5_SCHEMA_MIGRATION.md`.

This document defines the observable data capabilities that the V2.5 subgraph
replacement must preserve. It deliberately does not preserve the current
GraphQL schema or mapping structure.

The current SDK and app are reference consumers. They remain unchanged while
the subgraph is rebuilt. Their migration begins only after a replacement
endpoint satisfies this contract.

## Authority boundary

The subgraph is authoritative for deterministic indexed history and
relationships. It is an approximately-live cache for mutable state.

| Data | Required source |
| --- | --- |
| Discovery, origin, relationships, events, cumulative aggregates, and historical snapshots | Subgraph |
| Fast market/account list hydration | Subgraph snapshot with block and timestamp freshness |
| Current balances, liquidity, APR, reserve requirements, delinquency, withdrawal state, authorization, and transaction inputs | Lens or direct RPC, normally coordinated by the SDK |
| Historical USD analytics | Subgraph price observations with source and timestamp |
| Current USD presentation | Current onchain amount plus an explicitly sourced price |

Retaining an existing UI capability does not require retaining stale-data
behavior. In particular, current position and market-state views may initially
hydrate from the subgraph, but the SDK should replace mutable fields with lens
or RPC data where freshness matters.

## Factory and market discovery

### DISC-01: Historical market visibility

Consumers can enumerate every configured historical V1 and V2 market,
including markets whose factory is no longer a deployment target or is no
longer registered.

### DISC-02: Exact origin

Each market exposes its exact chain-scoped origin:

- V1 controller factory and controller, or V2 hooks factory and hooks instance;
- market implementation kind (`STANDARD` or `REVOLVING`);
- factory/market generation;
- hook template registration and hook behavior;
- borrower, asset, creation transaction, block, timestamp, and log index.

### DISC-03: Deployment eligibility is separate

Historical indexing does not make a factory deployable. Only configured V2.5
deployment targets may be offered to create-market consumers.

### DISC-04: Factory-scoped template state

Template name, fees, enabled state, and registration history are queryable per
factory. One factory cannot overwrite another factory's view of the same
template address.

### DISC-05: Registration history

ArchController add/remove observations remain queryable without deleting the
factory, controller, market, or historical relationships they affected.

## Market and account state

### STATE-01: Approximately-live market snapshots

Market lists can hydrate the current indexed values required by the SDK and
app, including standard and revolving fields. Every mutable snapshot identifies
the block and timestamp at which it was updated.

### STATE-02: Lender account snapshots

Consumers can discover lender positions and indexed balances, deposits,
interest, access state, withdrawal status, and the market relationship. Mutable
values expose freshness and can be replaced by live SDK reads.

### STATE-03: Withdrawal lifecycle

Consumers can reconstruct current and historical withdrawal batches, requests,
payments, expirations, executions, lender status, paid/owed amounts, and late or
unpaid behavior.

### STATE-04: Hook/access state

Consumers can query hooks instances, hook-specific configuration, role
providers, lender access observations, known-lender state, and access-change
history.

### STATE-05: Wrappers, collateral, and sanctions

Consumers can discover configured ERC-4626 wrappers, collateral relationships,
and sanctions escrows/events. Chains without an optional module expose empty or
nullable data under the same schema.

## Event history

### HIST-01: Unified market activity

The following event families remain queryable with transaction, block,
timestamp, log-index, market, and participant relationships where applicable:

- deposits and transfers;
- borrows and repayments;
- interest, delinquency fee, and protocol fee accrual;
- fee collection;
- withdrawal queue, payment, expiration, and execution;
- market closure and state/delinquency changes;
- APR, reserve ratio, supply cap, protocol fee, and hook configuration changes;
- sanctions, wrapper, and optional collateral events.

### HIST-02: Stable ordering and pagination

Immutable event IDs use transaction hash and log index. Consumers can request a
stable chronological market timeline and paginate without relying on entity ID
lexicographic order.

## First-class analytics

Analytics are a required read-model capability, not an optional application
overlay. The replacement may use different entities, but it must provide the
following outputs.

### AN-01: Market flows and totals

- daily and cumulative deposits;
- withdrawals requested and executed;
- borrows and repayments;
- base interest, delinquency fees, and protocol fees;
- supply/scale-factor/debt snapshots; and
- asset-denominated and price-derived USD series where pricing is supported.

### AN-02: Borrower profiles

- first market and time on protocol;
- total, active, delinquent, and closed markets;
- assets used, debt, capacity, and debt-weighted APR;
- cumulative borrowed, repaid, deposited, withdrawal, interest, penalty, and
  protocol-fee values;
- daily cost and debt/capacity series;
- APR-change history;
- delinquency duration, penalty exposure, and cure behavior; and
- expired, unpaid, and late-paid withdrawal-batch reliability.

### AN-03: Lender profiles

- first activity and time on protocol;
- total and active positions;
- indexed position balances with live-overlay support;
- deposited, withdrawn, pending-withdrawal, and interest totals;
- daily and cumulative cash flow;
- deposit, withdrawal, execution, and transfer activity;
- capital-at-risk history; and
- risk/return views correlated with market delinquency and penalties.

### AN-04: Market detail analytics

- daily flow and cumulative net-flow charts;
- withdrawal payment history;
- delinquency history;
- lifetime deposits, withdrawals, and lender interest; and
- active-lender count or an equivalent indexed position count.

### AN-05: Protocol aggregates

- cumulative and daily protocol flows and fees;
- market, borrower, lender, active-position, delinquent, and closed counts; and
- historical snapshots sufficient for protocol-wide time series.

### AN-06: Price observations

Token price observations expose token, timestamp, price, source, and source
chain/feed provenance. Stablecoin treatment is explicit. Missing pricing does
not fabricate zero-value economic activity; it produces an unpriced/null result
that consumers can identify.

## Current reference consumers

These paths identify the capability surface at the start of the refactor. They
are evidence, not schema requirements.

### SDK

- `../wildcat.ts/gql/queries.graphql`
- `../wildcat.ts/src/gql/getMarketList.ts`
- `../wildcat.ts/src/gql/getMarketRecords.ts`
- `../wildcat.ts/src/gql/getAllHooksTemplates.ts`
- `../wildcat.ts/src/gql/getMarketChartsData.ts`
- `../wildcat.ts/src/market.ts`
- `../wildcat.ts/src/account/index.ts`
- `../wildcat.ts/src/internal/market-lens.ts`

### App direct subgraph consumers

- `../wildcat-app-v2/src/graphql/`
- `../wildcat-app-v2/src/lib/hinterlight.ts`
- `../wildcat-app-v2/src/hooks/useTokenUsdPrices.ts`
- `../wildcat-app-v2/src/app/[locale]/borrower/profile/hooks/analytics/`
- `../wildcat-app-v2/src/app/[locale]/lender/profile/hooks/`
- `../wildcat-app-v2/src/app/[locale]/lender/market/[address]/hooks/`

The app's direct analytics client currently targets separate Hinterlight
Mainnet and Sepolia endpoints. Those endpoints remain the rollback/reference
surface until replacement profile queries pass parity.

## Parity gate

A replacement endpoint is not ready for consumer migration until:

1. every capability above has a new query or an explicit live-read replacement;
2. fixed-block comparisons cover representative V1, historical V2 standard,
   V2.5 standard, and V2.5 revolving markets;
3. borrower and lender profile fixtures produce equivalent visibility;
4. deliberately stale snapshots are visibly stamped and safely replaceable by
   live SDK data;
5. pricing gaps remain identifiable rather than silently becoming zero USD;
6. deregistered/historical markets remain discoverable; and
7. every supported chain builds the same schema, with unsupported optional
   modules returning empty or nullable data.
