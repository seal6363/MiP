var gulp = require('gulp');
var dest = require('gulp-dest');
var path = require('path');
var util = require('util');
var requirePostfixUpdator = require('gulp-ojbridge').requirePostfixModifier;
var encrypt = require('gulp-ojbridge').encrypt;

const EXAMPLE_APP_PATH = '../OJBDevicePlayground';
const POD_SOURCE_PATH = 'encrypted';
const PASSWORD = '123fartasvfdfhasrtasef';

// Setup the watch event:

gulp.task('watch', () => {

    gulp.watch(['*.js', '!gulpfile.js'], (event) => {

        if (event.type != 'changed') {
            return;
        }

        var sourceName = path.basename(event.path);
        var destName = util.format('%s.es', path.parse(event.path).name);
        
        console.log('working on: ' + sourceName);
        return gulp.src(sourceName, {})
        .pipe(gulp.dest(EXAMPLE_APP_PATH))
        .pipe(requirePostfixUpdator('es'))
        .pipe(encrypt(PASSWORD))
        .pipe(dest('./', {ext: 'es'}))
        .pipe(gulp.dest(POD_SOURCE_PATH))
        .pipe(gulp.dest(EXAMPLE_APP_PATH));
    });
});

