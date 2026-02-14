// ============================================
// Alarm Engine — CRUD + Scheduling
// ============================================

import { playTrack, pausePlayback } from './spotify.js';

const ALARMS_KEY = 'wakewave_alarms';
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

let checkInterval = null;
let onAlarmTrigger = null;
let snoozedAlarms = new Map(); // alarmId -> snooze time

// --- Storage ---

function loadAlarms() {
    try {
        const data = localStorage.getItem(ALARMS_KEY);
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
}

function saveAlarms(alarms) {
    localStorage.setItem(ALARMS_KEY, JSON.stringify(alarms));
}

// --- CRUD ---

export function getAlarms() {
    return loadAlarms();
}

export function getAlarm(id) {
    return loadAlarms().find(a => a.id === id);
}

export function createAlarm({
    time,
    label = '',
    trackUri = '',
    trackName = '',
    trackArtist = '',
    trackImage = '',
    enabled = true,
    days = [],
}) {
    const alarms = loadAlarms();
    const alarm = {
        id: crypto.randomUUID(),
        time, // "HH:MM" format
        label,
        trackUri,
        trackName,
        trackArtist,
        trackImage,
        enabled,
        days, // [0-6] for Sun-Sat, empty = one-time
        createdAt: Date.now(),
    };
    alarms.push(alarm);
    saveAlarms(alarms);
    return alarm;
}

export function updateAlarm(id, updates) {
    const alarms = loadAlarms();
    const idx = alarms.findIndex(a => a.id === id);
    if (idx === -1) return null;
    alarms[idx] = { ...alarms[idx], ...updates };
    saveAlarms(alarms);
    return alarms[idx];
}

export function deleteAlarm(id) {
    const alarms = loadAlarms().filter(a => a.id !== id);
    saveAlarms(alarms);
    snoozedAlarms.delete(id);
}

export function toggleAlarm(id) {
    const alarms = loadAlarms();
    const alarm = alarms.find(a => a.id === id);
    if (!alarm) return;
    alarm.enabled = !alarm.enabled;
    saveAlarms(alarms);
    return alarm;
}

// --- Scheduling ---

export function startAlarmChecker(triggerCallback) {
    onAlarmTrigger = triggerCallback;
    if (checkInterval) clearInterval(checkInterval);

    // Check every second
    checkInterval = setInterval(() => {
        checkAlarms();
    }, 1000);
}

export function stopAlarmChecker() {
    if (checkInterval) {
        clearInterval(checkInterval);
        checkInterval = null;
    }
}

let lastTriggeredKey = '';
let lastMinuteKey = '';

function checkAlarms() {
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const currentDay = now.getDay();
    const currentSeconds = now.getSeconds();
    // Use full date to prevent cross-day collisions
    const dateStr = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
    const minuteKey = `${currentTime}-${dateStr}`;
    const triggerKey = `${minuteKey}-${currentDay}`;

    // Reset lastTriggeredKey when we enter a new minute
    if (minuteKey !== lastMinuteKey) {
        lastMinuteKey = minuteKey;
        lastTriggeredKey = '';
    }

    // Only trigger at second 0 of the matching minute, and only once
    if (currentSeconds !== 0) return;
    if (triggerKey === lastTriggeredKey) return;

    const alarms = loadAlarms();

    for (const alarm of alarms) {
        if (!alarm.enabled) continue;

        // Check snooze
        const snoozeTime = snoozedAlarms.get(alarm.id);
        if (snoozeTime) {
            const snoozeDate = new Date(snoozeTime);
            const snoozeTimeStr = `${snoozeDate.getHours().toString().padStart(2, '0')}:${snoozeDate.getMinutes().toString().padStart(2, '0')}`;
            if (currentTime === snoozeTimeStr) {
                snoozedAlarms.delete(alarm.id);
                lastTriggeredKey = triggerKey;
                if (onAlarmTrigger) onAlarmTrigger(alarm);
                return;
            }
            continue; // Skip normal check if snoozed
        }

        // Check time match
        if (alarm.time !== currentTime) continue;

        // Check day match (empty days = every day / one-time)
        if (alarm.days.length > 0 && !alarm.days.includes(currentDay)) continue;

        // Trigger!
        lastTriggeredKey = triggerKey;

        // If no repeat days, disable after triggering (one-time alarm)
        if (alarm.days.length === 0) {
            updateAlarm(alarm.id, { enabled: false });
        }

        if (onAlarmTrigger) onAlarmTrigger(alarm);
        return; // Only trigger one alarm at a time
    }
}

export async function triggerAlarmPlayback(alarm) {
    if (alarm.trackUri) {
        return await playTrack(alarm.trackUri);
    }
    return false;
}

export function snoozeAlarm(alarmId, minutes = 5) {
    const snoozeTime = Date.now() + minutes * 60 * 1000;
    snoozedAlarms.set(alarmId, snoozeTime);
    pausePlayback();
}

export async function dismissAlarm() {
    await pausePlayback();
}

// --- Helpers ---

export function getNextAlarmTime(alarms) {
    const enabled = alarms.filter(a => a.enabled);
    if (enabled.length === 0) return null;

    const now = new Date();
    let closest = null;
    let closestDiff = Infinity;

    for (const alarm of enabled) {
        const [hours, minutes] = alarm.time.split(':').map(Number);
        const alarmDate = new Date(now);
        alarmDate.setHours(hours, minutes, 0, 0);

        if (alarmDate <= now) {
            alarmDate.setDate(alarmDate.getDate() + 1);
        }

        // If has specific days, find the next matching day
        if (alarm.days.length > 0) {
            for (let i = 0; i < 7; i++) {
                const checkDate = new Date(now);
                checkDate.setDate(checkDate.getDate() + i);
                checkDate.setHours(hours, minutes, 0, 0);
                if (checkDate <= now) continue;
                if (alarm.days.includes(checkDate.getDay())) {
                    alarmDate.setTime(checkDate.getTime());
                    break;
                }
            }
        }

        const diff = alarmDate - now;
        if (diff < closestDiff) {
            closestDiff = diff;
            closest = { alarm, time: alarmDate, diff };
        }
    }

    return closest;
}

export function formatTimeUntil(ms) {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
}

export { DAY_NAMES };
