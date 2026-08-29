import { BigInt } from "@graphprotocol/graph-ts";
import { rayMul } from "./utils";

/**
 * Move the same proportion of basis as scaled market tokens. A full transfer
 * carries all remaining basis so division rounding cannot strand it.
 */
export function getTransferredPrincipalBasis(
  principalBasis: BigInt,
  scaledAmount: BigInt,
  scaledBalance: BigInt
): BigInt {
  if (
    principalBasis.isZero() ||
    scaledAmount.isZero() ||
    scaledBalance.isZero()
  ) {
    return BigInt.zero();
  }
  if (scaledAmount.ge(scaledBalance)) {
    return principalBasis;
  }
  return principalBasis.times(scaledAmount).div(scaledBalance);
}

/**
 * Withdrawals consume accrued interest before principal. Principal therefore
 * changes only when the remaining active position is worth less than its
 * previous basis.
 */
export function getPrincipalBasisAfterWithdrawal(
  principalBasis: BigInt,
  remainingScaledBalance: BigInt,
  scaleFactor: BigInt
): BigInt {
  let remainingBalance = rayMul(remainingScaledBalance, scaleFactor);
  return principalBasis.gt(remainingBalance)
    ? remainingBalance
    : principalBasis;
}
