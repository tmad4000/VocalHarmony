class AudioProcessor {
    constructor() {
        this.mic = null;
        this.gainNode = null;
        this.analyser = null;
        this.isInitialized = false;
        this.harmonyInterval = 3;
        this.recorder = null;
        this.recordedChunks = [];
        this.isAsyncMode = false;
        this.recordedAudio = null;
        this.pitchShift = null;
        this.crossFade = null;
    }

    async initialize(isAsync = false) {
        if (this.isInitialized) return;

        try {
            await Tone.start();
            this.isAsyncMode = isAsync;

            // Create audio nodes with improved formant preservation
            this.mic = new Tone.UserMedia();
            this.pitchShift = new Tone.PitchShift({
                pitch: 0,
                windowSize: 0.05,  // Smaller window size for better formant preservation
                delayTime: 0.01,   // Small delay for cross-fading
                feedback: 0,
                wet: 1
            }).toDestination();

            // Add crossfade for smoother transitions
            this.crossFade = new Tone.CrossFade(0.5);
            this.gainNode = new Tone.Gain(0.8);
            this.analyser = new Tone.Analyser("waveform", 2048);

            // Set initial pitch shift based on harmony interval
            this.updatePitchShift();

            // Connect the nodes
            await this.mic.open();

            if (!this.isAsyncMode) {
                // Real-time mode connections with formant preservation
                this.mic.chain(
                    this.crossFade.a,
                    this.pitchShift,
                    this.gainNode,
                    this.analyser,
                    Tone.Destination
                );

                // Direct signal path for crossfading
                this.mic.connect(this.crossFade.b);
                this.crossFade.b.connect(this.gainNode);
            }

            this.isInitialized = true;

        } catch (error) {
            console.error('Error initializing audio:', error);
            throw error;
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

        // Connect through the pitch shifter with formant preservation
        player.chain(
            this.crossFade.a,
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
            case 1: // No Harmony
                semitones = 0;
                break;
            case 3: // Third
                semitones = 4;
                break;
            case 4: // Fourth
                semitones = 5;
                break;
            case 5: // Fifth
                semitones = 7;
                break;
            case 7: // Seventh
                semitones = 11;
                break;
        }

        // Configure pitch shifter with optimized formant preservation settings
        this.pitchShift.set({
            pitch: semitones,
            windowSize: 0.05,
            delayTime: 0.01,
            feedback: 0,
            wet: 1
        });

        // Adjust crossfade based on pitch shift amount
        const crossfadeAmount = Math.min(0.8, Math.abs(semitones) / 12);
        this.crossFade.fade.value = crossfadeAmount;
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