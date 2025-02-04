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
        this.reverb = null;
        this.bgMusic = null;
        this.bgMusicNext = null;
        this.bgMusicVolume = new Tone.Gain(0.5);
        this.currentBgTrack = 'none';
        this.crossfadeDuration = 2;
        this.lowPassFilter = null;  // New low-pass filter
        this.bgTracks = {
            'acoustic-guitar': 'https://tonejs.github.io/audio/berklee/guitar_chord1.mp3',
            'piano-ambient': 'https://tonejs.github.io/audio/salamander/basicPiano1.mp3',
            'soft-drums': 'https://tonejs.github.io/audio/drum-samples/loops/ominous.mp3',
            'electronic-pad': 'https://tonejs.github.io/audio/berklee/ambient_pad.mp3'
        };
    }

    async initialize(isAsync = false) {
        if (this.isInitialized) return;

        try {
            await Tone.start();
            this.isAsyncMode = isAsync;

            this.mic = new Tone.UserMedia();

            // Initialize low-pass filter
            this.lowPassFilter = new Tone.Filter({
                type: "lowpass",
                frequency: 2000, // Cut off frequencies above 2kHz
                rolloff: -24,    // Steeper rolloff for better feedback prevention
                Q: 1            // Quality factor
            }).toDestination();

            this.pitchShift = new Tone.PitchShift({
                pitch: 0,
                windowSize: 0.1,
                delayTime: 0,
                feedback: 0,
                wet: 1
            }).toDestination();

            this.reverb = new Tone.Reverb({
                decay: 4,
                preDelay: 0.2,
                wet: 0.3
            }).toDestination();

            this.bgMusic = new Tone.Player({
                loop: true,
                loopStart: 0,
                loopEnd: 8,
                fadeIn: 0.5,
                fadeOut: 0.5,
                volume: 0
            }).connect(this.bgMusicVolume);

            this.bgMusicNext = new Tone.Player({
                loop: true,
                loopStart: 0,
                loopEnd: 8,
                fadeIn: 0.5,
                fadeOut: 0.5,
                volume: -Infinity // Start silent
            }).connect(this.bgMusicVolume);

            this.bgMusicVolume.toDestination();

            this.sampler = {
                'synth-pad': new Tone.Synth({
                    oscillator: { type: 'sine' },
                    envelope: { attack: 0.1, decay: 0.2, sustain: 0.8, release: 1 }
                }),
                'choir': new Tone.PolySynth(Tone.Synth, {
                    voice: new Tone.Synth({
                        oscillator: {
                            type: "sawtooth8",
                            spread: 20,
                            count: 3
                        },
                        envelope: {
                            attack: 0.2,
                            decay: 0.1,
                            sustain: 1,
                            release: 0.8
                        }
                    }),
                    maxPolyphony: 6
                }).chain(
                    new Tone.Filter({
                        type: "lowpass",
                        frequency: 2000,
                        Q: 1
                    }),
                    this.reverb
                ),
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
        this.mic.disconnect();
        this.pitchShift.disconnect();
        this.crossFade.disconnect();
        this.gainNode.disconnect();
        this.lowPassFilter.disconnect();

        if (this.harmonyType === 'voice-basic') {
            this.mic.chain(
                this.lowPassFilter,    // Add filter to chain
                this.pitchShift,
                this.gainNode,
                this.analyser,
                Tone.Destination
            );

            this.mic.connect(this.gainNode);
            this.gainNode.connect(this.analyser);

        } else if (this.harmonyType === 'voice-formant') {
            this.mic.chain(
                this.lowPassFilter,    // Add filter to chain
                this.crossFade.a,
                this.pitchShift,
                this.gainNode,
                this.analyser,
                Tone.Destination
            );

            this.mic.connect(this.crossFade.b);
            this.crossFade.b.connect(this.gainNode);
            this.gainNode.connect(this.analyser);

        } else if (this.harmonyType === 'choir') {
            this.mic.connect(this.lowPassFilter);  // Connect through filter
            this.lowPassFilter.connect(this.analyser);
            this.lowPassFilter.connect(Tone.Destination);

            const detunes = [-10, -5, 0, 5, 10];
            detunes.forEach(detune => {
                const voice = this.sampler['choir'].voices[0];
                voice.detune.value = detune;
                voice.connect(this.gainNode);
            });

            this.gainNode.connect(this.analyser);
            this.gainNode.connect(this.reverb);
            this.reverb.connect(Tone.Destination);

        } else {
            const instrument = this.sampler[this.harmonyType];
            if (instrument) {
                this.mic.connect(this.lowPassFilter);  // Connect through filter
                this.lowPassFilter.connect(this.analyser);
                this.lowPassFilter.connect(Tone.Destination);
                instrument.connect(this.gainNode);
                this.gainNode.connect(this.analyser);
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
            const baseNote = 60;
            const newNote = baseNote + semitones;
            this.sampler[this.harmonyType].triggerAttack(Tone.Frequency(newNote, "midi"));
        }

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
        if (this.bgMusic && this.bgMusic.state === 'started') {
            const currentTime = Tone.now();
            this.bgMusic.volume.rampTo(-Infinity, this.crossfadeDuration, currentTime);
            setTimeout(() => {
                this.bgMusic.stop();
            }, this.crossfadeDuration * 1000);
        }
        if (this.bgMusicNext && this.bgMusicNext.state === 'started') {
            const currentTime = Tone.now();
            this.bgMusicNext.volume.rampTo(-Infinity, this.crossfadeDuration, currentTime);
            setTimeout(() => {
                this.bgMusicNext.stop();
            }, this.crossfadeDuration * 1000);
        }
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

    setBackgroundVolume(value) {
        if (this.bgMusicVolume) {
            // Normalize the volume between 0 and 2, allowing for up to 200% volume
            const normalizedVolume = Math.max(0, Math.min(2, value * 2));
            this.bgMusicVolume.gain.rampTo(normalizedVolume, 0.1);
        }
    }

    async setBackgroundMusic(trackId) {
        if (trackId === 'none') {
            if (this.bgMusic && this.bgMusic.state === 'started') {
                const currentTime = Tone.now();
                this.bgMusic.volume.rampTo(-Infinity, this.crossfadeDuration, currentTime);
                setTimeout(() => {
                    this.bgMusic.stop();
                }, this.crossfadeDuration * 1000);
            }
            this.currentBgTrack = 'none';
            return;
        }

        const trackUrl = this.bgTracks[trackId];
        if (!trackUrl) return;

        try {
            await this.bgMusicNext.load(trackUrl);

            const currentTime = Tone.now();

            if (this.bgMusic && this.bgMusic.state === 'started') {
                this.bgMusic.volume.rampTo(-Infinity, this.crossfadeDuration, currentTime);
                this.bgMusicNext.volume.value = -Infinity;
                await this.bgMusicNext.start();
                // Apply current volume setting when starting new track
                const currentVolume = this.bgMusicVolume.gain.value;
                this.bgMusicNext.volume.rampTo(currentVolume, this.crossfadeDuration, currentTime);

                setTimeout(() => {
                    this.bgMusic.stop();
                    [this.bgMusic, this.bgMusicNext] = [this.bgMusicNext, this.bgMusic];
                }, this.crossfadeDuration * 1000);
            } else {
                // Apply current volume setting for initial track
                const currentVolume = this.bgMusicVolume.gain.value;
                this.bgMusicNext.volume.value = currentVolume;
                await this.bgMusicNext.start();
                [this.bgMusic, this.bgMusicNext] = [this.bgMusicNext, this.bgMusic];
            }

            this.currentBgTrack = trackId;
        } catch (error) {
            console.error('Error loading background music:', error);
        }
    }
}