const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Force Metro to use CJS builds on web — ESM deps use `import.meta` which breaks in the browser bundle.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === "web") {
    // Redirect three to CJS build (including nested ones)
    if (moduleName === "three" || moduleName.endsWith("/three")) {
      return {
        filePath: path.resolve(__dirname, "node_modules/three/build/three.cjs"),
        type: "sourceFile",
      };
    }
    // zustand ESM middleware uses import.meta.env; CJS uses process.env.NODE_ENV instead.
    if (moduleName === "zustand" || moduleName.startsWith("zustand/")) {
      const subpath =
        moduleName === "zustand"
          ? "index.js"
          : `${moduleName.slice("zustand/".length)}.js`;
      return {
        filePath: path.resolve(__dirname, "node_modules/zustand", subpath),
        type: "sourceFile",
      };
    }
    // Redirect rhino3dm to non-module version
    if (moduleName.includes("rhino3dm.module.js")) {
      return {
        filePath: path.resolve(
          __dirname,
          "node_modules/three/examples/jsm/libs/rhino3dm/rhino3dm.js"
        ),
        type: "sourceFile",
      };
    }
  }
  return context.resolveRequest(context, moduleName, platform);
};

// Also keep the transformation as a backup for other nested dependencies
config.transformer.unstable_transformModules = [
  "three",
  "rhino3dm",
  "@react-three/drei",
  "@react-three/fiber",
  "stats-gl",
  "three-mesh-bvh",
];

module.exports = withNativeWind(config, { input: "./src/app/global.css" });
