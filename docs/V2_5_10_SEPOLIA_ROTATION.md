# v2.5.10 Sepolia factory rotation

Status: configured for the Sepolia protocol v2.5.3 deployment completed on
2026-08-27.

## Scope

This release rotates deployment and indexing configuration. It does not change
the schema, mappings, or event model introduced in v2.5.9.

The checked-in v2.5 factory, market, revolving-market, and combined-hooks ABIs
match the deployed protocol artifacts. The wrapper factory event and function
selectors are also unchanged.

## Canonical deployment targets

- Standard factory: `0x89797b782cA5b4BBFC975146B98ba3941Fe26C56`,
  block `11581361`.
- Revolving factory: `0xb3FBD4FBeb1EE4BEE7afdbC4A75C7c4E97CF105C`,
  block `11581363`.
- ERC-4626 wrapper factory: `0x31D8D5564Ce11f764E74beca5B4e8d363046949f`,
  block `11581359`.

The replacement factories use the existing borrower identity registry and
access-list role-provider factory. The replacement OpenTerm, FixedTerm, and
PeriodicTerm init-code stores are included in `hooksTemplates`.

## Historical indexing

The immediately preceding v2.5 standard, revolving, and wrapper factories
remain active and indexed. They are no longer deployment targets. Earlier
indexed generations are also retained. The four intentionally excluded test or
retired factories remain `indexed: false`.

Registration, deployment eligibility, and indexing are independent. A factory
rotation must not erase markets deployed by an older generation.

## Provenance

The Sepolia descriptor is pinned to
`v2-protocol/deployments/sepolia/handoff-v2-5-sepolia-fix-1.json`, SHA-256
`5c0a38d145152e79b0333161fa8644c820659be0776eb19129b735a594a54f9a`.

The protocol handoff also contains the replacement lens addresses. The
subgraph does not call the lens, so those addresses do not belong in the chain
descriptor.
