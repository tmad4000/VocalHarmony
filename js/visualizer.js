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
    }

    draw() {
        if (!this.analyser) return;

        requestAnimationFrame(() => this.draw());

        const values = this.analyser.getValue();

        this.ctx.fillStyle = 'rgb(0, 0, 0)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.lineWidth = 2;
        this.ctx.strokeStyle = 'rgb(0, 255, 0)';
        this.ctx.beginPath();

        const sliceWidth = this.canvas.width * 1.0 / values.length;
        let x = 0;

        for (let i = 0; i < values.length; i++) {
            const v = values[i] + 1;
            const y = (v * this.canvas.height) / 2;

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