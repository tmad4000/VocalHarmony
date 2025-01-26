class AudioProcessor {
    constructor() {
        this.mic = null;
        this.gainNode = null;
        this.analyser = null;
        this.isInitialized = false;
        this.harmonyInterval = 3;
        this.harmonyType = 'voice-formant';
        this.recorder = null;
        this.recordedChunks = [];
        this.isAsyncMode = false;
        this.recordedAudio = null;
        this.pitchShift = null;
        this.crossFade = null;
        this.sampler = null;
    }

    async initialize(isAsync = false) {
        if (this.isInitialized) return;

        try {
            await Tone.start();
            this.isAsyncMode = isAsync;

            // Create audio nodes
            this.mic = new Tone.UserMedia();
            this.pitchShift = new Tone.PitchShift({
                pitch: 0,
                windowSize: 0.1,
                delayTime: 0,
                feedback: 0,
                wet: 1
            }).toDestination();

            // Initialize samplers for different instruments
            this.sampler = {
                'synth-pad': new Tone.Synth({
                    oscillator: { type: 'sine' },
                    envelope: { attack: 0.1, decay: 0.2, sustain: 0.8, release: 1 }
                }),
                'choir': new Tone.Sampler({
                    urls: {
                        'C4': 'https://tonejs.github.io/audio/salamander/C4.mp3',
                    },
                    baseUrl: 'https://tonejs.github.io/audio/salamander/'
                }),
                'strings': new Tone.Sampler({
                    urls: {
                        'C4': 'https://tonejs.github.io/audio/salamander/C4.mp3',
                    },
                    baseUrl: 'https://tonejs.github.io/audio/salamander/'
                })
            };

            this.crossFade = new Tone.CrossFade(0.5);
            this.gainNode = new Tone.Gain(0.8);
            this.analyser = new Tone.Analyser("waveform", 2048);

            await this.mic.open();

            if (!this.isAsyncMode) {
                this.setupAudioChain();
            }

            this.isInitialized = true;

        } catch (error) {
            console.error('Error initializing audio:', error);
            throw error;
        }
    }

    setupAudioChain() {
        // Disconnect existing connections
        this.mic.disconnect();
        this.pitchShift.disconnect();
        this.crossFade.disconnect();
        this.gainNode.disconnect();

        if (this.harmonyType === 'voice-basic') {
            // Basic pitch shift - original implementation without crossfade
            this.pitchShift.set({
                windowSize: 0.1,
                delayTime: 0,
                feedback: 0
            });

            this.mic.chain(
                this.pitchShift,
                this.gainNode,
                this.analyser,
                Tone.Destination
            );

            // Direct mic monitoring
            this.mic.connect(this.gainNode);

        } else if (this.harmonyType === 'voice-formant') {
            // Advanced formant-preserved pitch shifting
            this.pitchShift.set({
                windowSize: 0.05,
                delayTime: 0.01
            });

            this.mic.chain(
                this.crossFade.a,
                this.pitchShift,
                this.gainNode,
                this.analyser,
                Tone.Destination
            );

            this.mic.connect(this.crossFade.b);
            this.crossFade.b.connect(this.gainNode);

        } else {
            // Instrument harmony setup
            const instrument = this.sampler[this.harmonyType];
            if (instrument) {
                this.mic.connect(this.analyser);
                this.mic.connect(Tone.Destination);
                instrument.connect(this.gainNode);
                this.gainNode.connect(Tone.Destination);
            }
        }
    }

    setHarmonyType(type) {
        this.harmonyType = type;
        if (this.isInitialized && !this.isAsyncMode) {
            this.setupAudioChain();
        }
    }

    startRecording() {
        if (!this.isAsyncMode || !this.mic) return;

        const micStream = this.mic.context.rawContext.createMediaStreamSource(this.mic._mediaStream);
        this.recorder = new MediaRecorder(this.mic._mediaStream);
        this.recordedChunks = [];

        this.recorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
                this.recordedChunks.push(e.data);
            }
        };

        this.recorder.onstop = async () => {
            const blob = new Blob(this.recordedChunks, { type: 'audio/webm' });
            const audioUrl = URL.createObjectURL(blob);
            this.recordedAudio = await Tone.Buffer.fromUrl(audioUrl);
        };

        this.recorder.start();
    }

    stopRecording() {
        if (this.recorder && this.recorder.state === "recording") {
            this.recorder.stop();
        }
    }

    async playProcessedAudio() {
        if (!this.recordedAudio) return;

        const player = new Tone.Player(this.recordedAudio);
        player.chain(
            this.pitchShift,
            this.gainNode,
            this.analyser,
            Tone.Destination
        );

        player.loop = false;
        await player.start();

        return new Promise((resolve) => {
            player.onstop = () => {
                player.dispose();
                resolve();
            };
        });
    }

    updatePitchShift() {
        if (!this.pitchShift) return;

        // Calculate semitones based on harmony interval
        let semitones = 0;
        switch(parseInt(this.harmonyInterval)) {
            case 1: semitones = 0; break;
            case 3: semitones = 4; break;
            case 4: semitones = 5; break;
            case 5: semitones = 7; break;
            case 7: semitones = 11; break;
        }

        if (this.harmonyType.startsWith('voice')) {
            this.pitchShift.pitch = semitones;
        } else if (this.sampler[this.harmonyType]) {
            // Handle instrument harmony
            const baseNote = 60; // Middle C
            const newNote = baseNote + semitones;
            this.sampler[this.harmonyType].triggerAttack(Tone.Frequency(newNote, "midi"));
        }

        // Only use crossfade for formant-preserved mode
        if (this.harmonyType === 'voice-formant') {
            const crossfadeAmount = Math.min(0.8, Math.abs(semitones) / 12);
            this.crossFade.fade.value = crossfadeAmount;
        }
    }

    setHarmonyInterval(interval) {
        this.harmonyInterval = parseInt(interval);
        this.updatePitchShift();
    }

    setVolume(value) {
        if (this.gainNode) {
            this.gainNode.gain.value = Math.max(0, Math.min(1.5, value * 1.5));
        }
    }

    async startProcessing() {
        if (this.mic && !this.isAsyncMode) {
            await Tone.start();
            await this.mic.open();
        }
    }

    async stopProcessing() {
        if (this.mic) {
            await this.mic.close();
        }
        if (this.gainNode) {
            this.gainNode.disconnect();
        }
        if (this.pitchShift) {
            this.pitchShift.disconnect();
        }
        if (this.crossFade) {
            this.crossFade.disconnect();
        }
        this.isInitialized = false;
    }

    getAnalyser() {
        return this.analyser;
    }
}