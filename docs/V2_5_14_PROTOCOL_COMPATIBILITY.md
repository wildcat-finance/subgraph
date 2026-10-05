# V2.5.14: Sepolia V2.5.6 hook templates

Prepared on 2026-10-04 from subgraph `release/v2.5.13` at
`1479482787c2ebe4635ce0fc7106a718a85d38b9`. This release adds the three Sepolia
V2.5.6 hook template addresses to configuration. Mappings, schema, and consumed
ABIs are unchanged from [V2.5.13](./V2_5_13_PROTOCOL_COMPATIBILITY.md).

## Why configuration changes

Protocol contract source `fe431bbdfc157b8778ac3690772c6556c74a0a9d` adds
repayment-date guards and makes the maximum-supply callback mandatory for the
three built-in hooks. Compared with the V2.5.13 protocol source pin
`05165ad4c4020c1400048680b85b3585f84e8527`, event signatures and consumed read
interfaces are unchanged. The new `MarketInRepayment` custom error requires no
subgraph event handler.

The new template addresses store initcode; they cannot answer `version()`.
V2.5.13 can classify them when a `HooksInstanceDeployed` event supplies the
version, but registration before that can produce an `Unknown` template and
an `UNKNOWN_HOOKS_TEMPLATE` diagnostic. Configured address/type pairs classify
them from their first registration on either factory.

This matters to consumers: `wildcat.ts` at
`e64e7668691c0e92ff90bb4d748c71a4556c5ee0` filters unknown template kinds in
`getAllHooksTemplates` and `getAllHooksDataForBorrower`. No query or schema
migration is needed for this release.

## Deployment evidence and retained history

The descriptor's provenance points to the finalized
[V2.5.6 template update](https://github.com/wildcat-finance/v2-protocol/blob/71a65ff3710794642d9759d3ba05f16708939e85/deployments/sepolia/template-update-v2.5.6.json),
SHA-256 `e102f1ccc2a620d4881991fbc4ca886bc844d482a197c6db10028c5dc4bb3b24`.
Its recorded verification is 2026-10-04 at block 11841012. This is the
receipt-backed ceremony handoff; preparation of this subgraph release did not
repeat live RPC verification.

| Template kind | V2.5.6 address |
| --- | --- |
| OpenTerm | `0xBcA425d384Da256040779DF532B6D2E8d3B3f1aD` |
| FixedTerm | `0xa3FE06137cc893E19C2E4764a4A7b001E988ba2B` |
| PeriodicTerm | `0x79DA352868305d37D0179f460Ded88886D4eE524` |

The update pins the V2.5.5 base handoff, which retains authority for every
other deployment and indexing policy. Both existing hooks factories and the
wrapper factory retain their addresses, V2.5.5 generation labels, and original
start blocks. All 22 previous template identities remain configured, bringing
the total to 25. Existing handlers record the six new registrations and their
initcode commitments, and disable the six predecessor registrations while
preserving their history and existing hook instances. Other chain descriptors
are unchanged.

## Release checks and deployment

```sh
yarn netconfig sepolia
yarn verify:all-networks
yarn netconfig:check sepolia
yarn check:protocol-abis ../v2-protocol/deploy-out
```

The ABI comparison verified 290 consumed event/function wire formats. Metadata
for all 19 compared protocol artifacts matched 89 protocol source files at the
contract source pin above. The three hook creation-code hashes also matched the
commitments in the finalized template update. Both handoff digests, template
context on both current factories, and preservation of prior configuration
were checked against the pinned V2.5.13 baseline.

All 51 configuration/generator/ABI tests passed. Code generation and builds
passed for mainnet, plasma-mainnet, plasma-testnet, sepolia, and the V2.5 compile
fixture. The selected Sepolia outputs passed `netconfig:check` after the build
matrix restored them; `git diff --check` also passed.

Publish using the commands in the [deployment guide](../README.md), with
`v2.5.14` as the version label. Use a fresh replay from the existing manifest
start blocks so classification applies to the original registration events.
After indexing passes block 11841003, verify all six new registrations are
enabled, have their expected template kinds and initcode hashes, and all six
predecessor registrations are disabled. Check `_meta.hasIndexingErrors` is
false and indexing has caught up before switching consumers.

Hosted compatibility checks completed on 2026-10-04 against Hinterlight,
Goldsky, and the gateway. The expected configuration, new registrations,
initcode commitments, and predecessor disables passed the SDK checks. See the
SDK's 3.2.14-beta verification and consumer migration notes
(`wildcat.ts/docs/releases/3.2.14-beta.md`) for the tested scope. Consumer adoption
remains a separate release step; the
older SDK source pin in the classification discussion above is historical.

The combined protocol/SDK inventory gate did not complete:
`validate-factory-inventory.js --network sepolia --subgraph-dir ../subgraph`
reported `SDK constants do not contain deployment block for chain 11155111`.
It reads the old `src/constants.ts` layout; the inspected SDK uses
`src/config/deployments.ts` and the renamed `HooksFactoryStandard` key. The
direct subgraph/handoff checks above passed, but the combined gate needs
reconciliation during the SDK update.
