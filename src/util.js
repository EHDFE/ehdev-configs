const path = require('path');
const glob = require('glob');
const ExtractTextPlugin = require('extract-text-webpack-plugin');

exports.getHTML = (cwd) => glob.sync('*.html', {
  cwd,
});

/**
 * 其它文件处理
 */
exports.getOtherFileLoaderConfig = (PROJECT_CONFIG) => ({
  test: /\.(swf|xlsx?|txt|docx?|pptx?|ico|cur|webp|woff|eot|ttf)$/,
  use: {
    loader: 'file-loader',
    options: {
      name: '[name].[ext]',
      outputPath: 'assets/',
      publicPath: PROJECT_CONFIG.publicPath,
    },
  },
});

/**
 * 样式和图片配置
 * 开发环境：使用 style loader 注入页面
 * 生产环境：使用 ExtractTextPlugin 抽成独立 css 文件
 */
exports.getStyleWithImageLoaderConfig = (IS_DEV, BROWSER_SUPPORTS, PUBLIC_PATH, base64Config) => {
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
              browsers: BROWSER_SUPPORTS,
            }),
          ];
        }
      },
    },
    'less-loader',
  ];
  let StyleLoaderConfig;
  let ImageLoaderConfig;
  let ExtractCssPlugin;
  if (IS_DEV) {
    StyleLoaderConfig = [
      'style-loader',
      ...CommonStyleLoader
    ];
    // 开发环境 图片不做处理
    ImageLoaderConfig = [
      {
        loader: 'file-loader',
        options: {
          name: '[name].[ext]',
          outputPath: 'assets/',
          publicPath: PUBLIC_PATH,
        },
      },
    ];
  } else {
    StyleLoaderConfig = ExtractTextPlugin.extract({
      fallback: 'style-loader',
      use: CommonStyleLoader,
    });
    ExtractCssPlugin = new ExtractTextPlugin({
      filename: '[name].[contenthash:8].css',
    });
    // 生产环境 图片需要优化
    const c = {
      name: '[name].[hash:8].[ext]',
      outputPath: 'assets/',
      publicPath: PUBLIC_PATH,
    };
    if (base64Config.enable) {
      Object.assign(c, {
        limit: base64Config.limit,
      });
    }
    ImageLoaderConfig = [
      {
        loader: base64Config.enable ? 'url-loader' : 'file-loader',
        options: c,
      },
    ];
  }
  return {
    StyleLoaderConfig: {
      test: /\.(le|c)ss$/,
      use: StyleLoaderConfig,
    },
    ImageLoaderConfig: {
      test: /\.(png|jpe?g|gif)$/,
      use: ImageLoaderConfig,
    },
    ExtractCssPlugin,
  }
}

exports.HtmlLoaderConfig = {
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
};

/**
 * svg 处理
 */
exports.getSVGLoaderConfig = (PROJECT_CONFIG, MODULES_PATH, BROWSER_SUPPORTS) => {
  if (PROJECT_CONFIG.framework === 'react') {
    return {
      test: /\.svg$/,
      exclude: /node_modules/,
      oneOf: [
        {
          resourceQuery: /assets/, // foo.svg?assets,
          use: {
            loader: 'file-loader',
            options: {
              name: '[name].[ext]',
              outputPath: 'assets/',
              publicPath: PROJECT_CONFIG.publicPath,
            },
          },
        },
        {
          // resourceQuery: /^(?!.*assets)/, // foo.svg
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
                    useBuiltIns: PROJECT_CONFIG.useBuiltIns,
                  }],
                  path.resolve(MODULES_PATH, 'babel-preset-react'),
                ],
                cacheDirectory: true,
              },
            },
            {
              loader: 'react-svg-loader',
              options: {
                svgo: {
                  floatPrecision: 2,
                  plugins: [{
                    cleanupIDs: false,
                  }],
                },
              },
            },
          ],
        }
      ],
    };
  } else {
    return {
      test: /\.svg$/,
      exclude: /node_modules/,
      use: {
        loader: 'file-loader',
        options: {
          name: '[name].[ext]',
          outputPath: 'assets/',
          publicPath: PROJECT_CONFIG.publicPath,
        },
      },
    }
  }
};

/**
 * js 处理
 */
exports.getJsLoader = (PROJECT_CONFIG, MODULES_PATH, BROWSER_SUPPORTS) => {
  const ret = {
    test: /\.jsx?$/,
    exclude: /node_modules/,
    loader: 'babel-loader',
  };
  if (PROJECT_CONFIG.framework === 'react') {
    Object.assign(ret, {
      options: {
        presets: [
          [ path.resolve(MODULES_PATH, 'babel-preset-env'), {
            targets: {
              browsers: BROWSER_SUPPORTS
            }, 
            module: false,
            useBuiltIns: PROJECT_CONFIG.useBuiltIns,
          }],
          path.resolve(MODULES_PATH, 'babel-preset-react'),
          path.resolve(MODULES_PATH, 'babel-preset-stage-1'),
        ],
      }
    });
  } else {
    Object.assign(ret, {
      options: {
        presets: [
          [ path.resolve(MODULES_PATH, 'babel-preset-env'), {
            targets: {
              browsers: BROWSER_SUPPORTS
            }, 
            module: false,
            useBuiltIns: PROJECT_CONFIG.useBuiltIns,
          }],
          path.resolve(MODULES_PATH, 'babel-preset-stage-1'),
        ],
      }
    });
  }
  return ret;
};