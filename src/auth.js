// ============================================
// Spotify OAuth 2.0 PKCE Authentication
// ============================================

const CLIENT_ID_KEY = 'wakewave_client_id';
const TOKEN_KEY = 'wakewave_token';
const REFRESH_TOKEN_KEY = 'wakewave_refresh_token';
const EXPIRY_KEY = 'wakewave_token_expiry';
const VERIFIER_KEY = 'wakewave_code_verifier';

const SCOPES = [
    'streaming',
    'user-read-email',
    'user-read-private',
    'user-modify-playback-state',
    'user-read-playback-state',
].join(' ');

function getRedirectUri() {
    return window.location.origin + window.location.pathname;
}

function getClientId() {
    return localStorage.getItem(CLIENT_ID_KEY) || '';
}

export function setClientId(id) {
    localStorage.setItem(CLIENT_ID_KEY, id.trim());
}

export function hasClientId() {
    return !!getClientId();
}

// --- PKCE Helpers ---

function generateRandomString(length) {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const values = crypto.getRandomValues(new Uint8Array(length));
    return values.reduce((acc, x) => acc + possible[x % possible.length], '');
}

async function sha256(plain) {
    const encoder = new TextEncoder();
    const data = encoder.encode(plain);
    return window.crypto.subtle.digest('SHA-256', data);
}

function base64urlencode(buffer) {
    return btoa(String.fromCharCode(...new Uint8Array(buffer)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

async function generateCodeChallenge(verifier) {
    const hashed = await sha256(verifier);
    return base64urlencode(hashed);
}

// --- Auth Flow ---

export async function redirectToSpotifyAuth() {
    const clientId = getClientId();
    if (!clientId) {
        throw new Error('Client ID not set. Please enter your Spotify Client ID.');
    }

    const verifier = generateRandomString(128);
    const challenge = await generateCodeChallenge(verifier);

    localStorage.setItem(VERIFIER_KEY, verifier);

    const params = new URLSearchParams({
        client_id: clientId,
        response_type: 'code',
        redirect_uri: getRedirectUri(),
        scope: SCOPES,
        code_challenge_method: 'S256',
        code_challenge: challenge,
    });

    window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`;
}

export async function handleAuthCallback() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const error = params.get('error');

    if (error) {
        console.error('Spotify auth error:', error);
        return false;
    }

    if (!code) return false;

    const verifier = localStorage.getItem(VERIFIER_KEY);
    if (!verifier) {
        console.error('No code verifier found');
        return false;
    }

    const clientId = getClientId();
    const body = new URLSearchParams({
        client_id: clientId,
        grant_type: 'authorization_code',
        code,
        redirect_uri: getRedirectUri(),
        code_verifier: verifier,
    });

    try {
        const response = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body.toString(),
        });

        if (!response.ok) {
            const err = await response.json();
            console.error('Token exchange failed:', err);
            return false;
        }

        const data = await response.json();
        saveTokens(data);

        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
        localStorage.removeItem(VERIFIER_KEY);

        return true;
    } catch (err) {
        console.error('Token exchange error:', err);
        return false;
    }
}

function saveTokens(data) {
    localStorage.setItem(TOKEN_KEY, data.access_token);
    if (data.refresh_token) {
        localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token);
    }
    const expiry = Date.now() + data.expires_in * 1000;
    localStorage.setItem(EXPIRY_KEY, expiry.toString());
}

export function getAccessToken() {
    return localStorage.getItem(TOKEN_KEY);
}

export function isLoggedIn() {
    const token = getAccessToken();
    const expiry = localStorage.getItem(EXPIRY_KEY);
    if (!token || !expiry) return false;
    // Consider logged in if token exists (we'll refresh if needed)
    return true;
}

export async function refreshAccessToken() {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    const clientId = getClientId();

    if (!refreshToken || !clientId) {
        logout();
        return false;
    }

    try {
        const body = new URLSearchParams({
            client_id: clientId,
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
        });

        const response = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body.toString(),
        });

        if (!response.ok) {
            logout();
            return false;
        }

        const data = await response.json();
        saveTokens(data);
        return true;
    } catch {
        logout();
        return false;
    }
}

export async function ensureValidToken() {
    const expiry = parseInt(localStorage.getItem(EXPIRY_KEY) || '0');
    // Refresh 5 minutes before expiry
    if (Date.now() > expiry - 5 * 60 * 1000) {
        return await refreshAccessToken();
    }
    return true;
}

export function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(EXPIRY_KEY);
    localStorage.removeItem(VERIFIER_KEY);
    window.location.reload();
}
