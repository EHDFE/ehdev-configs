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
  svgToReactComponent: false,
  // 使用 pages 下面的目录名做为 html 名称，只对 standard 项目生效
  useFolderAsHtmlName: false,
};