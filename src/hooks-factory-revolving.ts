import {
  ChangedSpherexEngineAddress as ChangedSpherexEngineAddressEvent,
  ChangedSpherexOperator as ChangedSpherexOperatorEvent,
  HooksInstanceDeployed as HooksInstanceDeployedEvent,
  HooksTemplateAdded as HooksTemplateAddedEvent,
  HooksTemplateDisabled as HooksTemplateDisabledEvent,
  HooksTemplateFeesUpdated as HooksTemplateFeesUpdatedEvent,
  MarketDeployed as MarketDeployedEvent,
} from "../generated/HooksFactoryRevolving/HooksFactory";
import {
  handleHooksInstanceDeployedForMarketType,
  handleHooksTemplateAddedForMarketType,
  handleHooksTemplateDisabledForMarketType,
  handleHooksTemplateFeesUpdatedForMarketType,
  handleMarketDeployedForMarketType,
} from "./hooks-factory";

export function handleChangedSpherexEngineAddress(
  event: ChangedSpherexEngineAddressEvent
): void {}

export function handleChangedSpherexOperator(
  event: ChangedSpherexOperatorEvent
): void {}

export function handleHooksInstanceDeployed(
  event: HooksInstanceDeployedEvent
): void {
  handleHooksInstanceDeployedForMarketType(
    event,
    event.params.hooksInstance,
    event.params.hooksTemplate,
    "Revolving"
  );
}

export function handleHooksTemplateAdded(event: HooksTemplateAddedEvent): void {
  handleHooksTemplateAddedForMarketType(
    event,
    event.params.hooksTemplate,
    event.params.name,
    event.params.feeRecipient,
    event.params.originationFeeAsset,
    event.params.originationFeeAmount,
    event.params.protocolFeeBips,
    "Revolving"
  );
}

export function handleHooksTemplateDisabled(
  event: HooksTemplateDisabledEvent
): void {
  handleHooksTemplateDisabledForMarketType(
    event,
    event.params.hooksTemplate,
    "Revolving"
  );
}

export function handleHooksTemplateFeesUpdated(
  event: HooksTemplateFeesUpdatedEvent
): void {
  handleHooksTemplateFeesUpdatedForMarketType(
    event,
    event.params.hooksTemplate,
    event.params.feeRecipient,
    event.params.originationFeeAsset,
    event.params.originationFeeAmount,
    event.params.protocolFeeBips,
    "Revolving"
  );
}

export function handleMarketDeployed(event: MarketDeployedEvent): void {
  handleMarketDeployedForMarketType(
    event,
    event.params.market,
    event.params.hooks,
    event.params.name,
    event.params.symbol,
    event.params.asset,
    event.params.maxTotalSupply,
    event.params.annualInterestBips,
    event.params.delinquencyFeeBips,
    event.params.withdrawalBatchDuration,
    event.params.reserveRatioBips,
    event.params.delinquencyGracePeriod,
    "Revolving"
  );
}
