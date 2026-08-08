import { assert, clearStore, describe, test } from "matchstick-as/assembly";
import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import { createMockedFunction } from "matchstick-as";
import {
  generateHooksInstanceId,
  generateRoleProviderId,
} from "../generated/UncrashableEntityHelpers";
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
let pullProvider = Address.fromString(
  "0x00000000000000000000000000000000000000aa"
);

describe("hooks factory", () => {
  test("classifies periodic hooks and decodes unsigned provider fields", () => {
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
      .returns([
        ethereum.Value.fromUnsignedBigIntArray([
          // 0x0000003c | provider 0xaa | pull index 1 | null push index
          BigInt.fromString(
            "1617596800029038387680020905221177840418228665355570295360946261917696"
          ),
        ]),
      ]);
    createMockedFunction(
      hooksInstance,
      "getPushProviders",
      "getPushProviders():(uint256[])"
    )
      .withArgs([])
      .returns([
        ethereum.Value.fromUnsignedBigIntArray([
          // uint32 max | borrower | null pull index | push index 0
          BigInt.fromString(
            "115792089210356248756420345214020892766250353992003419843664389679747816226816"
          ),
        ]),
      ]);

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
    assert.fieldEquals("HooksInstance", hooksInstanceId, "eventIndex", "2");
    assert.entityCount("HooksInstanceDeployed", 1);

    let pullProviderId = generateRoleProviderId(hooksInstance, pullProvider);
    assert.fieldEquals("RoleProvider", pullProviderId, "timeToLive", "60");
    assert.fieldEquals("RoleProvider", pullProviderId, "isPullProvider", "true");
    assert.fieldEquals("RoleProvider", pullProviderId, "pullProviderIndex", "1");
    assert.fieldEquals("RoleProvider", pullProviderId, "isPushProvider", "false");
    assert.fieldEquals(
      "RoleProvider",
      pullProviderId,
      "pushProviderIndex",
      "16777215"
    );

    let borrowerProviderId = generateRoleProviderId(hooksInstance, borrower);
    assert.fieldEquals(
      "RoleProvider",
      borrowerProviderId,
      "timeToLive",
      "4294967295"
    );
    assert.fieldEquals(
      "RoleProvider",
      borrowerProviderId,
      "isPullProvider",
      "false"
    );
    assert.fieldEquals(
      "RoleProvider",
      borrowerProviderId,
      "pullProviderIndex",
      "16777215"
    );
    assert.fieldEquals(
      "RoleProvider",
      borrowerProviderId,
      "isPushProvider",
      "true"
    );
    assert.fieldEquals(
      "RoleProvider",
      borrowerProviderId,
      "pushProviderIndex",
      "0"
    );
    assert.entityCount("RoleProvider", 2);
    // Factory snapshots describe current state; they are not emitted lifecycle
    // events and must not fabricate immutable RoleProviderAdded records.
    assert.entityCount("RoleProviderAdded", 0);
  });
});
