import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import { CombinedHooks } from "../generated/HooksFactory/CombinedHooks";
import {
  HooksFactory,
  HooksTemplate,
  HooksTemplateRegistration,
  HooksTemplateRegistrationEvent,
} from "../generated/schema";
import { recordIndexerDiagnostic } from "./indexer-diagnostics";
import { generateEventId } from "./utils";
import { getConfiguredHooksTemplate } from "./factory-context";

export function generateHooksTemplateId(template: Address): string {
  return template.toHexString();
}

export function generateHooksTemplateRegistrationId(
  factory: Address,
  template: Address
): string {
  return factory.toHexString() + "-" + template.toHexString();
}

function hooksKindForVersion(version: string): string {
  if (version == "OpenTermHooks") return "OpenTerm";
  if (version == "FixedTermHooks") return "FixedTerm";
  if (version == "PeriodicTermHooks") return "PeriodicTerm";
  return "Unknown";
}

export function getOrCreateHooksTemplate(
  event: ethereum.Event,
  address: Address,
  abiFamily: string
): HooksTemplate {
  let id = generateHooksTemplateId(address);
  let template = HooksTemplate.load(id);
  let isNew = template == null;
  if (template != null && template.abiFamily != abiFamily) {
    recordIndexerDiagnostic(
      event,
      "TEMPLATE_ABI_FAMILY_CONFLICT",
      "Hooks template was observed through conflicting ABI families: " +
        template.abiFamily +
        " and " +
        abiFamily,
      address
    );
  }
  let configuredTemplate = getConfiguredHooksTemplate(address);
  let version = "Unknown";
  let kind = "Unknown";
  if (configuredTemplate != null) {
    version = configuredTemplate.version;
    kind = configuredTemplate.kind;
  } else {
    let versionResult = CombinedHooks.bind(address).try_version();
    if (template != null && versionResult.reverted) {
      return template;
    }
    version = versionResult.reverted ? "Unknown" : versionResult.value;
    kind = hooksKindForVersion(version);
  }

  if (template == null) {
    template = new HooksTemplate(id);
    template.address = address;
    template.abiFamily = abiFamily;
  }
  if (isNew || template.kind == "Unknown" || kind != "Unknown") {
    template.version = version;
    template.kind = kind;
  }
  template.save();

  if (kind == "Unknown") {
    recordIndexerDiagnostic(
      event,
      "UNKNOWN_HOOKS_TEMPLATE",
      "Hooks template version could not be classified: " + version,
      address
    );
  }
  return template;
}

function stampRegistration(
  registration: HooksTemplateRegistration,
  event: ethereum.Event,
  isNew: boolean
): void {
  if (isNew) {
    registration.createdAtBlock = event.block.number;
    registration.createdAtTimestamp = event.block.timestamp;
    registration.createdAtTransaction = event.transaction.hash;
    registration.createdAtLogIndex = event.logIndex;
  }
  registration.updatedAtBlock = event.block.number;
  registration.updatedAtTimestamp = event.block.timestamp;
  registration.updatedAtTransaction = event.transaction.hash;
  registration.updatedAtLogIndex = event.logIndex;
}

export function createTemplateRegistration(
  event: ethereum.Event,
  factory: HooksFactory,
  template: HooksTemplate,
  name: string,
  feeRecipient: Address,
  originationFeeAsset: string | null,
  originationFeeAmount: BigInt,
  protocolFeeBips: i32
): HooksTemplateRegistration {
  let id = generateHooksTemplateRegistrationId(
    Address.fromBytes(factory.address),
    Address.fromBytes(template.address)
  );
  let registration = HooksTemplateRegistration.load(id);
  let isNew = registration == null;
  if (registration == null) {
    registration = new HooksTemplateRegistration(id);
  }
  registration.hooksFactory = factory.id;
  registration.hooksTemplate = template.id;
  registration.templateAddress = template.address;
  registration.name = name;
  registration.feeRecipient = feeRecipient;
  registration.originationFeeAsset = originationFeeAsset;
  registration.originationFeeAmount = originationFeeAmount;
  registration.protocolFeeBips = protocolFeeBips;
  registration.isEnabled = true;
  stampRegistration(registration, event, isNew);
  registration.save();
  return registration;
}

export function updateTemplateRegistrationFees(
  event: ethereum.Event,
  registration: HooksTemplateRegistration,
  feeRecipient: Address,
  originationFeeAsset: string | null,
  originationFeeAmount: BigInt,
  protocolFeeBips: i32
): void {
  registration.feeRecipient = feeRecipient;
  registration.originationFeeAsset = originationFeeAsset;
  registration.originationFeeAmount = originationFeeAmount;
  registration.protocolFeeBips = protocolFeeBips;
  stampRegistration(registration, event, false);
  registration.save();
}

export function disableTemplateRegistration(
  event: ethereum.Event,
  registration: HooksTemplateRegistration
): void {
  registration.isEnabled = false;
  stampRegistration(registration, event, false);
  registration.save();
}

export function recordTemplateRegistrationEvent(
  event: ethereum.Event,
  registration: HooksTemplateRegistration,
  change: string
): void {
  let record = new HooksTemplateRegistrationEvent(generateEventId(event));
  record.registration = registration.id;
  record.hooksFactory = registration.hooksFactory;
  record.hooksTemplate = registration.hooksTemplate;
  record.change = change;
  record.name = registration.name;
  record.isEnabled = registration.isEnabled;
  record.feeRecipient = registration.feeRecipient;
  record.protocolFeeBips = registration.protocolFeeBips;
  record.originationFeeAsset = registration.originationFeeAsset;
  record.originationFeeAmount = registration.originationFeeAmount;
  record.blockNumber = event.block.number;
  record.blockTimestamp = event.block.timestamp;
  record.transactionHash = event.transaction.hash;
  record.blockLogIndex = event.logIndex;
  record.save();
}
