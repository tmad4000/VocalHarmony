class AudioVisualizer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.analyser = null;
        this.dataArray = null;
        
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        this.canvas.width = this.canvas.offsetWidth;
        this.canvas.height = this.canvas.offsetHeight;
    }

    setAnalyser(analyser) {
        this.analyser = analyser;
        this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    }

    draw() {
        if (!this.analyser) return;

        requestAnimationFrame(() => this.draw());

        this.analyser.getByteTimeDomainData(this.dataArray);

        this.ctx.fillStyle = 'rgb(0, 0, 0)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.lineWidth = 2;
        this.ctx.strokeStyle = 'rgb(0, 255, 0)';
        this.ctx.beginPath();

        const sliceWidth = this.canvas.width * 1.0 / this.dataArray.length;
        let x = 0;

        for (let i = 0; i < this.dataArray.length; i++) {
            const v = this.dataArray[i] / 128.0;
            const y = v * this.canvas.height / 2;

            if (i === 0) {
                this.ctx.moveTo(x, y);
            } else {
                this.ctx.lineTo(x, y);
            }

            x += sliceWidth;
        }

        this.ctx.lineTo(this.canvas.width, this.canvas.height / 2);
        this.ctx.stroke();

        // Update level meters
        const inputLevel = this.calculateRMS(this.dataArray);
        this.updateLevelMeter('inputLevel', inputLevel);
        this.updateLevelMeter('outputLevel', inputLevel); // For simplicity, using same level
    }

    calculateRMS(dataArray) {
        let rms = 0;
        for (let i = 0; i < dataArray.length; i++) {
            rms += (dataArray[i] - 128) * (dataArray[i] - 128);
        }
        rms = Math.sqrt(rms / dataArray.length) / 128;
        return Math.min(1, rms * 2);
    }

    updateLevelMeter(meterId, level) {
        const meter = document.getElementById(meterId);
        if (meter) {
            meter.style.setProperty('--level', `${level * 100}%`);
            meter.style.backgroundColor = `hsl(${120 - level * 120}, 70%, 50%)`;
        }
    }
}
