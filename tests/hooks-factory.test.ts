import { assert, clearStore, describe, test } from "matchstick-as/assembly";
import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import { createMockedFunction } from "matchstick-as";
import { generateHooksInstanceId } from "../generated/UncrashableEntityHelpers";
import {
  HooksFactory,
  HooksTemplate,
  HooksTemplateRegistration,
} from "../generated/schema";
import { handleHooksInstanceDeployed } from "../src/hooks-factory";
import {
  generateHooksTemplateId,
  generateHooksTemplateRegistrationId,
} from "../src/hooks-template-domain";
import { createHooksInstanceDeployedEvent } from "./hooks-factory-utils";

let hooksInstance = Address.fromString(
  "0x0000000000000000000000000000000000003001"
);
let hooksTemplate = Address.fromString(
  "0x0000000000000000000000000000000000003002"
);
let borrower = Address.fromString(
  "0x0000000000000000000000000000000000003003"
);

describe("hooks factory", () => {
  test("classifies deployed periodic term hooks instances", () => {
    clearStore();

    let event = createHooksInstanceDeployedEvent(hooksInstance, hooksTemplate);
    let factory = new HooksFactory(event.address.toHex());
    factory.address = event.address;
    factory.label = "test";
    factory.archController = Address.zero().toHexString();
    factory.marketKind = "STANDARD";
    factory.generation = "test";
    factory.abiFamily = "test";
    factory.hookedMarketAbi = "BASE";
    factory.configuredStartBlock = BigInt.zero();
    factory.indexed = true;
    factory.deploymentTarget = false;
    factory.lifecycle = "ACTIVE";
    factory.configured = true;
    factory.isRegistered = true;
    factory.eventIndex = 0;
    factory.sentinel = Address.zero();
    factory.save();

    let template = new HooksTemplate(generateHooksTemplateId(hooksTemplate));
    template.address = hooksTemplate;
    template.kind = "PeriodicTerm";
    template.version = "PeriodicTermHooks";
    template.abiFamily = "test";
    template.save();

    let registration = new HooksTemplateRegistration(
      generateHooksTemplateRegistrationId(event.address, hooksTemplate)
    );
    registration.hooksFactory = factory.id;
    registration.hooksTemplate = template.id;
    registration.templateAddress = hooksTemplate;
    registration.name = "PeriodicTermHooks";
    registration.feeRecipient = Address.zero();
    registration.protocolFeeBips = 0;
    registration.originationFeeAsset = null;
    registration.originationFeeAmount = BigInt.zero();
    registration.isEnabled = true;
    registration.createdAtBlock = BigInt.zero();
    registration.createdAtTimestamp = BigInt.zero();
    registration.createdAtTransaction = Address.zero();
    registration.createdAtLogIndex = BigInt.zero();
    registration.updatedAtBlock = BigInt.zero();
    registration.updatedAtTimestamp = BigInt.zero();
    registration.updatedAtTransaction = Address.zero();
    registration.updatedAtLogIndex = BigInt.zero();
    registration.save();

    createMockedFunction(hooksTemplate, "version", "version():(string)")
      .withArgs([])
      .returns([ethereum.Value.fromString("PeriodicTermHooks")]);

    createMockedFunction(hooksInstance, "borrower", "borrower():(address)")
      .withArgs([])
      .returns([ethereum.Value.fromAddress(borrower)]);
    createMockedFunction(hooksInstance, "name", "name():(string)")
      .withArgs([])
      .returns([ethereum.Value.fromString("periodic test hooks")]);
    createMockedFunction(
      hooksInstance,
      "getPullProviders",
      "getPullProviders():(uint256[])"
    )
      .withArgs([])
      .returns([ethereum.Value.fromUnsignedBigIntArray([])]);
    createMockedFunction(
      hooksInstance,
      "getPushProviders",
      "getPushProviders():(uint256[])"
    )
      .withArgs([])
      .returns([ethereum.Value.fromUnsignedBigIntArray([])]);

    handleHooksInstanceDeployed(event);

    let hooksInstanceId = generateHooksInstanceId(hooksInstance);
    assert.entityCount("HooksInstance", 1);
    assert.fieldEquals(
      "HooksInstance",
      hooksInstanceId,
      "kind",
      "PeriodicTerm"
    );
    assert.fieldEquals(
      "HooksInstance",
      hooksInstanceId,
      "hooksTemplate",
      generateHooksTemplateId(hooksTemplate)
    );
    assert.fieldEquals("HooksInstance", hooksInstanceId, "borrower", borrower.toHex());
    assert.fieldEquals(
      "HooksInstance",
      hooksInstanceId,
      "address",
      hooksInstance.toHexString()
    );
    assert.fieldEquals(
      "HooksInstance",
      hooksInstanceId,
      "marketKind",
      "STANDARD"
    );
    assert.fieldEquals("HooksInstance", hooksInstanceId, "generation", "test");
    assert.fieldEquals("HooksInstance", hooksInstanceId, "abiFamily", "test");
    assert.fieldEquals(
      "HooksInstance",
      hooksInstanceId,
      "deployedAtTransaction",
      event.transaction.hash.toHexString()
    );
    assert.fieldEquals("HooksInstance", hooksInstanceId, "eventIndex", "0");
    assert.entityCount("HooksInstanceDeployed", 1);
  });
});
