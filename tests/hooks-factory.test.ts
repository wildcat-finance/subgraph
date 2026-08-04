import { assert, clearStore, describe, test } from "matchstick-as/assembly";
import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import { createMockedFunction } from "matchstick-as";
import {
  createHooksFactory,
  createHooksTemplate,
  generateHooksInstanceId,
  generateRoleProviderId,
  generateHooksTemplateId,
} from "../generated/UncrashableEntityHelpers";
import { handleHooksInstanceDeployed } from "../src/hooks-factory";
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
    createHooksFactory(event.address.toHex(), {
      archController: "arch-controller",
      isRegistered: true,
      sentinel: Address.zero(),
    });
    createHooksTemplate(generateHooksTemplateId(hooksTemplate), {
      name: "PeriodicTermHooks",
      feeRecipient: Address.zero(),
      protocolFeeBips: 0,
      originationFeeAsset: null,
      originationFeeAmount: BigInt.zero(),
      hooksFactory: event.address.toHex(),
    });

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
    assert.fieldEquals("RoleProvider", borrowerProviderId, "pushProviderIndex", "0");
    assert.fieldEquals(
      "RoleProviderAdded",
      "RECORD-" + hooksInstanceId + "-1",
      "timeToLive",
      "4294967295"
    );
  });
});
