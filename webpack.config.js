const path = require("path");

module.exports = {
  context: path.resolve("src/"),
  // Start here: /src/app.js
  entry: {
    main: path.resolve(__dirname, "../src/index.js")
  },
  // Put the bundled code here: /dist/app.bundle.js
  output: {
    path: path.resolve(__dirname, "../dist/"),
    filename: "app.bundle.js"
  },
  module: {
    rules: [
      {
        test: /\.node$/i,
        use: "node-loader"
      }
    ]
  }
};
