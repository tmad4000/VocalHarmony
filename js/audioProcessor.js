class AudioProcessor {
    constructor() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.analyser = null;
        this.microphone = null;
        this.gainNode = null;
        this.harmonizer = null;
        this.harmonyInterval = 3; // Default to third
        this.isInitialized = false;
    }

    async initialize() {
        if (this.isInitialized) return;

        try {
            // Initialize audio context if suspended
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }

            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                }
            });

            // Create and connect audio nodes in the same way as the working mic test
            this.microphone = this.audioContext.createMediaStreamSource(stream);
            this.analyser = this.audioContext.createAnalyser();
            this.gainNode = this.audioContext.createGain();
            this.gainNode.gain.value = 0.8; // Increased from 0.5 to 0.8 for more volume

            // Create harmonizer effect node
            this.harmonizer = this.audioContext.createScriptProcessor(2048, 1, 1);
            this.harmonizer.onaudioprocess = this.processAudio.bind(this);

            // Connect nodes in the same order as the working mic test
            this.microphone.connect(this.analyser);
            this.analyser.connect(this.harmonizer);
            this.harmonizer.connect(this.gainNode);
            this.gainNode.connect(this.audioContext.destination);

            // Set up analyzer
            this.analyser.fftSize = 2048;

            this.isInitialized = true;
            await this.startProcessing();
        } catch (error) {
            console.error('Error initializing audio:', error);
            throw error;
        }
    }

    processAudio(e) {
        const inputBuffer = e.inputBuffer.getChannelData(0);
        const outputBuffer = e.outputBuffer.getChannelData(0);

        // Simple harmony effect - for now, just pass through the audio
        // We'll add pitch shifting later once basic audio flow works
        outputBuffer.set(inputBuffer);
    }

    setHarmonyInterval(interval) {
        this.harmonyInterval = parseInt(interval);
    }

    async startProcessing() {
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
    }

    async stopProcessing() {
        if (this.audioContext) {
            if (this.microphone) {
                this.microphone.disconnect();
            }
            if (this.harmonizer) {
                this.harmonizer.disconnect();
            }
            if (this.gainNode) {
                this.gainNode.disconnect();
            }
            await this.audioContext.suspend();
            this.isInitialized = false;
        }
    }

    getAnalyser() {
        return this.analyser;
    }

    setGain(value) {
        if (this.gainNode) {
            this.gainNode.gain.value = Math.max(0, Math.min(1, value));
        }
    }
}