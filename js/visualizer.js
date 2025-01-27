class AudioVisualizer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.analyser = null;
        this.fftAnalyser = null;  // New FFT analyzer
        this.dataArray = null;
        this.fftSize = 2048;      // Higher FFT size for better resolution

        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        this.canvas.width = this.canvas.offsetWidth;
        this.canvas.height = this.canvas.offsetHeight;
    }

    setAnalyser(analyser) {
        this.analyser = analyser;

        // Create FFT analyzer for frequency spectrum
        this.fftAnalyser = new Tone.Analyser('fft', this.fftSize);
        if (this.analyser) {
            this.analyser.connect(this.fftAnalyser);
        }
    }

    drawFrequencySpectrum() {
        const frequencies = this.fftAnalyser.getValue();
        const width = this.canvas.width;
        const height = this.canvas.height / 2;  // Use bottom half for spectrum
        const barWidth = width / frequencies.length;

        // Draw frequency spectrum
        this.ctx.fillStyle = 'rgb(20, 20, 20)';
        this.ctx.fillRect(0, height, width, height);

        // Draw frequency grid and labels
        this.ctx.strokeStyle = 'rgb(40, 40, 40)';
        this.ctx.fillStyle = 'rgb(100, 100, 100)';
        this.ctx.font = '10px Arial';

        // Frequency markers
        const freqMarkers = [100, 500, 1000, 2000, 3000, 5000, 10000];
        freqMarkers.forEach(freq => {
            const x = (freq / (this.fftAnalyser.context.sampleRate / 2)) * width;
            if (x < width) {
                this.ctx.beginPath();
                this.ctx.moveTo(x, height);
                this.ctx.lineTo(x, this.canvas.height);
                this.ctx.stroke();
                this.ctx.fillText(`${freq >= 1000 ? (freq/1000)+'k' : freq}Hz`, x, this.canvas.height - 5);
            }
        });

        // Draw 3kHz cutoff line in red
        const cutoffX = (3000 / (this.fftAnalyser.context.sampleRate / 2)) * width;
        this.ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
        this.ctx.beginPath();
        this.ctx.moveTo(cutoffX, height);
        this.ctx.lineTo(cutoffX, this.canvas.height);
        this.ctx.stroke();
        this.ctx.fillStyle = 'red';
        this.ctx.fillText('3kHz cutoff', cutoffX + 5, height + 15);

        // Draw spectrum
        this.ctx.beginPath();
        frequencies.forEach((value, i) => {
            const x = i * barWidth;
            const dbValue = Tone.gainToDb(value);
            const normalized = Math.max(0, (dbValue + 100) / 100);  // Normalize between -100 and 0 dB
            const y = height + (height * (1 - normalized));

            if (i === 0) {
                this.ctx.moveTo(x, y);
            } else {
                this.ctx.lineTo(x, y);
            }
        });

        this.ctx.strokeStyle = 'rgb(0, 255, 0)';
        this.ctx.stroke();
    }

    draw() {
        if (!this.analyser || !this.fftAnalyser) return;

        requestAnimationFrame(() => this.draw());

        // Draw waveform in top half
        const values = this.analyser.getValue();
        const height = this.canvas.height / 2;

        this.ctx.fillStyle = 'rgb(20, 20, 20)';
        this.ctx.fillRect(0, 0, this.canvas.width, height);

        this.ctx.lineWidth = 2;
        this.ctx.strokeStyle = 'rgb(0, 255, 0)';
        this.ctx.beginPath();

        const sliceWidth = this.canvas.width * 1.0 / values.length;
        let x = 0;

        for (let i = 0; i < values.length; i++) {
            const v = values[i] + 1;
            const y = (v * height) / 2;

            if (i === 0) {
                this.ctx.moveTo(x, y);
            } else {
                this.ctx.lineTo(x, y);
            }

            x += sliceWidth;
        }

        this.ctx.lineTo(this.canvas.width, height / 2);
        this.ctx.stroke();

        // Draw frequency spectrum in bottom half
        this.drawFrequencySpectrum();

        // Update level meters
        const rms = Math.sqrt(values.reduce((acc, val) => acc + val * val, 0) / values.length);
        const normalizedLevel = Math.min(1, rms * 2);
        this.updateLevelMeter('inputLevel', normalizedLevel);
        this.updateLevelMeter('outputLevel', normalizedLevel);
    }

    updateLevelMeter(meterId, level) {
        const meter = document.getElementById(meterId);
        if (meter) {
            meter.style.setProperty('--level', `${level * 100}%`);
            meter.style.backgroundColor = `hsl(${120 - level * 120}, 70%, 50%)`;
        }
    }
}