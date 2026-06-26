import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import {
  handleHooksInstanceDeployedForMarketType,
  handleHooksTemplateAddedForMarketType,
  handleHooksTemplateDisabledForMarketType,
  handleHooksTemplateFeesUpdatedForMarketType,
  handleMarketDeployedForMarketType,
} from "./hooks-factory";

const REVOLVING_MARKET_TYPE = "Revolving";

const HOOKS_INSTANCE_DEPLOYED_HOOKS_INSTANCE = 0;
const HOOKS_INSTANCE_DEPLOYED_HOOKS_TEMPLATE = 1;

const HOOKS_TEMPLATE_ADDED_HOOKS_TEMPLATE = 0;
const HOOKS_TEMPLATE_ADDED_NAME = 1;
const HOOKS_TEMPLATE_ADDED_FEE_RECIPIENT = 2;
const HOOKS_TEMPLATE_ADDED_ORIGINATION_FEE_ASSET = 3;
const HOOKS_TEMPLATE_ADDED_ORIGINATION_FEE_AMOUNT = 4;
const HOOKS_TEMPLATE_ADDED_PROTOCOL_FEE_BIPS = 5;

const HOOKS_TEMPLATE_DISABLED_HOOKS_TEMPLATE = 0;

const HOOKS_TEMPLATE_FEES_UPDATED_HOOKS_TEMPLATE = 0;
const HOOKS_TEMPLATE_FEES_UPDATED_FEE_RECIPIENT = 1;
const HOOKS_TEMPLATE_FEES_UPDATED_ORIGINATION_FEE_ASSET = 2;
const HOOKS_TEMPLATE_FEES_UPDATED_ORIGINATION_FEE_AMOUNT = 3;
const HOOKS_TEMPLATE_FEES_UPDATED_PROTOCOL_FEE_BIPS = 4;

const MARKET_DEPLOYED_MARKET = 1;
const MARKET_DEPLOYED_NAME = 2;
const MARKET_DEPLOYED_SYMBOL = 3;
const MARKET_DEPLOYED_ASSET = 4;
const MARKET_DEPLOYED_MAX_TOTAL_SUPPLY = 5;
const MARKET_DEPLOYED_ANNUAL_INTEREST_BIPS = 6;
const MARKET_DEPLOYED_DELINQUENCY_FEE_BIPS = 7;
const MARKET_DEPLOYED_WITHDRAWAL_BATCH_DURATION = 8;
const MARKET_DEPLOYED_RESERVE_RATIO_BIPS = 9;
const MARKET_DEPLOYED_DELINQUENCY_GRACE_PERIOD = 10;
const MARKET_DEPLOYED_HOOKS_CONFIG = 11;

// Decode by ABI index so this one mapping can serve any revolving factory data source name.
function addressParam(event: ethereum.Event, index: i32): Address {
  return event.parameters[index].value.toAddress();
}

function bigIntParam(event: ethereum.Event, index: i32): BigInt {
  return event.parameters[index].value.toBigInt();
}

function i32Param(event: ethereum.Event, index: i32): i32 {
  return event.parameters[index].value.toI32();
}

function stringParam(event: ethereum.Event, index: i32): string {
  return event.parameters[index].value.toString();
}

export function handleChangedSpherexEngineAddress(
  event: ethereum.Event
): void {}

export function handleChangedSpherexOperator(
  event: ethereum.Event
): void {}

export function handleHooksInstanceDeployed(
  event: ethereum.Event
): void {
  handleHooksInstanceDeployedForMarketType(
    event,
    addressParam(event, HOOKS_INSTANCE_DEPLOYED_HOOKS_INSTANCE),
    addressParam(event, HOOKS_INSTANCE_DEPLOYED_HOOKS_TEMPLATE),
    REVOLVING_MARKET_TYPE
  );
}

export function handleHooksTemplateAdded(event: ethereum.Event): void {
  handleHooksTemplateAddedForMarketType(
    event,
    addressParam(event, HOOKS_TEMPLATE_ADDED_HOOKS_TEMPLATE),
    stringParam(event, HOOKS_TEMPLATE_ADDED_NAME),
    addressParam(event, HOOKS_TEMPLATE_ADDED_FEE_RECIPIENT),
    addressParam(event, HOOKS_TEMPLATE_ADDED_ORIGINATION_FEE_ASSET),
    bigIntParam(event, HOOKS_TEMPLATE_ADDED_ORIGINATION_FEE_AMOUNT),
    i32Param(event, HOOKS_TEMPLATE_ADDED_PROTOCOL_FEE_BIPS),
    REVOLVING_MARKET_TYPE
  );
}

export function handleHooksTemplateDisabled(
  event: ethereum.Event
): void {
  handleHooksTemplateDisabledForMarketType(
    event,
    addressParam(event, HOOKS_TEMPLATE_DISABLED_HOOKS_TEMPLATE),
    REVOLVING_MARKET_TYPE
  );
}

export function handleHooksTemplateFeesUpdated(
  event: ethereum.Event
): void {
  handleHooksTemplateFeesUpdatedForMarketType(
    event,
    addressParam(event, HOOKS_TEMPLATE_FEES_UPDATED_HOOKS_TEMPLATE),
    addressParam(event, HOOKS_TEMPLATE_FEES_UPDATED_FEE_RECIPIENT),
    addressParam(event, HOOKS_TEMPLATE_FEES_UPDATED_ORIGINATION_FEE_ASSET),
    bigIntParam(event, HOOKS_TEMPLATE_FEES_UPDATED_ORIGINATION_FEE_AMOUNT),
    i32Param(event, HOOKS_TEMPLATE_FEES_UPDATED_PROTOCOL_FEE_BIPS),
    REVOLVING_MARKET_TYPE
  );
}

export function handleMarketDeployed(event: ethereum.Event): void {
  handleMarketDeployedForMarketType(
    event,
    addressParam(event, MARKET_DEPLOYED_MARKET),
    bigIntParam(event, MARKET_DEPLOYED_HOOKS_CONFIG),
    stringParam(event, MARKET_DEPLOYED_NAME),
    stringParam(event, MARKET_DEPLOYED_SYMBOL),
    addressParam(event, MARKET_DEPLOYED_ASSET),
    bigIntParam(event, MARKET_DEPLOYED_MAX_TOTAL_SUPPLY),
    bigIntParam(event, MARKET_DEPLOYED_ANNUAL_INTEREST_BIPS),
    bigIntParam(event, MARKET_DEPLOYED_DELINQUENCY_FEE_BIPS),
    bigIntParam(event, MARKET_DEPLOYED_WITHDRAWAL_BATCH_DURATION),
    bigIntParam(event, MARKET_DEPLOYED_RESERVE_RATIO_BIPS),
    bigIntParam(event, MARKET_DEPLOYED_DELINQUENCY_GRACE_PERIOD),
    REVOLVING_MARKET_TYPE
  );
}
