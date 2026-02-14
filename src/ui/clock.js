// ============================================
// Clock Display
// ============================================

import { getAlarms, getNextAlarmTime, formatTimeUntil } from '../alarms.js';

let clockInterval = null;

export function renderClock(container) {
    container.innerHTML = `
    <div class="clock-section">
      <div class="clock-time" id="clock-digits">
        <span id="clock-h">--</span>:<span id="clock-m">--</span><span class="clock-seconds" id="clock-s">--</span>
      </div>
      <div class="clock-date" id="clock-date">--</div>
      <div class="clock-next-alarm" id="next-alarm-display" style="display:none;">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 22c1.1 0 2-.9 2-2h-4a2 2 0 002 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg>
        <span id="next-alarm-text"></span>
      </div>
    </div>
  `;

    updateClock();
    if (clockInterval) clearInterval(clockInterval);
    clockInterval = setInterval(updateClock, 1000);
}

function updateClock() {
    const now = new Date();
    const h = document.getElementById('clock-h');
    const m = document.getElementById('clock-m');
    const s = document.getElementById('clock-s');
    const d = document.getElementById('clock-date');

    if (h) h.textContent = now.getHours().toString().padStart(2, '0');
    if (m) m.textContent = now.getMinutes().toString().padStart(2, '0');
    if (s) s.textContent = now.getSeconds().toString().padStart(2, '0');

    if (d) {
        d.textContent = now.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
        });
    }

    // Next alarm
    const nextAlarmDisplay = document.getElementById('next-alarm-display');
    const nextAlarmText = document.getElementById('next-alarm-text');
    if (nextAlarmDisplay && nextAlarmText) {
        const next = getNextAlarmTime(getAlarms());
        if (next) {
            nextAlarmDisplay.style.display = '';
            nextAlarmText.textContent = `Next alarm in ${formatTimeUntil(next.diff)} — ${next.alarm.time}`;
        } else {
            nextAlarmDisplay.style.display = 'none';
        }
    }
}

export function destroyClock() {
    if (clockInterval) {
        clearInterval(clockInterval);
        clockInterval = null;
    }
}
