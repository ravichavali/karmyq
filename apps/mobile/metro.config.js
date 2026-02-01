// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

// Set EXPO_ROUTER_APP_ROOT before expo-router uses it
// This fixes the Windows issue where the env var isn't properly set
process.env.EXPO_ROUTER_APP_ROOT = path.resolve(__dirname, "app");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

module.exports = config;
