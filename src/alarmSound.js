// ============================================
// Alarm Sound — iOS Safari Compatible
// ============================================
//
// iOS Safari has 3 strict requirements for audio:
// 1. audio.play() must first be called during a user gesture
// 2. Changing <audio> src after unlock invalidates the unlock
// 3. setInterval is throttled/paused in background tabs
//
// Solution:
// - Pre-generate the alarm WAV at startup
// - Set it as the src and play+pause during user gesture (unlock)
// - When alarm fires, just call play() — src is already set
// - Keep a silent audio loop running to maintain audio session

let alarmAudio = null;    // The alarm tone player
let keepaliveAudio = null; // Silent loop to keep audio session alive
let alarmBlobUrl = null;
let isUnlocked = false;
let alarmPlaying = false;

// =============================================
// WAV Generator — builds alarm tone in memory
// =============================================

function generateAlarmWav() {
    const sampleRate = 44100;
    const duration = 120; // 2 minutes
    const numSamples = sampleRate * duration;
    const buffer = new ArrayBuffer(44 + numSamples * 2);
    const view = new DataView(buffer);

    // WAV header
    const writeStr = (offset, str) => {
        for (let i = 0; i < str.length; i++)
            view.setUint8(offset + i, str.charCodeAt(i));
    };
    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + numSamples * 2, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);   // PCM
    view.setUint16(22, 1, true);   // Mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeStr(36, 'data');
    view.setUint32(40, numSamples * 2, true);

    // ========================================
    // Gentle ascending chime alarm
    // Musical notes: C5 → E5 → G5 → C6
    // Each chime has a soft attack and long decay
    // Pattern repeats every ~3.2 seconds with a pause
    // ========================================

    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    const chimeDuration = 0.45;    // Each chime rings for 450ms
    const chimeGap = 0.12;         // 120ms between chimes
    const chimeStep = chimeDuration + chimeGap;
    const groupPause = 1.6;        // 1.6s pause between note groups
    const groupDuration = chimeStep * notes.length + groupPause;
    const patternLen = Math.floor(groupDuration * sampleRate);

    const fadeInSamples = 15 * sampleRate; // 15 second gentle fade-in
    const attackMs = 0.025; // 25ms soft attack
    const releaseMs = 0.35; // 350ms long release (bell-like decay)
    const attackSamples = Math.floor(attackMs * sampleRate);
    const releaseSamples = Math.floor(releaseMs * sampleRate);
    const chimeSamples = Math.floor(chimeDuration * sampleRate);

    for (let i = 0; i < numSamples; i++) {
        const pos = i % patternLen;
        const t = i / sampleRate;
        let sample = 0;

        // Which chime in the group?
        const posInGroup = pos / sampleRate;
        const chimeIdx = Math.floor(posInGroup / chimeStep);
        const posInChime = Math.floor((posInGroup - chimeIdx * chimeStep) * sampleRate);

        if (chimeIdx < notes.length && posInChime >= 0 && posInChime < chimeSamples) {
            const freq = notes[chimeIdx];
            const tLocal = posInChime / sampleRate;

            // Fundamental + soft harmonics for richness
            sample = Math.sin(2 * Math.PI * freq * tLocal) * 0.65
                + Math.sin(2 * Math.PI * freq * 2 * tLocal) * 0.20
                + Math.sin(2 * Math.PI * freq * 3 * tLocal) * 0.10
                + Math.sin(2 * Math.PI * freq * 4 * tLocal) * 0.05;

            // Smooth attack envelope
            if (posInChime < attackSamples) {
                sample *= posInChime / attackSamples;
            }

            // Exponential decay (bell-like)
            const decayStart = chimeSamples - releaseSamples;
            if (posInChime > decayStart) {
                const decayProgress = (posInChime - decayStart) / releaseSamples;
                sample *= Math.pow(1 - decayProgress, 2); // Quadratic decay
            }

            // Overall bell envelope — gentle amplitude curve
            const lifeRatio = posInChime / chimeSamples;
            sample *= Math.exp(-lifeRatio * 2.5); // Natural bell decay
        }

        // Global fade-in over 15 seconds
        let vol = i < fadeInSamples ? i / fadeInSamples : 1.0;
        // Ease-in curve for gentler start
        if (i < fadeInSamples) {
            vol = vol * vol; // Quadratic ease-in
        }
        sample *= vol * 0.75;

        view.setInt16(44 + i * 2,
            Math.max(-32768, Math.min(32767, Math.floor(sample * 32767))), true);
    }

    return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
}

// Tiny silent WAV for the keepalive loop
function generateSilentWav() {
    const sampleRate = 22050;
    const duration = 5; // 5 second loop
    const numSamples = sampleRate * duration;
    const buffer = new ArrayBuffer(44 + numSamples * 2);
    const view = new DataView(buffer);
    const writeStr = (offset, str) => {
        for (let i = 0; i < str.length; i++)
            view.setUint8(offset + i, str.charCodeAt(i));
    };
    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + numSamples * 2, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeStr(36, 'data');
    view.setUint32(40, numSamples * 2, true);
    // All samples default to 0 = silence
    return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
}

// =============================================
// Audio Element Setup — CRITICAL for iOS
// The alarm WAV is set as src ONCE and never changed
// =============================================

function ensureAlarmAudio() {
    if (alarmAudio) return alarmAudio;

    // Generate alarm tone
    if (!alarmBlobUrl) {
        alarmBlobUrl = generateAlarmWav();
    }

    // Create audio element with alarm src set immediately
    alarmAudio = document.createElement('audio');
    alarmAudio.setAttribute('playsinline', '');
    alarmAudio.setAttribute('webkit-playsinline', '');
    alarmAudio.preload = 'auto';
    alarmAudio.loop = true;
    alarmAudio.volume = 1.0;
    alarmAudio.src = alarmBlobUrl; // Set src ONCE, never change it
    alarmAudio.load(); // Force preload
    alarmAudio.style.display = 'none';
    document.body.appendChild(alarmAudio);

    return alarmAudio;
}

function ensureKeepaliveAudio() {
    if (keepaliveAudio) return keepaliveAudio;

    const silentUrl = generateSilentWav();
    keepaliveAudio = document.createElement('audio');
    keepaliveAudio.setAttribute('playsinline', '');
    keepaliveAudio.setAttribute('webkit-playsinline', '');
    keepaliveAudio.loop = true;
    keepaliveAudio.volume = 0.001; // Nearly silent but not zero
    keepaliveAudio.src = silentUrl;
    keepaliveAudio.load();
    keepaliveAudio.style.display = 'none';
    document.body.appendChild(keepaliveAudio);

    return keepaliveAudio;
}

// =============================================
// Unlock Audio — call during user gesture
// This is THE critical step for iOS.
// We play+pause the ACTUAL alarm audio (not a
// different file), and start the silent keepalive.
// =============================================

export function unlockAudio() {
    if (isUnlocked) return;

    const alarm = ensureAlarmAudio();
    const keepalive = ensureKeepaliveAudio();

    // Play the actual alarm audio and immediately pause
    // This "registers" this audio element as user-gesture-approved
    const p1 = alarm.play();
    if (p1) {
        p1.then(() => {
            alarm.pause();
            alarm.currentTime = 0;
            console.log('🔊 Alarm audio unlocked (iOS)');
        }).catch(e => {
            console.warn('Alarm unlock attempt failed:', e.message);
        });
    }

    // Start silent keepalive loop to maintain audio session
    const p2 = keepalive.play();
    if (p2) {
        p2.then(() => {
            console.log('🔇 Keepalive audio running');
        }).catch(e => {
            console.warn('Keepalive start failed:', e.message);
        });
    }

    isUnlocked = true;
}

// =============================================
// Play / Stop Alarm
// Since src is already set, just play() — iOS allows it
// =============================================

export function playAlarmSound() {
    const alarm = ensureAlarmAudio();
    alarm.currentTime = 0;
    alarm.volume = 1.0;
    alarm.loop = true;

    const p = alarm.play();
    if (p) {
        p.then(() => {
            console.log('🔔 Alarm sound playing!');
            alarmPlaying = true;
        }).catch(e => {
            console.error('❌ Alarm play failed:', e.message);
            // Last resort: try again
            setTimeout(() => {
                alarm.play().catch(() => { });
            }, 100);
        });
    }

    alarmPlaying = true;
    return true;
}

export function stopAlarmSound() {
    if (alarmAudio) {
        alarmAudio.pause();
        alarmAudio.currentTime = 0;
    }
    alarmPlaying = false;
}

export function isAlarmSoundPlaying() {
    return alarmPlaying;
}

// =============================================
// Spotify Deep Link (mobile fallback)
// =============================================

export function openSpotifyDeepLink(trackUri) {
    if (!trackUri) return;
    const trackId = trackUri.split(':')[2];
    if (!trackId) return;

    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
        window.location.href = `spotify:track:${trackId}`;
        setTimeout(() => {
            window.open(`https://open.spotify.com/track/${trackId}`, '_blank');
        }, 2500);
    } else {
        window.open(`https://open.spotify.com/track/${trackId}`, '_blank');
    }
}
