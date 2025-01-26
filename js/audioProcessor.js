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
                    echoCancellation: true,      // Enable echo cancellation
                    noiseSuppression: true,      // Enable noise suppression
                    autoGainControl: true        // Enable auto gain control
                }
            });

            // Create audio nodes
            this.microphone = this.audioContext.createMediaStreamSource(stream);
            this.analyser = this.audioContext.createAnalyser();

            // Create compressor to control dynamics
            this.compressor = this.audioContext.createDynamicsCompressor();
            this.compressor.threshold.value = -24;
            this.compressor.knee.value = 30;
            this.compressor.ratio.value = 12;
            this.compressor.attack.value = 0.003;
            this.compressor.release.value = 0.25;

            // Create limiter to prevent clipping
            this.limiter = this.audioContext.createDynamicsCompressor();
            this.limiter.threshold.value = -6;
            this.limiter.knee.value = 0;
            this.limiter.ratio.value = 20;
            this.limiter.attack.value = 0.001;
            this.limiter.release.value = 0.1;

            // Create notch filter for feedback suppression
            this.notchFilter = this.audioContext.createBiquadFilter();
            this.notchFilter.type = 'notch';
            this.notchFilter.frequency.value = 1000;
            this.notchFilter.Q.value = 1;

            // Create gain node with lower initial value
            this.gainNode = this.audioContext.createGain();
            this.gainNode.gain.value = 0.6; // Reduced from 0.8 to prevent initial feedback

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
            // Clamp gain value between 0 and 0.8 to prevent feedback
            this.gainNode.gain.value = Math.max(0, Math.min(0.8, value));
        }
    }
}