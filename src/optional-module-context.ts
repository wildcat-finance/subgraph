import { BigInt, dataSource } from "@graphprotocol/graph-ts";

export const CONTEXT_MODULE_FACTORY_LABEL = "moduleFactoryLabel";
export const CONTEXT_MODULE_FACTORY_GENERATION = "moduleFactoryGeneration";
export const CONTEXT_MODULE_FACTORY_START_BLOCK = "moduleFactoryStartBlock";
export const CONTEXT_MODULE_FACTORY_INDEXED = "moduleFactoryIndexed";
export const CONTEXT_MODULE_FACTORY_DEPLOYMENT_TARGET =
  "moduleFactoryDeploymentTarget";
export const CONTEXT_MODULE_FACTORY_LIFECYCLE = "moduleFactoryLifecycle";

export class ConfiguredOptionalModuleFactory {
  label: string;
  generation: string;
  startBlock: BigInt;
  indexed: boolean;
  deploymentTarget: boolean;
  lifecycle: string;

  constructor(
    label: string,
    generation: string,
    startBlock: BigInt,
    indexed: boolean,
    deploymentTarget: boolean,
    lifecycle: string
  ) {
    this.label = label;
    this.generation = generation;
    this.startBlock = startBlock;
    this.indexed = indexed;
    this.deploymentTarget = deploymentTarget;
    this.lifecycle = lifecycle;
  }
}

export function getConfiguredOptionalModuleFactory(): ConfiguredOptionalModuleFactory | null {
  let context = dataSource.context();
  if (
    !context.isSet(CONTEXT_MODULE_FACTORY_LABEL) ||
    !context.isSet(CONTEXT_MODULE_FACTORY_GENERATION) ||
    !context.isSet(CONTEXT_MODULE_FACTORY_START_BLOCK) ||
    !context.isSet(CONTEXT_MODULE_FACTORY_INDEXED) ||
    !context.isSet(CONTEXT_MODULE_FACTORY_DEPLOYMENT_TARGET) ||
    !context.isSet(CONTEXT_MODULE_FACTORY_LIFECYCLE)
  ) {
    return null;
  }

  return new ConfiguredOptionalModuleFactory(
    context.getString(CONTEXT_MODULE_FACTORY_LABEL),
    context.getString(CONTEXT_MODULE_FACTORY_GENERATION),
    BigInt.fromString(context.getString(CONTEXT_MODULE_FACTORY_START_BLOCK)),
    context.getString(CONTEXT_MODULE_FACTORY_INDEXED) == "true",
    context.getString(CONTEXT_MODULE_FACTORY_DEPLOYMENT_TARGET) == "true",
    context.getString(CONTEXT_MODULE_FACTORY_LIFECYCLE)
  );
}
