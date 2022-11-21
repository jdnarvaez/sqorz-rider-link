module.exports = {
  presets: [
    [
      "@babel/preset-env",
      {
        targets: {
          node: "current",
        },
      },
    ],
    ["@babel/preset-typescript"],
    ["@babel/preset-react"],
  ],
  plugins: [
    // ["transform-react-jsx", { pragma: "h" }],
    [
      "@babel/plugin-transform-runtime",
      {
        regenerator: true,
      },
    ],
    ["@babel/plugin-proposal-class-properties"],
    [
      "module-resolver",
      {
        root: ["./src"],
        alias: {
          "@/": "./src",
        },
      },
    ],
  ],
};
