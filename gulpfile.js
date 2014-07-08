var fs = require('fs');
var gulp = require('gulp');
var gutil = require('gulp-util');
var concat = require('gulp-concat');
var minifyCSS = require('gulp-minify-css');
var rename = require("gulp-rename");
var webpack = require('webpack');
var uglify = require('uglify-js');
var rimraf = require('rimraf');
var merge = require('merge-stream');

var ENTRY             = './index.js';
var HEADER            = './lib/header.js';
var DIST              = './dist';
var VIS_JS            = 'vis.js';
var VIS_MAP           = 'vis.map';
var VIS_CSS           = 'vis.css';
var VIS_MIN_CSS       = 'vis.min.css';
var DIST_VIS_MIN_JS   = DIST + '/vis.min.js';
var DIST_VIS_MAP      = DIST + '/' + VIS_MAP;

// generate banner with today's date and correct version
function createBanner() {
  var today = gutil.date(new Date(), 'yyyy-mm-dd'); // today, formatted as yyyy-mm-dd
  var version = require('./package.json').version;

  return String(fs.readFileSync(HEADER))
      .replace('@@date', today)
      .replace('@@version', version);
}

var bannerPlugin = new webpack.BannerPlugin(createBanner(), {
  entryOnly: true,
  raw: true
});

// TODO: the moment.js language files should be excluded by default (they are quite big)
var webpackConfig = {
  entry: ENTRY,
  output: {
    library: 'vis',
    libraryTarget: 'umd',
    path: DIST,
    filename: VIS_JS,
    sourcePrefix: '  '
  },
  plugins: [ bannerPlugin ],
  cache: true
};

var uglifyConfig = {
  outSourceMap: VIS_MAP,
  output: {
    comments: /@license/
  }
};

// create a single instance of the compiler to allow caching
var compiler = webpack(webpackConfig);

// clean the dist directory
gulp.task('clean', function (cb) {
  rimraf(DIST, cb);
});

gulp.task('bundle-js', ['clean'], function (cb) {
  // update the banner contents (has a date in it which should stay up to date)
  bannerPlugin.banner = createBanner();

  compiler.run(function (err, stats) {
    if (err) gutil.log(err);
    cb();
  });
});

// bundle and minify css
gulp.task('bundle-css', ['clean'], function () {
  var files = [
    './lib/timeline/component/css/timeline.css',
    './lib/timeline/component/css/panel.css',
    './lib/timeline/component/css/labelset.css',
    './lib/timeline/component/css/itemset.css',
    './lib/timeline/component/css/item.css',
    './lib/timeline/component/css/timeaxis.css',
    './lib/timeline/component/css/currenttime.css',
    './lib/timeline/component/css/customtime.css',
    './lib/timeline/component/css/animation.css',

    './lib/timeline/component/css/dataaxis.css',
    './lib/timeline/component/css/pathStyles.css',

    './lib/network/css/network-manipulation.css',
    './lib/network/css/network-navigation.css'
  ];

  return gulp.src(files)
      .pipe(concat(VIS_CSS))
      .pipe(gulp.dest(DIST))

    // TODO: nicer to put minifying css in a separate task?
      .pipe(minifyCSS())
      .pipe(rename(VIS_MIN_CSS))
      .pipe(gulp.dest(DIST));
});

gulp.task('copy-img', ['clean'], function () {
  var network = gulp.src('./lib/network/img/**/*')
      .pipe(gulp.dest(DIST + '/img/network'));

  var timeline = gulp.src('./lib/timeline/img/**/*')
      .pipe(gulp.dest(DIST + '/img/timeline'));

  return merge(network, timeline);
});

gulp.task('minify', ['bundle-js'], function (cb) {
  var result = uglify.minify([DIST + '/' + VIS_JS], uglifyConfig);

  fs.writeFileSync(DIST_VIS_MIN_JS, result.code);
  fs.writeFileSync(DIST_VIS_MAP, result.map);

  cb();
});

gulp.task('bundle', ['bundle-js', 'bundle-css', 'copy-img']);

// The watch task (to automatically rebuild when the source code changes)
gulp.task('watch', ['bundle', 'minify'], function () {
  gulp.watch(['index.js', 'lib/**/*'], ['bundle', 'minify']);
});

// The watch task (to automatically rebuild when the source code changes)
// this watch only rebuilds vis.js, not vis.min.js
gulp.task('watch-dev', ['bundle'], function () {
  gulp.watch(['index.js', 'lib/**/*'], ['bundle']);
});

// The default task (called when you run `gulp`)
gulp.task('default', ['clean', 'bundle', 'minify']);