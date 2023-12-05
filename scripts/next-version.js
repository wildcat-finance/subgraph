const path = require("path");
const package = require("../package.json");
const versionString = package.version;
const [major, minor, patch] = versionString.split(".");
const nextPatch = +patch + 1;
const nextVersion = [major, minor, nextPatch].join(".");
console.log(`v${nextVersion}`);

const shouldUpdate = process.argv[2] === "--update";
if (shouldUpdate) {
  package.version = nextVersion;
  const fs = require("fs");
  fs.writeFileSync(
    path.join(__dirname, "../package.json"),
    JSON.stringify(package, null, 2)
  );
}
