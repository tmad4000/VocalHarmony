document.addEventListener('DOMContentLoaded', () => {
    const audioProcessor = new AudioProcessor();
    const visualizer = new AudioVisualizer('audioVisualizer');
    let isProcessing = false;

    const startButton = document.getElementById('startButton');
    const harmonySelect = document.getElementById('harmonySelect');
    const antiAliasControl = document.getElementById('antiAliasControl');
    const reverbControl = document.getElementById('reverbControl');
    const volumeControl = document.getElementById('volumeControl'); // Added volume control
    const status = document.createElement('div');
    status.className = 'status-message';
    document.querySelector('.controls').appendChild(status);

    startButton.addEventListener('click', async () => {
        if (!isProcessing) {
            try {
                startButton.textContent = 'Connecting...';
                startButton.disabled = true;
                status.textContent = 'Requesting microphone access...';

                await audioProcessor.initialize();

                // Set initial volume from slider
                audioProcessor.setVolume(volumeControl.value / 100);

                // Only set up visualization after successful initialization
                visualizer.setAnalyser(audioProcessor.getAnalyser());
                visualizer.draw();

                startButton.textContent = 'Stop';
                startButton.disabled = false;
                status.textContent = 'Microphone connected and processing audio';
                isProcessing = true;
            } catch (error) {
                console.error('Failed to start audio processing:', error);
                let errorMessage = 'An error occurred while accessing the microphone. ';

                if (error.name === 'NotAllowedError') {
                    errorMessage = 'Microphone access was denied. Please allow microphone access in your browser settings and try again.';
                } else if (error.name === 'NotFoundError') {
                    errorMessage = 'No microphone was found. Please connect a microphone and try again.';
                } else if (error.name === 'NotReadableError') {
                    errorMessage = 'Could not access your microphone. It may be in use by another application.';
                } else {
                    errorMessage += 'Please check your microphone connection and try again.';
                }

                status.textContent = errorMessage;
                startButton.textContent = 'Start Microphone';
                startButton.disabled = false;
            }
        } else {
            try {
                await audioProcessor.stopProcessing();
                startButton.textContent = 'Start Microphone';
                status.textContent = 'Audio processing stopped';
                isProcessing = false;
            } catch (error) {
                console.error('Error stopping audio:', error);
            }
        }
    });

    harmonySelect.addEventListener('change', (e) => {
        audioProcessor.setHarmonyInterval(parseInt(e.target.value));
    });

    volumeControl.addEventListener('input', (e) => {
        audioProcessor.setVolume(e.target.value / 100);
    });

    antiAliasControl.addEventListener('input', (e) => {
        audioProcessor.setAntiAliasing(parseInt(e.target.value));
    });

    reverbControl.addEventListener('input', (e) => {
        audioProcessor.setReverb(parseInt(e.target.value));
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