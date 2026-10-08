import { Address, log } from "@graphprotocol/graph-ts";
import { IERC20 } from "../generated/HooksFactory/IERC20";

export class TokenMetadata {
  name: string;
  symbol: string;
  decimals: i32;
  isMock: boolean;

  constructor(name: string, symbol: string, decimals: i32, isMock: boolean) {
    this.name = name;
    this.symbol = symbol;
    this.decimals = decimals;
    this.isMock = isMock;
  }
}

export function readTokenMetadata(tokenAddress: Address): TokenMetadata {
  let token = IERC20.bind(tokenAddress);

  let nameResult = token.try_name();
  let name = nameResult.reverted
    ? fallbackTokenName(tokenAddress, "name")
    : nameResult.value;

  let symbolResult = token.try_symbol();
  let symbol = symbolResult.reverted
    ? fallbackTokenSymbol(tokenAddress, "symbol")
    : symbolResult.value;

  let decimalsResult = token.try_decimals();
  let decimals = decimalsResult.reverted
    ? fallbackTokenDecimals(tokenAddress)
    : decimalsResult.value;

  let isMockResult = token.try_isMock();
  let isMock = !isMockResult.reverted && isMockResult.value;

  return new TokenMetadata(name, symbol, decimals, isMock);
}

function fallbackTokenName(tokenAddress: Address, field: string): string {
  log.warning("ERC20 {}() reverted for {}; using fallback token name", [
    field,
    tokenAddress.toHexString(),
  ]);
  return "Unknown Token " + tokenAddress.toHexString();
}

function fallbackTokenSymbol(tokenAddress: Address, field: string): string {
  log.warning("ERC20 {}() reverted for {}; using fallback token symbol", [
    field,
    tokenAddress.toHexString(),
  ]);
  return "UNKNOWN";
}

function fallbackTokenDecimals(tokenAddress: Address): i32 {
  log.warning("ERC20 decimals() reverted for {}; using 18 decimals fallback", [
    tokenAddress.toHexString(),
  ]);
  return 18;
}
