// Learn more: https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Pure logic shared with the web app (escalation timings, case IDs, distance, DB types).
// Those files import nothing, so only the folders themselves need watching.
config.watchFolders = [
  path.resolve(__dirname, '../src/lib/sos'),
  path.resolve(__dirname, '../src/types'),
];

module.exports = config;
