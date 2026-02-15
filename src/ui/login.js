// ============================================
// Login View
// ============================================

import { redirectToSpotifyAuth, setClientId, hasClientId } from '../auth.js';

export function renderLogin(container) {
  container.innerHTML = `
    <div class="login-container">
      <svg class="login-logo" viewBox="0 0 96 96" fill="none">
        <defs>
          <linearGradient id="logoGrad" x1="0" y1="0" x2="96" y2="96">
            <stop offset="0%" stop-color="#1DB954"/>
            <stop offset="100%" stop-color="#8B5CF6"/>
          </linearGradient>
        </defs>
        <circle cx="48" cy="48" r="44" stroke="url(#logoGrad)" stroke-width="3" fill="none"/>
        <path d="M36 28v40l32-20-32-20z" fill="url(#logoGrad)" opacity="0.9"/>
        <circle cx="48" cy="16" r="4" fill="#1DB954">
          <animate attributeName="opacity" values="1;0.3;1" dur="2s" repeatCount="indefinite"/>
        </circle>
        <circle cx="72" cy="28" r="3" fill="#8B5CF6">
          <animate attributeName="opacity" values="0.3;1;0.3" dur="2s" repeatCount="indefinite"/>
        </circle>
        <circle cx="76" cy="52" r="3.5" fill="#1DB954">
          <animate attributeName="opacity" values="0.5;1;0.5" dur="1.5s" repeatCount="indefinite"/>
        </circle>
      </svg>

      <h1 class="login-brand">WakeWave</h1>
      <p class="login-subtitle">Wake up to your favorite music. Connect your Spotify and choose the perfect song for every alarm.</p>

      <div id="client-id-section" style="margin-bottom: 24px; width: 100%; max-width: 360px; ${hasClientId() ? 'display:none;' : ''}">
        <div class="editor-section-label" style="text-align:left; margin-bottom: 8px;">Spotify Client ID</div>
        <input
          type="text"
          id="client-id-input"
          class="editor-input"
          placeholder="Paste your Spotify Client ID here"
          value="${hasClientId() ? '••••••••' : ''}"
          style="margin-bottom: 8px;"
        />
        <div style="font-size: 0.75rem; color: var(--text-muted); text-align: left; line-height: 1.5;">
          Get one free at <a href="https://developer.spotify.com/dashboard" target="_blank" style="color: var(--spotify-green); text-decoration: none;">developer.spotify.com/dashboard</a>.
          Create an app, add <strong style="color: var(--text-secondary);">${window.location.origin}${window.location.pathname}</strong> as a Redirect URI.
        </div>
      </div>

      ${hasClientId() ? `
        <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 16px;">
          Client ID configured ✓ &nbsp;
          <button id="change-client-id" style="background:none;border:none;color:var(--accent-purple-light);cursor:pointer;font-size:0.75rem;font-family:var(--font-family);text-decoration:underline;">Change</button>
        </div>
      ` : ''}

      <button id="spotify-login-btn" class="login-btn" ${!hasClientId() ? 'style="opacity:0.5;"' : ''}>
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
        </svg>
        Connect with Spotify
      </button>

      <div class="login-features">
        <div class="login-feature">
          <div class="login-feature-icon">⏰</div>
          <span>Set multiple alarms</span>
        </div>
        <div class="login-feature">
          <div class="login-feature-icon">🎵</div>
          <span>Pick any Spotify song</span>
        </div>
        <div class="login-feature">
          <div class="login-feature-icon">🌅</div>
          <span>Gentle volume fade-in</span>
        </div>
        <div class="login-feature">
          <div class="login-feature-icon">🔁</div>
          <span>Repeat on any day</span>
        </div>
      </div>

      <div class="app-version">v1.8</div>
    </div>
  `;

  // --- Event Listeners ---
  const loginBtn = document.getElementById('spotify-login-btn');
  const clientInput = document.getElementById('client-id-input');
  const changeBtn = document.getElementById('change-client-id');
  const clientSection = document.getElementById('client-id-section');

  if (changeBtn) {
    changeBtn.addEventListener('click', () => {
      clientSection.style.display = '';
      clientInput.value = '';
      clientInput.focus();
      loginBtn.style.opacity = '0.5';
    });
  }

  if (clientInput) {
    clientInput.addEventListener('input', () => {
      const val = clientInput.value.trim();
      if (val.length > 10) {
        setClientId(val);
        loginBtn.style.opacity = '1';
      } else {
        loginBtn.style.opacity = '0.5';
      }
    });
  }

  loginBtn.addEventListener('click', async () => {
    // If client ID from input, save it first
    if (clientInput && clientInput.value.trim().length > 10) {
      setClientId(clientInput.value.trim());
    }

    if (!hasClientId()) {
      clientInput?.focus();
      return;
    }

    try {
      await redirectToSpotifyAuth();
    } catch (err) {
      alert(err.message);
    }
  });
}
