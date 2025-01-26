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
        this.soundTouch = null;
        this.bufferSize = 2048;
        this.scriptNode = null;
    }

    async initialize(isAsync = false) {
        if (this.isInitialized) return;

        try {
            await Tone.start();
            this.isAsyncMode = isAsync;

            // Create audio context and nodes
            const audioContext = Tone.context.rawContext;
            this.mic = new Tone.UserMedia();
            this.gainNode = new Tone.Gain(0.8);
            this.analyser = new Tone.Analyser("waveform", this.bufferSize);

            // Initialize SoundTouch
            this.soundTouch = new window.soundtouch.SoundTouch(audioContext.sampleRate);
            this.scriptNode = audioContext.createScriptProcessor(this.bufferSize, 1, 1);

            // Set initial pitch shift based on harmony interval
            this.updatePitchShift();

            // Connect the nodes
            await this.mic.open();

            if (!this.isAsyncMode) {
                // Real-time mode connections with formant preservation
                const inputNode = audioContext.createGain();
                this.mic.connect(inputNode);

                this.scriptNode.onaudioprocess = (e) => {
                    const inputBuffer = e.inputBuffer.getChannelData(0);
                    const outputBuffer = e.outputBuffer.getChannelData(0);

                    // Process audio through SoundTouch
                    const frame = new Float32Array(inputBuffer);
                    this.soundTouch.process(frame);

                    // Get processed samples
                    const processed = new Float32Array(this.bufferSize);
                    this.soundTouch.receive(processed);

                    // Copy to output
                    for (let i = 0; i < processed.length; i++) {
                        outputBuffer[i] = processed[i];
                    }
                };

                inputNode.connect(this.scriptNode);
                this.scriptNode.connect(this.gainNode.input);
                this.gainNode.connect(this.analyser);
                this.gainNode.toDestination();
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

        const audioContext = Tone.context.rawContext;
        const source = audioContext.createBufferSource();
        source.buffer = this.recordedAudio.get();

        // Create a new SoundTouch instance for playback
        const playbackSoundTouch = new window.soundtouch.SoundTouch(audioContext.sampleRate);
        playbackSoundTouch.pitch = this.soundTouch.pitch;
        playbackSoundTouch.tempo = this.soundTouch.tempo;

        const scriptNode = audioContext.createScriptProcessor(this.bufferSize, 1, 1);
        scriptNode.onaudioprocess = (e) => {
            const inputBuffer = source.buffer.getChannelData(0);
            const outputBuffer = e.outputBuffer.getChannelData(0);

            const frame = new Float32Array(inputBuffer);
            playbackSoundTouch.process(frame);

            const processed = new Float32Array(this.bufferSize);
            playbackSoundTouch.receive(processed);

            for (let i = 0; i < processed.length; i++) {
                outputBuffer[i] = processed[i];
            }
        };

        source.connect(scriptNode);
        scriptNode.connect(this.gainNode.input);
        source.start();

        return new Promise((resolve) => {
            source.onended = () => {
                scriptNode.disconnect();
                resolve();
            };
        });
    }

    updatePitchShift() {
        if (!this.soundTouch) return;

        // Calculate pitch shift based on harmony interval
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

        // Set pitch shift with formant preservation
        const pitchShift = Math.pow(2, semitones / 12);
        this.soundTouch.tempo = 1.0;
        this.soundTouch.pitch = pitchShift;
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
        }
    }

    async stopProcessing() {
        if (this.mic) {
            await this.mic.close();
        }
        if (this.gainNode) {
            this.gainNode.disconnect();
        }
        if (this.scriptNode) {
            this.scriptNode.disconnect();
        }
        this.isInitialized = false;
    }

    getAnalyser() {
        return this.analyser;
    }
}