const AudioManager = {
    initialized: false,
    init: function() {
        if(this.initialized) return;

        Tone.context.lookAhead = 0.02;
        Tone.context.latencyHint = 'fastest';

        this.audioContext = Tone.getContext().rawContext;
        this.outputNode = this.audioContext.createGain();
        this.outputNode.gain.value = 1;
        this.outputNode.connect(this.audioContext.destination);
        this.fireSynth = new Tone.MembraneSynth({
            pitchDecay: 0.05,
            octaves: 4,
            oscillator: { type: "sine" },
            envelope: {
                attack: 0.001,
                decay: 0.2,
                sustain: 0.01,
                release: 1.4,
                attackCurve: "exponential"
            }
        }).connect(this.outputNode);
        this.fireSynth.volume.value = -10;

        this.catchSynth = new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: "triangle" },
            envelope: {
                attack: 0.01,
                decay: 0.1,
                sustain: 0.1,
                release: 1
            }
        }).connect(this.outputNode);
        this.catchSynth.volume.value = -15;

        this.uiSynth = new Tone.MetalSynth({
            frequency: 200,
            envelope: {
                attack: 0.001,
                decay: 0.1,
                release: 0.01
            },
            harmonicity: 5.1,
            modulationIndex: 32,
            resonance: 4000,
            octaves: 1.5
        }).connect(this.outputNode);
        this.uiSynth.volume.value = -20;

        this.bgPlayer = new Tone.Player({
            url: "./loop-01.mp3",
            loop: true,
            fadeIn: 2,
            volume: -10
        }).connect(this.outputNode);

        this.webSynth = new Tone.NoiseSynth({
            noise: { type: "white" },
            envelope: {
                attack: 0.001,
                decay: 0.1,
                sustain: 0,
                release: 0.1
            }
        }).connect(this.outputNode);
        this.webSynth.volume.value = -20;

        this.bubbleSynth = new Tone.MembraneSynth({
            octaves: 10,
            pitchDecay: 0.01,
            envelope: {
                attack: 0.01,
                decay: 0.1,
                sustain: 0.01,
                release: 0.01
            }
        }).connect(this.outputNode);
        this.bubbleSynth.volume.value = -25;

        // 为暴击和强力击打准备的合成器
        this.powerSynth = new Tone.PolySynth(Tone.FMSynth, {
            oscillator: { type: "square" },
            envelope: { attack: 0.01, decay: 0.2, sustain: 0.2, release: 1.5 },
            modulationIndex: 5,
            harmonicity: 1.5
        }).connect(this.outputNode);
        this.powerSynth.volume.value = -12;

        this.initialized = true;
    },

    getOutputNode: function() {
        if(!this.initialized) this.init();
        return this.outputNode;
    },

    playFire: function() {
        if(!this.initialized) this.init();
        var now = Tone.now();
        this._lastFireTime = this._lastFireTime || 0;
        var t = Math.max(now, this._lastFireTime);
        if (t > now + 0.2) return;
        this.fireSynth.triggerAttackRelease("C1", "8n", t);
        this._lastFireTime = t + 0.05;
    },

    playCatch: function() {
        if(!this.initialized) this.init();
        var now = Tone.now();
        this._lastCatchTime = this._lastCatchTime || 0;
        var t = Math.max(now, this._lastCatchTime);
        if (t > now + 0.2) return;
        this.catchSynth.triggerAttackRelease(["C5", "E5", "G5"], "16n", t);
        this._lastCatchTime = t + 0.05;
    },

    playUI: function() {
        if(!this.initialized) this.init();
        var now = Tone.now();
        this._lastUITime = this._lastUITime || 0;
        var t = Math.max(now, this._lastUITime);
        if (t > now + 0.2) return;
        this.uiSynth.triggerAttackRelease("16n", t);
        this._lastUITime = t + 0.05;
    },

    playBubble: function() {
        if(!this.initialized) this.init();
        var now = Tone.now();
        this._lastBubbleTime = this._lastBubbleTime || 0;
        var t = Math.max(now, this._lastBubbleTime);
        if (t > now + 0.25) return;
        var freq = 400 + Math.random() * 1000;
        this.bubbleSynth.triggerAttackRelease(freq, "32n", t);
        this._lastBubbleTime = t + 0.05;
    },

    playWeb: function() {
        if(!this.initialized) this.init();
        var now = Tone.now();
        this._lastWebTime = this._lastWebTime || 0;
        var t = Math.max(now, this._lastWebTime);
        if (t > now + 0.2) return;
        this.webSynth.triggerAttackRelease("16n", t);
        this._lastWebTime = t + 0.05;
    },

    playCritical: function() {
        if(!this.initialized) this.init();
        var now = Tone.now();
        this.powerSynth.triggerAttackRelease(["C5", "E5"], "8n", now);
    },

    playMegaHit: function() {
        if(!this.initialized) this.init();
        var now = Tone.now();
        this.powerSynth.triggerAttackRelease(["C4", "E4", "G4", "B4"], "4n", now);
    },

    playOneShot: function() {
        if(!this.initialized) this.init();
        var now = Tone.now();
        this.powerSynth.triggerAttackRelease(["A2", "A3", "C4", "E4", "A4"], "1m", now);
    },

    startAmbient: function() {
        if(!this.initialized) this.init();
        Tone.start().then(() => {
            if (this.bgPlayer.state !== "started") {
                this.bgPlayer.start();
            }
        });
    }
};
