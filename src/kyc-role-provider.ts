import { Address, Bytes, dataSource, ethereum } from "@graphprotocol/graph-ts";
import { getOrCreateRoleProviderInstance } from "./role-provider-domain";

// KYC and access list providers use the same membership and administrator event signatures.
export {
  handleAdministratorTransferCancelled,
  handleAdministratorTransferRequested,
  handleAdministratorTransferred,
  handleMemberAdded,
  handleMemberRemoved
} from "./access-list-role-provider";

export function handleDeployment(block: ethereum.Block): void {
  let context = dataSource.context();
  let provider = getOrCreateRoleProviderInstance(dataSource.address());
  provider.kind = "KYC";
  provider.administrator = Address.fromString(context.getString("initialAdministrator"));
  provider.deployedAtBlock = block.number;
  provider.deployedAtTimestamp = block.timestamp;
  provider.deployedAtTransaction = Bytes.fromHexString(context.getString("deployTxHash"));
  provider.save();
}
