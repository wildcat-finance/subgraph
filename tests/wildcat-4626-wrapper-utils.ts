import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import { createMockedFunction, newMockEvent } from "matchstick-as";
import { WrapperDeployed } from "../generated/Wildcat4626WrapperFactory/Wildcat4626WrapperFactory";

export const ARCH_CONTROLLER_ADDRESS = Address.fromString("0x1000000000000000000000000000000000000001");
export const WRAPPER_FACTORY_ADDRESS = Address.fromString("0x2000000000000000000000000000000000000002");
export const MARKET_ADDRESS = Address.fromString("0x4000000000000000000000000000000000000004");
export const WRAPPER_ADDRESS = Address.fromString("0x5000000000000000000000000000000000000005");

export function mockTokenMetadata(address: Address, name: string, symbol: string): void {
  createMockedFunction(address, "name", "name():(string)").returns([ethereum.Value.fromString(name)]);
  createMockedFunction(address, "symbol", "symbol():(string)").returns([ethereum.Value.fromString(symbol)]);
  createMockedFunction(address, "decimals", "decimals():(uint8)").returns([
    ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(6)),
  ]);
  createMockedFunction(address, "isMock", "isMock():(bool)").reverts();
}

export function createWrapperDeployedEvent(market: Address = MARKET_ADDRESS): WrapperDeployed {
  createMockedFunction(WRAPPER_FACTORY_ADDRESS, "archController", "archController():(address)")
    .returns([ethereum.Value.fromAddress(ARCH_CONTROLLER_ADDRESS)]);
  mockTokenMetadata(market, "Market USDC", "mUSDC");
  mockTokenMetadata(WRAPPER_ADDRESS, "Wrapped Market USDC", "v-mUSDC");
  let event = changetype<WrapperDeployed>(newMockEvent());
  event.address = WRAPPER_FACTORY_ADDRESS;
  event.block.number = BigInt.fromI32(24750460);
  event.block.timestamp = BigInt.fromI32(1770000000);
  event.logIndex = BigInt.fromI32(7);
  event.parameters = [
    new ethereum.EventParam("market", ethereum.Value.fromAddress(market)),
    new ethereum.EventParam("wrapper", ethereum.Value.fromAddress(WRAPPER_ADDRESS)),
  ];
  return event;
}
