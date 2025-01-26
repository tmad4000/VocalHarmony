class AudioProcessor {
    constructor() {
        this.mic = null;
        this.pitchShift = null;
        this.gainNode = null;
        this.analyser = null;
        this.isInitialized = false;
        this.harmonyInterval = 4;
    }

    async initialize() {
        if (this.isInitialized) return;

        try {
            await Tone.start();

            // Create audio nodes
            this.mic = new Tone.UserMedia();
            this.pitchShift = new Tone.PitchShift();
            this.gainNode = new Tone.Gain(0.8);
            this.analyser = new Tone.Analyser("waveform", 2048);

            // Set initial pitch shift based on harmony interval
            this.updatePitchShift();

            // Connect the nodes
            await this.mic.open();
            this.mic.connect(this.pitchShift);
            this.pitchShift.connect(this.gainNode);
            this.gainNode.connect(this.analyser);
            this.gainNode.toDestination();

            this.isInitialized = true;
            await this.startProcessing();

        } catch (error) {
            console.error('Error initializing audio:', error);
            throw error;
        }
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
        this.pitchShift.pitch = semitones;
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
        if (this.mic) {
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
        if (this.pitchShift) {
            this.pitchShift.disconnect();
        }
        this.isInitialized = false;
    }

    getAnalyser() {
        return this.analyser;
    }
}