// ============================================
// WakeWave — Main Entry Point
// ============================================

import { isLoggedIn, handleAuthCallback, logout, hasClientId } from './auth.js';
import { getUserProfile, initPlayer } from './spotify.js';
import { getAlarms, startAlarmChecker, triggerAlarmPlayback } from './alarms.js';
import { renderLogin } from './ui/login.js';
import { renderClock, destroyClock } from './ui/clock.js';
import { renderAlarmList, destroyAlarmList } from './ui/alarmList.js';
import { renderEditor } from './ui/alarmEditor.js';
import { renderRingingOverlay } from './ui/alarmRinging.js';

// --- DOM References ---
const loadingScreen = document.getElementById('loading-screen');
const loginView = document.getElementById('login-view');
const mainView = document.getElementById('main-view');
const editorView = document.getElementById('editor-view');
const ringingOverlay = document.getElementById('ringing-overlay');

let currentUser = null;

// --- App Init ---
async function init() {
    // Check for OAuth callback
    const params = new URLSearchParams(window.location.search);
    if (params.has('code')) {
        const success = await handleAuthCallback();
        if (!success) {
            console.error('Auth callback failed');
        }
    }

    // Route to appropriate view
    if (isLoggedIn()) {
        try {
            currentUser = await getUserProfile();
        } catch (e) {
            console.error('Failed to get profile:', e);
        }

        // Initialize Spotify player
        initPlayer().catch(err => console.log('Player init (may need Premium):', err));

        // Start alarm checker
        startAlarmChecker(handleAlarmTrigger);

        showMainView();
    } else {
        showLoginView();
    }

    // Hide loading
    loadingScreen.style.display = 'none';
}

// --- Views ---

function showLoginView() {
    hideAllViews();
    loginView.style.display = '';
    renderLogin(loginView);
}

function showMainView() {
    hideAllViews();
    mainView.style.display = '';
    renderMainView();
}

function renderMainView() {
    mainView.innerHTML = '';

    // Header
    const header = document.createElement('header');
    header.className = 'app-header';
    header.innerHTML = `
    <div class="header-left">
      <div class="header-logo">WakeWave</div>
    </div>
    <div class="header-user">
      ${currentUser?.images?.[0]?.url
            ? `<img class="header-user-avatar" src="${currentUser.images[0].url}" alt="Profile" />`
            : ''
        }
      <span class="header-user-name">${currentUser?.display_name || 'User'}</span>
      <button class="header-logout" id="logout-btn">Log out</button>
    </div>
  `;
    mainView.appendChild(header);

    document.getElementById('logout-btn').addEventListener('click', () => {
        if (confirm('Log out of WakeWave?')) {
            logout();
        }
    });

    // Clock
    const clockContainer = document.createElement('div');
    mainView.appendChild(clockContainer);
    renderClock(clockContainer);

    // Tab Warning
    const warning = document.createElement('div');
    warning.className = 'tab-warning';
    warning.innerHTML = `
    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
    Keep this tab open for alarms to work. Your alarms are saved locally.
  `;
    mainView.appendChild(warning);

    // Alarm List
    const listContainer = document.createElement('div');
    mainView.appendChild(listContainer);
    renderAlarmList(listContainer, {
        onEdit: (id) => showEditorView(id),
        onAdd: () => showEditorView(null),
    });
}

function showEditorView(alarmId) {
    hideAllViews();
    editorView.style.display = '';
    renderEditor(editorView, {
        alarmId,
        onSave: () => {
            showMainView();
        },
        onCancel: () => {
            showMainView();
        },
    });
}

// --- Alarm Trigger ---

async function handleAlarmTrigger(alarm) {
    console.log('🔔 Alarm triggered:', alarm);

    // Play the track
    await triggerAlarmPlayback(alarm);

    // Show ringing overlay
    renderRingingOverlay(ringingOverlay, alarm, () => {
        // On dismiss/snooze, refresh main view if visible
        if (mainView.style.display !== 'none') {
            renderMainView();
        }
    });

    // Browser notification (if allowed)
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('⏰ WakeWave', {
            body: `${alarm.label || 'Alarm'} — ${alarm.trackName || 'Time to wake up!'}`,
            icon: alarm.trackImage || undefined,
        });
    }
}

// Request notification permission
if ('Notification' in window && Notification.permission === 'default') {
    // Ask after a short delay so it doesn't feel aggressive
    setTimeout(() => {
        Notification.requestPermission();
    }, 3000);
}

// --- Helpers ---

function hideAllViews() {
    loginView.style.display = 'none';
    mainView.style.display = 'none';
    editorView.style.display = 'none';
    destroyClock();
    destroyAlarmList();
}

// --- Start ---
init();
