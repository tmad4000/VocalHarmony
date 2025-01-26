class AudioProcessor {
    constructor() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.analyser = null;
        this.microphone = null;
        this.gainNode = null;
        this.harmonizer = null;
        this.harmonyInterval = 3; // Default to third
        this.isInitialized = false;
        this.pitchDetector = null;
    }

    async initialize() {
        if (this.isInitialized) return;

        try {
            // Resume context if suspended
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }

            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: false,  // Disable echo cancellation for better pitch detection
                    noiseSuppression: false,  // Disable noise suppression for clearer signal
                    autoGainControl: false    // Disable auto gain for consistent levels
                }
            });

            // Create audio source from microphone
            this.microphone = this.audioContext.createMediaStreamSource(stream);

            // Create analyser for visualization
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 2048;

            // Create gain node for output volume control
            this.gainNode = this.audioContext.createGain();
            this.gainNode.gain.value = 0.5; // Set initial volume

            // Create pitch detector
            this.pitchDetector = this.createPitchDetector();

            // Create harmonizer
            this.harmonizer = this.createHarmonizer();


            // Connect the nodes: microphone -> analyser -> harmonizer -> gain -> output
            this.microphone.connect(this.analyser);
            this.analyser.connect(this.harmonizer);
            this.harmonizer.connect(this.gainNode);
            this.gainNode.connect(this.audioContext.destination);

            this.isInitialized = true;
            await this.startProcessing();
        } catch (error) {
            console.error('Error initializing audio:', error);
            throw error;
        }
    }

    createPitchDetector() {
        return new Pitchy.PitchDetector({
            audioContext: this.audioContext,
            bufferSize: 2048
        });
    }

    createHarmonizer() {
        const harmonizer = this.audioContext.createScriptProcessor(2048, 1, 1);

        harmonizer.onaudioprocess = (e) => {
            const inputBuffer = e.inputBuffer.getChannelData(0);
            const outputBuffer = e.outputBuffer.getChannelData(0);

            // Detect pitch
            const [pitch] = this.pitchDetector.analyzePitch(inputBuffer);

            if (pitch && pitch > 0) {
                // Calculate harmony pitch based on interval
                const harmonyPitch = this.calculateHarmonyPitch(pitch);

                // Apply pitch shifting
                this.applyPitchShift(inputBuffer, outputBuffer, pitch, harmonyPitch);
            } else {
                // If no pitch detected, pass through original audio
                outputBuffer.set(inputBuffer);
            }
        };

        return harmonizer;
    }

    calculateHarmonyPitch(fundamental) {
        // Calculate harmony pitch based on musical intervals
        const semitones = parseInt(this.harmonyInterval);
        return fundamental * Math.pow(2, semitones / 12);
    }

    applyPitchShift(inputBuffer, outputBuffer, originalPitch, targetPitch) {
        const pitchRatio = targetPitch / originalPitch;

        // Simple pitch shifting using resampling
        let readIndex = 0;
        for (let i = 0; i < outputBuffer.length; i++) {
            readIndex += pitchRatio;

            const index1 = Math.floor(readIndex);
            const index2 = Math.ceil(readIndex);
            const fraction = readIndex - index1;

            // Linear interpolation
            if (index2 < inputBuffer.length) {
                outputBuffer[i] = inputBuffer[index1] * (1 - fraction) + 
                                inputBuffer[index2] * fraction;
            } else {
                outputBuffer[i] = 0;
            }
        }
    }

    setHarmonyInterval(interval) {
        this.harmonyInterval = interval;
    }

    async startProcessing() {
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
    }

    async stopProcessing() {
        if (this.audioContext) {
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