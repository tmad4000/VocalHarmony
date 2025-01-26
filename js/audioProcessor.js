class AudioProcessor {
    constructor() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.analyser = null;
        this.microphone = null;
        this.gainNode = null;
        this.harmonizer = null;
        this.compressor = null;
        this.limiter = null;
        this.notchFilter = null;
        this.harmonyInterval = 3; // Default to third
        this.isInitialized = false;
    }

    async initialize() {
        if (this.isInitialized) return;

        try {
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }

            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,      // Keep echo cancellation
                    noiseSuppression: true,      // Keep noise suppression
                    autoGainControl: false       // Disable auto gain control for more consistent levels
                }
            });

            // Create audio nodes
            this.microphone = this.audioContext.createMediaStreamSource(stream);
            this.analyser = this.audioContext.createAnalyser();

            // Create compressor with gentler settings
            this.compressor = this.audioContext.createDynamicsCompressor();
            this.compressor.threshold.value = -18;  // Raised from -24
            this.compressor.knee.value = 20;       // Reduced from 30 for smoother compression
            this.compressor.ratio.value = 6;       // Reduced from 12 for gentler compression
            this.compressor.attack.value = 0.005;  // Slightly slower attack
            this.compressor.release.value = 0.15;  // Faster release

            // Create limiter with gentler settings
            this.limiter = this.audioContext.createDynamicsCompressor();
            this.limiter.threshold.value = -3;    // Raised from -6
            this.limiter.knee.value = 0;
            this.limiter.ratio.value = 12;        // Reduced from 20
            this.limiter.attack.value = 0.002;    // Slightly slower attack
            this.limiter.release.value = 0.05;    // Faster release

            // Create narrower notch filter for more precise feedback suppression
            this.notchFilter = this.audioContext.createBiquadFilter();
            this.notchFilter.type = 'notch';
            this.notchFilter.frequency.value = 1000;
            this.notchFilter.Q.value = 4.5;        // Increased from 1 for narrower notch

            // Create gain node
            this.gainNode = this.audioContext.createGain();
            this.gainNode.gain.value = 0.7;        // Slightly increased from 0.6

            // Create harmonizer effect node
            this.harmonizer = this.audioContext.createScriptProcessor(2048, 1, 1);
            this.harmonizer.onaudioprocess = this.processAudio.bind(this);

            // Connect nodes in optimized order for feedback prevention:
            // microphone -> notchFilter -> compressor -> harmonizer -> limiter -> gain -> destination
            this.microphone.connect(this.notchFilter);
            this.notchFilter.connect(this.compressor);
            this.compressor.connect(this.harmonizer);
            this.harmonizer.connect(this.limiter);
            this.limiter.connect(this.gainNode);
            this.gainNode.connect(this.audioContext.destination);

            // Connect analyzer in parallel for visualization
            this.notchFilter.connect(this.analyser);

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
            // Disconnect all nodes in reverse order
            if (this.gainNode) {
                this.gainNode.disconnect();
            }
            if (this.limiter) {
                this.limiter.disconnect();
            }
            if (this.harmonizer) {
                this.harmonizer.disconnect();
            }
            if (this.compressor) {
                this.compressor.disconnect();
            }
            if (this.notchFilter) {
                this.notchFilter.disconnect();
            }
            if (this.microphone) {
                this.microphone.disconnect();
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
            // Allow slightly higher maximum gain while still preventing extreme feedback
            this.gainNode.gain.value = Math.max(0, Math.min(0.9, value));
        }
    }
}