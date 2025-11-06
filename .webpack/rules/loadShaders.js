/**
 * This is exclusively used by `vtk.js` to bundle glsl files.
 */
const loadShaders = {
  test: /\.glsl$/i,
  include: /vtk\.js[\/\\]Sources/,
  loader: 'shader-loader',
};

//module.exports = loadShaders;
module.exports = {
  // ...
  module: {
    rules: [
      loadShaders,
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: 'babel-loader',
      },
      // ... your other rules (css, ts, assets)
    ],
  },
};
