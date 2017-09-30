module.exports = {
  libiary: {},
  externals: {},
  browser_support: {
    DEVELOPMENT: [ 'last 2 versions' ],
    PRODUCTION: [ 'last 2 versions' ]
  },
  build_path: './dist',
  base64: {
    enable: true,
    limit: 10000
  },
  publicPath: '../',
  supportIE8: false,
  htmlAssetsInject: true,
  framework: 'react',
  useBuiltIns: false,
};