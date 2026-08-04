import {
  assert,
  clearStore,
  describe,
  test,
} from "matchstick-as/assembly/index";
import { createMockedFunction, newMockEvent } from "matchstick-as";
import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import { HooksInstanceDeployed } from "../generated/HooksFactory/HooksFactory";
import {
  createHooksFactory,
  createHooksTemplate,
  generateHooksInstanceId,
  generateHooksTemplateId,
  generateRoleProviderId,
} from "../generated/UncrashableEntityHelpers";
import { handleHooksInstanceDeployed } from "../src/hooks-factory";

let factoryAddress = Address.fromString(
  "0x0000000000000000000000000000000000002001"
);
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

function createHooksInstanceDeployedEvent(): HooksInstanceDeployed {
  let event = changetype<HooksInstanceDeployed>(newMockEvent());
  event.address = factoryAddress;
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam(
      "hooksInstance",
      ethereum.Value.fromAddress(hooksInstance)
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "hooksTemplate",
      ethereum.Value.fromAddress(hooksTemplate)
    )
  );
  return event;
}

describe("hooks factory role provider decoding", () => {
  test("preserves uint32 TTLs and uint24 provider indexes", () => {
    clearStore();

    createHooksFactory(factoryAddress.toHex(), {
      archController: "arch-controller",
      isRegistered: true,
      sentinel: Address.zero(),
    });
    createHooksTemplate(generateHooksTemplateId(hooksTemplate), {
      name: "OpenTermHooks",
      feeRecipient: Address.zero(),
      protocolFeeBips: 0,
      originationFeeAsset: null,
      originationFeeAmount: BigInt.zero(),
      hooksFactory: factoryAddress.toHex(),
    });

    createMockedFunction(hooksInstance, "borrower", "borrower():(address)")
      .withArgs([])
      .returns([ethereum.Value.fromAddress(borrower)]);
    createMockedFunction(hooksInstance, "name", "name():(string)")
      .withArgs([])
      .returns([ethereum.Value.fromString("open term hooks")]);
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

    handleHooksInstanceDeployed(createHooksInstanceDeployedEvent());

    let hooksInstanceId = generateHooksInstanceId(hooksInstance);
    let pullProviderId = generateRoleProviderId(hooksInstance, pullProvider);
    let borrowerProviderId = generateRoleProviderId(hooksInstance, borrower);

    assert.fieldEquals("HooksInstance", hooksInstanceId, "eventIndex", "2");
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
