const path = require('path');
const fs = require('fs');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const HtmlWebpackIncludeAssetsPlugin = require('html-webpack-include-assets-plugin');

const { getHTML, getStyleWithImageLoaderConfig } = require('./util');

const WORK_DIR = process.cwd();
const SOURCE_PATH = path.resolve(WORK_DIR, './src');
const MODULES_PATH = path.resolve(__dirname, '../node_modules');
const APP_PATH = path.join(SOURCE_PATH, './app');

/**
 * 标准化项目输出配置
 * @{param} env: 'development' or 'production' 指定开发环境或生产环境
 */
module.exports = (env = 'development', options) => {

  // 开发环境
  const IS_DEV = env === 'development';

  // 应用输出页面
  const AppPages = getHTML(APP_PATH);

  // 默认项目配置
  const DEFAULT_PROJECT_CONFIG = {
    libiary: {},
    externals: {},
    browser_support: {
      DEVELOPMENT: [ 'last 2 versions' ],
      PRODUCTION: [ 'last 2 versions' ]
    },
    build_path: './dist',
  };
  const PROJECT_CONFIG = Object.assign(
    DEFAULT_PROJECT_CONFIG,
    require(path.resolve(WORK_DIR, './abc.json'))
  );
  const EXTERNALS = PROJECT_CONFIG.externals;

  // refer to: https://github.com/ai/browserslist#queries
  const BROWSER_SUPPORTS = PROJECT_CONFIG.browser_support[env.toUpperCase()];
  const BUILD_PATH = path.resolve(WORK_DIR, PROJECT_CONFIG.build_path);

  // 入口配置
  const entryConfig = {};
  // 插件配置
  let pluginsConfig = [];
  if (IS_DEV) {
    pluginsConfig.push(new webpack.HotModuleReplacementPlugin());
  }

  const OutputConfig = {
    path: BUILD_PATH,
    pathinfo: IS_DEV,
  };
  if (!IS_DEV) {
    // 生产环境 资源名加上 hash
    Object.assign(OutputConfig, {
      filename: '[name].[chunkhash:8].js',
    });
  }

  // libiary 输出配置
  const LibiaryList = Object.keys(PROJECT_CONFIG.libiary);
  const LibiaryEntry = {};
  LibiaryList.forEach(name => {
    LibiaryEntry[`assets/${name}`] = PROJECT_CONFIG.libiary[name].map(file => path.resolve(SOURCE_PATH, file));
  });

  AppPages.forEach(appPage => {
    const pageName = appPage.replace(/\.html?$/, '');
    entryConfig[pageName] = [
      path.join(SOURCE_PATH, `app/${pageName}.js`),
    ];
    if (IS_DEV) {
      entryConfig[pageName].unshift(
        `webpack-dev-server/client?http://localhost:${options.port}`,
        'webpack/hot/dev-server'
      );
    }
    pluginsConfig.push(
      new HtmlWebpackPlugin({
        filename: appPage,
        template: path.join(APP_PATH, appPage),
        chunksSortMode: 'auto',
        chunks: [
          LibiaryList.map(name => `assets/${name}`),
          pageName,
        ],
      })
    );
  });

  // 公共模块配置
  const LibiaryChunks = LibiaryList.map(
    name => new webpack.optimize.CommonsChunkPlugin({
      name: `assets/${name}`,
      minChunks: Infinity,
    })
  );

  const CommonChunk = new webpack.optimize.CommonsChunkPlugin({
    name: 'common',
  });

  // css & image 解析配置
  const {
    StyleLoaderConfig,
    ImageLoaderConfig,
    ExtractCssPlugin,
  } = getStyleWithImageLoaderConfig(IS_DEV, BROWSER_SUPPORTS, `${PROJECT_CONFIG.publicPath}/assets/`);

  if (ExtractCssPlugin) {
    pluginsConfig.push(ExtractCssPlugin);
  }

  // 外部资源配置，这里配置后不通过构建
  const ExternalsConfig = {};
  const ExternalsCopyList = [];
  const ExternalsBuildList = [];
  Object.keys(EXTERNALS).forEach(name => {
    ExternalsConfig[name] = EXTERNALS[name].alias;
    ExternalsCopyList.push({
      from: path.join(WORK_DIR, EXTERNALS[name].path),
      to: path.join(BUILD_PATH, 'assets'),
    });
    ExternalsBuildList.push(path.join('assets', path.basename(EXTERNALS[name].path)));
  });
  // 复制 external 资源到输出目录
  pluginsConfig.push(new CopyWebpackPlugin(ExternalsCopyList));
  // html 中 external 的资源需要手动加入
  const IncludeAssetsConfig = new HtmlWebpackIncludeAssetsPlugin({
    assets: ExternalsBuildList,
    append: false,
  });

  pluginsConfig = [
    ...pluginsConfig,
    IncludeAssetsConfig,
    ...LibiaryChunks,
    // CommonChunk,
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
      'process.env.DEBUG': JSON.stringify(process.env.DEBUG)
    }),
  ];

  return {
    entry: entryConfig,

    output: OutputConfig,

    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /node_modules/,
          loader: 'babel-loader',
          query: {
            presets: [
              [ path.resolve(MODULES_PATH, 'babel-preset-env'), {
                targets: {
                  browsers: BROWSER_SUPPORTS
                }, 
              }]
            ],
            plugins: [ path.resolve(MODULES_PATH, 'babel-plugin-syntax-dynamic-import') ],
          }
        },
        StyleLoaderConfig,
        ImageLoaderConfig,
        {
          test: /\.html$/,
          use: [
            {
              loader: 'html-loader',
              options: {
                minimize: !IS_DEV,
                removeComments: !IS_DEV,
                interpolate: true,
                root: './',
              },
            },
          ],
        },
      ]
    },

    externals: {},

    resolve: {
      modules: [
        'node_modules',
        MODULES_PATH,
      ]
    },

    devtool: IS_DEV ? 'cheap-module-source-map': 'source-map',

    resolveLoader: {
      modules: [ MODULES_PATH ],
    },

    plugins: pluginsConfig,
  };

};