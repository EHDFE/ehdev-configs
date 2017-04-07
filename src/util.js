const glob = require('glob');

exports.getHTML = (cwd) => glob.sync('*.html', {
  cwd,
});