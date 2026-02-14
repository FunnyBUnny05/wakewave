// ============================================
// Alarm Editor (Create / Edit)
// ============================================

import { createAlarm, updateAlarm, getAlarm, DAY_NAMES } from '../alarms.js';
import { searchTracks, formatDuration } from '../spotify.js';

let searchTimeout = null;

export function renderEditor(container, { alarmId = null, onSave, onCancel }) {
    const existing = alarmId ? getAlarm(alarmId) : null;
    const isEdit = !!existing;

    const now = new Date();
    const defaultTime = existing ? existing.time : `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const [defaultH, defaultM] = defaultTime.split(':');

    let selectedTrack = existing ? {
        uri: existing.trackUri,
        name: existing.trackName,
        artist: existing.trackArtist,
        image: existing.trackImage,
    } : null;

    let selectedDays = existing ? [...existing.days] : [];

    container.innerHTML = `
    <div class="editor-container">
      <div class="editor-header">
        <button class="editor-cancel" id="editor-cancel">Cancel</button>
        <div class="editor-title">${isEdit ? 'Edit Alarm' : 'New Alarm'}</div>
        <button class="editor-save" id="editor-save">Save</button>
      </div>

      <div class="time-picker">
        <div class="time-picker-display">
          <input type="number" class="time-input" id="time-hours" value="${defaultH}" min="0" max="23" />
          <span class="time-separator">:</span>
          <input type="number" class="time-input" id="time-minutes" value="${defaultM}" min="0" max="59" />
        </div>
      </div>

      <div class="editor-section">
        <div class="editor-section-label">Label</div>
        <input type="text" class="editor-input" id="alarm-label" placeholder="e.g. Wake up, Gym time..." value="${existing?.label || ''}" maxlength="50" />
      </div>

      <div class="editor-section">
        <div class="editor-section-label">Repeat</div>
        <div class="days-selector" id="days-selector">
          ${DAY_NAMES.map((day, i) => `
            <button class="day-btn ${selectedDays.includes(i) ? 'active' : ''}" data-day="${i}">${day}</button>
          `).join('')}
        </div>
      </div>

      <div class="editor-section">
        <div class="editor-section-label">Song</div>
        <div id="selected-song-container"></div>
        <div class="song-search-container">
          <svg class="song-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input type="text" class="song-search-input" id="song-search" placeholder="Search Spotify for a song..." />
        </div>
        <div class="song-results" id="song-results"></div>
      </div>
    </div>
  `;

    // Render selected song if exists
    if (selectedTrack && selectedTrack.uri) {
        renderSelectedSong(selectedTrack);
    }

    // --- Time Input Handling ---
    const hoursInput = document.getElementById('time-hours');
    const minutesInput = document.getElementById('time-minutes');

    hoursInput.addEventListener('input', () => {
        let v = parseInt(hoursInput.value);
        if (v > 23) hoursInput.value = '23';
        if (v < 0) hoursInput.value = '0';
    });

    minutesInput.addEventListener('input', () => {
        let v = parseInt(minutesInput.value);
        if (v > 59) minutesInput.value = '59';
        if (v < 0) minutesInput.value = '0';
    });

    // Auto-focus behavior: select all on focus
    [hoursInput, minutesInput].forEach(input => {
        input.addEventListener('focus', () => input.select());
    });

    // --- Days Selector ---
    const daysContainer = document.getElementById('days-selector');
    daysContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('.day-btn');
        if (!btn) return;
        const day = parseInt(btn.dataset.day);
        const idx = selectedDays.indexOf(day);
        if (idx > -1) {
            selectedDays.splice(idx, 1);
            btn.classList.remove('active');
        } else {
            selectedDays.push(day);
            btn.classList.add('active');
        }
    });

    // --- Song Search ---
    const searchInput = document.getElementById('song-search');
    const resultsContainer = document.getElementById('song-results');

    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        const query = searchInput.value.trim();
        if (query.length < 2) {
            resultsContainer.innerHTML = '';
            return;
        }

        resultsContainer.innerHTML = '<div class="song-search-loading">Searching...</div>';

        searchTimeout = setTimeout(async () => {
            try {
                const tracks = await searchTracks(query);
                renderSearchResults(tracks, resultsContainer, (track) => {
                    selectedTrack = track;
                    renderSelectedSong(track);
                    resultsContainer.innerHTML = '';
                    searchInput.value = '';
                });
            } catch (err) {
                resultsContainer.innerHTML = '<div class="song-search-loading">Search failed. Try again.</div>';
            }
        }, 400);
    });

    // --- Save ---
    document.getElementById('editor-save').addEventListener('click', () => {
        const hours = hoursInput.value.padStart(2, '0');
        const minutes = minutesInput.value.padStart(2, '0');
        const time = `${hours}:${minutes}`;
        const label = document.getElementById('alarm-label').value.trim();

        const alarmData = {
            time,
            label,
            trackUri: selectedTrack?.uri || '',
            trackName: selectedTrack?.name || '',
            trackArtist: selectedTrack?.artist || '',
            trackImage: selectedTrack?.image || '',
            enabled: true,
            days: selectedDays,
        };

        if (isEdit) {
            updateAlarm(alarmId, alarmData);
        } else {
            createAlarm(alarmData);
        }

        onSave();
    });

    // --- Cancel ---
    document.getElementById('editor-cancel').addEventListener('click', onCancel);
}

function renderSelectedSong(track) {
    const container = document.getElementById('selected-song-container');
    if (!container) return;

    if (!track || !track.uri) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = `
    <div class="selected-song">
      <img class="selected-song-art" src="${track.image || ''}" alt="" />
      <div class="selected-song-info">
        <div class="selected-song-name">${track.name}</div>
        <div class="selected-song-artist">${track.artist}</div>
      </div>
      <button class="selected-song-remove" id="remove-song" title="Remove song">✕</button>
    </div>
  `;

    document.getElementById('remove-song').addEventListener('click', () => {
        track.uri = '';
        track.name = '';
        track.artist = '';
        track.image = '';
        container.innerHTML = '';
    });
}

function renderSearchResults(tracks, container, onSelect) {
    if (tracks.length === 0) {
        container.innerHTML = '<div class="song-search-loading">No results found</div>';
        return;
    }

    container.innerHTML = tracks.map(track => `
    <div class="song-result-item" data-uri="${track.uri}">
      <img class="song-result-art" src="${track.imageSmall || track.image}" alt="" loading="lazy" />
      <div class="song-result-info">
        <div class="song-result-name">${track.name}</div>
        <div class="song-result-artist">${track.artist}</div>
      </div>
      <div class="song-result-duration">${formatDuration(track.duration)}</div>
      <div class="song-result-check">✓</div>
    </div>
  `).join('');

    container.querySelectorAll('.song-result-item').forEach((el, i) => {
        el.addEventListener('click', () => {
            onSelect(tracks[i]);
        });
    });
}
