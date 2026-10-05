# V2.5.13: Sepolia protocol compatibility

Prepared from subgraph `584e5de1c22a2c8cc3b79aeda707392392d9be83` against
`v2-protocol` branch `release/v2.5` at
`05165ad4c4020c1400048680b85b3585f84e8527` (2026-10-02).

The Sepolia V2.5.5 protocol deployment is now integrated. Its finalized records
are in `v2-protocol/feat/sepolia-v2.5.5@846f5ea1b03bcb9f8d8a6a5025c2a20ecc8a7507`.
Solidity source, libraries, and compiler configuration are unchanged from the
source pin above. Addresses, deployment blocks, receipts, and live activation
were verified. The operator subsequently reported `v2.5.13` deployed. Hosted
endpoint health and indexing completion have not been independently verified.
The previous subgraph package was `2.5.12`; this package and endpoint label are
`2.5.13` / `v2.5.13`.

## Indexed changes

| Protocol change | Subgraph behavior |
| --- | --- |
| `MarketRepaymentTerms` from both factories | Immutable terms record plus nullable `repaymentDate`, `repaymentPeriod`, and `repaymentDeadline` on `Market` and `MarketSnapshot`. `(0, 0)` identifies a supported, unscheduled market. Null identifies older markets without this event. |
| `RepaymentDateReached` | Immutable record and `repaymentActivatedAt`; sets the effective reserve ratio to 10,000 without requiring a separate parameter-change event. |
| `DefaultRecorded` | Immutable record and permanent `defaultedAt`, independent of closure. Zero means no committed default for a supported market; null means unsupported. |
| Automatic `MarketClosed` | Records `closedAt` from the event, separately from its block timestamp. Updates effective periodic closure/proposal state without inventing hook events that the protocol does not emit. |
| `HooksTemplateInitCodeHashRecorded` | Factory-scoped `HooksTemplateRegistration.initCodeHash` and immutable `HooksTemplateInitCodeHashRecord`, including transaction/log provenance. |
| Fractional withdrawal payments | `WithdrawalBatch.paymentRemainder` and `Market.withdrawalRemainder` track non-interest-bearing fractions. Debt, reserve requirements, and batch accounting include them before rounding. |

Lifecycle timestamps describe committed transitions. Neither a zero
`defaultedAt` nor a missing `repaymentActivatedAt` proves that an unprocessed
deadline has not passed. Live transaction decisions still require the current
protocol lens/RPC state.

The unified market history gains `REPAYMENT_TERMS`, `REPAYMENT_DATE_REACHED`,
and `DEFAULT_RECORDED`. Existing fields, enum values, and entity types remain.
New fields on existing entities are nullable for older deployments.

## ABI and accounting boundaries

The V2.5 market ABI includes the fifteen-word `MarketState`, four-word
`WithdrawalBatch`, widened cumulative withdrawal counters, repayment getters,
and new events. The V2.5 factory ABI includes repayment input fields, template
hash commitments, and both standard/revolving deployment signatures.

Older indexed V2.5 deployments still return fourteen-word stored state.
`WildcatMarketLegacyState.json` freezes that read ABI. Receipt of the factory's
`MarketRepaymentTerms` selects the new decoder and carry accounting, including
for unscheduled markets. Deployment labels and `version() == "2.5"` do not
select the decoder. V2/V2.1 ABIs remain unchanged.

Payment logs contain shares burned and whole assets reserved. Given the
event-local scale factor, the next batch fraction is:

```text
nextRemainder = previousRemainder + scaledAmountBurned * scaleFactor
                - normalizedAmountPaid * RAY
```

The fraction must remain in `[0, RAY)`. The market sum changes by the batch
delta. A fully paid open batch retains its fraction because new requests may
join it; expiry or final closure releases it exactly once. Aggregate fractions
may exceed one RAY. They do not earn interest and are combined with scaled
liabilities before the protocol's half-up normalization.

V2.5 delinquency history continues deriving charged seconds from the emitted
penalty fee and reading the stored clock only for block-final intervals.
The stored-state read is block-final, not transaction-local. Repayment-date
underfunding activates penalty exposure immediately, even below the original
grace threshold; unscheduled markets retain their grace behavior.

The concrete built-in hook events and hooked-market read tuples are unchanged.
Their source refactor and the removed market-to-hook withdrawal callback need
no hook mapping migration. Identity/provider and consumed wrapper event/call
wire formats were checked against the same protocol artifacts.

## Address handoff

The descriptor adopts the finalized
[`handoff-v2.5.5.json`](../../v2-protocol/deployments/sepolia/handoff-v2.5.5.json),
SHA-256 `393e02e2cdf2711163e8e731ad2e161935e06028243a1d6cd633688dcbd8a0b2`,
and its source
[`factory-inventory.json`](../../v2-protocol/deployments/sepolia/factory-inventory.json).
`deploymentTargetsReady` is true. Only the new standard, revolving, and wrapper
factories are deployment targets; compatibility aliases select those factories.

| New event source | Address | Start block |
| --- | --- | ---: |
| Standard hooks factory | `0x0E12301A4F4b81A2B9965E4959e21faDf1754Ead` | 11831246 |
| Revolving hooks factory | `0x130E07D24e2aF6ea4554032d4F53fcBAe000d1b1` | 11831251 |
| Wrapper factory | `0x1986DF1c77d25670e8D55865B83C5fFeD00e0134` | 11831239 |
| AccessList role-provider factory | `0xE6D5bDd5011568C46fAf257cf426Ea822bC4255F` | 11831240 |

The three new OpenTerm/FixedTerm/PeriodicTerm template addresses are appended to
`hooksTemplates`. The shared borrower identity registry remains indexed from
its original block 11559126. The old AccessList factory remains indexed too.
Only AccessList was deployed in V2.5.5; no sources were added for the excluded
provider kinds. Split market initcode stores and lens helpers are not subgraph
event sources.

All 22 factory-inventory records retain their address, start block, and indexing
policy. Inventory `canonical`/`live` map to descriptor `active`, with only
`canonical` selected as `deploymentTarget`; `retired` stays `retired`.
The four excluded generations remain unindexed: `revolving-preview-2026-04-19`,
`standard-test-2024-08-05`, `standard-test-2024-09-23`, and
`standard-test-2024-11-21`. Every previously indexed source remains indexed.

The preview wrapper `0x8a77449eaBB1522983cd700f002b5b191463378e` has no separate
wrapper-inventory row, but both live July preview factories reference it in
their inventory records. Its existing source and start block are preserved.
Existing anchors and collateral indexing are unchanged.

Before consumer cutover, verify synchronization and indexed repayment/default,
wrapper, and withdrawal behavior.

```sh
yarn netconfig sepolia
yarn verify:all-networks
yarn netconfig:check sepolia
yarn check:protocol-abis ../v2-protocol/deploy-out

# Publish the new subgraph release when authorized:
yarn deploy:goldsky:sepolia v2.5.13
yarn deploy:hinterlight:sepolia v2.5.13
```

## Consumer handoff

SDK files were inspected but not modified. Existing queries retain their
selected fields. The current SDK snapshot normalizer does not expose these
new fields, and its own debt/penalty calculations need separate reconciliation
before using the new protocol for live actions. Refresh its protocol and lens
bindings as part of that work; this subgraph update does not provide that ABI
migration. Switch consumers only after the new endpoint's indexing is verified.

## Validation

Completed locally against the source pin above:

- Fresh protocol artifacts built successfully; `yarn check:protocol-abis`
  verified 290 consumed event/function wire formats against both those artifacts
  and the V2.5.5 deployment-profile artifacts in `v2-protocol/deploy-out`.
- `yarn codegen` and `yarn verify:all-networks` passed, including builds for
  mainnet, plasma-mainnet, plasma-testnet, sepolia, and v2.5-fixture.
- `node --test scripts/*.test.js`: 51 passed, including manifest wiring,
  old/new ABI shapes, release paths and the pending-address deploy gate.
- Matchstick: 92 tests across 26 suites passed using the cached Docker runner
  after native AssemblyScript 0.19.23 compilation. Coverage includes legacy
  and current stored-state decoding, repayment/default transitions, automatic
  periodic closure, and withdrawal fractions across payment/expiry/closure.
- Schema comparison preserved all 1,862 existing fields and 124 enum values.
  Historical source addresses, start blocks, and indexing flags are unchanged;
  other chain descriptors are unchanged. `yarn netconfig:check sepolia` and
  `git diff --check` passed.

Protocol handoff validation passed for all 22 factory records. Read-only Sepolia
checks passed all 25 activation predicates and all 25 transaction provenance
checks, including successful receipts, executor, calldata, value, deployment
addresses, and receipt blocks. At block 11831416
(`0x3543cd93da2630acee8b88d59fcdea40792552b15c57ccfe8157fa6cce27e7d7`),
both factories' template counts, six template creation-code commitments, wrapper
binding, and reused identity-registry binding matched the deployment artifacts.

The operator reported the subgraph deployment complete after local validation.
Full-chain replay, hosted endpoint health, and live indexing completion have
not been independently verified; those remain separate release checks.
