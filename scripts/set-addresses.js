const fs = require('fs');
const networks = require('../networks.json');
const path = require('path');
const network = process.argv[2];
if (!networks[network]) {
  throw Error(`No deployments for network: ${network}`);
}
const {
  WildcatArchController,
  WildcatSanctionsSentinel
} = networks[network];
const template = fs.readFileSync(path.join(__dirname, '../subgraph.template.yaml'), 'utf8');
const subgraph = template
  .replace(/{{WildcatArchControllerAddress}}/g, WildcatArchController.address)
  .replace(/{{WildcatArchControllerStartBlock}}/g, WildcatArchController.startBlock)
  .replace(/{{WildcatSanctionsSentinelAddress}}/g, WildcatSanctionsSentinel.address)
  .replace(/{{WildcatSanctionsSentinelStartBlock}}/g, WildcatSanctionsSentinel.startBlock)
  .replace(/{{NetworkName}}/g, network)

fs.writeFileSync(path.join(__dirname, '../subgraph.yaml'), subgraph);