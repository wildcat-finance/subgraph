import { Address } from "@graphprotocol/graph-ts";

export function generateBorrowerAccountId(
  registryId: string,
  account: Address
): string {
  return registryId.concat("-").concat(account.toHexString());
}
