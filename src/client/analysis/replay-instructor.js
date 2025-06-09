import "../style.css";
import "../style-replay.css";
import { GET_JSON_REQUEST } from "../utils.js";
import { ReviewCodeEditor } from "../code-editors.js";
import { Text } from "@codemirror/state";
import { setupTimeline } from "./timeline.js";

// DOM Elements
const sessionNameDisplay = document.querySelector("#session-name-display");
const sessionSelect = document.querySelector("#session-select");
const codeContainer = document.querySelector("#code-container");
const playPauseButton = document.querySelector("#play-pause");
const timelineSlider = document.querySelector("#timeline-slider");
const statusMessage = document.querySelector("#status-message");

let currentEditor = null;
let isLoading = false;

function setLoading(loading) {
    isLoading = loading;
    sessionSelect.disabled = loading;
    playPauseButton.disabled = loading;
    timelineSlider.disabled = loading;
    
    if (loading) {
        statusMessage.textContent = "Loading...";
        statusMessage.className = "status-message loading";
    } else {
        statusMessage.textContent = "";
        statusMessage.className = "status-message";
    }
}

async function loadSession(sessionId) {
    if (!sessionId || isLoading) return;
    
    setLoading(true);
    try {
        // Fetch instructor changes
        const url = `/instructor-changes/${sessionId}/0`;
        const response = await fetch(url, GET_JSON_REQUEST);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        if (data.error) {
            throw new Error(data.error);
        }

        // Fetch session details
        const sessionUrl = `/lecture-sessions/${sessionId}`;
        const sessionResponse = await fetch(sessionUrl, GET_JSON_REQUEST);
        if (!sessionResponse.ok) {
            throw new Error(`HTTP error! status: ${sessionResponse.status}`);
        }
        const sessionData = await sessionResponse.json();

        if (sessionData.error) {
            throw new Error(sessionData.error);
        }

        // Display session info
        sessionNameDisplay.textContent = sessionData.name;

        // Initialize or update CodeMirror editor
        if (!currentEditor) {
            currentEditor = new ReviewCodeEditor({
                node: codeContainer,
                doc: Text.empty.toJSON(),
                isEditable: false
            });
        }

        // Set up timeline for playback
        setupTimeline({
            actions: [], // No actions for now
            changes: data.changes,
            codeEditors: { 'instructor.py': currentEditor },
            initialTab: 'instructor.py',
            switchTabFn: () => {} // No tab switching needed
        });
    } catch (error) {
        console.error("Error loading session:", error);
        statusMessage.textContent = `Error: ${error.message}`;
        statusMessage.className = "status-message error";
    } finally {
        setLoading(false);
    }
}

async function loadSessions() {
    setLoading(true);
    try {
        // Fetch all lecture sessions
        const response = await fetch("/lecture-sessions", GET_JSON_REQUEST);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        if (data.error) {
            throw new Error(data.error);
        }

        // Populate session select dropdown
        sessionSelect.innerHTML = '<option value="">Select a session...</option>';
        data.sessions.forEach(session => {
            const option = document.createElement('option');
            option.value = session.id;
            option.textContent = `${session.name} (${new Date(session.startTime).toLocaleString()})`;
            sessionSelect.appendChild(option);
        });
    } catch (error) {
        console.error("Error loading sessions:", error);
        sessionSelect.innerHTML = '<option value="">Error loading sessions</option>';
        statusMessage.textContent = `Error: ${error.message}`;
        statusMessage.className = "status-message error";
    } finally {
        setLoading(false);
    }
}

// Event Listeners
sessionSelect.addEventListener('change', (e) => {
    loadSession(e.target.value);
});

// Initialize
loadSessions(); 