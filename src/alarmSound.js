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

    // Alarm pattern: 3 beeps @ 880Hz, gap, 3 beeps @ 1047Hz, gap
    const freq1 = 880, freq2 = 1047;
    const beepOn = Math.floor(0.12 * sampleRate);
    const beepOff = Math.floor(0.08 * sampleRate);
    const beepCycle = beepOn + beepOff;
    const groupGap = Math.floor(0.25 * sampleRate);
    const patternLen = beepCycle * 3 + groupGap + beepCycle * 3 + groupGap;
    const fadeInSamples = 10 * sampleRate; // 10 second fade-in
    const attackSamples = Math.floor(0.005 * sampleRate);

    for (let i = 0; i < numSamples; i++) {
        const pos = i % patternLen;
        const t = i / sampleRate;
        let sample = 0;

        const g1End = beepCycle * 3;
        const g2Start = g1End + groupGap;
        const g2End = g2Start + beepCycle * 3;

        let posInBeep = -1;
        if (pos < g1End) {
            const p = pos % beepCycle;
            if (p < beepOn) {
                sample = Math.sin(2 * Math.PI * freq1 * t);
                posInBeep = p;
            }
        } else if (pos >= g2Start && pos < g2End) {
            const p = (pos - g2Start) % beepCycle;
            if (p < beepOn) {
                sample = Math.sin(2 * Math.PI * freq2 * t);
                posInBeep = p;
            }
        }

        // Smooth attack/release envelope per beep
        if (sample !== 0 && posInBeep >= 0) {
            if (posInBeep < attackSamples) {
                sample *= posInBeep / attackSamples;
            } else if (posInBeep > beepOn - attackSamples) {
                sample *= (beepOn - posInBeep) / attackSamples;
            }
        }

        // Fade-in over first 10 seconds
        let vol = i < fadeInSamples ? i / fadeInSamples : 1.0;
        sample *= vol * 0.85;

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
