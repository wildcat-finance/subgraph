# v2.5.9 event and identity model

Status: v2.5.9 introduced the current event model. Its original Sepolia factory
set has been superseded by the v2.5.10 rotation documented in
`docs/V2_5_10_SEPOLIA_ROTATION.md`.

## What this pass changes

v2.5.9 gives the hard-cut v2.5 contracts their own event-generation path instead of trying to decode them through the legacy factory, hook, and market ABIs. The selected ABI family owns that choice. Package versions, branch names, factory labels, and deployment tags do not.

Legacy factories keep their existing mappings and contract-call fallbacks. New v2.5 factories use event-driven mappings for borrower identity, hook administration, reusable role providers, deployment configuration, borrower transfers, wrapper registration, and revolving drawn principal.

## Market deployment bundle

The v2.5 factory emits a `MarketDeployed` event followed by the companion configuration events. `MarketDeployed` creates temporary assembly state, and the market is finalized once every event required by its market kind has arrived.

- Standard markets require `MarketDeploymentConfig` and `MarketHooksData`.
- Revolving markets also require `RevolvingMarketDeployed`.
- The companion events may arrive in either order. The protocol still emits `MarketDeployed` first.
- Market creation coordinates come from `MarketDeployed`, not whichever companion event happens to complete the bundle.
- The temporary `PendingMarketDeployment` entity is removed after finalization.

The deployment events carry the market terms, origination fee, requested and final hook flags, raw hook data, commitment fee, operational borrower, and legal principal. This removes the historical RPC reads that would otherwise be required to construct a new v2.5 market.

## Protocol event contract

The subgraph expects `MarketDeployed` to include the market's immutable borrower identity registry:

```solidity
event MarketDeployed(
  address indexed hooksTemplate,
  address indexed hooksInstance,
  address indexed market,
  address borrower,
  address borrowerPrincipal,
  address borrowerIdentityRegistry,
  string name,
  string symbol,
  address asset,
  HooksConfig requestedHooks,
  HooksConfig hooks
);
```

The protocol source in `../v2-protocol/src/IHooksFactory.sol` includes that field. Both factory emitters use the same immutable registry address that is installed on the market. The event entry in `abis/v2.5/HooksFactory.json` matches the reviewed deploy-profile artifacts for both factories.

The registry cannot be reconstructed from events for a direct-principal market without this field. Inferring it from an account works only for account-owned markets, and an archival factory call would violate the event-only reindex requirement. The final Sepolia factories include the field.

## Borrower identity

The data model keeps the operational borrower, legal principal, and immutable market registry separate.

- `Market.borrower` is the address that can execute borrower-only market calls.
- `Market.borrowerPrincipal` and `Market.borrowerProfile` identify the legal principal used for borrower analytics and sanctions-facing identity.
- `Market.borrowerIdentityRegistry` never changes during borrower transfer.
- `Market.borrowerAccount` is set only when the operational borrower is indexed as an account under that market's registry.
- Borrower-account IDs are scoped as `<registry>-<account>`, so a later registry generation cannot overwrite an older association at the same account address.

Account principal migration and market borrower transfer remain separate histories. Changing `A(P)` to `A(Q)` in the registry does not silently rewrite a market. The account must explicitly accept a same-address market transfer before that market changes its stored principal from `P` to `Q`.

Current and active market counts move between principals when a borrower transfer is accepted. Historical borrowed, repaid, deposit, withdrawal, interest, and fee aggregates are not retroactively reassigned. New activity accrues to the accepted principal. We should confirm that historical attribution is the SDK and analytics behavior we want before publishing the 3.2.x types.

## Hooks and reusable role providers

Hook administration and credential-provider administration remain separate because either component may be shared.

- `HooksInstance` records its administrator, pending administrator, deployer, template version, factory generation, and immutable transfer history.
- `RoleProviderInstance` represents one reusable provider contract and owns provider-level administrator and membership history.
- `RoleProvider` remains the hook-specific attachment. Its TTL, pull and push indexes, approval state, and lifecycle belong to the hook relationship rather than the reusable provider.
- `HooksInstanceRoleProviderSnapshot` preserves the provider arrays reported by the factory when the hook is deployed, including the case where metadata is unavailable.
- The access-list provider factory event carries initial members because constructor membership events occur before the dynamic provider data source exists.

Sharing one provider across several hooks therefore creates one provider instance and several independent hook attachments. Moving one hook administrator does not move the provider or any other hook.

## Market history

The v2.5 market mapping records borrower transfer requests, cancellations, and acceptances with both operational and principal addresses. It also records caller and previous/new values for mutable configuration events that previously forced consumers to infer context.

`Borrow` and `DrawnAmountUpdated` are intentionally independent. A revolving draw after over-repayment may transfer 400 assets while drawn principal only moves from 0 to 200. Both facts remain queryable, and v2.5 drawn principal is projected from events instead of refreshed through a market call after every event.

Wrapper registration is also first-class market history. The wrapper factory remains the source for wrapper deployment details.

## Configuration and mixed generations

`config/abi-families.json` marks each hooks-factory ABI family as `LEGACY` or `V2_5`. Chain descriptors list borrower identity registries and role-provider factories independently from market factories.

The July Sepolia preview factories remain `LEGACY` because they use the old event ABI and still have indexed test markets. The final standard and revolving factories use `V2_5`; both generations coexist in the same manifest. `verify:all-networks` still builds a synthetic v2.5 fixture so every supported role-provider factory remains compile-checked even when it is not deployed.

When legacy and v2.5 factories coexist in one manifest, a legacy standard factory keeps the generated `HooksFactory` type anchor. The new canonical standard factory receives its own manifest name. This avoids changing generated legacy imports merely because deployment eligibility moved to a new ABI generation.

## Verification

```sh
yarn netconfig sepolia
yarn test:config
yarn build
yarn verify:all-networks
yarn test -d
```

Matchstick does not run natively through the pinned Graph CLI on Apple Silicon. `yarn test -d` uses the existing linux/amd64 Docker image under emulation and must be run from a terminal with a TTY.

## Original Sepolia handoff

The v2.5.9 Sepolia descriptor was pinned to:

- standard factory `0xbFbDaFc91977eE599a61B30D9e75788565Ad6d18` from block `11559133`;
- revolving factory `0x190B42942fe9492df9CeA441dA5c43309840E93A` from block `11559137`;
- wrapper factory `0x6B1DD93453584346C530A1646e98aB306fD6D37C` from block `11559124`;
- borrower identity registry `0xc2cF90781595203D1e75c28246b306C95d4b8b21` from block `11559126`; and
- access-list role-provider factory `0x92995EA2ba572E4Cb8bB41E30f813BeB77FD4974` from block `11559128`.

The source is the live evidence packet `v2-5-sepolia-live-20260824T194947Z.tar.gz`, SHA-256 `8d8464612987074b151b8cb66451298962431ee24b2dd5b19757057318eb34ad`. SDK 3.2.4 integration is the downstream consumer; deployment and publication remain coordinated release steps.
