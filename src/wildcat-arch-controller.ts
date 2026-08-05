import {
  createBorrowerRegistrationChange,
  createControllerAdded,
  createControllerFactory,
  createControllerFactoryAdded,
  createControllerFactoryRemoved,
  createControllerRemoved,
  createMarketAdded,
  createMarketRemoved,
  createParameterConstraints,
  generateRegisteredBorrowerId,
  generateControllerFactoryId,
  generateControllerId,
  generateMarketId,
  generateParameterConstraintsId,
  getController,
  getOrInitializeArchController,
  getRegisteredBorrower,
  getOrInitializeRegisteredBorrower,
} from "../generated/UncrashableEntityHelpers";
import {
  BorrowerAdded as BorrowerAddedEvent,
  BorrowerRemoved as BorrowerRemovedEvent,
  ControllerAdded as ControllerAddedEvent,
  ControllerFactoryAdded as ControllerFactoryAddedEvent,
  ControllerFactoryRemoved as ControllerFactoryRemovedEvent,
  ControllerRemoved as ControllerRemovedEvent,
  MarketAdded as MarketAddedEvent,
  MarketRemoved as MarketRemovedEvent,
  OwnershipHandoverCanceled as OwnershipHandoverCanceledEvent,
  OwnershipHandoverRequested as OwnershipHandoverRequestedEvent,
  OwnershipTransferred as OwnershipTransferredEvent,
} from "../generated/WildcatArchController/WildcatArchController";
import { WildcatMarketControllerFactory } from "../generated/WildcatArchController/WildcatMarketControllerFactory";
import { HooksFactory as HooksFactoryContract } from "../generated/WildcatArchController/HooksFactory";
import {
  ControllerFactory,
  Controller,
  FactoryRegistration,
  FactoryRegistrationEvent,
  HooksFactory,
  Market,
  OwnershipHandoverCanceled,
  OwnershipHandoverRequested,
  OwnershipTransferred,
} from "../generated/schema";
import { WildcatMarketControllerFactory as ControllerFactoryTemplate } from "../generated/templates";
import { generateEventId, loadExistingMarket } from "./utils";
import {
  generateFactoryRegistrationId,
  getOrCreateHooksFactory,
} from "./factory-domain";
import { getConfiguredHooksFactory } from "./factory-context";
import { recordIndexerDiagnostic } from "./indexer-diagnostics";
import {
  recordMarketEvent,
  recordMarketEventForMarketId,
} from "./market-event-domain";
import { getOrCreateBorrower } from "./borrower-domain";
import {
  createDeploymentChildContext,
  ensureIndexerDeployment,
} from "./deployment-context";

export function handleBorrowerAdded(event: BorrowerAddedEvent): void {
  ensureIndexerDeployment(event);
  let borrower = event.params.borrower;
  let profile = getOrCreateBorrower(event, borrower);
  getOrInitializeArchController(event.address.toHex(), {});
  let borrowerStatus = getOrInitializeRegisteredBorrower(
    generateRegisteredBorrowerId(event.address, borrower),
    {
      archController: event.address.toHex(),
      profile: profile.id,
      isRegistered: true,
      borrower,
    }
  );
  if (!borrowerStatus.wasCreated) {
    borrowerStatus.entity.isRegistered = true;
    borrowerStatus.entity.save();
  }

  createBorrowerRegistrationChange(generateEventId(event), {
    // archController: event.address.toHex(),
    // borrower: borrowerStatus.entity.borrower,
    registration: borrowerStatus.entity.id,
    isRegistered: true,
    blockNumber: event.block.number.toI32(),
    blockTimestamp: event.block.timestamp.toI32(),
    transactionHash: event.transaction.hash,
    blockLogIndex: event.logIndex.toI32(),
  });
}

export function handleBorrowerRemoved(event: BorrowerRemovedEvent): void {
  ensureIndexerDeployment(event);
  let borrower = event.params.borrower;
  getOrCreateBorrower(event, borrower);
  getOrInitializeArchController(event.address.toHex(), {});
  let borrowerStatus = getRegisteredBorrower(
    generateRegisteredBorrowerId(event.address, borrower)
  );
  borrowerStatus.isRegistered = false;
  borrowerStatus.save();

  createBorrowerRegistrationChange(generateEventId(event), {
    registration: borrowerStatus.id,
    isRegistered: false,
    blockNumber: event.block.number.toI32(),
    blockTimestamp: event.block.timestamp.toI32(),
    transactionHash: event.transaction.hash,
    blockLogIndex: event.logIndex.toI32(),
  });
}

export function handleControllerAdded(event: ControllerAddedEvent): void {
  ensureIndexerDeployment(event);
  const controllerFactoryId = generateControllerFactoryId(
    event.params.controllerFactory
  );
  if (ControllerFactory.load(controllerFactoryId) != null) {
    createControllerAdded(generateEventId(event), {
      controllerFactory: controllerFactoryId,
      controller: generateControllerId(event.params.controller),
      blockNumber: event.block.number.toI32(),
      blockTimestamp: event.block.timestamp.toI32(),
      transactionHash: event.transaction.hash,
      blockLogIndex: event.logIndex.toI32(),
    });
  }
}

function saveFactoryRegistration(
  event: ControllerFactoryAddedEvent,
  kind: string,
  controllerFactory: string | null,
  hooksFactory: string | null
): void {
  let id = generateFactoryRegistrationId(
    event.address,
    event.params.controllerFactory
  );
  let registration = FactoryRegistration.load(id);
  if (registration == null) {
    registration = new FactoryRegistration(id);
  }
  registration.archController = event.address.toHexString();
  registration.factoryAddress = event.params.controllerFactory;
  registration.kind = kind;
  registration.isRegistered = true;
  registration.controllerFactory = controllerFactory;
  registration.hooksFactory = hooksFactory;
  registration.updatedAtBlock = event.block.number;
  registration.updatedAtTimestamp = event.block.timestamp;
  registration.updatedAtTransaction = event.transaction.hash;
  registration.updatedAtLogIndex = event.logIndex;
  registration.save();

  let change = new FactoryRegistrationEvent(generateEventId(event));
  change.registration = registration.id;
  change.factoryAddress = event.params.controllerFactory;
  change.kind = kind;
  change.change = "ADDED";
  change.isRegistered = true;
  change.blockNumber = event.block.number;
  change.blockTimestamp = event.block.timestamp;
  change.transactionHash = event.transaction.hash;
  change.blockLogIndex = event.logIndex;
  change.save();

  if (hooksFactory != null) {
    let factory = HooksFactory.load(hooksFactory!);
    if (factory != null) {
      factory.isRegistered = true;
      factory.registrationUpdatedAtBlock = event.block.number;
      factory.registrationUpdatedAtTimestamp = event.block.timestamp;
      factory.save();
    }
  }
}

function saveFactoryRemoval(
  event: ControllerFactoryRemovedEvent,
  registration: FactoryRegistration
): void {
  registration.isRegistered = false;
  registration.updatedAtBlock = event.block.number;
  registration.updatedAtTimestamp = event.block.timestamp;
  registration.updatedAtTransaction = event.transaction.hash;
  registration.updatedAtLogIndex = event.logIndex;
  registration.save();

  let change = new FactoryRegistrationEvent(generateEventId(event));
  change.registration = registration.id;
  change.factoryAddress = event.params.controllerFactory;
  change.kind = registration.kind;
  change.change = "REMOVED";
  change.isRegistered = false;
  change.blockNumber = event.block.number;
  change.blockTimestamp = event.block.timestamp;
  change.transactionHash = event.transaction.hash;
  change.blockLogIndex = event.logIndex;
  change.save();
}

export function handleControllerFactoryAdded(
  event: ControllerFactoryAddedEvent
): void {
  ensureIndexerDeployment(event);
  getOrInitializeArchController(event.address.toHex(), {});
  let controllerFactory = event.params.controllerFactory;
  let configuredFactory = getConfiguredHooksFactory(controllerFactory);
  if (configuredFactory != null) {
    let hooksFactory = getOrCreateHooksFactory(
      controllerFactory,
      configuredFactory.marketKind,
      event.address.toHexString()
    );
    saveFactoryRegistration(event, "HOOKS", null, hooksFactory.id);
    return;
  }

  let factoryContract = WildcatMarketControllerFactory.bind(controllerFactory);

  let constraintsResult = factoryContract.try_getParameterConstraints();
  if (!constraintsResult.reverted) {
    let factoryId = generateControllerFactoryId(controllerFactory);
    let existingFactory = ControllerFactory.load(factoryId);
    if (existingFactory == null) {
      let constraintsValue = constraintsResult.value;
      ControllerFactoryTemplate.createWithContext(
        event.params.controllerFactory,
        createDeploymentChildContext()
      );
      let constraints = createParameterConstraints(
        generateParameterConstraintsId(controllerFactory),
        {
          minimumDelinquencyGracePeriod: constraintsValue.minimumDelinquencyGracePeriod.toI32(),
          maximumDelinquencyGracePeriod: constraintsValue.maximumDelinquencyGracePeriod.toI32(),
          minimumReserveRatioBips: constraintsValue.minimumReserveRatioBips,
          maximumReserveRatioBips: constraintsValue.maximumReserveRatioBips,
          minimumDelinquencyFeeBips: constraintsValue.minimumDelinquencyFeeBips,
          maximumDelinquencyFeeBips: constraintsValue.maximumDelinquencyFeeBips,
          minimumWithdrawalBatchDuration: constraintsValue.minimumWithdrawalBatchDuration.toI32(),
          maximumWithdrawalBatchDuration: constraintsValue.maximumWithdrawalBatchDuration.toI32(),
          minimumAnnualInterestBips: constraintsValue.minimumAnnualInterestBips,
          maximumAnnualInterestBips: constraintsValue.maximumAnnualInterestBips,
        }
      );

      createControllerFactory(factoryId, {
        address: controllerFactory,
        generation: "v1",
        abiFamily: "controller-factory-v1",
        constraints: constraints.id,
        sentinel: factoryContract.sentinel(),
        isRegistered: true,
        archController: event.address.toHex(),
        originationFeeAsset: null,
      });
    } else {
      existingFactory.isRegistered = true;
      existingFactory.save();
    }
    createControllerFactoryAdded(generateEventId(event), {
      controllerFactory: factoryId,
      blockNumber: event.block.number.toI32(),
      blockTimestamp: event.block.timestamp.toI32(),
      transactionHash: event.transaction.hash,
      blockLogIndex: event.logIndex.toI32(),
    });
    saveFactoryRegistration(event, "CONTROLLER", factoryId, null);
  } else {
    let hooksContract = HooksFactoryContract.bind(controllerFactory);
    let archControllerResult = hooksContract.try_archController();
    let isHooksFactory =
      !archControllerResult.reverted &&
      archControllerResult.value == event.address;
    if (isHooksFactory) {
      let hooksFactory = getOrCreateHooksFactory(
        controllerFactory,
        "UNKNOWN",
        event.address.toHexString()
      );
      saveFactoryRegistration(event, "HOOKS", null, hooksFactory.id);
    } else {
      saveFactoryRegistration(event, "UNKNOWN", null, null);
      recordIndexerDiagnostic(
        event,
        "UNKNOWN_FACTORY",
        "ArchController registered a factory that does not match a configured hooks factory or the V1 controller-factory interface",
        controllerFactory
      );
    }
  }
}

export function handleControllerFactoryRemoved(
  event: ControllerFactoryRemovedEvent
): void {
  ensureIndexerDeployment(event);
  let registrationId = generateFactoryRegistrationId(
    event.address,
    event.params.controllerFactory
  );
  let registration = FactoryRegistration.load(registrationId);
  if (registration == null) {
    registration = new FactoryRegistration(registrationId);
    registration.archController = event.address.toHexString();
    registration.factoryAddress = event.params.controllerFactory;
    registration.kind = "UNKNOWN";
    registration.isRegistered = true;
    let controllerFactoryId = generateControllerFactoryId(
      event.params.controllerFactory
    );
    let knownControllerFactory = ControllerFactory.load(controllerFactoryId);
    let knownHooksFactory = HooksFactory.load(
      event.params.controllerFactory.toHexString()
    );
    if (knownControllerFactory != null) {
      registration.kind = "CONTROLLER";
      registration.controllerFactory = knownControllerFactory.id;
    } else if (knownHooksFactory != null) {
      registration.kind = "HOOKS";
      registration.hooksFactory = knownHooksFactory.id;
    } else if (
      getConfiguredHooksFactory(event.params.controllerFactory) != null
    ) {
      knownHooksFactory = getOrCreateHooksFactory(
        event.params.controllerFactory,
        "UNKNOWN",
        event.address.toHexString()
      );
      registration.kind = "HOOKS";
      registration.hooksFactory = knownHooksFactory.id;
    }
    registration.updatedAtBlock = event.block.number;
    registration.updatedAtTimestamp = event.block.timestamp;
    registration.updatedAtTransaction = event.transaction.hash;
    registration.updatedAtLogIndex = event.logIndex;
    registration.save();
    if (registration.kind == "UNKNOWN") {
      recordIndexerDiagnostic(
        event,
        "UNKNOWN_FACTORY",
        "ArchController removed a factory with no prior indexed registration",
        event.params.controllerFactory
      );
    }
  }

  saveFactoryRemoval(event, registration);

  if (registration.controllerFactory != null) {
    let factory = ControllerFactory.load(registration.controllerFactory!);
    if (factory != null) {
      factory.isRegistered = false;
      factory.save();
      createControllerFactoryRemoved(generateEventId(event), {
        controllerFactory: factory.id,
        blockNumber: event.block.number.toI32(),
        blockTimestamp: event.block.timestamp.toI32(),
        transactionHash: event.transaction.hash,
        blockLogIndex: event.logIndex.toI32(),
      });
    }
  }

  if (registration.hooksFactory != null) {
    let factory = HooksFactory.load(registration.hooksFactory!);
    if (factory != null) {
      factory.isRegistered = false;
      factory.registrationUpdatedAtBlock = event.block.number;
      factory.registrationUpdatedAtTimestamp = event.block.timestamp;
      factory.save();
    }
  }
}

export function handleControllerRemoved(event: ControllerRemovedEvent): void {
  ensureIndexerDeployment(event);
  let controller = getController(generateControllerId(event.params.controller));
  controller.isRegistered = false;
  controller.save();
  createControllerRemoved(generateEventId(event), {
    controller: controller.id,
    blockNumber: event.block.number.toI32(),
    blockTimestamp: event.block.timestamp.toI32(),
    transactionHash: event.transaction.hash,
    blockLogIndex: event.logIndex.toI32(),
  });
}

export function handleMarketAdded(event: MarketAddedEvent): void {
  ensureIndexerDeployment(event);
  let controllerAddress = event.params.controller;
  let controller = Controller.load(generateControllerId(controllerAddress));
  let hooksFactory = HooksFactory.load(controllerAddress.toHexString());
  let marketId = generateMarketId(event.params.market);
  let market = Market.load(marketId);
  if (market != null) {
    market.isRegistered = true;
    market.save();
    recordMarketEvent(event, market, "MARKET_REGISTERED");
  } else if (controller != null || hooksFactory != null) {
    // Initial registration precedes the deployment event that creates Market.
    recordMarketEventForMarketId(event, marketId, "MARKET_REGISTERED");
  }
  createMarketAdded(generateEventId(event), {
    controllerAddress,
    controller: controller == null ? null : controller.id,
    hooksFactory: hooksFactory == null ? null : hooksFactory.id,
    marketAddress: event.params.market,
    market: marketId,
    blockNumber: event.block.number.toI32(),
    blockTimestamp: event.block.timestamp.toI32(),
    transactionHash: event.transaction.hash,
    blockLogIndex: event.logIndex.toI32(),
  });
}

export function handleMarketRemoved(event: MarketRemovedEvent): void {
  ensureIndexerDeployment(event);
  let market = loadExistingMarket(
    generateMarketId(event.params.market),
    "handleMarketRemoved"
  );
  if (market == null) {
    return;
  }
  recordMarketEvent(event, market, "MARKET_DEREGISTERED");
  market.isRegistered = false;
  market.save();
  createMarketRemoved(generateEventId(event), {
    market: market.id,
    blockNumber: event.block.number.toI32(),
    blockTimestamp: event.block.timestamp.toI32(),
    transactionHash: event.transaction.hash,
    blockLogIndex: event.logIndex.toI32(),
  });
}

export function handleOwnershipHandoverCanceled(
  event: OwnershipHandoverCanceledEvent
): void {
  ensureIndexerDeployment(event);
  let entity = new OwnershipHandoverCanceled(generateEventId(event));
  entity.pendingOwner = event.params.pendingOwner;

  entity.blockNumber = event.block.number.toI32();
  entity.blockTimestamp = event.block.timestamp.toI32();
  entity.transactionHash = event.transaction.hash;
  entity.blockLogIndex = event.logIndex.toI32();
  entity.save();
}

export function handleOwnershipHandoverRequested(
  event: OwnershipHandoverRequestedEvent
): void {
  ensureIndexerDeployment(event);
  let entity = new OwnershipHandoverRequested(generateEventId(event));
  entity.pendingOwner = event.params.pendingOwner;

  entity.blockNumber = event.block.number.toI32();
  entity.blockTimestamp = event.block.timestamp.toI32();
  entity.transactionHash = event.transaction.hash;
  entity.blockLogIndex = event.logIndex.toI32();
  entity.save();
}

export function handleOwnershipTransferred(
  event: OwnershipTransferredEvent
): void {
  ensureIndexerDeployment(event);
  let entity = new OwnershipTransferred(generateEventId(event));
  entity.oldOwner = event.params.oldOwner;
  entity.newOwner = event.params.newOwner;

  entity.blockNumber = event.block.number.toI32();
  entity.blockTimestamp = event.block.timestamp.toI32();
  entity.transactionHash = event.transaction.hash;
  entity.blockLogIndex = event.logIndex.toI32();
  entity.save();
}
