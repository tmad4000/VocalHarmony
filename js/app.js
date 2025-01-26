document.addEventListener('DOMContentLoaded', () => {
    const audioProcessor = new AudioProcessor();
    const visualizer = new AudioVisualizer('audioVisualizer');
    let isProcessing = false;

    const startButton = document.getElementById('startButton');
    const harmonySelect = document.getElementById('harmonySelect');

    startButton.addEventListener('click', async () => {
        if (!isProcessing) {
            try {
                await audioProcessor.initialize();
                visualizer.setAnalyser(audioProcessor.getAnalyser());
                visualizer.draw();
                startButton.textContent = 'Stop';
                isProcessing = true;
            } catch (error) {
                console.error('Failed to start audio processing:', error);
                alert('Failed to access microphone. Please ensure microphone permissions are granted.');
            }
        } else {
            audioProcessor.stopProcessing();
            startButton.textContent = 'Start Microphone';
            isProcessing = false;
        }
    });

    harmonySelect.addEventListener('change', (e) => {
        audioProcessor.setHarmonyInterval(e.target.value);
    });

    // Handle page visibility changes
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && isProcessing) {
            audioProcessor.stopProcessing();
        } else if (!document.hidden && isProcessing) {
            audioProcessor.startProcessing();
        }
    });
});
