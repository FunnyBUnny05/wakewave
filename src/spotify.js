// ============================================
// Spotify Web API & Web Playback SDK
// ============================================

import { getAccessToken, ensureValidToken } from './auth.js';

let player = null;
let deviceId = null;
let playerReady = false;
let onPlayerReadyCallback = null;

// --- Web API ---

async function spotifyFetch(endpoint, options = {}) {
    await ensureValidToken();
    const token = getAccessToken();
    const res = await fetch(`https://api.spotify.com/v1${endpoint}`, {
        ...options,
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...options.headers,
        },
    });

    if (res.status === 401) {
        await ensureValidToken();
        // Retry once
        const token2 = getAccessToken();
        return fetch(`https://api.spotify.com/v1${endpoint}`, {
            ...options,
            headers: {
                Authorization: `Bearer ${token2}`,
                'Content-Type': 'application/json',
                ...options.headers,
            },
        }).then(r => r.json());
    }

    if (res.status === 204) return null;
    return res.json();
}

export async function searchTracks(query) {
    if (!query || query.length < 2) return [];
    const data = await spotifyFetch(`/search?q=${encodeURIComponent(query)}&type=track&limit=10`);
    if (!data || !data.tracks) return [];
    return data.tracks.items.map(track => ({
        id: track.id,
        uri: track.uri,
        name: track.name,
        artist: track.artists.map(a => a.name).join(', '),
        album: track.album.name,
        image: track.album.images[1]?.url || track.album.images[0]?.url || '',
        imageSmall: track.album.images[2]?.url || track.album.images[0]?.url || '',
        duration: track.duration_ms,
    }));
}

export async function getUserProfile() {
    return spotifyFetch('/me');
}

export function formatDuration(ms) {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// --- Web Playback SDK ---

export function initPlayer() {
    return new Promise((resolve) => {
        if (playerReady && player) {
            resolve({ player, deviceId });
            return;
        }

        onPlayerReadyCallback = resolve;

        window.onSpotifyWebPlaybackSDKReady = () => {
            const token = getAccessToken();
            player = new Spotify.Player({
                name: 'WakeWave Alarm Clock',
                getOAuthToken: async cb => {
                    await ensureValidToken();
                    cb(getAccessToken());
                },
                volume: 0.0, // Start silent for fade-in
            });

            player.addListener('ready', ({ device_id }) => {
                console.log('Spotify Player ready, device ID:', device_id);
                deviceId = device_id;
                playerReady = true;
                if (onPlayerReadyCallback) {
                    onPlayerReadyCallback({ player, deviceId: device_id });
                    onPlayerReadyCallback = null;
                }
            });

            player.addListener('not_ready', ({ device_id }) => {
                console.log('Spotify Player not ready:', device_id);
                playerReady = false;
            });

            player.addListener('initialization_error', ({ message }) => {
                console.error('Player init error:', message);
            });

            player.addListener('authentication_error', ({ message }) => {
                console.error('Player auth error:', message);
            });

            player.addListener('account_error', ({ message }) => {
                console.error('Player account error (Premium required):', message);
            });

            player.connect();
        };

        // If SDK already loaded, trigger manually
        if (window.Spotify) {
            window.onSpotifyWebPlaybackSDKReady();
        }
    });
}

import { playAlarmSound, stopAlarmSound, openSpotifyDeepLink } from './alarmSound.js';

export async function playTrack(trackUri) {
    await ensureValidToken();
    const token = getAccessToken();

    // Strategy 1: Use browser SDK player if available
    if (deviceId) {
        try {
            const res = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
                method: 'PUT',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ uris: [trackUri] }),
            });
            if (res.ok || res.status === 204) {
                console.log('🎵 Playing via browser SDK player');
                fadeInVolume(30);
                return true;
            }
            console.warn('SDK play response:', res.status);
        } catch (err) {
            console.warn('SDK play failed:', err);
        }
    }

    // Strategy 2: Play on any active Spotify device (e.g. Spotify app on phone)
    console.log('📱 Trying Spotify Connect — looking for active devices...');
    try {
        const devicesRes = await fetch('https://api.spotify.com/v1/me/player/devices', {
            headers: { Authorization: `Bearer ${token}` },
        });
        const devicesData = await devicesRes.json();
        const devices = devicesData.devices || [];
        console.log('🔍 Found devices:', devices.map(d => `${d.name} (${d.type}, active:${d.is_active})`));

        // Pick the best device: prefer active, then any available
        const activeDevice = devices.find(d => d.is_active) || devices[0];

        if (activeDevice) {
            console.log(`🎯 Playing on: ${activeDevice.name} (${activeDevice.type})`);
            const playRes = await fetch(
                `https://api.spotify.com/v1/me/player/play?device_id=${activeDevice.id}`, {
                method: 'PUT',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ uris: [trackUri] }),
            });
            if (playRes.ok || playRes.status === 204) {
                console.log('🎵 Playing via Spotify Connect!');
                return 'connect';
            }
            console.warn('Connect play response:', playRes.status);
        } else {
            console.log('📵 No Spotify devices found');
        }
    } catch (err) {
        console.warn('Spotify Connect failed:', err);
    }

    // Strategy 3: Last resort — chime + open Spotify app
    console.log('⚠️ No Spotify playback available — using fallback');
    playAlarmSound();
    openSpotifyDeepLink(trackUri);
    return 'fallback';
}

async function fadeInVolume(durationSeconds) {
    if (!player) return;

    const steps = 30;
    const interval = (durationSeconds * 1000) / steps;
    let currentStep = 0;

    const fade = setInterval(() => {
        currentStep++;
        const volume = Math.min(currentStep / steps, 1.0);
        player.setVolume(volume).catch(() => { });

        if (currentStep >= steps) {
            clearInterval(fade);
        }
    }, interval);
}

export async function pausePlayback() {
    // Stop fallback alarm sound
    stopAlarmSound();
    // Stop Spotify browser player
    if (player) {
        await player.pause().catch(() => { });
    }
    // Also pause via Spotify Connect API (for phone/other devices)
    try {
        await ensureValidToken();
        const token = getAccessToken();
        if (token) {
            await fetch('https://api.spotify.com/v1/me/player/pause', {
                method: 'PUT',
                headers: { Authorization: `Bearer ${token}` },
            }).catch(() => { });
        }
    } catch { }
}

export async function resumePlayback() {
    if (player) {
        await player.resume().catch(() => { });
    }
}

export function getPlayer() {
    return player;
}

export function getDeviceId() {
    return deviceId;
}

export function isPlayerReady() {
    return playerReady;
}
