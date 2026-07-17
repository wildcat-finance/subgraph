import {
  Address,
  BigInt,
  DataSourceContext,
  dataSource,
} from "@graphprotocol/graph-ts";
import { HooksFactory } from "../generated/schema";
import { copyDeploymentContext } from "./deployment-context";

const FACTORY_CONTEXT_PREFIX = "hooksFactory_";

export const CONTEXT_FACTORY_ADDRESS = "factoryAddress";
export const CONTEXT_FACTORY_MARKET_KIND = "factoryMarketKind";
export const CONTEXT_FACTORY_GENERATION = "factoryGeneration";
export const CONTEXT_FACTORY_ABI_FAMILY = "factoryAbiFamily";
export const CONTEXT_HOOKED_MARKET_ABI = "hookedMarketAbi";
export const CONTEXT_TEMPLATE_REGISTRATION = "templateRegistration";
export const CONTEXT_HOOKS_TEMPLATE = "hooksTemplate";
export const CONTEXT_HOOKS_KIND = "hooksKind";

export class ConfiguredHooksFactory {
  marketKind: string;
  generation: string;
  abiFamily: string;
  hookedMarketAbi: string;
  startBlock: BigInt;
  indexed: boolean;
  deploymentTarget: boolean;
  lifecycle: string;
  label: string;
  archController: Address;

  constructor(
    marketKind: string,
    generation: string,
    abiFamily: string,
    hookedMarketAbi: string,
    startBlock: BigInt,
    indexed: boolean,
    deploymentTarget: boolean,
    lifecycle: string,
    label: string,
    archController: Address
  ) {
    this.marketKind = marketKind;
    this.generation = generation;
    this.abiFamily = abiFamily;
    this.hookedMarketAbi = hookedMarketAbi;
    this.startBlock = startBlock;
    this.indexed = indexed;
    this.deploymentTarget = deploymentTarget;
    this.lifecycle = lifecycle;
    this.label = label;
    this.archController = archController;
  }
}

export function configuredHooksFactoryContextKey(address: Address): string {
  return FACTORY_CONTEXT_PREFIX + address.toHexString().slice(2);
}

export function getConfiguredHooksFactory(
  address: Address
): ConfiguredHooksFactory | null {
  let context = dataSource.context();
  let key = configuredHooksFactoryContextKey(address);
  if (!context.isSet(key)) {
    return null;
  }

  let parts = context.getString(key).split("|");
  if (parts.length != 10) {
    return null;
  }

  return new ConfiguredHooksFactory(
    parts[0],
    parts[1],
    parts[2],
    parts[3],
    BigInt.fromString(parts[4]),
    parts[5] == "true",
    parts[6] == "true",
    parts[7],
    parts[8],
    Address.fromString(parts[9])
  );
}

export function createFactoryChildContext(
  factory: HooksFactory
): DataSourceContext {
  let context = new DataSourceContext();
  copyDeploymentContext(context);
  context.setString(CONTEXT_FACTORY_ADDRESS, factory.address.toHexString());
  context.setString(CONTEXT_FACTORY_MARKET_KIND, factory.marketKind);
  context.setString(CONTEXT_FACTORY_GENERATION, factory.generation);
  context.setString(CONTEXT_FACTORY_ABI_FAMILY, factory.abiFamily);
  context.setString(CONTEXT_HOOKED_MARKET_ABI, factory.hookedMarketAbi);
  return context;
}
