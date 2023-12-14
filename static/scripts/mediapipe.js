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
const {
  GestureRecognizer,
  FaceLandmarker,
  FilesetResolver,
  DrawingUtils,
} = vision;

const loadingElement = document.getElementById("loading");
const gestureDemosSection = document.getElementById("gestureDemos");
const videoBlendShapes = document.getElementById("video-blend-shapes");

let gestureRecognizer;
let faceLandmarker;
let runningMode = "VIDEO";

let enableWebcamButton;
let enableGesture;
let enableEyeFocus;

let webcamRunning = false;
let gestureFunctionEnabled = true;
let eyeFocusFunctionEnabled = true;

// Before we can use HandLandmarker class we must wait for it to finish
// loading. Machine Learning models can be large and take a moment to
// get everything needed to run.
const initializeModels = async () => {
  const filesetResolver = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
  );

  gestureRecognizer = await GestureRecognizer.createFromOptions(
    filesetResolver,
    {
      baseOptions: {
        modelAssetPath:
          "https://raw.githubusercontent.com/Er-Simon/GestureRecognitionCustomModel/main/gesture_recognizer.task",
        delegate: "GPU",
      },
      runningMode: runningMode,
      numHands: 2,
    }
  );

  faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
    baseOptions: {
      modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
      delegate: "GPU",
    },
    outputFaceBlendshapes: true,
    runningMode,
    numFaces: 1,
  });

  loadingElement.classList.add("d-none");
  gestureDemosSection.classList.remove("d-none");
};

initializeModels();

/********************************************************************
// Demo 2: Continuously grab image from webcam stream and detect it.
********************************************************************/
const video = document.getElementById("gestureWebcam");
const canvasGestureElement = document.getElementById("gesture_output_canvas");
const canvasEyeFocusElement = document.getElementById(
  "eye_focus_output_canvas"
);
const canvasGestureCtx = canvasGestureElement.getContext("2d");
const canvasEyeFocusCtx = canvasEyeFocusElement.getContext("2d");
//const gestureOutput = document.getElementById("gesture_output");

const canvasWidth = canvasGestureElement.width;

// Check if webcam access is supported.
function hasGetUserMedia() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

// If webcam supported, add event listener to button for when user
// wants to activate it.
if (hasGetUserMedia()) {
  enableWebcamButton = document.getElementById("gestureWebcamButton");
  enableWebcamButton.addEventListener(
    "click",
    () => (webcamRunning = !webcamRunning)
  );
  enableWebcamButton.addEventListener("click", displayFunctions);

  enableGesture = document.getElementById("flexSwitchGestureControl");
  enableGesture.addEventListener("change", (event) => {
    canvasGestureCtx.clearRect(
      0,
      0,
      canvasGestureElement.width,
      canvasGestureElement.height
    );
    gestureFunctionEnabled = event.currentTarget.checked;
  });

  enableEyeFocus = document.getElementById("flexSwitchEyeFocusControl");
  enableEyeFocus.addEventListener("change", (event) => {
    canvasEyeFocusCtx.clearRect(
      0,
      0,
      canvasEyeFocusElement.width,
      canvasEyeFocusElement.height
    );
    eyeFocusFunctionEnabled = event.currentTarget.checked;

    var faceLandmarkerResults = document.getElementById(
      "faceLandmarkerResults"
    );
    if (eyeFocusFunctionEnabled === true) {
      faceLandmarkerResults.classList.remove("d-none");
    } else {
      faceLandmarkerResults.classList.add("d-none");
    }
  });
} else {
  console.warn("getUserMedia() is not supported by your browser");
}

function displayFunctions(event) {
  var gestureSwitch = document.getElementById("gestureSwitch");
  var eyeFocusSwitch = document.getElementById("eyeFocusSwitch");

  if (webcamRunning === false) {
    gestureSwitch.classList.add("d-none");
    eyeFocusSwitch.classList.add("d-none");
  } else {
    gestureSwitch.classList.remove("d-none");
    eyeFocusSwitch.classList.remove("d-none");
  }

  enableCam(event);
}

// Enable the live webcam view and start detection.
function enableCam(event) {
  if (!gestureRecognizer) {
    alert("Please wait for gestureRecognizer to load");
    return;
  }

  if (!faceLandmarker) {
    alert("Please wait for faceLandmarker to load");
    return;
  }

  if (webcamRunning === false) {
    enableWebcamButton.innerText = "Enable webcam access";
    video.classList.add("d-none");
    canvasGestureElement.classList.add("d-none");
    canvasEyeFocusElement.classList.add("d-none");
    return;
  } else {
    enableWebcamButton.innerText = "Disable webcam access";
    video.classList.remove("d-none");
    canvasGestureElement.classList.remove("d-none");
    canvasEyeFocusElement.classList.remove("d-none");
  }

  // getUsermedia parameters.
  const constraints = {
    video: true,
  };

  // Activate the webcam stream.
  navigator.mediaDevices.getUserMedia(constraints).then(function(stream) {
    video.srcObject = stream;
    video.addEventListener("loadeddata", predictWebcam);
  });
}

let eyeFocusResults = undefined;
let gestureResults = undefined;
const drawingEyeFocusUtils = new DrawingUtils(canvasEyeFocusCtx);
const drawingGestureUtils = new DrawingUtils(canvasGestureCtx);

const MIN_SCORE = 0.44
const MIN_FOCUS_TIME = 650
const FACE_BLEND_SHAPES = [
  "eyeSquintLeft",
  "eyeSquintRight",
  "browDownLeft",
  "browDownRight",
  "eyeLookOutLeft",
  "eyeLookOutRight",
  "eyeLookDownLeft",
  "eyeLookDownRight",
  "mouthShrugLower",
  "browOuterUpLeft",
  "browOuterUpRight",
]

var focusStartTime = null;
var noFocusStartTime = null;
var automaticResumed = false;
var automaticStopped = false;

async function predictWebcam() {
  const webcamElement = document.getElementById("gestureWebcam");

  canvasEyeFocusCtx.clearRect(
    0,
    0,
    canvasEyeFocusElement.width,
    canvasEyeFocusElement.height
  );
  canvasEyeFocusCtx.save();

  canvasGestureCtx.clearRect(
    0,
    0,
    canvasGestureElement.width,
    canvasGestureElement.height
  );
  canvasGestureCtx.save();

  if (gestureFunctionEnabled === true) {
    let nowInMs = Date.now();

    gestureResults = gestureRecognizer.recognizeForVideo(video, nowInMs);

    canvasGestureElement.style.height = `${webcamElement.offsetHeight}px`;
    canvasGestureElement.style.width = `${webcamElement.offsetWidth}px`;
    canvasGestureElement.style.left = `${webcamElement.offsetLeft}px`;

    if (gestureResults) {
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
    }

    var rightHandGesture = null;
    var leftHandGesture = null;
    var totalFingerCount = 0;

    if (gestureResults) {
      if (gestureResults.gestures.length > 0) {
        if (webcamRunning) {
          for (var i = 0; i < gestureResults.gestures.length; i++) {
            var categoryName = gestureResults.gestures[i][0].categoryName;

            var categoryScore = parseFloat(
              gestureResults.gestures[i][0].score * 100
            ).toFixed(2);

            var handLabel = gestureResults.handednesses[i][0].displayName;

            if (handLabel == "Right") {
              rightHandGesture = categoryName;
            } else if (handLabel == "Left") {
              leftHandGesture = categoryName;
            }

            var fingerCount = 0;
            var landmarks = [];

            for (const landmark of gestureResults.landmarks[i]) {
              landmarks.push([landmark.x, landmark.y]);
            }

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

            totalFingerCount += fingerCount;

            var gestureOutput = `GestureRecognizer: ${categoryName}\nConfidence: ${categoryScore} %\nHandedness: ${handLabel}\nFingerCount: ${fingerCount}`;

            var offset = 10;
            var lineheight = 38;

            var lines = gestureOutput
              .split("")
              .join(String.fromCharCode(8202))
              .split("\n");

            canvasGestureCtx.font = "36px Arial";

            var textMaxWidth = lines.map(
              (text) => canvasGestureCtx.measureText(text).width
            );

            textMaxWidth = Math.max.apply(Math, textMaxWidth);

            canvasGestureCtx.textAlign = "start";
            canvasGestureCtx.textBaseline = "top";

            canvasGestureCtx.fillStyle = "rgba(0, 0, 0, .6)";
            canvasGestureCtx.fillRect(
              (canvasWidth - textMaxWidth - offset) * i,
              0,
              textMaxWidth + offset * 2,
              lines.length * lineheight + offset * 2
            );

            canvasGestureCtx.fillStyle = "white";

            for (var j = 0; j < lines.length; j++)
              canvasGestureCtx.fillText(
                lines[j],
                (canvasWidth - textMaxWidth - offset) * i + offset,
                offset + j * lineheight
              );
          }

          YTPlayerController(
            rightHandGesture,
            leftHandGesture,
            totalFingerCount,
            null
          );
        }
      }
    }
  }


  if (eyeFocusFunctionEnabled === true) {
    canvasEyeFocusElement.style.height = `${webcamElement.offsetHeight}px`;
    canvasEyeFocusElement.style.width = `${webcamElement.offsetWidth}px`;
    canvasEyeFocusElement.style.left = `${webcamElement.offsetLeft}px`;

    if (runningMode === "IMAGE") {
      runningMode = "VIDEO";
      await faceLandmarker.setOptions({ runningMode: runningMode });
    }

    let startTimeMs = performance.now();

    eyeFocusResults = faceLandmarker.detectForVideo(video, startTimeMs);

    if (eyeFocusResults.faceLandmarks) {
      for (const landmarks of eyeFocusResults.faceLandmarks) {
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

    if (!gestureResults || gestureResults.gestures.length == 0) {
      if (eyeFocusResults) {
        if (eyeFocusResults.faceBlendshapes) {
          let shapes = eyeFocusResults.faceBlendshapes.length == 0 ? [] :
            eyeFocusResults.faceBlendshapes[0].categories.filter((e) => e.score > MIN_SCORE && FACE_BLEND_SHAPES.includes(e.categoryName))

          let currentTime = Date.now();

          //console.log("shapes", shapes)
          //console.log("focusStartTime time elapsed:", currentTime - focusStartTime, currentTime, focusStartTime)
          //console.log("noFocusStartTime time elapsed:", currentTime - noFocusStartTime, currentTime, noFocusStartTime)
          //console.log("DEBUG:", eyeFocusResults.faceBlendshapes.length == 0 ? [] :
          //eyeFocusResults.faceBlendshapes[0].categories.filter((e) => e.score > 0.1))
          //console.log("------------------------------------------------------")

          if (shapes.length == 0 && !eyeFocusResults.faceBlendshapes.length == 0) {
            noFocusStartTime = null

            if (!automaticResumed) {
              if (focusStartTime == null) {
                focusStartTime = currentTime;
              } else {
  
                if (currentTime - focusStartTime > MIN_FOCUS_TIME) {
                  //console.log("auto focus")
                  let response = YTPlayerController(null, null, null, "focus");
                  
                  if (response) {
                    automaticResumed = true;
                    automaticStopped = false;
                  }
                  
                  focusStartTime = null;
                }
              }
            }
          } else {
            focusStartTime = null

            if (!automaticStopped) {
              if (noFocusStartTime == null) {
                noFocusStartTime = currentTime;
              } else {

                if (currentTime - noFocusStartTime > MIN_FOCUS_TIME) {
                  //console.log("auto noFocus")
                  let response = YTPlayerController(null, null, null, "noFocus");

                  if (response) {
                    automaticStopped = true;
                    automaticResumed = false;
                  }

                  noFocusStartTime = null;
                }
              }
            } 
          }            
        }
      }
    }
      
    //drawBlendShapes(videoBlendShapes, eyeFocusResults.faceBlendshapes);
  }

  // Call this function again to keep predicting when the browser is ready.
  if (webcamRunning === true) {
    window.requestAnimationFrame(predictWebcam);
  }
}

function drawBlendShapes(el, blendShapes) {
  if (!blendShapes.length) {
    return;
  }

  let htmlMaker = "";
  blendShapes[0].categories.map((shape) => {
    var score = +shape.score.toFixed(3);
    if (score !== 0 && score > 0.1) {
      htmlMaker += `
        <li class="blend-shapes-item my-li">
          <span class="blend-shapes-label">${shape.displayName ||
            shape.categoryName}</span>
          <span class="blend-shapes-value" style="width: calc(${+shape.score *
            100}% - 120px)">${(+shape.score).toFixed(4)}</span>
        </li>
      `;
    }
  });

  el.innerHTML = htmlMaker;
}
