import "../style.css";

import { io } from "socket.io-client";
import { GET_JSON_REQUEST, POST_JSON_REQUEST } from "../utils.js";

import { PythonCodeRunner } from "../code-runner.js";

import {
  Console,
  RunInteractions,
  makeConsoleResizable,
} from "../shared-interactions.js";

import { InstructorCodeEditor } from "../code-editors.js";
import { CLIENT_TYPE, SOCKET_MESSAGE_TYPE } from "../../shared-constants.js";

const codeContainer = document.querySelector("#code-container");
const startButton = document.querySelector("#start-session-butt");
const endButton = document.querySelector("#end-session-butt");
const sessionDetails = document.querySelector("#session-details");
const runButtonEl = document.querySelector("#run-button");
const outputCodeContainer = document.querySelector("#all-code-outputs");
const consoleResizer = document.querySelector("#resize-console");
const codeOutputsContainer = document.querySelector("#output-container");
makeConsoleResizable(codeOutputsContainer, consoleResizer);

const socket = io();
// Change ID X gets you to doc version X+1

function setupMediaRecorder(sessionNumber) {
  if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia))
  {
    console.error("getUserMedia not supported on your browser!");
    return;
  }

  return navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.chunks = [];

    mediaRecorder.onstop = () => {
      console.log("Audio recording stopped.");

      stream.getTracks().forEach(track => track.stop());

      const blob = new Blob(mediaRecorder.chunks, { type: mediaRecorder.mimeType });
      mediaRecorder.chunks = [];

      const formData = new FormData();
      formData.append("id", sessionNumber);
      formData.append("audio", blob, "recording.ogg");
      
      fetch("/upload-audio", {
        method: "POST",
        body: formData
      }).then((response) => response.json()).then((data) => {
        console.log("Audio uploaded successfully:", data);
      }).catch((error) => {
        console.error("Error uploading audio:", error);
      });
    };

    mediaRecorder.ondataavailable = (e) => mediaRecorder.chunks.push(e.data);

    endButton.addEventListener("click", () => {
      mediaRecorder.stop();
      console.log("Finished recording audio.");
    });

    return mediaRecorder;
  }).catch((err) => {
    console.error(`The following getUserMedia error occurred: ${err}`);
  });
};

// If it's not disabled already, start button should create a new session
startButton.addEventListener("click", () => {
  startButton.disabled = true;
  endButton.disabled = false;

  let sessionName = prompt("Session name: ");

  if (!sessionName) {
    alert("Please enter a valid session name");
    return false;
  }

  fetch("/lecture-session", {
    body: JSON.stringify({ sessionName }),
    ...POST_JSON_REQUEST
  }).then((response) => response.json()).then((res) => {
    // TODO: what if this fails? lol. It really shouldn't :)
    document.querySelector("#session-name-display").innerText = `Lecture ID: ${sessionName}`;
    res.sessionNumber && initialize(res);

    console.info("Created session", res);
  });
});

// Start up the editor and hook up the end session button.
function initialize({ doc = null, docVersion = null, sessionNumber = null }) {
  startButton.disabled = true;
  endButton.disabled = false;
  sessionDetails.textContent = `Session: ${sessionNumber}`;

  let codeEditor = new InstructorCodeEditor({
    node: codeContainer,
    socket,
    doc,
    startVersion: docVersion,
    sessionNumber,
  });

  let codeRunner = new PythonCodeRunner();
  let consoleOutput = new Console(outputCodeContainer);

  let runInteractions = new RunInteractions({
    runButtonEl,
    codeEditor,
    codeRunner,
    consoleOutput,
    sessionNumber,
    source: CLIENT_TYPE.INSTRUCTOR,
    broadcastResult: (msg) =>
      socket.emit(SOCKET_MESSAGE_TYPE.INSTRUCTOR_CODE_RUN, msg),
  });

  endButton.addEventListener("click", async () => {
    // TODO: make it so you can't edit the code :)
    endButton.disabled = true;
    sessionDetails.textContent += " (Terminated)";
    codeEditor.endSession();
    socket.emit(SOCKET_MESSAGE_TYPE.INSTRUCTOR_END_SESSION, { sessionNumber });
  });

  setupMediaRecorder(sessionNumber).then((mediaRecorder) => {
    mediaRecorder.start();
    console.log("Started recording audio.");
  }).catch((err) => {
    console.error("Failed to start audio recording:", err);
  });

  socket.on(
    SOCKET_MESSAGE_TYPE.INSTRUCTOR_OUT_OF_SYNC,
    ({ sessionId: problemSesh, error }) => {
      if (parseInt(problemSesh) === sessionNumber) {
        alert(`Please restart: out of sync w/ server (${error})`);
      }
    }
  );
}
