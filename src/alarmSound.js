// ============================================
// Fallback Alarm Sound (Web Audio API)
// Works on mobile and desktop when Spotify SDK
// is unavailable (no external audio files needed)
// ============================================

let audioCtx = null;
let isUnlocked = false;
let alarmOscillators = [];
let alarmGain = null;
let alarmPlaying = false;
let fadeInterval = null;

// --- Unlock Audio Context ---
// iOS requires a user gesture before audio can play.
// We "unlock" the AudioContext on the first user interaction.
function getAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtx;
}

export function unlockAudio() {
    if (isUnlocked) return;

    const ctx = getAudioContext();

    // Resume if suspended (iOS requires this after a user gesture)
    if (ctx.state === 'suspended') {
        ctx.resume();
    }

    // Play a silent buffer to fully unlock
    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);

    isUnlocked = true;
    console.log('🔊 Audio context unlocked');
}

// --- Alarm Sound Generator ---
// Creates a pleasant but attention-getting alarm tone
// that gradually increases in volume (fade-in)

export function playAlarmSound(fadeInSeconds = 15) {
    stopAlarmSound(); // Stop any existing alarm

    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
        ctx.resume();
    }

    // Master gain for fade-in
    alarmGain = ctx.createGain();
    alarmGain.gain.setValueAtTime(0.0, ctx.currentTime);
    alarmGain.connect(ctx.destination);

    // Create a pleasant alarm pattern:
    // Two alternating tones (like a real alarm)
    function createTonePattern() {
        const freq1 = 880;  // A5
        const freq2 = 1047; // C6
        const patternDuration = 1.5; // seconds per cycle

        function scheduleCycle(startTime) {
            // Tone 1: beep-beep
            for (let i = 0; i < 3; i++) {
                const osc = ctx.createOscillator();
                const oscGain = ctx.createGain();

                osc.type = 'sine';
                osc.frequency.value = freq1;
                osc.connect(oscGain);
                oscGain.connect(alarmGain);

                const beepStart = startTime + i * 0.2;
                oscGain.gain.setValueAtTime(0.6, beepStart);
                oscGain.gain.setValueAtTime(0, beepStart + 0.12);

                osc.start(beepStart);
                osc.stop(beepStart + 0.15);
                alarmOscillators.push(osc);
            }

            // Tone 2: higher beep-beep
            for (let i = 0; i < 3; i++) {
                const osc = ctx.createOscillator();
                const oscGain = ctx.createGain();

                osc.type = 'sine';
                osc.frequency.value = freq2;
                osc.connect(oscGain);
                oscGain.connect(alarmGain);

                const beepStart = startTime + 0.75 + i * 0.2;
                oscGain.gain.setValueAtTime(0.6, beepStart);
                oscGain.gain.setValueAtTime(0, beepStart + 0.12);

                osc.start(beepStart);
                osc.stop(beepStart + 0.15);
                alarmOscillators.push(osc);
            }
        }

        // Schedule 2 minutes of alarm pattern (120 / 1.5 = 80 cycles)
        const now = ctx.currentTime;
        for (let cycle = 0; cycle < 80; cycle++) {
            scheduleCycle(now + cycle * patternDuration);
        }
    }

    createTonePattern();

    // Fade in volume
    const steps = 30;
    const interval = (fadeInSeconds * 1000) / steps;
    let currentStep = 0;

    fadeInterval = setInterval(() => {
        currentStep++;
        const volume = Math.min(currentStep / steps, 1.0);
        if (alarmGain) {
            alarmGain.gain.setValueAtTime(volume, ctx.currentTime);
        }
        if (currentStep >= steps) {
            clearInterval(fadeInterval);
            fadeInterval = null;
        }
    }, interval);

    alarmPlaying = true;
    return true;
}

export function stopAlarmSound() {
    if (fadeInterval) {
        clearInterval(fadeInterval);
        fadeInterval = null;
    }

    // Stop all oscillators
    for (const osc of alarmOscillators) {
        try { osc.stop(); } catch (e) { /* already stopped */ }
    }
    alarmOscillators = [];

    if (alarmGain) {
        try { alarmGain.disconnect(); } catch (e) { /* ok */ }
        alarmGain = null;
    }

    alarmPlaying = false;
}

export function isAlarmSoundPlaying() {
    return alarmPlaying;
}

// --- Spotify Deep Link (mobile fallback) ---
// Opens the song in the Spotify app if available
export function openSpotifyDeepLink(trackUri) {
    if (!trackUri) return;

    const trackId = trackUri.split(':')[2];
    if (!trackId) return;

    // Try Spotify app deep link first (works on iOS & Android)
    const spotifyAppUrl = `spotify:track:${trackId}`;
    const spotifyWebUrl = `https://open.spotify.com/track/${trackId}`;

    // On mobile, try the app URI scheme
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    if (isMobile) {
        // Try to open Spotify app, fall back to web
        window.location.href = spotifyAppUrl;
        // If app not installed, fall back to web after a short delay
        setTimeout(() => {
            window.open(spotifyWebUrl, '_blank');
        }, 2500);
    } else {
        window.open(spotifyWebUrl, '_blank');
    }
}
