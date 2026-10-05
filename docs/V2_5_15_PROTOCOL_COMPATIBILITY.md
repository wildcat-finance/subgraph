# V2.5.15: Sepolia V2.5.7 factories

Prepared on 2026-10-05 from subgraph `release/v2.5.14` at
`6f4539af0c2b9526278a68bd93e28f5ae55d36ab`, on branch `release/v2.5.15`.
This release indexes the new standard, revolving, and ERC4626 wrapper factories
deployed by protocol V2.5.7. Package version and deployment label are
`2.5.15` / `v2.5.15`.

## Protocol compatibility

Protocol contract source `85b963d767ac295bfff32f6e69d734dd616da248` adds a
sanctions check on the caller of `transferFrom` in market tokens and ERC4626
wrapper shares. Compared with the V2.5.14 contract source pin
`fe431bbdfc157b8778ac3690772c6556c74a0a9d`, the consumed event and read interfaces
are unchanged. Existing transfer handlers remain applicable. No schema,
mapping, ABI, dependency, or consumer query changes are required by this patch.

The market and wrapper bytecode changes required replacement factories. Their
events need new static sources even though they use the existing `hooks-v2-5`
ABI family. Lens replacements are consumed by the SDK, not indexed here.

## Finalized deployment handoff

Addresses and start blocks come from the committed
[V2.5.7 handoff](https://github.com/wildcat-finance/v2-protocol/blob/54e848180e67836969273a17cd117de7fc89ab53/deployments/sepolia/handoff-v2.5.7.json),
SHA-256 `fade102764b41984ab3d49c193d3d32c5489eaa595863d433225b1deb3114101`.
The protocol evidence commit is `54e848180e67836969273a17cd117de7fc89ab53`
on `feat/sepolia-v2.5.6`; the branch name predates this deployment.

| New event source | Address | Receipt block |
| --- | --- | ---: |
| Standard hooks factory | `0xae525051d16912D13b63eCa01f52ADF576FC4380` | 11845725 |
| Revolving hooks factory | `0x2f0E18ae9134cD16b7Ec0C63cC4B11B38eAdB2aF` | 11845732 |
| Wrapper factory | `0xCf2338947eeE38b7D82E187698339B3E67E67CBf` | 11845719 |

The protocol's
[final evidence ZIP](https://github.com/wildcat-finance/v2-protocol/blob/54e848180e67836969273a17cd117de7fc89ab53/deployments/sepolia/ceremony-evidence/wildcat-v2.5.7-evidence-20261005T012905684517Z.zip)
has SHA-256 `9491405cd3953913d1877df308bced454a6d10273c44a5250aecdd78544f3809`.
Its checksum and per-file hashes passed, and the archived handoff, inventory,
and deployment aliases match the checked-out records byte for byte. It retains
the green live activation at block 11845761 and the green inventory
reconciliation. Activation block hash:
`0xe6f1ce5a6bbe2630a288bb0f25b5d700db6fdd48e7623690d15db963adf533a2`.

Read-only Sepolia checks on 2026-10-05 independently confirmed chain 11155111,
that activation block hash, and the three successful deployment receipts,
contract addresses, start blocks, and code presence at the activation block.
This consumer preparation did not repeat the full protocol ceremony verifier.

## Configuration and retained history

Only the V2.5.7 standard, revolving, and wrapper factories are selected as
deployment targets and compatibility aliases. The three V2.5.5 predecessors
remain active and indexed with their original start blocks. This is a consumer
selection change; it does not deregister any factory on chain.

All 25 protocol factory-inventory records match by address, block, indexing
policy, lifecycle, and canonical selection. The extra July preview wrapper
source remains configured as before; it is referenced by the preview hooks
factories but has no standalone inventory row. Sepolia now has 19 configured
hooks factories, of which 15 are indexed, and seven indexed wrapper factories.
The four previously excluded hooks factories remain excluded.

All 25 hook-template identities are retained. The new factories reuse the
three [V2.5.6 hook stores](./V2_5_14_PROTOCOL_COMPATIBILITY.md), so their six
registrations can be classified from the first event. The identity registry,
AccessList factories, anchors, collateral, and other chain descriptors retain
their existing configuration. The source comparison preserved every prior
factory record except its deployment-target flag where superseded.

Expected Sepolia `IndexerDeployment.configDigest`:
`f1814d20789e9e33cce9448e2a2a4c10cb24d3b6dc22ac0f11f0a950d644b081`.

## Verification

- Configuration validation and all 51 configuration/generator/ABI/deployment
  tests passed.
- `yarn check:protocol-abis ../v2-protocol/deploy-out` verified all 290 consumed
  event/function wire formats. Metadata for the 19 compared deploy-profile
  artifacts matched 89 protocol source files at the contract source pin above.
- Code generation and builds passed for mainnet, plasma-mainnet, plasma-testnet,
  Sepolia, and the V2.5 compile fixture. The restored Sepolia outputs passed
  `yarn netconfig:check sepolia`; `git diff --check` passed.
- The generated manifest grows from 25 to 28 static sources. Every predecessor
  source retains its address, start block, and mapping, and the dynamic
  templates are unchanged.
- The handoff comparison preserved all previous source addresses, start blocks,
  indexing flags, template identities, and other chain descriptors. Schema,
  mappings, ABI files, and the dependency lockfile are unchanged.

The configuration checks and build matrix cover this release's wiring changes.
The unchanged Matchstick mapping suite was not rerun; hosted replay and consumer
acceptance remain pending.

## Deployment and consumer handoff

The operator runs these from the subgraph repository using the existing
[provider setup](../README.md):

```sh
yarn deploy:goldsky:sepolia v2.5.15
yarn deploy:hinterlight:sepolia v2.5.15
```

Use a fresh replay from the configured start blocks. After each endpoint has
indexed past activation block 11845761, check the expected configuration digest,
both new factory identities and registration state, and the six enabled
OpenTerm/FixedTerm/PeriodicTerm registrations with the initcode commitments in
the finalized activation evidence. Confirm predecessor factories and markets
remain indexed. Wrapper indexing can be exercised when a wrapper is created
through the new factory. Wait for `_meta.hasIndexingErrors` to remain false and
the index to catch up to Sepolia before switching consumers.

Hosted deployment and synchronization of V2.5.15 are not yet established.
Add the new provider routes to the data gateway inventory after deployment.
The SDK follow-up must adopt the receipt-backed V2.5.7 factories, wrapper and
lens, retain recognition of the older factories, and select the V2.5.15 route.
The inspected SDK `release/v3.2.16-beta` at
`8efc853df6d1aeb6ff0d21251920b930e81eec6e` still selects the V2.5.5 factories
and V2.5.14 route. The app's completed lifecycle controls are on
`feat/v2.5-market-lifecycle-controls` at
`da13712b5802917410dbafe764dfd272527268fe`; carry them forward with the next SDK
update. These are source observations, not evidence of hosted app adoption.

The combined protocol/subgraph/SDK inventory gate remains a separate follow-up:
its existing SDK parser expects the old constants layout, as recorded in the
[V2.5.14 notes](./V2_5_14_PROTOCOL_COMPATIBILITY.md). This preparation checked the
subgraph directly against the finalized handoff; it does not establish SDK or
app adoption of the new deployment.
