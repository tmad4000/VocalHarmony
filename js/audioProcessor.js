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
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                }
            });

            // Create basic audio nodes
            this.microphone = this.audioContext.createMediaStreamSource(stream);
            this.analyser = this.audioContext.createAnalyser();
            this.gainNode = this.audioContext.createGain();
            this.gainNode.gain.value = 0.5;

            // Create anti-aliasing filter
            this.antiAliasFilter = this.audioContext.createBiquadFilter();
            this.antiAliasFilter.type = 'lowpass';
            this.antiAliasFilter.frequency.value = 20000; // Start with max frequency
            this.antiAliasFilter.Q.value = 1;

            // Create reverb nodes
            this.reverbNode = this.audioContext.createConvolver();
            this.reverbGain = this.audioContext.createGain();
            this.reverbGain.gain.value = 0; // Start with no reverb

            // Create harmonizer effect node
            this.harmonizer = this.audioContext.createScriptProcessor(2048, 1, 1);
            this.harmonizer.onaudioprocess = this.processAudio.bind(this);

            // Create impulse response for reverb
            await this.createReverbImpulse();

            // Connect nodes:
            // microphone -> antiAliasFilter -> harmonizer -> gainNode -> destination
            //                                             -> reverbNode -> reverbGain -> destination
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

    async createReverbImpulse() {
        const length = 2; // Reverb length in seconds
        const decay = 2.0; // Decay rate
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

    setAntiAliasing(frequency) {
        if (this.antiAliasFilter) {
            // Map 0-100 to 200-20000 Hz logarithmically
            const minFreq = Math.log(200);
            const maxFreq = Math.log(20000);
            const scale = (maxFreq - minFreq) / 100;
            const freqValue = Math.exp(minFreq + scale * frequency);
            this.antiAliasFilter.frequency.value = freqValue;
        }
    }

    setReverb(amount) {
        if (this.reverbGain) {
            // Map 0-100 to 0-0.5 for reverb mix
            this.reverbGain.gain.value = (amount / 100) * 0.5;
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
            if (this.gainNode) {
                this.gainNode.disconnect();
            }
            if (this.harmonizer) {
                this.harmonizer.disconnect();
            }
            if (this.antiAliasFilter) {
                this.antiAliasFilter.disconnect();
            }
            if (this.reverbNode) {
                this.reverbNode.disconnect();
            }
            if (this.reverbGain) {
                this.reverbGain.disconnect();
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
            this.gainNode.gain.value = Math.max(0, Math.min(0.6, value));
        }
    }
}