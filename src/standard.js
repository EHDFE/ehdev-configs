const path = require('path');
const fs = require('fs');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const HtmlWebpackIncludeAssetsPlugin = require('html-webpack-include-assets-plugin');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
// const ChunkManifestPlugin = require('chunk-manifest-webpack-plugin');

const WORK_DIR = process.cwd();
const SOURCE_PATH = path.resolve(WORK_DIR, './src');
const PAGE_PATH = path.resolve(SOURCE_PATH, './pages');
const BUILD_PATH = path.resolve(WORK_DIR, './dist');
const MODULES_PATH = path.resolve(__dirname, '../node_modules');

/**
 * 标准化项目输出配置
 * @{param} env: 'development' or 'production' 指定开发环境或生产环境
 */
module.exports = (env = 'development', options) => {

  // 开发环境
  const IS_DEV = env === 'development';

  // 默认项目配置
  const DEFAULT_PROJECT_CONFIG = {
    libiary: {},
    externals: {},
    browser_support: {
      DEVELOPMENT: [ 'last 2 versions' ],
      PRODUCTION: [ 'last 2 versions' ]
    },
  };
  const PROJECT_CONFIG = Object.assign(
    DEFAULT_PROJECT_CONFIG,
    require(path.resolve(WORK_DIR, './abc.json'))
  );
  const EXTERNALS = PROJECT_CONFIG.externals;

  // refer to: https://github.com/ai/browserslist#queries
  const BROWSER_SUPPORTS = PROJECT_CONFIG.browser_support[env.toUpperCase()];

  // 页面级列表
  const pages = fs.readdirSync(PAGE_PATH);
  
  let FinalPlugins = [];
  if (IS_DEV) {
    FinalPlugins.push(new webpack.HotModuleReplacementPlugin());
  }

  // 构建输出map
  const pageEntry = {};
  pages.map(page => {
    let entry = [
      path.resolve(PAGE_PATH, `./${page}/index.js`),
    ];
    if (IS_DEV) {
      entry.unshift(
        `webpack-dev-server/client?http://localhost:${options.port}`,
        'webpack/hot/dev-server'
      );
    }
    pageEntry[`${page}/bundle`] = entry;
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
  LibiaryList.forEach(name => {
    LibiaryEntry[`assets/${name}`] = PROJECT_CONFIG.libiary[name].map(file => path.resolve(SOURCE_PATH, file));
  });

  // 输出页面配置
  const htmlPlugins = pages.map(page => new HtmlWebpackPlugin({
    filename: `${page}/index.html`,
    template: path.resolve(PAGE_PATH, `./${page}/index.html`),
    chunksSortMode: 'auto',
    chunks: [].concat(LibiaryList.map(name => `assets/${name}`), `${page}/bundle`),
  }));

  // 公共模块配置
  const LibiaryChunks = LibiaryList.map(
    name => new webpack.optimize.CommonsChunkPlugin({
      name: `assets/${name}`,
      minChunks: Infinity,
    })
  );

  // css 解析配置
  // 开发环境：使用 style loader 注入页面
  // 生产环境：使用 ExtractTextPlugin 抽成独立 css 文件
  let StyleLoaderConfig;
  const CommonStyleLoader = [
    {
      loader: 'css-loader',
      options: {
        minimize: !IS_DEV,
      },
    },
    {
      loader: 'postcss-loader',
      options: {
        plugins() {
          return [
            require('autoprefixer')({
              browsers: BROWSER_SUPPORTS
            }),
          ];
        }
      },
    },
    'less-loader',
  ];
  
  let ImageLoaderConfig;
  if (IS_DEV) {
    StyleLoaderConfig = [
      'style-loader',
    ].concat(CommonStyleLoader);
    // 开发环境 图片不做处理
    ImageLoaderConfig = [
      {
        loader: 'file-loader',
        options: {
          name: '[name].[ext]',
        },
      },
    ]
  } else {
    StyleLoaderConfig = ExtractTextPlugin.extract({
      fallback: 'style-loader',
      use: CommonStyleLoader,
    });
    FinalPlugins.push(new ExtractTextPlugin({
      filename: '[name].[contenthash:8].css',
    }));
    // 生产环境 图片需要优化
    ImageLoaderConfig = [
      {
        loader: 'url-loader',
        options: {
          limit: 10000,
          name: '[name].[hash:8].[ext]',
        },
      },
      {
        loader: 'image-webpack-loader',
        query: {
          progressive: true,
          optipng: {
            optimizationLevel: 3,
          },
          gifsicle: {
            interlaced: true,
          },
          pngquant: {
            quality: '65-80',
            speed: 5
          }
        }
      },
    ];
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
  FinalPlugins.push(new CopyWebpackPlugin(ExternalsCopyList));
  // html 中 external 的资源需要手动加入
  const IncludeAssetsConfig = new HtmlWebpackIncludeAssetsPlugin({
    assets: ExternalsBuildList,
    append: false,
  });

  FinalPlugins = FinalPlugins.concat(
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
            ]
          }
        },
        {
          test: /\.(le|c)ss$/,
          use: StyleLoaderConfig,
        },
        {
          test: /\.(png|jpe?g|gif|svg)$/,
          use: ImageLoaderConfig,
        },
        {
          test: /\.html$/,
          use: [
            {
              loader: 'html-loader',
              options: {
                minimize: !IS_DEV,
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

    devtool: IS_DEV ? 'cheap-module-source-map': 'source-map',

    resolveLoader: {
      modules: [ MODULES_PATH ]
    },

    plugins: FinalPlugins,
  };

};