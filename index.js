/**
 * Dev clients / bare builds may omit `scheme` in the embedded Constants manifest until a native rebuild.
 * `expo-router` calls `Linking.createURL` → `resolveScheme({ scheme })` without `scheme`; that throws when
 * the manifest has no schemes and no bundle id.
 *
 * Patch `resolveScheme` on the Schemes module BEFORE loading expo-router so every caller sees the default.
 * Patching only `Linking.createURL` is unreliable (bundler import bindings). Keep APP_SCHEME in sync with
 * `scheme` in app.config.ts.
 */
const APP_SCHEME = 'psuscc';

const schemesModule = require('expo-linking/build/Schemes');
const originalResolveScheme = schemesModule.resolveScheme;
schemesModule.resolveScheme = function resolveSchemeWithFallback(options = {}) {
  return originalResolveScheme({
    ...options,
    scheme: options.scheme ?? APP_SCHEME,
  });
};

require('expo-router/entry');
