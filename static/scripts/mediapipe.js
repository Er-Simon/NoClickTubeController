// Copyright 2023 The MediaPipe Authors.

// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at

//      http://www.apache.org/licenses/LICENSE-2.0

// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import vision from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3";

const { GestureRecognizer, FaceLandmarker, FilesetResolver, DrawingUtils } = vision;

let faceLandmarker;
let gestureRecognizer;

const runningMode = "VIDEO";

const loadingElement = document.getElementById("loading");
const recognitionSection = document.getElementById("recognitionSection");

// Before we can use HandLandmarker class we must wait for it to finish
// loading. Machine Learning models can be large and take a moment to
// get everything needed to run.
async function initialize() {
  const filesetResolver = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
  );

  gestureRecognizer = await GestureRecognizer.createFromOptions(
    filesetResolver,
    {
      baseOptions: {
        modelAssetPath:
          "https://raw.githubusercontent.com/Er-Simon/EZGestureTubeController/main/static/model/gesture_recognizer.task",
        delegate: "GPU",
      },
      runningMode: runningMode,
      numHands: 2,
    }
  );

  faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
    baseOptions: {
      modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
      delegate: "GPU"
    },
    outputFaceBlendshapes: true,
    runningMode,
    numFaces: 1
  });

  loadingElement.classList.add("d-none");
  recognitionSection.classList.remove("d-none");
}

initialize();

/********************************************************************
// Demo 2: Continuously grab image from webcam stream and detect it.
********************************************************************/

let webcamRunning = false;
let webcamStream;

const webcamButton = document.getElementById("webcamButton");
const recognitionOutput = document.getElementById("recognitionOutput");
const video = document.getElementById("userVideo");

const gestureSwitch = document.getElementById("flexSwitchGestureControl");
const eyeFocusSwitch = document.getElementById("flexSwitchEyeFocusControl");

const canvasGestureElement = document.getElementById("gesture_output_canvas");
const canvasGestureInformationElement = document.getElementById("gesture_information_output_canvas");
const canvasEyeFocusElement = document.getElementById("eye_focus_output_canvas");

const canvasGestureCtx = canvasGestureElement.getContext("2d");
const canvasGestureInformationCtx = canvasGestureInformationElement.getContext("2d");
const canvasEyeFocusCtx = canvasEyeFocusElement.getContext("2d");

const drawingGestureUtils = new DrawingUtils(canvasGestureCtx);
const drawingEyeFocusUtils = new DrawingUtils(canvasEyeFocusCtx);


let gestureStatus = false;
let eyeFocusStatus = false;

const calibrationData = {
  eyeLookDownLeft: 0,
  eyeLookDownRight: 0,
  eyeLookInLeft: 0,
  eyeLookInRight: 0,
  eyeLookOutLeft: 0,
  eyeLookOutRight: 0,
  eyeLookUpLeft: 0,
  eyeLookUpRight: 0,
}

// Check if webcam access is supported.
function hasGetUserMedia() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

// If webcam supported, add event listener to button for when user
// wants to activate it.
if (hasGetUserMedia()) {
  webcamButton.addEventListener("click", enableCam);
} else {
  console.warn("getUserMedia() is not supported by your browser");
}

function handleGestureSwitchChange() {
  if (gestureSwitch.checked) {
    canvasGestureElement.classList.remove("d-none");
    canvasGestureInformationElement.classList.remove("d-none");

    gestureStatus = true;
  } else {
    canvasGestureElement.classList.add("d-none");
    canvasGestureInformationElement.classList.add("d-none");

    gestureStatus = false;
  }
}

function photoOnClick(dot, modal) {
  return new Promise(resolve => {
    const checkModalStatus = setInterval(() => {
      if (!modal.classList.contains('show')) {
        clearInterval(checkModalStatus);
        resolve(false);
      }
    }, 100);

    const gestore = (event) => {
      clearInterval(checkModalStatus);
      var result = faceLandmarker.detectForVideo(video, performance.now());

      if (result.faceBlendshapes.length !== 0) {
        resolve(result);
      } else {
        dot.addEventListener('click', gestore, { once: true });
      }

      event.preventDefault();
    };

    dot.addEventListener('click', gestore, { once: true });
  });
}

async function eyeFocusCalibration() {
  var response = false;

  const modal = document.getElementById("calibrationModal");
  var calibrationModal = new bootstrap.Modal(modal, {
    focus: false
  });

  const modalHidden = new Promise((resolve) => {
    modal.addEventListener('hidden.bs.modal', resolve, { once: true });
  });

  var dots = document.getElementsByClassName('dot');

  modal.addEventListener('shown.bs.modal', async (event) => {
    for (var index = 0; index < dots.length; index++) {
      let dot = dots[index];
  
      dot.classList.remove('invisible');
  
      let result = await photoOnClick(dot, modal);
  
      dot.classList.add('invisible');
  
      if (result === false) break;
  
      result.faceBlendshapes[0].categories.forEach((item) => {
        if (item.categoryName in calibrationData) {
          if (item.score > calibrationData[item.categoryName]) {
            calibrationData[item.categoryName] = item.score;
          }
        }
      })
  
      if (index == dots.length - 1) response = true;
    }

    await calibrationModal.hide();

    event.preventDefault();

  }, { once: true });

  await calibrationModal.show();

  await modalHidden;

  // Apply sensibility
  for (let data in calibrationData) {
    calibrationData[data] += calibrationData[data] * 0.15
  }

  return response;
}

function handleEyeFocusSwitchChange() {
  if (eyeFocusSwitch.checked) {
    var response = window.confirm('Before use facial features to control the playback of the player you need to perform the calibration phase.\nPress ok to start the calibration immediately.');
    
    if (response === true) {
      webcamRunning = false;

      eyeFocusCalibration().then((success) => {
        if (!success) {
          alert('Calibration failed, enable the mode to try again!');
          eyeFocusSwitch.checked = !eyeFocusSwitch.checked;

        } else {
          canvasEyeFocusElement.classList.remove("d-none");
          eyeFocusStatus = true;  
        }
      }).then(() => {
        webcamRunning = true;
        video.srcObject = webcamStream; 
      });

    } else {
      eyeFocusSwitch.checked = !eyeFocusSwitch.checked;
      eyeFocusStatus = false;
    }
  } else {
    canvasEyeFocusElement.classList.add("d-none");
    eyeFocusStatus = false;
  }
}

// Enable the live webcam view and start detection.
function enableCam(event) {
  if (!gestureRecognizer || !faceLandmarker) {
    console.log("Wait! Models not loaded yet.");
    return;
  }

  if (webcamRunning === false) {
    webcamRunning = true;
    webcamButton.innerText = "Disable Webcam Access";
    
    // getUsermedia parameters.
    const constraints = {
      video: true
    };

    // Activate the webcam stream.
    navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
      video.srcObject = stream;
      webcamStream = stream;
    }).then(() => {
      handleGestureSwitchChange();
      handleEyeFocusSwitchChange();

      video.addEventListener("loadeddata", predictWebcam);

      gestureSwitch.addEventListener('change', handleGestureSwitchChange);
      eyeFocusSwitch.addEventListener('change', handleEyeFocusSwitchChange);

      recognitionOutput.classList.remove("d-none");
    });

  } else {
    webcamRunning = false;
    webcamButton.innerText = "Enable Webcam Access";

    if (webcamStream) {
      webcamStream.getTracks().forEach(track => {
        track.stop();
      });
  
      webcamStream = undefined;
    }
  
    video.removeEventListener("loadeddata", predictWebcam);

    recognitionOutput.classList.add("d-none");
    
    gestureSwitch.removeEventListener('change', handleGestureSwitchChange);
    eyeFocusSwitch.removeEventListener('change', handleEyeFocusSwitchChange);

    clearGestureCanvas();
    clearGestureInformationCanvas();
    clearEyeFocusCanvas();
  }

  event.preventDefault();
}

function clearGestureCanvas() {
  canvasGestureCtx.clearRect(
    0,
    0,
    canvasGestureElement.width,
    canvasGestureElement.height
  );
  canvasGestureCtx.save();
}

function clearGestureInformationCanvas() {
  canvasGestureInformationCtx.clearRect(
    0,
    0,
    canvasGestureInformationElement.width,
    canvasGestureInformationElement.height
  );
  canvasGestureInformationCtx.save();
}

async function gestureRecognition(video, startTimeMs) {
  clearGestureCanvas();
  clearGestureInformationCanvas();

  canvasGestureElement.style.height = `${video.offsetHeight}px`;
  canvasGestureElement.style.width = `${video.offsetWidth}px`;
  canvasGestureElement.style.left = `${video.offsetLeft}px`;

  canvasGestureInformationElement.style.height = `${video.offsetHeight}px`;
  canvasGestureInformationElement.style.width = `${video.offsetWidth}px`;
  canvasGestureInformationElement.style.left = `${video.offsetLeft}px`;

  let gestureResults = gestureRecognizer.recognizeForVideo(video, startTimeMs);

  if (gestureResults.landmarks) {
    for (const landmarks of gestureResults.landmarks) {
      drawingGestureUtils.drawConnectors(
        landmarks,
        GestureRecognizer.HAND_CONNECTIONS,
        {
          color: "#00FF00",
          lineWidth: 5,
        }
      );
      drawingGestureUtils.drawLandmarks(landmarks, {
        color: "#FF0000",
        lineWidth: 2,
      });
    }
  }


  var recognitionResult = {
    type: 'gesture',
    data: []
  };

  if (gestureResults.gestures) {
    for (var i = 0; i < gestureResults.gestures.length; i++) {
      var categoryName = gestureResults.gestures[i][0].categoryName;

      var categoryScore = parseFloat(
        gestureResults.gestures[i][0].score * 100
      ).toFixed(2);

      var handLabel = gestureResults.handednesses[i][0].displayName;

      var landmarks = [];

      for (const landmark of gestureResults.landmarks[i]) {
        landmarks.push([landmark.x, landmark.y]);
      }

      var fingerCount = 0;
      if (handLabel == "Left" && landmarks[4][0] > landmarks[3][0]) {
        fingerCount = fingerCount + 1;
      } else if (
        handLabel == "Right" &&
        landmarks[4][0] < landmarks[3][0]
      ) {
        fingerCount = fingerCount + 1;
      }

      if (landmarks[8][1] < landmarks[6][1])
        fingerCount = fingerCount + 1;
      if (landmarks[12][1] < landmarks[10][1])
        fingerCount = fingerCount + 1;
      if (landmarks[16][1] < landmarks[14][1])
        fingerCount = fingerCount + 1;
      if (landmarks[20][1] < landmarks[18][1])
        fingerCount = fingerCount + 1;

      recognitionResult.data.push({
        recognizedGesture: categoryName,
        fingerCount: fingerCount
      })

      var gestureOutput = `GestureRecognizer: ${categoryName}\nConfidence: ${categoryScore} %\nHandedness: ${handLabel}\nFingerCount: ${fingerCount}`;

      var offset = 10;
      var lineheight = 38;

      var lines = gestureOutput
        .split("")
        .join(String.fromCharCode(8202))
        .split("\n");

      canvasGestureInformationCtx.font = "36px Arial";

      var textMaxWidth = lines.map(
        (text) => canvasGestureInformationCtx.measureText(text).width
      );

      textMaxWidth = Math.max.apply(Math, textMaxWidth);

      canvasGestureInformationCtx.textAlign = "start";
      canvasGestureInformationCtx.textBaseline = "top";

      canvasGestureInformationCtx.fillStyle = "rgba(0, 0, 0, .6)";
      canvasGestureInformationCtx.fillRect(
        (canvasGestureElement.width - textMaxWidth - offset) * i,
        0,
        textMaxWidth + offset * 2,
        lines.length * lineheight + offset * 2
      );

      canvasGestureInformationCtx.fillStyle = "white";

      for (var j = 0; j < lines.length; j++)
      canvasGestureInformationCtx.fillText(
          lines[j],
          (canvasGestureElement.width - textMaxWidth - offset) * i + offset,
          offset + j * lineheight
        );
    }

    if (recognitionResult.data.length > 0)
      return await YTPlayerController(recognitionResult);
  }
}

function clearEyeFocusCanvas() {
  canvasEyeFocusCtx.clearRect(
    0,
    0,
    canvasEyeFocusElement.width,
    canvasEyeFocusElement.height
  );
  canvasEyeFocusCtx.save();
}

function eyeFocusRecognition(video, startTimeMs) {
  clearEyeFocusCanvas();
  
  canvasEyeFocusElement.style.height = `${video.offsetHeight}px`;
  canvasEyeFocusElement.style.width = `${video.offsetWidth}px`;
  canvasEyeFocusElement.style.left = `${video.offsetLeft}px`;

  results = faceLandmarker.detectForVideo(video, startTimeMs);

  if (results.faceLandmarks) {
    for (const landmarks of results.faceLandmarks) {
      drawingEyeFocusUtils.drawConnectors(
        landmarks,
        FaceLandmarker.FACE_LANDMARKS_TESSELATION,
        { color: "#C0C0C070", lineWidth: 1 }
      );
      drawingEyeFocusUtils.drawConnectors(
        landmarks,
        FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE,
        { color: "#FF3030" }
      );
      drawingEyeFocusUtils.drawConnectors(
        landmarks,
        FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW,
        { color: "#FF3030" }
      );
      drawingEyeFocusUtils.drawConnectors(
        landmarks,
        FaceLandmarker.FACE_LANDMARKS_LEFT_EYE,
        { color: "#30FF30" }
      );
      drawingEyeFocusUtils.drawConnectors(
        landmarks,
        FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW,
        { color: "#30FF30" }
      );
      drawingEyeFocusUtils.drawConnectors(
        landmarks,
        FaceLandmarker.FACE_LANDMARKS_FACE_OVAL,
        { color: "#E0E0E0" }
      );
      drawingEyeFocusUtils.drawConnectors(
        landmarks,
        FaceLandmarker.FACE_LANDMARKS_LIPS,
        { color: "#E0E0E0" }
      );
      drawingEyeFocusUtils.drawConnectors(
        landmarks,
        FaceLandmarker.FACE_LANDMARKS_RIGHT_IRIS,
        { color: "#FF3030" }
      );
      drawingEyeFocusUtils.drawConnectors(
        landmarks,
        FaceLandmarker.FACE_LANDMARKS_LEFT_IRIS,
        { color: "#30FF30" }
      );
    }
  }

  let recognitionResult = {
    type: 'face',
    data: 'noFocus'
  };

  if (results.faceBlendshapes) {
    if (results.faceBlendshapes.length !== 0) {
      let shapes = results.faceBlendshapes[0].categories.filter(
        (e) => e.categoryName in calibrationData && e.score > calibrationData[e.categoryName]
      )

      if (shapes.length === 0) {
        recognitionResult.data = 'focus';
      } 
    }
  }

  YTPlayerController(recognitionResult);
}

let lastVideoTime = -1;
let results = undefined;

async function predictWebcam() {
  if (video.currentTime != lastVideoTime) {
    lastVideoTime = video.currentTime;

    let gestureResult;
    if (gestureStatus) {
      let startTimeMs = performance.now();
      gestureResult = await gestureRecognition(video, startTimeMs)
    }

    if (gestureResult !== true) {
      if (eyeFocusStatus) {
        let startTimeMs = performance.now();
        eyeFocusRecognition(video, startTimeMs)
      }
    }
  }

  if (webcamRunning === true) {
    window.requestAnimationFrame(predictWebcam);
  }
}
