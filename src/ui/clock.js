// ============================================
// Clock Display
// ============================================

import { getAlarms, getNextAlarmTime, formatTimeUntil } from '../alarms.js';

let animFrameId = null;
let lastSecond = -1;

// Cache element references to avoid DOM lookups every frame
let elH = null;
let elM = null;
let elS = null;
let elDate = null;
let elNextAlarmDisplay = null;
let elNextAlarmText = null;

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

    // Cache element references
    elH = document.getElementById('clock-h');
    elM = document.getElementById('clock-m');
    elS = document.getElementById('clock-s');
    elDate = document.getElementById('clock-date');
    elNextAlarmDisplay = document.getElementById('next-alarm-display');
    elNextAlarmText = document.getElementById('next-alarm-text');

    lastSecond = -1;
    tick();
}

function tick() {
    const now = new Date();
    const currentSecond = now.getSeconds();

    // Only update DOM when the second actually changes
    if (currentSecond !== lastSecond) {
        lastSecond = currentSecond;

        const hStr = now.getHours().toString().padStart(2, '0');
        const mStr = now.getMinutes().toString().padStart(2, '0');
        const sStr = currentSecond.toString().padStart(2, '0');

        if (elH && elH.textContent !== hStr) elH.textContent = hStr;
        if (elM && elM.textContent !== mStr) elM.textContent = mStr;
        if (elS) elS.textContent = sStr;

        // Update date only when the minute changes
        if (elDate && (currentSecond === 0 || elDate.textContent === '--')) {
            elDate.textContent = now.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
            });
        }

        // Update next alarm display every 30 seconds to avoid unnecessary work
        if (elNextAlarmDisplay && elNextAlarmText && (currentSecond % 30 === 0 || currentSecond === lastSecond)) {
            const next = getNextAlarmTime(getAlarms());
            if (next) {
                elNextAlarmDisplay.style.display = '';
                elNextAlarmText.textContent = `Next alarm in ${formatTimeUntil(next.diff)} — ${next.alarm.time}`;
            } else {
                elNextAlarmDisplay.style.display = 'none';
            }
        }
    }

    animFrameId = requestAnimationFrame(tick);
}

export function destroyClock() {
    if (animFrameId) {
        cancelAnimationFrame(animFrameId);
        animFrameId = null;
    }
    lastSecond = -1;
    elH = elM = elS = elDate = elNextAlarmDisplay = elNextAlarmText = null;
}
