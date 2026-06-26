import {
  assert,
  clearStore,
  createMockedFunction,
  describe,
  newMockEvent,
  test,
} from "matchstick-as/assembly/index";
import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import { WrapperDeployed } from "../generated/Wildcat4626WrapperFactory/Wildcat4626WrapperFactory";
import { ArchController, Market, Token } from "../generated/schema";
import { generateTokenId } from "../generated/UncrashableEntityHelpers";
import { handleWrapperDeployed } from "../src/wildcat-4626-wrapper-factory";

const ARCH_CONTROLLER_ADDRESS = addressFrom(
  "0x1000000000000000000000000000000000000001"
);
const WRAPPER_FACTORY_ADDRESS = addressFrom(
  "0x2000000000000000000000000000000000000002"
);
const ASSET_ADDRESS = addressFrom("0x3000000000000000000000000000000000000003");
const MARKET_ADDRESS = addressFrom("0x4000000000000000000000000000000000000004");
const WRAPPER_ADDRESS = addressFrom("0x5000000000000000000000000000000000000005");
const BORROWER_ADDRESS = addressFrom(
  "0x6000000000000000000000000000000000000006"
);

function addressFrom(hex: string): Address {
  return Address.fromBytes(Bytes.fromHexString(hex));
}

function seedArchController(): void {
  let archController = new ArchController(ARCH_CONTROLLER_ADDRESS.toHexString());
  archController.save();
}

function seedToken(address: Address, name: string, symbol: string): void {
  let token = new Token(generateTokenId(address));
  token.address = address;
  token.name = name;
  token.symbol = symbol;
  token.decimals = 18;
  token.isMock = false;
  token.save();
}

function seedMarket(): void {
  let market = new Market(MARKET_ADDRESS.toHexString());
  market.archController = ARCH_CONTROLLER_ADDRESS.toHexString();
  market.isRegistered = true;
  market.version = "V2";
  market.marketType = "Legacy";
  market.borrower = BORROWER_ADDRESS;
  market.sentinel = BORROWER_ADDRESS;
  market.feeRecipient = BORROWER_ADDRESS;
  market.name = "Mock Market";
  market.symbol = "mMOCK";
  market.decimals = 18;
  market.protocolFeeBips = 25;
  market.delinquencyGracePeriod = 86400;
  market.delinquencyFeeBips = 100;
  market.asset = generateTokenId(ASSET_ADDRESS);
  market.withdrawalBatchDuration = 3600;
  market.isClosed = false;
  market.maxTotalSupply = BigInt.fromI32(1_000_000);
  market.pendingProtocolFees = BigInt.zero();
  market.normalizedUnclaimedWithdrawals = BigInt.zero();
  market.scaledTotalSupply = BigInt.fromI32(10_000);
  market.scaledPendingWithdrawals = BigInt.zero();
  market.pendingWithdrawalExpiry = BigInt.zero();
  market.isDelinquent = false;
  market.isIncurringPenalties = false;
  market.timeDelinquent = 0;
  market.annualInterestBips = 500;
  market.reserveRatioBips = 1000;
  market.scaleFactor = BigInt.fromString("1000000000000000000000000000");
  market.lastInterestAccruedTimestamp = 1;
  market.lastInterestAccruedBlockNumber = 1;
  market.originalAnnualInterestBips = 500;
  market.originalReserveRatioBips = 1000;
  market.temporaryReserveRatioExpiry = 0;
  market.temporaryReserveRatioActive = false;
  market.totalBorrowed = BigInt.zero();
  market.totalRepaid = BigInt.zero();
  market.totalBaseInterestAccrued = BigInt.zero();
  market.totalDelinquencyFeesAccrued = BigInt.zero();
  market.totalProtocolFeesAccrued = BigInt.zero();
  market.totalDeposited = BigInt.zero();
  market.eventIndex = 0;
  market.delinquencyStatusChangedIndex = 0;
  market.borrowIndex = 0;
  market.depositIndex = 0;
  market.feesCollectedIndex = 0;
  market.debtRepaidIndex = 0;
  market.maxTotalSupplyUpdatedIndex = 0;
  market.annualInterestBipsUpdatedIndex = 0;
  market.withdrawalRequestsIndex = 0;
  market.protocolFeeBipsUpdatedIndex = 0;
  market.forceBuyBackIndex = 0;
  market.fixedTermUpdatedIndex = 0;
  market.minimumDepositUpdatedIndex = 0;
  market.numCollateralContracts = 0;
  market.createdAt = 1;
  market.deployedEvent = "DEPLOYED";
  market.commitmentFeeBips = null;
  market.drawnAmount = null;
  market.save();
}

function createWrapperDeployedEvent(
  marketAddress: Address,
  wrapperAddress: Address
): WrapperDeployed {
  let event = changetype<WrapperDeployed>(newMockEvent());
  event.address = WRAPPER_FACTORY_ADDRESS;
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam("market", ethereum.Value.fromAddress(marketAddress))
  );
  event.parameters.push(
    new ethereum.EventParam("wrapper", ethereum.Value.fromAddress(wrapperAddress))
  );
  return event;
}

describe("Wildcat4626WrapperFactory", () => {
  test("indexes wrapper deployments and links them to markets", () => {
    clearStore();
    seedArchController();
    seedToken(ASSET_ADDRESS, "Mock Asset", "MOCK");
    seedToken(MARKET_ADDRESS, "Mock Market", "mMOCK");
    seedToken(WRAPPER_ADDRESS, "Wrapped Mock Market", "wmMOCK");
    seedMarket();

    createMockedFunction(
      WRAPPER_FACTORY_ADDRESS,
      "archController",
      "archController():(address)"
    ).returns([ethereum.Value.fromAddress(ARCH_CONTROLLER_ADDRESS)]);

    let event = createWrapperDeployedEvent(MARKET_ADDRESS, WRAPPER_ADDRESS);
    handleWrapperDeployed(event);

    let factoryId = WRAPPER_FACTORY_ADDRESS.toHexString();
    let wrapperId = WRAPPER_ADDRESS.toHexString();
    let marketId = MARKET_ADDRESS.toHexString();
    let eventId = event.transaction.hash
      .toHex()
      .concat("-")
      .concat(event.logIndex.toString());

    assert.entityCount("Wildcat4626WrapperFactory", 1);
    assert.fieldEquals(
      "Wildcat4626WrapperFactory",
      factoryId,
      "archController",
      ARCH_CONTROLLER_ADDRESS.toHexString()
    );
    assert.fieldEquals(
      "Wildcat4626WrapperFactory",
      factoryId,
      "eventIndex",
      "1"
    );

    assert.entityCount("Wildcat4626Wrapper", 1);
    assert.fieldEquals("Wildcat4626Wrapper", wrapperId, "factory", factoryId);
    assert.fieldEquals("Wildcat4626Wrapper", wrapperId, "market", marketId);
    assert.fieldEquals(
      "Wildcat4626Wrapper",
      wrapperId,
      "marketAddress",
      MARKET_ADDRESS.toHexString()
    );
    assert.fieldEquals(
      "Wildcat4626Wrapper",
      wrapperId,
      "marketToken",
      generateTokenId(MARKET_ADDRESS)
    );
    assert.fieldEquals(
      "Wildcat4626Wrapper",
      wrapperId,
      "token",
      generateTokenId(WRAPPER_ADDRESS)
    );

    assert.entityCount("Wildcat4626WrapperDeployed", 1);
    assert.fieldEquals("Wildcat4626WrapperDeployed", eventId, "factory", factoryId);
    assert.fieldEquals("Wildcat4626WrapperDeployed", eventId, "market", marketId);
    assert.fieldEquals("Wildcat4626WrapperDeployed", eventId, "wrapper", wrapperId);
  });
});
