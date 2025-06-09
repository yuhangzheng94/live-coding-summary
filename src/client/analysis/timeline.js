import { Text, ChangeSet } from "@codemirror/state";
import { USER_ACTIONS } from "../../shared-constants";

let slider = document.querySelector("#timeline-slider");
let playPauseButton = document.querySelector("#play-pause");
let timeDisplay = document.querySelector("#time-display");
let info = document.querySelector(".timeline .info");
let prevButt = document.querySelector("#prev-history");
let nextButt = document.querySelector("#next-history");
let sliderPos = 0;
let isPlaying = false;
let playInterval = null;
const PLAYBACK_SPEED = 1000; // 1 second per change
// let sliderBar = document.querySelector(".timeline .bar");

// // Update the current slider value (each time you drag the slider handle)
// slider.oninput = function () {
//   output.innerHTML = this.value;
// };

function getActiveEventTypes() {
  return Object.keys(USER_ACTIONS).filter((name) => {
    let checkbox = document.querySelector(`#${name}`);
    return checkbox && checkbox.checked;
  });
}

function setUpTicks(events) {
  let dl = document.querySelector("datalist");
  if (!dl) return; // Skip if datalist doesn't exist

  let updateTicks = () => {
    dl.innerHTML = "";
    let activeEventTypes = getActiveEventTypes();

    events.forEach((ev, i) => {
      if (!activeEventTypes.includes(ev.action_type)) return;

      let op = document.createElement("option");
      op.value = i + 1;
      op.label = ev.action_type;
      dl.appendChild(op);
    });
    slider.setAttribute("list", "tickmarks");
  };

  updateTicks();

  let counts = {};
  Object.keys(USER_ACTIONS).forEach((t) => (counts[t] = 0));
  for (let ev of events) {
    ev.action_type && counts[ev.action_type]++;
  }

  Object.keys(USER_ACTIONS).forEach((actionType) => {
    let checkbox = document.querySelector(`#${actionType}`);
    if (!checkbox) return;
    checkbox.nextElementSibling.innerText += ` (${counts[actionType]})`;
    checkbox.addEventListener("change", updateTicks);
  });
}

export function setupTimeline({
  actions,
  changes,
  codeEditors,
  notesEditor,
  initialTab,
  switchTabFn,
}) {
  // Ensure all events have timestamps
  let events = [...actions, ...changes].map(ev => ({
    ...ev,
    ts: ev.action_ts || ev.change_ts || Date.now() // Fallback to current time if no timestamp
  }));

  // Sort events by timestamp
  events.sort((a, b) => a.ts - b.ts);
  
  // Set initial timestamp to first event or current time
  let t0 = events.length > 0 ? events[0].ts : Date.now();
  console.log("events: ", events);

  if (!slider) {
    console.error("Timeline slider not found");
    return;
  }

  slider.max = events.length;

  setUpTicks(events);

  let updateSlider = () => {
    let idx = parseInt(slider.value);
    let prevPos = sliderPos;
    sliderPos = idx;
    let tab = "";

    let start = prevPos;
    if (prevPos == sliderPos) return;
    if (prevPos > sliderPos) {
      tab = initialTab;
      start = 0;
      Object.values(codeEditors).forEach((e) => e.reset());
      notesEditor?.reset();
    }

    for (let i = start; i < idx; i++) {
      let ev = events[i];
      if (ev.action_type) {
        if (ev.action_type === USER_ACTIONS.SWITCH_TAB) {
          tab = ev.details;
        }
        continue;
      }
      // we got a change
      let { change, file_name, change_number, changeNumber } = ev;
      if (!change) {
        console.warn("Missing change data for event:", ev);
        continue;
      }

      if (!file_name) {
        console.warn("Missing file_name in change event:", ev);
        continue;
      }

      if (file_name !== "instructor.py") {
        tab = file_name;
      }
      if (file_name === "notes") {
        notesEditor?.applyChange(change);
      } else {
        try {
          // Log the change data for debugging
          console.log("Processing change:", {
            file_name,
            change_type: typeof change,
            change_length: typeof change === 'string' ? change.length : JSON.stringify(change).length,
            change_preview: typeof change === 'string' ? change.substring(0, 100) : JSON.stringify(change).substring(0, 100)
          });

          let changes;
          if (typeof change === 'string') {
            changes = ChangeSet.fromJSON(JSON.parse(change));
          } else if (typeof change === 'object') {
            changes = ChangeSet.fromJSON(change);
          } else {
            console.error("Invalid change format:", change);
            continue;
          }
          codeEditors[file_name].applyChanges(changes);
        } catch (error) {
          console.error("Error applying change:", {
            error,
            file_name,
            change_preview: typeof change === 'string' ? change.substring(0, 100) : JSON.stringify(change).substring(0, 100)
          });
        }
      }
    }

    // Update time display
    if (idx == 0) {
      if (timeDisplay) timeDisplay.textContent = "0:00";
      if (info) info.textContent = "START";
    } else {
      let ev = events[idx - 1];
      let ms = ev.ts - t0;
      let s = Math.floor(ms / 1000);
      let m = Math.floor(s / 60);
      s = s % 60;
      if (timeDisplay) timeDisplay.textContent = `${m}:${s.toString().padStart(2, '0')}`;
      
      if (info) {
        if (ev.action_type) {
          if (ev.details) {
            info.textContent = `t=${s} -- Event: ${ev.action_type} (${ev.details})`;
          } else {
            info.textContent = `t=${s} -- Event: ${ev.action_type}`;
          }
        } else {
          info.textContent = `t=${s} -- Change #${ev.change_number} to file ${ev.file_name}`;
        }
        info.textContent = `${idx}) ${info.textContent}`;
      }
    }
    
    switchTabFn && tab !== "" && switchTabFn(tab);

    // Stop playback if we reach the end
    if (idx >= events.length && isPlaying) {
      togglePlayback();
    }
  };

  function togglePlayback() {
    if (!playPauseButton) return;
    
    isPlaying = !isPlaying;
    playPauseButton.textContent = isPlaying ? "Pause" : "Play";
    
    if (isPlaying) {
      playInterval = setInterval(() => {
        if (parseInt(slider.value) < events.length) {
          slider.value = parseInt(slider.value) + 1;
          updateSlider();
        } else {
          togglePlayback();
        }
      }, PLAYBACK_SPEED);
    } else {
      clearInterval(playInterval);
    }
  }

  slider.oninput = updateSlider;
  if (playPauseButton) {
    playPauseButton.onclick = togglePlayback;
  }
  
  if (nextButt) {
    nextButt.addEventListener("click", () => {
      slider.value = sliderPos + 1;
      updateSlider();
    });
  }
  
  if (prevButt) {
    prevButt.addEventListener("click", () => {
      slider.value = sliderPos - 1;
      updateSlider();
    });
  }
}
