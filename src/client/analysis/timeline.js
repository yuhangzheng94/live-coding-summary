import { Text, ChangeSet } from "@codemirror/state";
import { USER_ACTIONS } from "../../shared-constants";

const TIME_INCREMENT_MS = 10;

let slider = document.querySelector("#timeline-slider");
let info = document.querySelector(".timeline .info");
let prevButt = document.querySelector("#prev-history");
let nextButt = document.querySelector("#next-history");
let playPauseButt = document.querySelector("#play-pause");
let sliderPos = 0;
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
  let updateTicks = () => {
    let dl = document.querySelector("datalist");
    dl.innerHTML = "";

    let activeEventTypes = getActiveEventTypes();

    events.forEach((ev, i) => {
      if (!activeEventTypes.includes(ev.action_type)) return;

      let op = document.createElement("option");
      op.value = i + 1;
      op.label = ev.action_type; // Not shown... BOOO
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
  runResults = null,
  startTimeInSeconds,
  endTimeInSeconds,
  consoleOutput = null,
}) {
  for (let a of actions) {
    a.ts = a.action_ts;
  }
  for (let c of changes) {
    c.ts = c.change_ts;
  }
  if (runResults) {
    for (let r of runResults) {
      r.ts = r.run_ts;
    }
  }
  let events = [...actions, ...changes, ...runResults];
  events.sort((a, b) => a.ts - b.ts);
  let t0 = events.length > 0 ? startTimeInSeconds : 0; 
  console.log("changes: ", changes);

  // slider ranges from 0 to lecture session duration (ms)
  // startTime and endTime are in seconds, so we convert to ms
  slider.max = ( endTimeInSeconds - startTimeInSeconds ) * 1000;

  setUpTicks(events);

  let updateSlider = () => {
    // events are represented in unixepoch time (ms)
    const elapsedMs = parseFloat(slider.value);
    let idx = findGreatestLowerBoundEventIndex(events, startTimeInSeconds * 1000 + elapsedMs);
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
      consoleOutput?.reset();
    }

    for (let i = start; i < idx; i++) {
      let ev = events[i];
      if (ev.action_type) {
        if (ev.action_type === USER_ACTIONS.SWITCH_TAB) {
          tab = ev.details;
        }
        continue;
      }
      
      // handle run results
      if (ev.run_result) {
        const run_result = JSON.parse(ev.run_result);   
        console.log("run result: ", run_result);   
        consoleOutput.addResult({...run_result});
      }

      // we got a change
      let { change, file_name } = ev;
      if (file_name !== "instructor.py") {
        tab = file_name;
      }
      if (file_name === "notes") {
        // Figure out what to do
        notesEditor?.applyChange(change);
      } else {
        // TODO: move this logic inside... maybe? Meh.
        let changes = ChangeSet.fromJSON(JSON.parse(change));
        // codeEditors[file_name].applyChanges(changes);
        codeEditors["instructor.py"].applyChanges(changes); // TODO: fix this
      }
    }

    // Display the information for the event.
    if (idx == 0) {
      info.textContent = "START";
    } else {
      let ev = events[idx - 1];
      let ms = ev.ts - t0;
      let s = ms / 1000;
      if (ev.action_type) {
        if (ev.details) {
          info.textContent = `t=${s} -- Event: ${ev.action_type} (${ev.details})`;
        } else {
          info.textContent = `t=${s} -- Event: ${ev.action_type}`;
        }
      } else {
        info.textContent = `t=${s} -- Change #${ev.change_number} to file ${ev.file_name}`;
      }
    }
    info.textContent = `${idx}) ${info.textContent}`;
    switchTabFn && tab !== "" && switchTabFn(tab);
  };

  slider.oninput = updateSlider;
  nextButt.addEventListener("click", () => {
    slider.value = sliderPos + 1;
    // sliderPos = parseInt(slider.value);
    updateSlider();
  });
  prevButt.addEventListener("click", () => {
    slider.value = sliderPos - 1;
    // sliderPos = parseInt(slider.value);
    updateSlider();
  });

  let playbackInterval = null;

  playPauseButt.addEventListener("click", () => {
    if (playPauseButt.textContent == "play") {
      playPauseButt.textContent = "pause";
      playbackInterval = setInterval(() => {
        slider.value = parseFloat(slider.value) + TIME_INCREMENT_MS;
        updateSlider();
      }, TIME_INCREMENT_MS);
    } else {
      playPauseButt.textContent = "play";
      clearInterval(playbackInterval);
    }
  });

}


function findGreatestLowerBoundEventIndex(events, timestamp) {
  let low = 0;
  let high = events.length - 1;

  while (low <= high) {
    let mid = Math.floor((low + high) / 2);
    if (events[mid].ts < timestamp) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return high;
}