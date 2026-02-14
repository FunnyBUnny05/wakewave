// ============================================
// Fallback Alarm Sound — iOS-Compatible
// Uses <audio> element + generated WAV for
// maximum compatibility with mobile Safari.
// ============================================

let audioElement = null;
let isUnlocked = false;
let alarmPlaying = false;

// --- Generate a WAV alarm tone as a Blob URL ---
// This creates a real audio file in memory — no external files needed.

function generateAlarmWav() {
    const sampleRate = 44100;
    const duration = 60; // 60 seconds of alarm audio
    const numSamples = sampleRate * duration;
    const buffer = new ArrayBuffer(44 + numSamples * 2);
    const view = new DataView(buffer);

    // WAV header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + numSamples * 2, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // chunk size
    view.setUint16(20, 1, true);  // PCM
    view.setUint16(22, 1, true);  // mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true); // byte rate
    view.setUint16(32, 2, true);  // block align
    view.setUint16(34, 16, true); // bits per sample
    writeString(view, 36, 'data');
    view.setUint32(40, numSamples * 2, true);

    // Generate alarm pattern:
    // Repeating pattern: 3 beeps at 880Hz, pause, 3 beeps at 1047Hz, pause
    // Each beep: 120ms on, 80ms off
    // Pattern repeats every 1.6 seconds
    // Volume fades in over first 15 seconds

    const freq1 = 880;   // A5
    const freq2 = 1047;  // C6
    const beepOnSamples = Math.floor(0.12 * sampleRate);   // 120ms on
    const beepOffSamples = Math.floor(0.08 * sampleRate);   // 80ms off
    const beepCycle = beepOnSamples + beepOffSamples;
    const groupGap = Math.floor(0.2 * sampleRate);           // 200ms gap between groups
    const patternLength = beepCycle * 3 + groupGap + beepCycle * 3 + groupGap;
    const fadeInSamples = 15 * sampleRate; // 15 second fade-in

    for (let i = 0; i < numSamples; i++) {
        const posInPattern = i % patternLength;
        const t = i / sampleRate;

        // Determine if we're in a beep or silence
        let sample = 0;
        const group1End = beepCycle * 3;
        const group2Start = group1End + groupGap;
        const group2End = group2Start + beepCycle * 3;

        if (posInPattern < group1End) {
            // Group 1: 880Hz beeps
            const posInBeep = posInPattern % beepCycle;
            if (posInBeep < beepOnSamples) {
                sample = Math.sin(2 * Math.PI * freq1 * t);
            }
        } else if (posInPattern >= group2Start && posInPattern < group2End) {
            // Group 2: 1047Hz beeps
            const posInGroup = posInPattern - group2Start;
            const posInBeep = posInGroup % beepCycle;
            if (posInBeep < beepOnSamples) {
                sample = Math.sin(2 * Math.PI * freq2 * t);
            }
        }

        // Apply fade-in envelope
        let volume = 1.0;
        if (i < fadeInSamples) {
            volume = i / fadeInSamples;
        }

        // Apply soft envelope to each beep to avoid clicks
        if (sample !== 0) {
            const posInBeep = (posInPattern < group1End)
                ? (posInPattern % beepCycle)
                : ((posInPattern - group2Start) % beepCycle);
            // Smooth attack and release (first/last 5ms)
            const attackSamples = Math.floor(0.005 * sampleRate);
            if (posInBeep < attackSamples) {
                sample *= posInBeep / attackSamples;
            } else if (posInBeep > beepOnSamples - attackSamples) {
                sample *= (beepOnSamples - posInBeep) / attackSamples;
            }
        }

        sample *= volume * 0.8; // Overall volume at 80%

        const intSample = Math.max(-32768, Math.min(32767, Math.floor(sample * 32767)));
        view.setInt16(44 + i * 2, intSample, true);
    }

    const blob = new Blob([buffer], { type: 'audio/wav' });
    return URL.createObjectURL(blob);
}

function writeString(view, offset, str) {
    for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
    }
}

// --- Pre-create the audio element ---
// We create the <audio> element once and reuse it.

function getAudioElement() {
    if (!audioElement) {
        audioElement = document.createElement('audio');
        audioElement.setAttribute('playsinline', '');
        audioElement.setAttribute('webkit-playsinline', '');
        audioElement.loop = true;
        audioElement.volume = 1.0;
        // Some mobile browsers need it in the DOM
        audioElement.style.display = 'none';
        document.body.appendChild(audioElement);
    }
    return audioElement;
}

// --- Unlock Audio (call on user gesture) ---
// iOS Safari requires .play() to be called from a user gesture
// at least once before programmatic playback is allowed.

export function unlockAudio() {
    if (isUnlocked) return;

    const audio = getAudioElement();

    // Create a tiny silent WAV (0.1 seconds of silence)
    const silentSamples = 4410;
    const buf = new ArrayBuffer(44 + silentSamples * 2);
    const v = new DataView(buf);
    writeString(v, 0, 'RIFF');
    v.setUint32(4, 36 + silentSamples * 2, true);
    writeString(v, 8, 'WAVE');
    writeString(v, 12, 'fmt ');
    v.setUint32(16, 16, true);
    v.setUint16(20, 1, true);
    v.setUint16(22, 1, true);
    v.setUint32(24, 44100, true);
    v.setUint32(28, 88200, true);
    v.setUint16(32, 2, true);
    v.setUint16(34, 16, true);
    writeString(v, 36, 'data');
    v.setUint32(40, silentSamples * 2, true);
    // Samples are already 0 (silence)

    const silentBlob = new Blob([buf], { type: 'audio/wav' });
    const silentUrl = URL.createObjectURL(silentBlob);

    audio.src = silentUrl;
    const playPromise = audio.play();
    if (playPromise) {
        playPromise.then(() => {
            // Immediately pause — we just needed to "unlock" it
            setTimeout(() => {
                audio.pause();
                audio.currentTime = 0;
                URL.revokeObjectURL(silentUrl);
                isUnlocked = true;
                console.log('🔊 Audio element unlocked for future playback');
            }, 100);
        }).catch(err => {
            console.warn('Audio unlock failed:', err);
        });
    }
}

// --- Play Alarm Sound ---

let alarmBlobUrl = null;

export function playAlarmSound() {
    const audio = getAudioElement();

    // Generate the alarm WAV if not already generated
    if (!alarmBlobUrl) {
        alarmBlobUrl = generateAlarmWav();
    }

    audio.src = alarmBlobUrl;
    audio.loop = true;
    audio.volume = 1.0;
    audio.currentTime = 0;

    const playPromise = audio.play();
    if (playPromise) {
        playPromise.then(() => {
            console.log('🔔 Alarm sound playing');
            alarmPlaying = true;
        }).catch(err => {
            console.error('Alarm sound play failed:', err);
            // Last resort: try to resume and play again
            audio.play().catch(() => { });
        });
    }

    alarmPlaying = true;
    return true;
}

// --- Stop Alarm Sound ---

export function stopAlarmSound() {
    if (audioElement) {
        audioElement.pause();
        audioElement.currentTime = 0;
    }
    alarmPlaying = false;
}

export function isAlarmSoundPlaying() {
    return alarmPlaying;
}

// --- Spotify Deep Link (mobile fallback) ---

export function openSpotifyDeepLink(trackUri) {
    if (!trackUri) return;

    const trackId = trackUri.split(':')[2];
    if (!trackId) return;

    const spotifyAppUrl = `spotify:track:${trackId}`;
    const spotifyWebUrl = `https://open.spotify.com/track/${trackId}`;
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    if (isMobile) {
        // Try Spotify app URI scheme first
        window.location.href = spotifyAppUrl;
        setTimeout(() => {
            window.open(spotifyWebUrl, '_blank');
        }, 2500);
    } else {
        window.open(spotifyWebUrl, '_blank');
    }
}
