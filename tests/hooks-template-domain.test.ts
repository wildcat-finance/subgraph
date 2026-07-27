import {
  assert,
  clearStore,
  dataSourceMock,
  describe,
  newMockEvent,
  test
} from "matchstick-as/assembly";
import { Address, DataSourceContext } from "@graphprotocol/graph-ts";
import { configuredHooksTemplateContextKey } from "../src/factory-context";
import {
  generateHooksTemplateId,
  getOrCreateHooksTemplate
} from "../src/hooks-template-domain";

const STORED_INIT_CODE = Address.fromString(
  "0x0000000000000000000000000000000000004001"
);

describe("hooks template identity", () => {
  test("classifies configured stored initcode without calling version", () => {
    clearStore();
    let context = new DataSourceContext();
    context.setString(
      configuredHooksTemplateContextKey(STORED_INIT_CODE),
      "OpenTermHooks|OpenTerm"
    );
    dataSourceMock.setContext(context);

    getOrCreateHooksTemplate(newMockEvent(), STORED_INIT_CODE, "test");

    let id = generateHooksTemplateId(STORED_INIT_CODE);
    assert.fieldEquals(
      "HooksTemplate",
      id,
      "address",
      STORED_INIT_CODE.toHexString()
    );
    assert.fieldEquals("HooksTemplate", id, "version", "OpenTermHooks");
    assert.fieldEquals("HooksTemplate", id, "kind", "OpenTerm");
    assert.fieldEquals("HooksTemplate", id, "abiFamily", "test");
    assert.entityCount("IndexerDiagnostic", 0);
    dataSourceMock.resetValues();
  });
});
