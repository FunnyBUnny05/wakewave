// ============================================
// Alarm List View
// ============================================

import { getAlarms, toggleAlarm, deleteAlarm, DAY_NAMES } from '../alarms.js';

export function renderAlarmList(container, { onEdit, onAdd }) {
    const alarms = getAlarms();

    if (alarms.length === 0) {
        container.innerHTML = `
      <div class="alarm-section">
        <div class="empty-state">
          <div class="empty-state-icon">⏰</div>
          <div class="empty-state-text">No alarms yet</div>
          <div class="empty-state-hint">Tap the + button to create your first alarm</div>
        </div>
      </div>
    `;
    } else {
        // Sort: enabled first, then by time
        const sorted = [...alarms].sort((a, b) => {
            if (a.enabled !== b.enabled) return b.enabled ? 1 : -1;
            return a.time.localeCompare(b.time);
        });

        container.innerHTML = `
      <div class="alarm-section">
        <div class="alarm-section-header">
          <div class="alarm-section-title">Your Alarms</div>
          <div class="alarm-count">${alarms.filter(a => a.enabled).length} active</div>
        </div>
        <div class="alarm-list">
          ${sorted.map(alarm => renderAlarmCard(alarm)).join('')}
        </div>
      </div>
    `;

        // Bind events
        sorted.forEach(alarm => {
            const card = document.getElementById(`alarm-card-${alarm.id}`);
            const toggle = document.getElementById(`alarm-toggle-${alarm.id}`);
            const deleteBtn = document.getElementById(`alarm-delete-${alarm.id}`);

            if (card) {
                card.addEventListener('click', (e) => {
                    // Don't trigger edit when clicking toggle or delete
                    if (e.target.closest('.toggle') || e.target.closest('.alarm-delete-btn')) return;
                    onEdit(alarm.id);
                });
            }

            if (toggle) {
                toggle.addEventListener('change', (e) => {
                    e.stopPropagation();
                    toggleAlarm(alarm.id);
                    // Re-render
                    renderAlarmList(container, { onEdit, onAdd });
                });
            }

            if (deleteBtn) {
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (confirm('Delete this alarm?')) {
                        deleteAlarm(alarm.id);
                        renderAlarmList(container, { onEdit, onAdd });
                    }
                });
            }
        });
    }

    // FAB
    let fab = document.getElementById('add-alarm-fab');
    if (!fab) {
        fab = document.createElement('button');
        fab.id = 'add-alarm-fab';
        fab.className = 'fab';
        fab.innerHTML = '+';
        document.body.appendChild(fab);
    }
    fab.onclick = onAdd;
}

function renderAlarmCard(alarm) {
    const daysHtml = DAY_NAMES.map((d, i) => {
        const active = alarm.days.includes(i) ? 'active' : '';
        return `<div class="alarm-day-dot ${active}">${d[0]}</div>`;
    }).join('');

    const trackArt = alarm.trackImage
        ? `<img class="alarm-track-art" src="${alarm.trackImage}" alt="Album art" />`
        : `<div class="alarm-track-art-placeholder">🎵</div>`;

    const trackInfo = alarm.trackName
        ? `<div class="alarm-track-name">♪ ${alarm.trackName} — ${alarm.trackArtist}</div>`
        : `<div class="alarm-track-name" style="color:var(--text-muted);">No song selected</div>`;

    return `
    <div class="alarm-card ${alarm.enabled ? '' : 'disabled'}" id="alarm-card-${alarm.id}">
      ${trackArt}
      <div class="alarm-info">
        <div class="alarm-time-display">${alarm.time}</div>
        ${alarm.label ? `<div class="alarm-label">${alarm.label}</div>` : ''}
        ${trackInfo}
        ${alarm.days.length > 0 ? `<div class="alarm-days">${daysHtml}</div>` : ''}
      </div>
      <div class="alarm-actions">
        <button class="alarm-delete-btn" id="alarm-delete-${alarm.id}" title="Delete alarm">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path>
          </svg>
        </button>
        <label class="toggle">
          <input type="checkbox" id="alarm-toggle-${alarm.id}" ${alarm.enabled ? 'checked' : ''} />
          <span class="toggle-slider"></span>
        </label>
      </div>
    </div>
  `;
}

export function destroyAlarmList() {
    const fab = document.getElementById('add-alarm-fab');
    if (fab) fab.remove();
}
