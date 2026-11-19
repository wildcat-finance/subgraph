# Sepolia subgraph v2.5.16

The subgraph selects the v2.5.9 standard, revolving, and wrapper factories for
new deployments. Replay each source from its configured start block to keep
older markets and index the first template registrations on both new hooks
factories. [Finalized addresses and deployment blocks](https://github.com/wildcat-finance/v2-protocol/blob/962a08d0c1f7071fc65b0427d9ed4a30a73c2a07/deployments/sepolia/handoff-v2.5.9.json)

| Source | Address | Start block |
|---|---|---:|
| Standard hooks factory | `0xE967A79399C3C4dE66F0d66B3B2656e1C63C8B47` | 12170120 |
| Revolving hooks factory | `0x9d3E40508f9c9148e8529fbd81fCA75Ed4dCf13e` | 12170126 |
| ERC-4626 wrapper factory | `0xF45bf6d89A34003226EbE388B0291798F534dE9F` | 12170117 |
| Shared KYC provider | `0x231ee08A700DdAe6FeD989D797BCa1e18f198aA8` | 12170140 |

The Sepolia config lists the new OpenTerm, FixedTerm, and PeriodicTerm initcode
addresses. The subgraph uses them to identify each template when either hooks
factory registers it.

## Historical coverage

At finalized block **12170273**, all 347 retained market addresses and 37 wrapper
addresses matched `sepolia/v2.5.15` on both Goldsky and Hinterlight.
The block hash was `0x844308fd1b894563014e6536072b7f60327fdfe6eba7648f897952528ebec836`.

The archive scan started at block 4796511. For each previously indexed hooks
factory, the ArchController's `MarketAdded` logs and the factory's
`MarketDeployed` logs agreed on every market address. The wrapper check covered
`WrapperDeployed` on each factory, including the July preview, and
`wrapperFactory()` on markets that expose it.

- Twelve older hooks factories deployed those 347 markets. Each keeps its
  original start block. The v2.5.7 standard factory deployed one market and
  the revolving factory deployed two.
- The v2.5.4 revolving factory and both v2.5.5 hooks factories deployed no
  markets. All three stay in the inventory with `indexed: false`.
- Six older wrapper factories deployed all 37 wrappers. The v2.5.5 wrapper
  factory deployed none, and no market in the inventory pointed to it.
  The v1 factory stays indexed because v2.5.9 delegates some deployments to it.
- v2.5.15 already excluded four retired test factories with five market
  registrations between them. These were the April 19 revolving preview and
  the August, September, and November 2024 test factories.

The protocol handoff includes live factories with zero deployments. Before
publishing, check for `MarketAdded` logs naming the three omitted hooks
factories and `WrapperDeployed` logs from the omitted wrapper factory after
block 12170273. Keep checking until they retire onchain. If one deploys, enable
its source from its original start block. When retiring a factory with existing
markets, keep its source indexed from the same block.

## Indexed events

The KYC constructor emits no event. A handler runs once at deployment to
record the block, transaction hash, and initial administrator on the shared
`RoleProviderInstance` (kind `KYC`). The provider uses the same membership
and two-step administrator transfer events as an access list.
For an enrolled wallet, `RoleProviderMember.updatedAtTimestamp` gives its
latest enrollment time. `RoleProviderMembershipChange` keeps the history
across removal and re-enrollment.

`NukeProtectionFactoryApproval` tracks whether a feature factory can request
protection on a hooks factory's markets. Its change history records grants and
revocations. Each successful `NukeProtectionRequest` names the feature factory,
market, and account. A `NukeProtectionRegistered` event creates a
`NukeProtectionRegistration` record and a `NUKE_PROTECTION_REGISTERED` entry
in the market timeline. Revoking factory approval leaves registered accounts
protected.

## Local verification

The 52 configuration and tooling tests and 94 Matchstick tests passed.
All four networks and the v2.5 fixture compiled. The ABI check matched 318
event and function signatures against the v2.5.9 deployment artifacts.
The schema retains all 1,913 existing fields and 127 enum values.

## Hosted verification

After deploying `sepolia/v2.5.16` on each host, check the following against
the [ceremony receipts](https://github.com/wildcat-finance/v2-protocol/blob/962a08d0c1f7071fc65b0427d9ed4a30a73c2a07/deployments/sepolia/receipts-v2.5.9.json).

1. Check that the endpoint has caught up to Sepolia and `_meta.hasIndexingErrors`
   is `false`. The expected `configDigest` for `IndexerDeployment` ID `deployment`
   is `fdc39cf6a8663040efa74c527e38358bc5c5d70d8359bdcd1acf04eab2894818`.
2. Check both new hooks factories are registered, indexed, and selected for
   deployment. Each should show three enabled template registrations with their
   initcode hashes and an approval for the new wrapper factory.
3. Look up the KYC provider by its lowercase address at deployment block
   12170140. The record should exist before the first enrollment, with
   administrator `0xCa7007a75296b532Ce1606d9e130eAa849800Ca7`.
4. Compare the retained market and wrapper IDs at block 12170273 with
   `sepolia/v2.5.15` before switching consumers.
