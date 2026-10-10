// Sentry's wrapper around the Expo Metro config: adds the Debug IDs that let Sentry match
// crash stack traces to source maps. Do not swap it back to expo/metro-config's
// getDefaultConfig, or crashes will show up minified.
const { getSentryExpoConfig } = require("@sentry/react-native/metro");

module.exports = getSentryExpoConfig(__dirname);
