class AudioProcessor {
    constructor() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.analyser = null;
        this.microphone = null;
        this.gainNode = null;
        this.harmonizer = null;

        // Advanced audio processing nodes
        this.lowBandComp = null;
        this.midBandComp = null;
        this.highBandComp = null;
        this.paramEQ = [];
        this.stereoWidth = null;
        this.noiseGate = null;

        // Existing nodes
        this.antiAliasFilter = null;
        this.reverbNode = null;
        this.reverbGain = null;

        // Harmony settings
        this.harmonyInterval = 3;
        this.harmonyMode = 'parallel'; // 'parallel', 'counter', 'chord'
        this.pitchCorrection = true;

        this.isInitialized = false;

        // Audio analysis
        this.pitchDetector = null;
        this.currentPitch = 0;
        this.pitchConfidence = 0;
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

            // Create basic nodes
            this.microphone = this.audioContext.createMediaStreamSource(stream);
            this.analyser = this.audioContext.createAnalyser();
            this.gainNode = this.audioContext.createGain();
            this.gainNode.gain.value = 0.5;

            // Create multiband compressor nodes
            const createCompressor = () => {
                const comp = this.audioContext.createDynamicsCompressor();
                comp.threshold.value = -24;
                comp.knee.value = 12;
                comp.ratio.value = 4;
                comp.attack.value = 0.003;
                comp.release.value = 0.25;
                return comp;
            };

            this.lowBandComp = createCompressor();
            this.midBandComp = createCompressor();
            this.highBandComp = createCompressor();

            // Create parametric EQ bands (5-band EQ)
            const frequencies = [100, 400, 1000, 2500, 8000];
            this.paramEQ = frequencies.map(freq => {
                const filter = this.audioContext.createBiquadFilter();
                filter.type = 'peaking';
                filter.frequency.value = freq;
                filter.Q.value = 1;
                filter.gain.value = 0;
                return filter;
            });

            // Create stereo width processor
            this.stereoWidth = this.audioContext.createStereoPanner();

            // Create noise gate
            this.noiseGate = this.audioContext.createDynamicsCompressor();
            this.noiseGate.threshold.value = -50;
            this.noiseGate.knee.value = 0;
            this.noiseGate.ratio.value = 40;
            this.noiseGate.attack.value = 0;
            this.noiseGate.release.value = 0.1;

            // Create anti-aliasing and reverb nodes
            this.antiAliasFilter = this.audioContext.createBiquadFilter();
            this.antiAliasFilter.type = 'lowpass';
            this.antiAliasFilter.frequency.value = 20000;
            this.antiAliasFilter.Q.value = 1;

            this.reverbNode = this.audioContext.createConvolver();
            this.reverbGain = this.audioContext.createGain();
            this.reverbGain.gain.value = 0;

            // Create harmonizer
            this.harmonizer = this.audioContext.createScriptProcessor(2048, 1, 1);
            this.harmonizer.onaudioprocess = this.processAudio.bind(this);

            // Create impulse response for reverb
            await this.createReverbImpulse();

            // Connect nodes in series:
            // mic -> noiseGate -> EQ -> compressors -> harmonizer -> stereoWidth -> reverb -> gain -> out

            this.microphone.connect(this.noiseGate);

            // Connect EQ bands in series
            let lastNode = this.noiseGate;
            this.paramEQ.forEach(eq => {
                lastNode.connect(eq);
                lastNode = eq;
            });

            // Split into three frequency bands for multiband compression
            lastNode.connect(this.lowBandComp);
            lastNode.connect(this.midBandComp);
            lastNode.connect(this.highBandComp);

            // Merge bands into harmonizer
            this.lowBandComp.connect(this.harmonizer);
            this.midBandComp.connect(this.harmonizer);
            this.highBandComp.connect(this.harmonizer);

            this.harmonizer.connect(this.stereoWidth);
            this.stereoWidth.connect(this.gainNode);

            // Parallel reverb path
            this.harmonizer.connect(this.reverbNode);
            this.reverbNode.connect(this.reverbGain);
            this.reverbGain.connect(this.gainNode);

            this.gainNode.connect(this.audioContext.destination);

            // Connect analyzer for visualization
            this.harmonizer.connect(this.analyser);

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

    setCompressorBand(band, params) {
        const compressor = band === 'low' ? this.lowBandComp :
                         band === 'mid' ? this.midBandComp :
                         this.highBandComp;

        if (compressor) {
            Object.entries(params).forEach(([param, value]) => {
                if (compressor[param]) {
                    compressor[param].value = value;
                }
            });
        }
    }

    setEQBand(index, gain) {
        if (this.paramEQ[index]) {
            this.paramEQ[index].gain.value = gain;
        }
    }

    setStereoWidth(width) {
        if (this.stereoWidth) {
            // Map 0-100 to -1 to 1
            this.stereoWidth.pan.value = (width - 50) / 50;
        }
    }

    setNoiseGateThreshold(threshold) {
        if (this.noiseGate) {
            // Map 0-100 to -100 to 0
            this.noiseGate.threshold.value = -100 + threshold;
        }
    }

    setHarmonyMode(mode) {
        this.harmonyMode = mode;
    }

    setPitchCorrection(enabled) {
        this.pitchCorrection = enabled;
    }
}