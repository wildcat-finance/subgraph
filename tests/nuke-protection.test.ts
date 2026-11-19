import { assert, clearStore, test } from "matchstick-as/assembly";
import { Address, ethereum } from "@graphprotocol/graph-ts";
import { generateMarketId } from "../generated/UncrashableEntityHelpers";
import { NukeProtectionRegistered } from "../generated/templates/WildcatMarketV2_5/WildcatMarketV2_5";
import { handleNukeProtectionFactoryApproval, handleNukeProtectionRequested } from "../src/hooks-factory-v2-5";
import { handleNukeProtectionRegistered } from "../src/wildcat-market-v2-5";
import { generateEventId } from "../src/utils";
import { createV25Event, pushAddress, seedV25Factory, seedV25Market } from "./v2-5-test-utils";

const FACTORY = Address.fromString("0x0000000000000000000000000000000000000011");
const FEATURE = Address.fromString("0x0000000000000000000000000000000000000012");
const MARKET = Address.fromString("0x0000000000000000000000000000000000000013");
const ACCOUNT = Address.fromString("0x0000000000000000000000000000000000000014");
const ASSET = Address.fromString("0x0000000000000000000000000000000000000015");
const BORROWER = Address.fromString("0x0000000000000000000000000000000000000016");
const REGISTRY = Address.fromString("0x0000000000000000000000000000000000000017");

function setApproval(approved: boolean, logIndex: i32): void {
  let event = createV25Event(FACTORY, logIndex);
  pushAddress(event, "featureFactory", FEATURE);
  event.parameters.push(new ethereum.EventParam("approved", ethereum.Value.fromBoolean(approved)));
  handleNukeProtectionFactoryApproval(event);
}

test("revoking factory approval preserves account protection", () => {
  clearStore();
  seedV25Factory(FACTORY, "REVOLVING");
  seedV25Market(createV25Event(FACTORY, 1), MARKET, ASSET, BORROWER, BORROWER, REGISTRY);
  setApproval(true, 2);
  let approvalId = FACTORY.toHexString() + "-" + FEATURE.toHexString();
  assert.fieldEquals("NukeProtectionFactoryApproval", approvalId, "approved", "true");

  let registered = changetype<NukeProtectionRegistered>(createV25Event(MARKET, 3));
  pushAddress(registered, "account", ACCOUNT);
  handleNukeProtectionRegistered(registered);
  let requested = createV25Event(FACTORY, 4);
  pushAddress(requested, "market", MARKET);
  pushAddress(requested, "account", ACCOUNT);
  pushAddress(requested, "featureFactory", FEATURE);
  handleNukeProtectionRequested(requested);
  setApproval(false, 5);

  assert.entityCount("NukeProtectionFactoryApproval", 1);
  assert.entityCount("NukeProtectionFactoryApprovalChange", 2);
  assert.fieldEquals("NukeProtectionFactoryApproval", approvalId, "approved", "false");
  assert.fieldEquals("NukeProtectionRequest", generateEventId(requested), "featureFactory", FEATURE.toHexString());
  assert.fieldEquals("NukeProtectionRequest", generateEventId(requested), "market", generateMarketId(MARKET));
  assert.fieldEquals("NukeProtectionRegistration", generateEventId(registered), "account", ACCOUNT.toHexString());
  assert.fieldEquals("MarketEvent", generateEventId(registered), "kind", "NUKE_PROTECTION_REGISTERED");
});
