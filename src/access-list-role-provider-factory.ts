import { Address, ethereum } from "@graphprotocol/graph-ts";
import { AccessListRoleProvider as AccessListRoleProviderTemplate } from "../generated/templates";
import { setRoleProviderMember } from "./role-provider-domain";
import { recordRoleProviderDeployment } from "./role-provider-factory-domain";
import { generateEventId } from "./utils";

export function handleAccessListRoleProviderDeployed(
  event: ethereum.Event
): void {
  let providerAddress = event.parameters[0].value.toAddress();
  let administrator = event.parameters[1].value.toAddress();
  let deployer = event.parameters[2].value.toAddress();
  let salt = event.parameters[3].value.toBytes();
  let initialMembers = event.parameters[4].value.toAddressArray();

  let provider = recordRoleProviderDeployment(
    event,
    "ACCESS_LIST",
    providerAddress,
    deployer,
    salt
  );
  provider.administrator = administrator;
  provider.save();

  let eventId = generateEventId(event);
  for (let i = 0; i < initialMembers.length; i++) {
    setRoleProviderMember(
      event,
      provider,
      initialMembers[i],
      administrator,
      true,
      eventId.concat("-initial-").concat(i.toString())
    );
  }

  AccessListRoleProviderTemplate.create(providerAddress);
}
