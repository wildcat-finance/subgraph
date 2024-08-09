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
  getControllerFactory,
  getMarket,
  getOrInitializeArchController,
  getRegisteredBorrower,
  getOrInitializeRegisteredBorrower
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
import {
  OwnershipHandoverCanceled,
  OwnershipHandoverRequested,
  OwnershipTransferred,
} from "../generated/schema";
import { WildcatMarketControllerFactory as ControllerFactoryTemplate } from "../generated/templates";
import { generateEventId } from "./utils";

export function handleBorrowerAdded(event: BorrowerAddedEvent): void {
  let borrower = event.params.borrower;
  getOrInitializeArchController(event.address.toHex(), {});
  let borrowerStatus = getOrInitializeRegisteredBorrower(
    generateRegisteredBorrowerId(event.address, borrower),
    {
      archController: event.address.toHex(),
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
  });
}

export function handleBorrowerRemoved(event: BorrowerRemovedEvent): void {
  let borrower = event.params.borrower;
  getOrInitializeArchController(event.address.toHex(), {});
  let borrowerStatus = getRegisteredBorrower(
    generateRegisteredBorrowerId(event.address, borrower)
  );
  borrowerStatus.isRegistered = false;
  borrowerStatus.save();

  createBorrowerRegistrationChange(generateEventId(event), {
    registration: borrowerStatus.id,
    isRegistered: true,
    blockNumber: event.block.number.toI32(),
    blockTimestamp: event.block.timestamp.toI32(),
    transactionHash: event.transaction.hash,
  });
}

export function handleControllerAdded(event: ControllerAddedEvent): void {
  createControllerAdded(generateEventId(event), {
    controllerFactory: generateControllerFactoryId(
      event.params.controllerFactory
    ),
    controller: generateControllerId(event.params.controller),
    blockNumber: event.block.number.toI32(),
    blockTimestamp: event.block.timestamp.toI32(),
    transactionHash: event.transaction.hash,
  });
}

export function handleControllerFactoryAdded(
  event: ControllerFactoryAddedEvent
): void {
  getOrInitializeArchController(event.address.toHex(), {});
  let controllerFactory = event.params.controllerFactory;
  let factoryContract = WildcatMarketControllerFactory.bind(controllerFactory);
  let constraintsResult = factoryContract.try_getParameterConstraints();
  if (!constraintsResult.reverted) {
    let constraintsValue = constraintsResult.value;
    ControllerFactoryTemplate.create(event.params.controllerFactory);
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
  
    createControllerFactory(generateControllerFactoryId(controllerFactory), {
      constraints: constraints.id,
      sentinel: factoryContract.sentinel(),
      isRegistered: true,
      archController: event.address.toHex(),
    });
    createControllerFactoryAdded(generateEventId(event), {
      controllerFactory: generateControllerFactoryId(
        event.params.controllerFactory
      ),
      blockNumber: event.block.number.toI32(),
      blockTimestamp: event.block.timestamp.toI32(),
      transactionHash: event.transaction.hash,
    });
  }
}

export function handleControllerFactoryRemoved(
  event: ControllerFactoryRemovedEvent
): void {
  let factory = getControllerFactory(
    generateControllerFactoryId(event.params.controllerFactory)
  );
  factory.isRegistered = false;
  factory.save();
  createControllerFactoryRemoved(generateEventId(event), {
    controllerFactory: factory.id,
    blockNumber: event.block.number.toI32(),
    blockTimestamp: event.block.timestamp.toI32(),
    transactionHash: event.transaction.hash,
  });
}

export function handleControllerRemoved(event: ControllerRemovedEvent): void {
  let controller = getController(generateControllerId(event.params.controller));
  controller.isRegistered = false;
  controller.save();
  createControllerRemoved(generateEventId(event), {
    controller: controller.id,
    blockNumber: event.block.number.toI32(),
    blockTimestamp: event.block.timestamp.toI32(),
    transactionHash: event.transaction.hash,
  });
}

export function handleMarketAdded(event: MarketAddedEvent): void {
  createMarketAdded(generateEventId(event), {
    controller: event.params.controller.toHex(),
    market: event.params.market.toHex(),
    blockNumber: event.block.number.toI32(),
    blockTimestamp: event.block.timestamp.toI32(),
    transactionHash: event.transaction.hash,
  });
}

export function handleMarketRemoved(event: MarketRemovedEvent): void {
  let market = getMarket(generateMarketId(event.params.market));
  market.isRegistered = false;
  market.save();
  createMarketRemoved(generateEventId(event), {
    market: market.id,
    blockNumber: event.block.number.toI32(),
    blockTimestamp: event.block.timestamp.toI32(),
    transactionHash: event.transaction.hash,
  });
}

export function handleOwnershipHandoverCanceled(
  event: OwnershipHandoverCanceledEvent
): void {
  let entity = new OwnershipHandoverCanceled(generateEventId(event));
  entity.pendingOwner = event.params.pendingOwner;

  entity.blockNumber = event.block.number.toI32();
  entity.blockTimestamp = event.block.timestamp.toI32();
  entity.transactionHash = event.transaction.hash;

  entity.save();
}

export function handleOwnershipHandoverRequested(
  event: OwnershipHandoverRequestedEvent
): void {
  let entity = new OwnershipHandoverRequested(generateEventId(event));
  entity.pendingOwner = event.params.pendingOwner;

  entity.blockNumber = event.block.number.toI32();
  entity.blockTimestamp = event.block.timestamp.toI32();
  entity.transactionHash = event.transaction.hash;

  entity.save();
}

export function handleOwnershipTransferred(
  event: OwnershipTransferredEvent
): void {
  let entity = new OwnershipTransferred(generateEventId(event));
  entity.oldOwner = event.params.oldOwner;
  entity.newOwner = event.params.newOwner;

  entity.blockNumber = event.block.number.toI32();
  entity.blockTimestamp = event.block.timestamp.toI32();
  entity.transactionHash = event.transaction.hash;

  entity.save();
}
