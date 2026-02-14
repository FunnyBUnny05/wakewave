// ============================================
// Alarm Ringing Overlay
// ============================================

import { snoozeAlarm, dismissAlarm } from '../alarms.js';

export function renderRingingOverlay(container, alarm, onDismiss) {
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    const art = alarm.trackImage
        ? `<img class="ringing-art" src="${alarm.trackImage}" alt="Album art" />`
        : `<div class="ringing-art-placeholder">🎵</div>`;

    container.innerHTML = `
    <div class="ringing-content">
      <div class="ringing-label">${alarm.label || 'Alarm'}</div>
      ${art}
      <div class="ringing-time">${timeStr}</div>
      <div class="ringing-track-name">${alarm.trackName || 'No song'}</div>
      <div class="ringing-track-artist">${alarm.trackArtist || ''}</div>
      <div class="ringing-actions">
        <button class="ringing-btn ringing-btn-snooze" id="ringing-snooze">Snooze (5 min)</button>
        <button class="ringing-btn ringing-btn-dismiss" id="ringing-dismiss">Dismiss</button>
      </div>
    </div>
  `;

    container.style.display = 'flex';

    document.getElementById('ringing-dismiss').addEventListener('click', async () => {
        await dismissAlarm();
        container.style.display = 'none';
        container.innerHTML = '';
        onDismiss();
    });

    document.getElementById('ringing-snooze').addEventListener('click', () => {
        snoozeAlarm(alarm.id, 5);
        container.style.display = 'none';
        container.innerHTML = '';
        onDismiss();
    });
}

export function hideRingingOverlay(container) {
    container.style.display = 'none';
    container.innerHTML = '';
}
