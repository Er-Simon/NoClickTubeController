# NoClickTubeController

A web app that allows users to interact with a video player to embed YouTube videos.

Users will be able to control the player using **gestures** and **monitor attention on the video using facial features** to pause or resume video playback depending on the user's attention.

> Gesture recognition and facial feature tracking leverage MediaPipe models.


# Run the Web App
Install required dependecies:

```sh
pip install -r requirements.txt
```
Run the app

```sh
flask run
```

# Enabling technologies

- [IFrame Player API](https://developers.google.com/youtube/iframe_api_reference#playVideo) - Embed a YouTube video player 

- [Gesture recognition](https://developers.google.com/mediapipe/solutions/vision/gesture_recognizer) - Recognize hand gestures in real time

- [Face landmark detection](https://developers.google.com/mediapipe/solutions/vision/face_landmarker) - Detect face landmarks and facial expressions
