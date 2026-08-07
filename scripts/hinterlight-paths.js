function getHinterlightPaths(subgraphName, version) {
  return {
    // Graph Node deployment names cannot use the dotted release route.
    internalSubgraphName: `${subgraphName}/${version.replace(/\./g, "-")}`,
    // Hinterlight's public gateway translates the dotted route internally.
    publicSubgraphName: `${subgraphName}/${version}`,
    publicQueryUrl: `https://graph.hinterlight.net/${subgraphName}/${version}`,
  };
}

module.exports = { getHinterlightPaths };
