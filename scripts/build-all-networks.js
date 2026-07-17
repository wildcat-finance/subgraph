#!/usr/bin/env node

const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const { REPO_ROOT, listNetworks } = require("./chain-config");
const { generate } = require("./generate-manifest");

const GRAPH_BIN = path.join(
  REPO_ROOT,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "graph.cmd" : "graph"
);
const GENERATED_CONFIG_PATHS = [
  path.join(REPO_ROOT, "subgraph.yaml"),
  path.join(REPO_ROOT, "uncrashable-config.yaml"),
  path.join(REPO_ROOT, "networks.json"),
];

function snapshotFiles(filePaths) {
  return new Map(
    filePaths.map((filePath) => [
      filePath,
      fs.existsSync(filePath) ? fs.readFileSync(filePath) : null,
    ])
  );
}

function restoreFiles(snapshots) {
  for (const [filePath, content] of snapshots) {
    if (content === null) {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } else {
      fs.writeFileSync(filePath, content);
    }
  }
}

function runGraph(args) {
  execFileSync(GRAPH_BIN, args, {
    cwd: REPO_ROOT,
    stdio: "inherit",
  });
}

function run() {
  if (!fs.existsSync(GRAPH_BIN)) {
    throw new Error("Graph CLI is not installed; run yarn install first");
  }
  const snapshots = snapshotFiles(GENERATED_CONFIG_PATHS);
  let buildError = null;
  try {
    for (const network of listNetworks()) {
      console.log(`\nValidating generated subgraph for ${network}`);
      generate(network);
      runGraph(["codegen", "-u"]);
      runGraph([
        "build",
        "--output-dir",
        path.join("build", network),
      ]);
    }
  } catch (error) {
    buildError = error;
    throw error;
  } finally {
    restoreFiles(snapshots);
    try {
      runGraph(["codegen", "-u"]);
    } catch (restoreError) {
      if (buildError === null) throw restoreError;
      console.error(
        `Failed to regenerate bindings for restored manifest: ${restoreError.message}`
      );
    }
  }
}

if (require.main === module) {
  try {
    run();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = { run };
