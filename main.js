const Player = require('./lib/Player');
const LoggerUtils = require('./lib/LoggerUtils');
const EventEmitter = require('events').EventEmitter.prototype;
const _ = require('lodash');

const defaults = {
    verbose: false,
    debug: false
};

const MPlayer = function (options) {
    options = _.defaults(options || {}, defaults);

    let pauseTimeout,
        paused = false;

    LoggerUtils.setPrefix('MPlayer');

    this.player = new Player(options);
    this.status = {
        muted: false,
        playing: false,
        volume: 0
    };

    this.player.once('ready', function() {
        if(options.verbose) {
            LoggerUtils.info('player.ready');
        }
        this.emit('ready');
    }.bind(this));

    this.player.on('statuschange', function(status) {
        this.status = _.extend(this.status, status);
        if(options.verbose) {
            LoggerUtils.info('player.status', this.status);
        }
        this.emit('status', this.status);
    }.bind(this));

    this.player.on('playstart', function() {
        if(options.verbose) {
            LoggerUtils.info('player.start');
        }
        this.emit('start');
    }.bind(this));

    this.player.on('playstop', function(code) {
        if(options.verbose) {
            LoggerUtils.info('player.stop', code);
        }
        this.emit('stop', code)
    }.bind(this));

    this.player.on('timechange', function(time) {
        clearTimeout(pauseTimeout);

        pauseTimeout = setTimeout(function() {
            paused = true;
            this.status.playing = false;
            this.emit('pause');
            if(options.verbose) {
                LoggerUtils.info('player.pause');
            }
        }.bind(this), 100);

        if(paused) {
            paused = false;
            this.status.playing = true;
            this.emit('play');

            if(options.verbose) {
                LoggerUtils.info('player.play');
            }
        }

        this.status.position = time;
        this.emit('time', time);

        if(options.verbose) {
            LoggerUtils.info('player.time', time);
        }
    }.bind(this));

};

MPlayer.prototype = _.extend({

    setOptions: function(options) {
        if(options && options.length) {
            options.forEach(function(value, key) {
                this.player.cmd('set_property', [key, value]);
            }.bind(this));
        }
    },

    openFile: function(file, options) {
        this.player.cmd('stop');

        this.setOptions(options);
        this.player.cmd('loadfile', ['"' + file + '"']);

        this.status.playing = true;
    },

    openPlaylist: function(file, options) {
        this.player.cmd('stop');

        this.setOptions(options);
        this.player.cmd('loadlist', ['"' + file + '"']);

        this.status.playing = true;
    },

    play: function() {
        if(!this.status.playing) {
            this.player.cmd('pause');
            this.status.playing = true;
        }
    },

    pause: function() {
        if(this.status.playing) {
            this.player.cmd('pause');
            this.status.playing = false;
        }
    },

    stop: function() {
        this.player.cmd('stop');
        this.status.playing = false;
    },

    next: function() {
        this.player.cmd('pt_step 1');
    },

    previous: function() {
        this.player.cmd('pt_step -1');
    },

    seek: function(seconds) {
        this.player.cmd('seek', [seconds, 2]);
    },

    seekPercent: function(percent) {
        this.player.cmd('seek', [percent, 1]);
    },

    volume: function(percent) {
        this.status.volume = percent;
        this.player.cmd('volume', [percent, 1]);
    },

    mute: function() {
        this.status.muted = !this.status.muted;
        this.player.cmd('mute');
    },

    fullscreen: function() {
        this.status.fullscreen = !this.status.fullscreen;
        this.player.cmd('vo_fullscreen');
    },

    hideSubtitles: function() {
        this.player.cmd('sub_visibility', [-1]);
    },

    showSubtitles: function() {
        this.player.cmd('sub_visibility', [1]);
    },

    cycleSubtitles: function() {
        this.player.cmd('sub_select');
    },

    speedUpSubtitles: function() {
        this.player.cmd('sub_step', [1]);
    },

    slowDownSubtitles: function() {
        this.player.cmd('sub_step', [-1]);
    },

    adjustSubtitles: function(seconds) {
        this.player.cmd('sub_delay', [seconds]);
    },

    adjustAudio: function(seconds) {
        this.player.cmd('audio_delay', [seconds]);
    },

    playbackSpeed: function (speed) {
        this.player.cmd('speed_mult', speed);
    }

}, EventEmitter);

module.exports = MPlayer;