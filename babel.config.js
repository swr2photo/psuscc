module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      [
        "babel-preset-expo",
        {
          jsxImportSource: "nativewind",
          // Rewrite import.meta (e.g. three-mesh-bvh workers) for web + Hermes.
          unstable_transformImportMeta: true,
        },
      ],
      "nativewind/babel",
    ],
  };
};
