document.addEventListener('DOMContentLoaded', () => {
    const audioProcessor = new AudioProcessor();
    const visualizer = new AudioVisualizer('audioVisualizer');
    let isProcessing = false;

    const startButton = document.getElementById('startButton');
    const harmonySelect = document.getElementById('harmonySelect');

    startButton.addEventListener('click', async () => {
        if (!isProcessing) {
            try {
                startButton.textContent = 'Connecting...';
                startButton.disabled = true;

                await audioProcessor.initialize();
                visualizer.setAnalyser(audioProcessor.getAnalyser());
                visualizer.draw();

                startButton.textContent = 'Stop';
                startButton.disabled = false;
                isProcessing = true;
            } catch (error) {
                console.error('Failed to start audio processing:', error);
                let errorMessage = 'An error occurred while accessing the microphone. ';

                if (error.name === 'NotAllowedError') {
                    errorMessage += 'Please allow microphone access in your browser settings and try again.';
                } else if (error.name === 'NotFoundError') {
                    errorMessage += 'No microphone was found. Please connect a microphone and try again.';
                } else {
                    errorMessage += 'Please check your microphone connection and try again.';
                }

                alert(errorMessage);
                startButton.textContent = 'Start Microphone';
                startButton.disabled = false;
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