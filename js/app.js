document.addEventListener('DOMContentLoaded', () => {
    const audioProcessor = new AudioProcessor();
    const visualizer = new AudioVisualizer('audioVisualizer');
    let isProcessing = false;

    const startButton = document.getElementById('startButton');
    const harmonySelect = document.getElementById('harmonySelect');
    const antiAliasControl = document.getElementById('antiAliasControl');
    const reverbControl = document.getElementById('reverbControl');
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

    // Add event listeners for new controls
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

function toggleAdvancedControls() {
    const advancedControls = document.querySelector('.advanced-controls');
    const toggleButton = document.querySelector('.advanced-toggle');
    const toggleText = toggleButton.querySelector('.toggle-text');
    const toggleIcon = toggleButton.querySelector('.toggle-icon');

    if (advancedControls.style.display === 'none') {
        advancedControls.style.display = 'block';
        // Use setTimeout to allow display:block to take effect before adding the visible class
        setTimeout(() => {
            advancedControls.classList.add('visible');
        }, 10);
        toggleText.textContent = 'Hide Advanced Controls';
        toggleIcon.textContent = '▲';
    } else {
        advancedControls.classList.remove('visible');
        // Wait for transition to complete before hiding
        setTimeout(() => {
            advancedControls.style.display = 'none';
        }, 300);
        toggleText.textContent = 'Show Advanced Controls';
        toggleIcon.textContent = '▼';
    }
}