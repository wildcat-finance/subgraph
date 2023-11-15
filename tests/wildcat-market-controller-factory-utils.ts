import { newMockEvent } from "matchstick-as"
import { ethereum, Address, BigInt } from "@graphprotocol/graph-ts"
import {
  NewController,
  UpdateProtocolFeeConfiguration
} from "../generated/WildcatMarketControllerFactory/WildcatMarketControllerFactory"

export function createNewControllerEvent(
  borrower: Address,
  controller: Address,
  namePrefix: string,
  symbolPrefix: string
): NewController {
  let newControllerEvent = changetype<NewController>(newMockEvent())

  newControllerEvent.parameters = new Array()

  newControllerEvent.parameters.push(
    new ethereum.EventParam("borrower", ethereum.Value.fromAddress(borrower))
  )
  newControllerEvent.parameters.push(
    new ethereum.EventParam(
      "controller",
      ethereum.Value.fromAddress(controller)
    )
  )
  newControllerEvent.parameters.push(
    new ethereum.EventParam("namePrefix", ethereum.Value.fromString(namePrefix))
  )
  newControllerEvent.parameters.push(
    new ethereum.EventParam(
      "symbolPrefix",
      ethereum.Value.fromString(symbolPrefix)
    )
  )

  return newControllerEvent
}

export function createUpdateProtocolFeeConfigurationEvent(
  feeRecipient: Address,
  protocolFeeBips: i32,
  originationFeeAsset: Address,
  originationFeeAmount: BigInt
): UpdateProtocolFeeConfiguration {
  let updateProtocolFeeConfigurationEvent = changetype<
    UpdateProtocolFeeConfiguration
  >(newMockEvent())

  updateProtocolFeeConfigurationEvent.parameters = new Array()

  updateProtocolFeeConfigurationEvent.parameters.push(
    new ethereum.EventParam(
      "feeRecipient",
      ethereum.Value.fromAddress(feeRecipient)
    )
  )
  updateProtocolFeeConfigurationEvent.parameters.push(
    new ethereum.EventParam(
      "protocolFeeBips",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(protocolFeeBips))
    )
  )
  updateProtocolFeeConfigurationEvent.parameters.push(
    new ethereum.EventParam(
      "originationFeeAsset",
      ethereum.Value.fromAddress(originationFeeAsset)
    )
  )
  updateProtocolFeeConfigurationEvent.parameters.push(
    new ethereum.EventParam(
      "originationFeeAmount",
      ethereum.Value.fromUnsignedBigInt(originationFeeAmount)
    )
  )

  return updateProtocolFeeConfigurationEvent
}
