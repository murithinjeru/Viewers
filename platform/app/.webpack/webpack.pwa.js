// https://developers.google.com/web/tools/workbox/guides/codelabs/webpack
const path = require('path');
const { merge } = require('webpack-merge');
const webpackBase = require('./../../../.webpack/webpack.base.js');

const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { InjectManifest } = require('workbox-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const Dotenv = require('dotenv-webpack');

const SRC_DIR = path.join(__dirname, '../src');
const DIST_DIR = path.join(__dirname, '../dist');
const PUBLIC_DIR = path.join(__dirname, '../public');

const HTML_TEMPLATE = process.env.HTML_TEMPLATE || 'index.html';
const PUBLIC_URL = process.env.PUBLIC_URL || '/';
const APP_CONFIG = process.env.APP_CONFIG || 'config/default.js';

const PROXY_TARGET = process.env.PROXY_TARGET;
const PROXY_DOMAIN = process.env.PROXY_DOMAIN;
const PROXY_PATH_REWRITE_FROM = process.env.PROXY_PATH_REWRITE_FROM;
const PROXY_PATH_REWRITE_TO = process.env.PROXY_PATH_REWRITE_TO;
const IS_COVERAGE = process.env.COVERAGE === 'true';

const OHIF_PORT = Number(process.env.OHIF_PORT || 3000);
const ENTRY_TARGET = process.env.ENTRY_TARGET || `${SRC_DIR}/index.js`;

const writePluginImportFile = require('./writePluginImportsFile.js');
const copyPluginFromExtensions = writePluginImportFile(SRC_DIR, DIST_DIR);

const setHeaders = (res, filePath) => {
  if (filePath.includes('.gz')) res.setHeader('Content-Encoding', 'gzip');
  else if (filePath.includes('.br')) res.setHeader('Content-Encoding', 'br');

  if (filePath.includes('.pdf')) res.setHeader('Content-Type', 'application/pdf');
  else if (filePath.includes('mp4')) res.setHeader('Content-Type', 'video/mp4');
  else if (filePath.includes('frames')) res.setHeader('Content-Type', 'multipart/related');
  else res.setHeader('Content-Type', 'application/json');
};

module.exports = (env, argv) => {
  const baseConfig = webpackBase(env, argv, { SRC_DIR, DIST_DIR });
  const isProdBuild = process.env.NODE_ENV === 'production';
  const hasProxy = PROXY_TARGET && PROXY_DOMAIN;

  const mergedConfig = merge(baseConfig, {
    mode: isProdBuild ? 'production' : 'development',

    entry: { app: ENTRY_TARGET },

    output: {
      path: DIST_DIR,
      filename: isProdBuild ? '[name].bundle.[chunkhash].js' : '[name].js',
      publicPath: PUBLIC_URL,
      devtoolModuleFilenameTemplate: info =>
        isProdBuild
          ? `webpack:///${info.resourcePath}`
          : 'file:///' + encodeURI(info.absoluteResourcePath),
    },

    resolve: {
      modules: [
        path.resolve(__dirname, '../node_modules'),
        path.resolve(__dirname, '../../../node_modules'),
        SRC_DIR,
      ],
    },

    plugins: [
      new Dotenv(),
      new CleanWebpackPlugin(),

      new CopyWebpackPlugin({
        patterns: [
          ...copyPluginFromExtensions,
          {
            from: PUBLIC_DIR,
            to: DIST_DIR,
            toType: 'dir',
            globOptions: { ignore: ['**/config/**', '**/html-templates/**', '.DS_Store'] },
          },
          { from: '../../../node_modules/onnxruntime-web/dist', to: `${DIST_DIR}/ort` },
          { from: `${PUBLIC_DIR}/config/google.js`, to: `${DIST_DIR}/google.js` },
          { from: `${PUBLIC_DIR}/${APP_CONFIG}`, to: `${DIST_DIR}/app-config.js` },
        ],
      }),

      new HtmlWebpackPlugin({
        template: `${PUBLIC_DIR}/html-templates/${HTML_TEMPLATE}`,
        filename: 'index.html',
        templateParameters: { PUBLIC_URL },
      }),

      // Add Workbox ONLY once, and ONLY in prod (avoid HMR conflicts)
      ...(isProdBuild || IS_COVERAGE
        ? [
            // If you run coverage builds, skip SW entirely:
            // no Workbox when IS_COVERAGE === true
          ].filter(Boolean)
        : []),

      ...(isProdBuild && !IS_COVERAGE
        ? [
            new InjectManifest({
              swSrc: path.join(SRC_DIR, 'service-worker.js'),
              swDest: 'sw.js',
              exclude: [/theme/],
              maximumFileSizeToCacheInBytes: 50 * 1024 * 1024,
            }),
          ]
        : []),
    ],

    devServer: {
      open: true,
      port: OHIF_PORT,
      client: { overlay: { errors: true, warnings: false } },

      proxy: [
        {
          context: ['/dicomweb'],
          target: 'http://localhost:5000',
          changeOrigin: true,
          secure: false,
          logLevel: 'info',
        },
      ],

      static: [
        {
          directory: '../../testdata',
          staticOptions: {
            extensions: ['gz', 'br', 'mht'],
            index: ['index.json.gz', 'index.mht.gz'],
            redirect: true,
            setHeaders,
          },
          publicPath: '/viewer-testdata',
        },
      ],

      historyApiFallback: {
        disableDotRule: true,
        index: PUBLIC_URL + 'index.html',
      },

      devMiddleware: { writeToDisk: true },
    },
  });

  // If PROXY_* envs are set, append (do not replace) another proxy route
  if (hasProxy) {
    const extraRoute = {
      context: [PROXY_TARGET],
      target: PROXY_DOMAIN,
      changeOrigin: true,
      pathRewrite:
        PROXY_PATH_REWRITE_FROM && PROXY_PATH_REWRITE_TO
          ? { [`^${PROXY_PATH_REWRITE_FROM}`]: PROXY_PATH_REWRITE_TO }
          : undefined,
    };
    mergedConfig.devServer.proxy = Array.isArray(mergedConfig.devServer.proxy)
      ? [...mergedConfig.devServer.proxy, extraRoute]
      : [extraRoute];
  }

  if (isProdBuild) {
    mergedConfig.plugins.push(
      new MiniCssExtractPlugin({
        filename: '[name].bundle.css',
        chunkFilename: '[id].css',
      })
    );
  }

  mergedConfig.watchOptions = { ignored: /node_modules\/@cornerstonejs/ };

  return mergedConfig;
};
