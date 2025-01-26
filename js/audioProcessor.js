class AudioProcessor {
    constructor() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.analyser = null;
        this.microphone = null;
        this.gainNode = null;
        this.harmonizer = null;
        this.antiAliasFilter = null;
        this.reverbNode = null;
        this.reverbGain = null;
        this.harmonyInterval = 4; 
        this.isInitialized = false;
        this.pitchDetector = null;
        this.lastPitch = 440;
        this.grainSize = 2048;
    }

    async initialize() {
        if (this.isInitialized) return;

        try {
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

            // Create basic audio nodes
            this.microphone = this.audioContext.createMediaStreamSource(stream);
            this.analyser = this.audioContext.createAnalyser();
            this.gainNode = this.audioContext.createGain();
            this.gainNode.gain.value = 0.8; // Increased from 0.5 to 0.8

            // Create anti-aliasing filter
            this.antiAliasFilter = this.audioContext.createBiquadFilter();
            this.antiAliasFilter.type = 'lowpass';
            this.antiAliasFilter.frequency.value = 20000;
            this.antiAliasFilter.Q.value = 1;

            // Create reverb nodes
            this.reverbNode = this.audioContext.createConvolver();
            this.reverbGain = this.audioContext.createGain();
            this.reverbGain.gain.value = 0;

            // Create harmonizer effect node
            this.harmonizer = this.audioContext.createScriptProcessor(this.grainSize, 1, 1);
            this.harmonizer.onaudioprocess = this.processAudio.bind(this);

            // Initialize pitch detector
            await this.createReverbImpulse();

            // Connect nodes
            this.microphone.connect(this.antiAliasFilter);
            this.antiAliasFilter.connect(this.harmonizer);
            this.harmonizer.connect(this.gainNode);
            this.harmonizer.connect(this.reverbNode);
            this.reverbNode.connect(this.reverbGain);
            this.reverbGain.connect(this.gainNode);
            this.gainNode.connect(this.audioContext.destination);

            // Connect analyzer for visualization
            this.antiAliasFilter.connect(this.analyser);

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

        // Apply pitch shifting for harmony
        const pitchRatio = this.calculatePitchRatio(this.harmonyInterval);
        const pitchShiftedBuffer = this.pitchShift(inputBuffer, pitchRatio);

        // Mix original and pitch-shifted signals with adjusted balance
        for (let i = 0; i < outputBuffer.length; i++) {
            // Adjust mix ratio: 60% original, 40% harmony
            outputBuffer[i] = 0.6 * inputBuffer[i] + 0.4 * pitchShiftedBuffer[i];
        }
    }

    calculatePitchRatio(interval) {
        const semitoneRatio = Math.pow(2, 1/12);
        switch(parseInt(interval)) {
            case 3: 
                return Math.pow(semitoneRatio, 4);
            case 4: 
                return Math.pow(semitoneRatio, 5);
            case 5: 
                return Math.pow(semitoneRatio, 7);
            case 7: 
                return Math.pow(semitoneRatio, 11);
            default:
                return 1.0;
        }
    }

    pitchShift(inputBuffer, pitchRatio) {
        const outputBuffer = new Float32Array(inputBuffer.length);
        const grainSize = Math.floor(this.grainSize / 4);
        const numGrains = Math.floor(inputBuffer.length / grainSize);

        for (let i = 0; i < numGrains; i++) {
            const grainStart = i * grainSize;
            const stretchedSize = Math.floor(grainSize * pitchRatio);

            // Apply Hanning window
            for (let j = 0; j < grainSize; j++) {
                const window = 0.5 * (1 - Math.cos(2 * Math.PI * j / grainSize));
                const inputIndex = grainStart + j;
                const outputIndex = Math.floor(grainStart * pitchRatio) + j;

                if (outputIndex < outputBuffer.length) {
                    outputBuffer[outputIndex] += inputBuffer[inputIndex] * window;
                }
            }
        }

        return outputBuffer;
    }

    async createReverbImpulse() {
        const length = 2;
        const decay = 2.0;
        const sampleRate = this.audioContext.sampleRate;
        const samples = length * sampleRate;
        const impulse = this.audioContext.createBuffer(2, samples, sampleRate);

        for (let channel = 0; channel < 2; channel++) {
            const channelData = impulse.getChannelData(channel);
            for (let i = 0; i < samples; i++) {
                const t = i / sampleRate;
                channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - t / length, decay);
            }
        }

        this.reverbNode.buffer = impulse;
    }

    setHarmonyInterval(interval) {
        this.harmonyInterval = parseInt(interval);
    }

    setAntiAliasing(frequency) {
        if (this.antiAliasFilter) {
            const minFreq = Math.log(200);
            const maxFreq = Math.log(20000);
            const scale = (maxFreq - minFreq) / 100;
            const freqValue = Math.exp(minFreq + scale * frequency);
            this.antiAliasFilter.frequency.value = freqValue;
        }
    }

    setReverb(amount) {
        if (this.reverbGain) {
            this.reverbGain.gain.value = (amount / 100) * 0.5;
        }
    }

    async startProcessing() {
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
    }

    async stopProcessing() {
        if (this.audioContext) {
            if (this.gainNode) this.gainNode.disconnect();
            if (this.harmonizer) this.harmonizer.disconnect();
            if (this.antiAliasFilter) this.antiAliasFilter.disconnect();
            if (this.reverbNode) this.reverbNode.disconnect();
            if (this.reverbGain) this.reverbGain.disconnect();
            if (this.microphone) this.microphone.disconnect();
            await this.audioContext.suspend();
            this.isInitialized = false;
        }
    }

    getAnalyser() {
        return this.analyser;
    }

    setGain(value) {
        if (this.gainNode) {
            this.gainNode.gain.value = Math.max(0, Math.min(0.6, value));
        }
    }
    setVolume(value) {
        if (this.gainNode) {
            this.gainNode.gain.value = Math.max(0, Math.min(1.5, value * 1.5));
        }
    }
}