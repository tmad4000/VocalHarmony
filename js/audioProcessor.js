class AudioProcessor {
    constructor() {
        this.mic = null;
        this.audioContext = null;
        this.pitchShifter = null;
        this.gainNode = null;
        this.analyser = null;
        this.isInitialized = false;
        this.harmonyInterval = 3; // Third above as default
        this.recorder = null;
        this.recordedChunks = [];
        this.isAsyncMode = false;
        this.recordedAudio = null;
        this.formantPreservation = true;
        this.processorNode = null;
        this.inputBuffer = null;
    }

    async initialize(isAsync = false) {
        if (this.isInitialized) return;

        try {
            this.isAsyncMode = isAsync;
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            // Create audio nodes
            this.mic = this.audioContext.createMediaStreamSource(stream);
            this.gainNode = this.audioContext.createGain();
            this.analyser = this.audioContext.createAnalyser();
            this.gainNode.gain.value = 0.8;

            // Initialize pitch shifter
            this.pitchShifter = new PitchShifter(this.audioContext, this.mic, 4096);
            this.pitchShifter.enableFormantCorrection = this.formantPreservation;

            // Set initial pitch shift based on harmony interval
            this.updatePitchShift();

            if (!this.isAsyncMode) {
                // Real-time mode connections
                this.mic.connect(this.pitchShifter.input);
                this.pitchShifter.output.connect(this.gainNode);
                this.gainNode.connect(this.analyser);
                this.gainNode.connect(this.audioContext.destination);
            }

            this.isInitialized = true;

        } catch (error) {
            console.error('Error initializing audio:', error);
            throw error;
        }
    }

    setFormantPreservation(enabled) {
        this.formantPreservation = enabled;
        if (this.pitchShifter) {
            this.pitchShifter.enableFormantCorrection = enabled;
        }
    }

    updatePitchShift() {
        if (!this.pitchShifter) return;

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
        this.pitchShifter.pitch = Math.pow(2, semitones/12);
    }

    startRecording() {
        if (!this.isAsyncMode || !this.mic) return;

        this.recorder = new MediaRecorder(this.mic.mediaStream);
        this.recordedChunks = [];

        this.recorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
                this.recordedChunks.push(e.data);
            }
        };

        this.recorder.onstop = async () => {
            const blob = new Blob(this.recordedChunks, { type: 'audio/webm' });
            const audioUrl = URL.createObjectURL(blob);
            this.recordedAudio = await this.loadAudio(audioUrl);
        };

        this.recorder.start();
    }

    async loadAudio(url) {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        return await this.audioContext.decodeAudioData(arrayBuffer);
    }

    stopRecording() {
        if (this.recorder && this.recorder.state === "recording") {
            this.recorder.stop();
        }
    }

    async playProcessedAudio() {
        if (!this.recordedAudio) return;

        const source = this.audioContext.createBufferSource();
        source.buffer = this.recordedAudio;

        // Create a new pitch shifter for playback
        const playbackShifter = new PitchShifter(this.audioContext, source, 4096);
        playbackShifter.pitch = this.pitchShifter.pitch;
        playbackShifter.enableFormantCorrection = this.formantPreservation;

        source.connect(playbackShifter.input);
        playbackShifter.output.connect(this.gainNode);
        this.gainNode.connect(this.analyser);
        this.gainNode.connect(this.audioContext.destination);

        source.start(0);

        return new Promise((resolve) => {
            source.onended = () => {
                source.disconnect();
                playbackShifter.disconnect();
                resolve();
            };
        });
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
        if (this.audioContext && this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
    }

    async stopProcessing() {
        if (this.audioContext) {
            await this.audioContext.close();
        }
        if (this.pitchShifter) {
            this.pitchShifter.disconnect();
        }
        this.isInitialized = false;
    }

    getAnalyser() {
        return this.analyser;
    }
}