# V2.5.12 subgraph for protocol V2.5.4

This release updates the Sepolia descriptor to the completed protocol V2.5.4
deployment and brings V2.5 transfer and delinquency indexing into line with
the deployed contracts. Compatibility is maintained across protocol families
(V2.0, V2.1, V2.5), not every experimental Sepolia patch.

## Deployment configuration

The canonical Sepolia targets are:

| Component | Address | Start block |
| --- | --- | ---: |
| Standard factory | `0x5ae696F4F1A771799e8d03Dc232C8F843f44417f` | 11652059 |
| Revolving factory | `0x01c3E16434eCd4c76e2ff3a88D1e6Bf82BBda07e` | 11652063 |
| Wrapper factory | `0xA159f68003e37cC77921e5e52F4c0e9A01D66262` | 11652056 |

Both hooks factories register these initcode stores:

- OpenTerm: `0xE8b9D2123b044D3A97a781d9DEcb9aC388ba24eb`.
- FixedTerm: `0x3c3b6BAcBc44c861F198691115B09D352d0DCF25`.
- PeriodicTerm: `0xE8E37B5051905f525c826E77f601540C5F4d8f8c`.

Historical factory sources remain indexed, but only the new standard,
revolving, and wrapper factories are deployment targets. The descriptor has
11 indexed hooks factories, five wrapper factories, and 19 known templates.
The borrower identity registry and access-list provider factory are reused.
Other chain descriptors are unchanged.

Provenance: `v2-protocol/deployments/sepolia/handoff-v2-5-4.json`, SHA-256
`cf0d59928b8413d188b0a430e5603dfd6efb53ffe2e1887fa9a7fd84007533a6`.

After indexing starts, `IndexerDeployment.configDigest` should be
`969c3d4d7fa55a165197b1a47d4aa3f500b54f278b989cc1267926eee71ec4ff`.

## Protocol family and transfer rounding

The market reports `version() == "2.5"` and
`scaledTransferRounding() == keccak256("scaleAmountDown")`. Protocol package
patch numbers are not on-chain compatibility markers. Both deployed V2.5.4
market initcode stores were compared with the current artifacts during recon.

`Market.generation` is configured deployment provenance, inherited from its
factory. Values such as `v2.5.4` must not choose transfer arithmetic. The
`V2_5` event family now uses floor rounding; legacy V2.0/V2.1 mappings retain
half-up rounding. The consumed ABI signatures and tuple shapes are unchanged.

## Delinquency at withdrawal expiry

V2.5.4 reclassifies delinquency after settling an expired withdrawal batch,
using its private asset checkpoint. This may split one transaction into two
different delinquency intervals. A later repayment or raw token donation
must not retroactively fund that checkpoint.

V2.5 indexing therefore uses:

- `InterestAndFeesAccrued.delinquencyFeeRay` to recover charged penalty
  seconds by exactly inverting the protocol's integer linear-rate formula.
- `previousState().timeDelinquent` for the accrual interval ending at the
  indexed block timestamp, and on `StateUpdated`. An earlier expiry-boundary
  accrual retains its event-local clock instead of receiving a later clock.
- The emitted `StateUpdated.isDelinquent` for status changes and counts.
  `isIncurringPenalties` continues to describe whether the clock exceeds the
  grace period, including recovery after the delinquency flag clears.

For V2.5, `MarketInterestAccrued.timeWithPenalties` denotes seconds charged a
delinquency fee. It is zero at a zero fee rate even when the delinquency clock
is advancing. Legacy families retain their existing projected exposure
semantics. No GraphQL fields or types were added or removed.

Contract calls return block-final state. Snapshots containing the stored
clock are marked `EVENT_AND_CONTRACT_CALL`, like existing token-balance
snapshots; they are not transaction-local storage snapshots. Charged penalty
history remains event-derived even if a later closure resets the stored
clock. This adds a stored-state read only to the V2.5 mapping path.

## Validation and deployment

Generate the selected network with `yarn netconfig sepolia`. Validate all
descriptors, generator fixtures, ABI tests, and network builds with
`yarn verify:all-networks`. Run the Matchstick suite in Linux; the existing
Docker test image supports the pinned Matchstick 0.5.0 dependency.

The mapping regressions cover floor rounding independent of deployment
labels, legacy rounding, split expiry accrual, delayed repayment, zero-rate
clocks, same-block state writes, closure, and single-second penalty rounding.

Validation completed for this change:

- `yarn verify:all-networks`: 48 configuration, generator, and ABI tests passed;
  mainnet, plasma-mainnet, plasma-testnet, Sepolia, and the V2.5 compile fixture
  all built successfully.
- Matchstick 0.5.0: all 81 tests across 24 suites passed. AssemblyScript 0.19.23
  compiled the suites under native Node using Matchstick's compiler arguments;
  the pinned Linux runner executed the resulting WASM in Docker.
- `yarn netconfig:check sepolia` confirmed that the selected generated outputs
  were restored correctly. The GraphQL schema AST is unchanged.

Publish a new version and let it reindex before changing consumers:

```sh
yarn deploy:goldsky:sepolia v2.5.12
yarn deploy:hinterlight:sepolia v2.5.12
```

Deployment, sync verification, and the later SDK cutover are operator steps.
