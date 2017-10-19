const LoggerUtils = require('./LoggerUtils');
const spawn = require('child_process').spawn;
const EventEmitter = require('events').EventEmitter.prototype;
const _ = require('lodash');

//const defaultArgs = ['-msglevel', 'global=6', '-msglevel', 'cplayer=4', '-idle', '-slave', '-fs', '-noborder'];
const defaultArgs = ['-msglevel', 'global=6', '-msglevel', 'cplayer=4', '-idle', '-slave', '-noborder'];

const Player = function(options) {
    this.options = options;
    this.spawn();
};

Player.prototype = _.extend({

    spawn: function() {
        let args = [];

        if(typeof this.options.args === 'string') {
            args = this.options.args.split(' ');
        } else if(Array.isArray(this.options.args)) {
            args = this.options.args
        }

        let instance;

        if (process.platform === 'win32') {
            instance = spawn('bin/win/mplayer', defaultArgs.concat(args));
        }

        this.setStatus();

        let startTime = Date.now();

        instance.stdout.on('data', this.onData.bind(this));
        instance.stderr.on('data', this.onError.bind(this));

        instance.on('exit', function() {

            if(Date.now() - startTime < 3000) {
                // Process is erroring too close to start up, abort.
                process.exit(1);
            }

            if(this.options.debug) {
                LoggerUtils.info('mplayer process exited, restarting...');
            }

            this.emit('playstop');
            this.spawn();

        }.bind(this));

        this.instance = instance;
    },

    cmd: function(command, arguments) {
        arguments = arguments || [];

        if(typeof arguments.length === 'undefined') {
            arguments = [arguments];
        }

        if(this.options.debug) {
            LoggerUtils.info('>>>> COMMAND: ' + command, arguments);
        }

        this.instance.stdin.write([command].concat(arguments).join(' ') + '\n');
    },

    getStatus: function() {
        this.cmd('get_time_length');
        this.cmd('get_vo_fullscreen');
        this.cmd('get_sub_visibility');
    },

    setStatus: function(status) {
        let defaults = {
            duration: 0,
            fullscreen: false,
            subtitles: false,
            filename: null,
            title: null
        };

        if(status) {
            this.status = _.defaults(_.extend(this.status || {}, status || {}), defaults);
        } else {
            this.status = _.defaults({}, defaults);
        }

        this.emit('statuschange', this.status);
    },

    onData: function(data) {
        if(this.options.debug) {
            LoggerUtils.info('stdout: ' + data);
        }

        data = data.toString();

        if(data.indexOf('MPlayer') === 0) {
            this.emit('ready');
            this.setStatus(false);
        }

        if(data.indexOf('StreamTitle') !== -1) {
            this.setStatus({
                title: data.match(/StreamTitle='([^']*)'/)[1]
            });
        }

        if(data.indexOf('Playing ') !== -1) {
            let file = data.match(/Playing\s(.+?)\.\s/)[1];
            this.setStatus(false);
            this.setStatus({
                filename: file
            });
            this.getStatus();
        }

        if(data.indexOf('Starting playback...') !== -1) {
            this.emit('playstart');
        }

        if(data.indexOf('EOF code:') > -1) {
            let codeStart, code;

            codeStart = data.indexOf('code:') + 5;
            code = data.substr(codeStart, 2).trim();
            code = parseInt(code, 10);

            this.emit('playstop', code);
            this.setStatus();
        }

        if(data.indexOf('A:') === 0) {
            let timeStart, timeEnd, time;

            if(data.indexOf(' V:') !== -1) {
                timeStart = data.indexOf(' V:') + 3;
                timeEnd = data.indexOf(' A-V:');
            } else {
                timeStart = data.indexOf('A:') + 2;
                timeEnd = data.indexOf(' (');
            }

            time = data.substring(timeStart, timeEnd).trim();

            this.emit('timechange', time)
        }

        if(data.indexOf('ANS_LENGTH') !== -1 && data.indexOf('ANS_VO_FULLSCREEN') !== -1 && data.indexOf('ANS_SUB_VISIBILITY') !== -1) {
            this.setStatus({
                duration: parseFloat(data.match(/ANS_LENGTH=([0-9\.]*)/)[1]),
                fullscreen: (parseInt(data.match(/ANS_VO_FULLSCREEN=([01])/)[1]) === 1),
                subtitles: (parseInt(data.match(/ANS_SUB_VISIBILITY=([01])/)[1]) === 1)
            });
        }
    },

    onError: function(error) {
        if(this.options.debug) {
            console.log('stderr: ' + error);
        }
    }

}, EventEmitter);

module.exports = Player;