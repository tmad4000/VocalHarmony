class AudioProcessor {
    constructor() {
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.pitchDetector = null;
        this.harmonizer = null;
        this.harmonyInterval = 3; // Default to third
    }

    async initialize() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // Create audio source from microphone
            this.microphone = this.audioContext.createMediaStreamSource(stream);
            
            // Create analyser for visualization
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 2048;
            
            // Create pitch detector
            this.pitchDetector = this.createPitchDetector();
            
            // Create harmonizer
            this.harmonizer = this.createHarmonizer();
            
            // Connect the audio nodes
            this.microphone.connect(this.analyser);
            this.microphone.connect(this.harmonizer);
            
            this.startProcessing();
        } catch (error) {
            console.error('Error initializing audio:', error);
            throw error;
        }
    }

    createPitchDetector() {
        const pitchDetector = new Pitchy.PitchDetector({
            audioContext: this.audioContext,
            bufferSize: 2048
        });
        return pitchDetector;
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
        
        harmonizer.connect(this.audioContext.destination);
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

    startProcessing() {
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
    }

    stopProcessing() {
        if (this.audioContext) {
            this.audioContext.suspend();
        }
    }

    getAnalyser() {
        return this.analyser;
    }
}
