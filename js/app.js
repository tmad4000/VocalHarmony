document.addEventListener('DOMContentLoaded', () => {
    const audioProcessor = new AudioProcessor();
    const visualizer = new AudioVisualizer('audioVisualizer');
    let isProcessing = false;

    // UI Elements
    const asyncModeToggle = document.getElementById('asyncModeToggle');
    const realtimeControls = document.getElementById('realtimeControls');
    const asyncControls = document.getElementById('asyncControls');
    const startButton = document.getElementById('startButton');
    const recordButton = document.getElementById('recordButton');
    const stopButton = document.getElementById('stopButton');
    const playButton = document.getElementById('playButton');
    const harmonySelect = document.getElementById('harmonySelect');
    const harmonyTypeSelect = document.getElementById('harmonyTypeSelect');
    const volumeControl = document.getElementById('volumeControl');

    // Add new UI elements
    const bgMusicSelect = document.getElementById('bgMusicSelect');
    const bgMusicVolume = document.getElementById('bgMusicVolume');

    const status = document.createElement('div');
    status.className = 'status-message';
    document.querySelector('.controls').appendChild(status);

    // Mode switching
    asyncModeToggle.addEventListener('change', (e) => {
        const isAsync = e.target.checked;
        realtimeControls.style.display = isAsync ? 'none' : 'block';
        asyncControls.style.display = isAsync ? 'block' : 'none';

        // Reset state when switching modes
        if (isProcessing) {
            audioProcessor.stopProcessing();
            isProcessing = false;
        }

        // Reset buttons
        recordButton.disabled = false;
        stopButton.disabled = true;
        playButton.disabled = true;
        startButton.textContent = 'Start Microphone';
    });

    // Real-time mode controls
    startButton.addEventListener('click', async () => {
        if (!isProcessing) {
            try {
                startButton.textContent = 'Connecting...';
                startButton.disabled = true;
                status.textContent = 'Requesting microphone access...';

                await audioProcessor.initialize(false);
                audioProcessor.setVolume(volumeControl.value / 100);
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
                    errorMessage = 'Microphone access was denied. Please allow microphone access in your browser settings.';
                } else if (error.name === 'NotFoundError') {
                    errorMessage = 'No microphone was found. Please connect a microphone and try again.';
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

    // Async mode controls
    recordButton.addEventListener('click', async () => {
        try {
            await audioProcessor.initialize(true);
            audioProcessor.startRecording();
            recordButton.disabled = true;
            stopButton.disabled = false;
            playButton.disabled = true;
            status.textContent = 'Recording...';
        } catch (error) {
            console.error('Failed to start recording:', error);
            status.textContent = 'Error starting recording. Please check microphone permissions.';
        }
    });

    stopButton.addEventListener('click', () => {
        audioProcessor.stopRecording();
        recordButton.disabled = false;
        stopButton.disabled = true;
        playButton.disabled = false;
        status.textContent = 'Recording stopped. Click Play to hear processed audio.';
    });

    playButton.addEventListener('click', async () => {
        try {
            playButton.disabled = true;
            status.textContent = 'Playing processed audio...';
            await audioProcessor.playProcessedAudio();
            playButton.disabled = false;
            status.textContent = 'Playback complete';
        } catch (error) {
            console.error('Failed to play audio:', error);
            status.textContent = 'Error playing audio';
            playButton.disabled = false;
        }
    });

    // Common controls
    harmonySelect.addEventListener('change', (e) => {
        audioProcessor.setHarmonyInterval(parseInt(e.target.value));
    });

    // Add harmony type change handler
    harmonyTypeSelect.addEventListener('change', (e) => {
        audioProcessor.setHarmonyType(e.target.value);
        // Update status message based on harmony type
        const typeText = e.target.options[e.target.selectedIndex].text;
        status.textContent = `Harmony type changed to: ${typeText}`;
    });

    volumeControl.addEventListener('input', (e) => {
        audioProcessor.setVolume(e.target.value / 100);
    });

    // Add background music controls
    bgMusicSelect.addEventListener('change', async (e) => {
        try {
            await audioProcessor.setBackgroundMusic(e.target.value);
            const trackName = e.target.options[e.target.selectedIndex].text;
            status.textContent = trackName === 'No Background Music'
                ? 'Background music stopped'
                : `Playing background track: ${trackName}`;
        } catch (error) {
            console.error('Error changing background music:', error);
            status.textContent = 'Error playing background music';
        }
    });

    bgMusicVolume.addEventListener('input', (e) => {
        const volumePercent = e.target.value;
        document.getElementById('bgVolumeValue').textContent = `${volumePercent}%`;
        audioProcessor.setBackgroundVolume(volumePercent / 100);
    });


    // Handle page visibility changes
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && isProcessing) {
            audioProcessor.stopProcessing();
        } else if (!document.hidden && isProcessing) {
            audioProcessor.startProcessing();
        }
    });

    // Add low-pass filter toggle handler
    const lowPassToggle = document.getElementById('lowPassToggle');
    lowPassToggle.addEventListener('change', (e) => {
        audioProcessor.toggleLowPassFilter(e.target.checked);
        status.textContent = e.target.checked ?
            'Low-pass filter enabled - reducing feedback' :
            'Low-pass filter disabled';
    });
});