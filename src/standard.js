const path = require('path');
const fs = require('fs');
const webpack = require('webpack');
const glob = require('glob');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const WebpackChunkHash = require('webpack-chunk-hash');
const HtmlWebpackIncludeAssetsPlugin = require('html-webpack-include-assets-plugin');
// const ChunkManifestPlugin = require('chunk-manifest-webpack-plugin');

const { getHTML, getStyleWithImageLoaderConfig } = require('./util');

const WORK_DIR = process.cwd();
const SOURCE_PATH = path.resolve(WORK_DIR, './src');
const PAGE_PATH = path.resolve(SOURCE_PATH, './pages');
const MODULES_PATH = path.resolve(__dirname, '../node_modules');

const DEFAULT_PROJECT_CONFIG = require('./project.config');

/**
 * 标准化项目输出配置
 * @{param} env: 'development' or 'production' 指定开发环境或生产环境
 */
module.exports = (env = 'development', options) => {

  // 开发环境
  const IS_DEV = env === 'development';

  const PROJECT_CONFIG = Object.assign(
    DEFAULT_PROJECT_CONFIG,
    require(path.resolve(WORK_DIR, './abc.json'))
  );
  const EXTERNALS = PROJECT_CONFIG.externals;

  // refer to: https://github.com/ai/browserslist#queries
  const BROWSER_SUPPORTS = PROJECT_CONFIG.browser_support[env.toUpperCase()];
  const BUILD_PATH = path.resolve(WORK_DIR, PROJECT_CONFIG.build_path);
  
  // 页面级列表
  const pages = fs.readdirSync(PAGE_PATH);


  let FinalPlugins = [];
  if (IS_DEV) {
    FinalPlugins.push(
      new webpack.NamedModulesPlugin(),
      new webpack.HotModuleReplacementPlugin()
    );
  } else {
    FinalPlugins.push(
      new webpack.HashedModuleIdsPlugin(),
      new WebpackChunkHash()
    );
  }

  // 构建输出map
  const htmlsList = pages.map(page => ({
    module: page,
    htmls: getHTML(path.join(PAGE_PATH, page)).map(html => html.replace(/\.html?$/, '')),
  }));
  const pageEntry = {};
  htmlsList.forEach(pageModule => {
    pageModule.htmls.forEach(page => {
      const matchs = glob.sync(`${pageModule.module}/**/${page}.js`, {
        cwd: PAGE_PATH,
        absolute: true,
      });
      let entry = matchs.slice(0, 1);
      if (IS_DEV) {
        if (PROJECT_CONFIG.enableReactHotLoader) {
          entryConfig[pageName].unshift(
            'react-hot-loader/patch',
            `webpack-dev-server/client?http://localhost:${options.port}`,
            'webpack/hot/dev-server'
          );
        } else {
          entryConfig[pageName].unshift(
            `webpack-dev-server/client?http://localhost:${options.port}`,
            'webpack/hot/dev-server'
          );
        }
      }
      pageEntry[`${pageModule.module}/bundle.${page}`] = entry;
    });
  });

  const OutputConfig = {
    path: BUILD_PATH,
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
  // 不配置 libiary，自动提取 common
  LibiaryList.forEach(name => {
    LibiaryEntry[`assets/${name}`] = PROJECT_CONFIG.libiary[name].map(file => path.resolve(SOURCE_PATH, file));
  });

  // 输出页面配置
  let htmlPlugins = [];
  htmlsList.forEach(pageModule => {
    htmlPlugins = htmlPlugins.concat(
      pageModule.htmls.map(page => new HtmlWebpackPlugin({
        filename: `${pageModule.module}/${page}.html`,
        template: path.resolve(PAGE_PATH, `./${pageModule.module}/${page}.html`),
        inject: PROJECT_CONFIG.htmlAssetsInject,
        chunksSortMode: 'auto',
        chunks: [].concat(LibiaryList.map(name => `assets/${name}`), 'assets/commonLibs', `${pageModule.module}/bundle.${page}`),
        minify: {
          removeComments: true,
          collapseWhitespace: true,
          removeRedundantAttributes: true,
          useShortDoctype: true,
          removeEmptyAttributes: false,
          removeStyleLinkTypeAttributes: true,
          keepClosingSlash: true,
          minifyJS: true,
          minifyCSS: true,
          minifyURLs: true,
        },
      }))
    );
  });

  // 公共模块配置
  const LibiaryChunks = LibiaryList.map(
    name => new webpack.optimize.CommonsChunkPlugin({
      name: `assets/${name}`,
      chunks: [`assets/${name}`],
      minChunks: Infinity,
    })
  );
  LibiaryChunks.push(
    new webpack.optimize.CommonsChunkPlugin({
      name: 'assets/commonLibs',
      chunks: Object.keys(pageEntry),
    })
  );

  // css & image 解析配置
  const {
    StyleLoaderConfig,
    ImageLoaderConfig,
    ExtractCssPlugin,
  } = getStyleWithImageLoaderConfig(IS_DEV, BROWSER_SUPPORTS, `${PROJECT_CONFIG.publicPath}`, PROJECT_CONFIG.base64);

  if (ExtractCssPlugin) {
    FinalPlugins.push(ExtractCssPlugin);
  }
  
  // 外部资源配置，这里配置后不通过构建
  const ExternalsConfig = {};
  const ExternalsCopyList = [];
  const ExternalsBuildList = [];
  Object.keys(EXTERNALS).forEach(name => {
    if (EXTERNALS[name].alias) {
      ExternalsConfig[name] = EXTERNALS[name].alias;
    }
    if (EXTERNALS[name].path) {
      ExternalsCopyList.push({
        from: path.join(WORK_DIR, EXTERNALS[name].path),
        to: path.join(BUILD_PATH, 'assets'),
      });
      ExternalsBuildList.push(path.join('assets', path.basename(EXTERNALS[name].path)));
    }
  });
  // 复制 external 资源到输出目录
  FinalPlugins.push(new CopyWebpackPlugin(ExternalsCopyList));
  // html 中 external 的资源需要手动加入
  const IncludeAssetsConfig = new HtmlWebpackIncludeAssetsPlugin({
    assets: ExternalsBuildList,
    append: false,
  });

  FinalPlugins = FinalPlugins.concat(
    new webpack.optimize.ModuleConcatenationPlugin(),
    htmlPlugins,
    IncludeAssetsConfig,
    LibiaryChunks,
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
      'process.env.DEBUG': JSON.stringify(process.env.DEBUG)
    })
  );
  // if (!IS_DEV) {
  //   FinalPlugins.push(
  //     new ChunkManifestPlugin({
  //       filename: 'manifest.json',
  //       manifestVariable: 'webpackManifest'
  //     })
  //   );
  // }

  return {
    entry: Object.assign(pageEntry, LibiaryEntry),

    output: OutputConfig,

    module: {
      rules: [
        {
          test: /\.jsx$/,
          exclude: /node_modules/,
          loader: 'babel-loader',
          query: {
            presets: [
              [ path.resolve(MODULES_PATH, 'babel-preset-env'), {
                targets: {
                  browsers: BROWSER_SUPPORTS
                }, 
                module: false,
              }],
              path.resolve(MODULES_PATH, 'babel-preset-react'),
              path.resolve(MODULES_PATH, 'babel-preset-stage-1'),
            ],
            plugins: PROJECT_CONFIG.enableReactHotLoader ? [
              'react-hot-loader/babel',
              path.resolve(MODULES_PATH, 'babel-plugin-syntax-dynamic-import'),
            ] : [
              path.resolve(MODULES_PATH, 'babel-plugin-syntax-dynamic-import')
            ],
          }
        },
        {
          test: /\.svg$/,
          exclude: /node_modules/,
          use: [
            {
              loader: 'babel-loader',
              options: {
                presets: [
                  [ path.resolve(MODULES_PATH, 'babel-preset-env'), {
                    targets: {
                      browsers: BROWSER_SUPPORTS
                    },
                    module: false,
                  }],
                  path.resolve(MODULES_PATH, 'babel-preset-react'),
                ],
              },
            },
            {
              loader: 'react-svg-loader',
              options: {
                svgo: {
                  floatPrecision: 2,
                },
              },
            },
          ],
        },
        StyleLoaderConfig,
        ImageLoaderConfig,
        {
          test: /\.html$/,
          use: [
            {
              loader: 'html-loader',
              options: {
                interpolate: true,
                root: './',
              },
            },
          ],
        }
      ]
    },

    externals: ExternalsConfig,

    resolve: {
      modules: [
        'node_modules',
        MODULES_PATH,
      ]
    },

    target: 'web',

    devtool: IS_DEV ? 'cheap-module-source-map': 'source-map',

    resolveLoader: {
      modules: [ MODULES_PATH ],
    },

    plugins: FinalPlugins,
  };

};
