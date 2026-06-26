import { assert, clearStore, describe, test } from "matchstick-as/assembly";
import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import { createMockedFunction } from "matchstick-as";
import {
  createHooksFactory,
  createHooksTemplate,
  generateHooksInstanceId,
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

describe("hooks factory", () => {
  test("classifies deployed periodic term hooks instances", () => {
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
    assert.fieldEquals("HooksInstance", hooksInstanceId, "eventIndex", "0");
    assert.entityCount("HooksInstanceDeployed", 1);
  });
});
