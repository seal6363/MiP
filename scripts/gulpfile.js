var gulp = require('gulp');
var dest = require('gulp-dest');
var ts = require('gulp-typescript');
var merge = require('merge2');
var path = require('path');
var util = require('util');
var requirePostfixUpdator = require('gulp-ojbridge').requirePostfixModifier;
var encrypt = require('gulp-ojbridge').encrypt;

const EXAMPLE_APP_PATH = '../OJBDevicePlayground';
const POD_SOURCE_PATH = 'encrypted';
const PASSWORD = '123fartasvfdfhasrtasef';
const TS_DEFINITIONS = './release/definitions'
const TS_RESULT_DEST = './release/js'

gulp.task('scripts', function() {
    
    var tsProject = ts.createProject('tsconfig.json');
    var tsResults = gulp.src('*.ts')
    .pipe(ts(tsProject));
    
    return merge([
        tsResults.dts.pipe(gulp.dest(TS_DEFINITIONS)),
        tsResults.js.pipe(gulp.dest(TS_RESULT_DEST))
    ]);
})

// Setup the watch event:

gulp.task('watch', function() {
    
    // setup the typescript task:
    gulp.watch('*.ts', ['scripts']);

    // setup the encryption task:
    gulp.watch(util.format('%s/*.js', TS_RESULT_DEST), function(event) {

        if (event.type != 'changed') {
            return;
        }

        var sourceName = path.basename(event.path);
        var destName = util.format('%s.es', path.parse(event.path).name);
        
        console.log('working on: ' + sourceName);
        return gulp.src(event.path, {})
        .pipe(gulp.dest(EXAMPLE_APP_PATH))
        .pipe(requirePostfixUpdator('es'))
        .pipe(encrypt(PASSWORD))
        .pipe(dest('./', {ext: 'es'}))
        .pipe(gulp.dest(POD_SOURCE_PATH))
        .pipe(gulp.dest(EXAMPLE_APP_PATH));
    });
});

