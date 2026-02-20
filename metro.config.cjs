// metro.config.js
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;

const config = getDefaultConfig(projectRoot);

/**
 * Keep Metro resolution stable without overriding
 * Expo's hierarchical lookup behavior.
 *
 * These aliases prevent duplicate React/RN copies
 * (which causes "Invalid hook call" errors).
 */
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
];

config.resolver.extraNodeModules = {
  react: path.resolve(projectRoot, "node_modules/react"),
  "react-native": path.resolve(projectRoot, "node_modules/react-native"),
};

/**
 * Ensure Metro watches only this project root
 */
config.watchFolders = [projectRoot];

module.exports = config;
