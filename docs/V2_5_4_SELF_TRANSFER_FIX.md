# V2.5.4 handoff: market self-transfer indexing bug

Status: confirmed defect; implementation intentionally deferred to the
development machine. Target the fix at a new `v2.5.4` deployment. Do not
mutate or reuse the `v2.5.3` release name.

## Summary

`handleTransfer` assumes that the `from` and `to` lenders are different. An
ERC-20 self-transfer violates that assumption. The handler loads the same
lender twice, accrues the same interest twice, writes the same immutable
`LenderInterestAccrued` ID twice, and applies the debit and credit to separate
in-memory copies of the same entity.

This has two provider-visible outcomes:

- Sentio rejects the second immutable-entity write and halts the deployment.
- Goldsky accepts the same-block overwrite, but the final lender balance is
  wrong: the later credit save replaces the earlier debit save.

The Graph's immutable-entity model permits an entity to change within the
block in which it was created. Sentio's rejection is therefore a provider
compatibility difference, but the incorrect Goldsky result proves that this
is also an application bug and not merely a Sentio deployment problem. See
[The Graph schema documentation](https://thegraph.com/docs/en/subgraphs/developing/creating/ql-schema/#defining-entities).

## Current code path

The defect is in `src/wildcat-market.ts`, in `handleTransfer`:

1. `getOrCreateLenderAccount` is called separately for `fromAddress` and
   `toAddress`.
2. `processLenderInterestAccrued` is called for both loaded entities.
3. The debit is applied to `from`, the credit is applied to `to`, and both are
   saved.
4. Lender aggregate and daily statistics are also processed and saved twice.

For a self-transfer, both entity IDs are identical but the loaded entity
instances retain the same pre-transfer balance. Saving the credited instance
last leaves the indexed balance one scaled transfer amount too high.

`processLenderInterestAccrued` now scopes its immutable history ID as
`<event-id>-<lender-account-id>`. That correctly gives two different lenders
distinct interest records during a normal transfer. It deliberately gives a
self-transfer only one possible ID, which exposed the duplicate processing on
Sentio.

## Exact v2.5.3 failure

The Sentio deployment was built as IPFS CID
`QmezRWZtivBiCVdA7EJD74Jgd7myvGz1orxXu66byFA6fW` and deployed as
`wildcat/data_gateway/HyWJKkbm`. It halted at 33% while indexing Sepolia:

| Field | Value |
| --- | --- |
| Chain ID | `11155111` |
| Block | `6974169` |
| Transaction | `0xe73eacdcc82973551b4a71cab16fcc9295eb9725449a099355220603cf5e20e7` |
| Log index | `50` |
| Market | `0x0207f373da1e65d067e95a6b9df51a26ccef01d7` |
| From and to | `0xca732651410e915090d7a7d889a1e44ef4575fce` |
| Interest written twice | `9699933160354` |

Sentio reported `invalid update ... update immutable` for this ID:

```text
0xe73eacdcc82973551b4a71cab16fcc9295eb9725449a099355220603cf5e20e7-50-LENDER-0x0207f373da1e65d067e95a6b9df51a26ccef01d7-0xca732651410e915090d7a7d889a1e44ef4575fce
```

The already-synced Goldsky `v2.5.3` endpoint demonstrates the silent data
error at the same event:

| Value after block 6974169 | Amount |
| --- | ---: |
| On-chain `scaledBalanceOf` | `499988510156526592` |
| Goldsky indexed `scaledBalance` | `999976925185881374` |
| Overstatement | `499988415029354782` |

The incorrect balance persists at the latest indexed block. A new mapping
deployment and full resync are required; changing the mapping cannot repair an
existing immutable deployment in place.

## Historical confirmation

The bug predates the v2.5 refactor. The source corresponding to `v2.0.22` on
`origin/main` and the `v2.1.5` source both load and process the two sides
without checking address equality. The old public Sepolia `v2.0.22` endpoint
currently returns 404, so it could not be queried directly.

The live Goldsky `v2.1.5` endpoint contains another self-transfer proving the
same balance corruption:

| Field | Value |
| --- | --- |
| Block | `7124469` |
| Market | `0xbab3e079d3f28a58a14e316dcb15a8b2cc25ca80` |
| Account | `0xca732651410e915090d7a7d889a1e44ef4575fce` |
| Balance before | `999999086758824878` |
| On-chain balance after | `499999571918197533` |
| Goldsky balance after | `999999086758824878` |
| Indexed scaled transfer amount | `499999514840627345` |

Older releases also used only `<transaction-hash>-<log-index>` for the lender
interest ID, so a normal two-lender transfer could collide as well. V2.5's
lender-scoped ID fixes that separate issue. Do not copy the old transfer
implementation into v2.5.4.

Also preserve the current v2.5 `satSub` implementation. Older branches contain
an unrelated inverted saturation check that has already been fixed on the
v2.5 line.

## Required v2.5.4 behavior

Treat `fromAddress.equals(toAddress)` as a first-class transfer case:

- load the lender once;
- accrue lender interest once;
- leave `scaledBalance` unchanged;
- save the lender and its snapshot once;
- update lender aggregate and daily interest statistics once;
- do not change active-market counts, because the balance is unchanged;
- retain one `Transfer` history entity whose `from` and `to` reference the
  same lender and whose `amount` and `scaledAmount` reflect the emitted event;
- retain the existing single `MarketEvent`; and
- leave all ordinary transfer behavior unchanged.

Prefer an explicit self-transfer branch or a shared single-lender helper over
aliasing two variables and relying on store object identity. The correctness
property is that each lender ID participating in an event is processed exactly
once.

## Regression coverage

Add at least these Matchstick cases:

1. Seed one lender with scaled balance `100` and last scale factor `1.0 RAY`.
   Set the market scale factor to `1.1 RAY`, then emit a self-transfer of `55`
   normalized units (`50` scaled units). Assert:
   - account and snapshot balances remain `100`;
   - `lastScaleFactor` becomes `1.1 RAY`;
   - total interest earned increases once by `10`;
   - exactly one `LenderInterestAccrued` exists for the event and lender;
   - lender and daily interest statistics increase once; and
   - the `Transfer` has the same account for `from` and `to`, amount `55`, and
     scaled amount `50`.
2. Preserve an ordinary A-to-B transfer test. With balances `100` and `40` at
   `1.0 RAY`, move `55` normalized units after changing the scale factor to
   `1.1 RAY`. Assert balances `50` and `90`, two distinct lender-interest
   records, and interest amounts `10` and `4`.
3. Run the complete Matchstick suite and all-network build/config validation.
4. Deploy fresh `v2.5.4` graphs and perform a fixed-block parity query against
   the two historical events above before admitting any provider endpoint to
   the gateway.

## Release steps

1. Implement and test the handler change on the development machine.
2. Set the package/release version and all provider labels to `2.5.4`.
3. Deploy the same build to Hinterlight, Goldsky, and Sentio under new release
   names.
4. Wait for each deployment to reach chain head and verify the fixed-block
   fixtures.
5. Register only the verified `2.5.4` endpoints with the gateway. Keep older
   names available only where backward compatibility requires them.

## Test-harness note for this VPS

No product-code fix was attempted here after the decision to move development
to the other machine. The VPS's cached Node image is Alpine. With the pinned
Graph CLI `0.60.0`, the default Matchstick lookup rejects Alpine's reported
major version, while forcing Matchstick `0.5.4` downloads a glibc-linked binary
that requires `libpq.so.5` and legacy `libssl.so.1.1`. Use the established
development image/toolchain on the other machine rather than changing the
subgraph dependencies merely to accommodate this VPS.
