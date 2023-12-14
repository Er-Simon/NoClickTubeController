const PAUSE_BETWEEN_COMMANDS_IN_MILLIS = 1800;

var isReady = false;
var timestampLastCommand = Date.now();

function handleYouTubeURL() {
  let url = document.getElementById('youtube-url').value

  var myregexp = /(youtu.*be.*)\/(watch\?v=|embed\/|v|shorts|)(.*?((?=[&#?])|$))/gi
  let matches = url.matchAll(myregexp)

  if (matches) {
    let video_id = null

    for (const match of matches) {
      video_id = match[3]
    }

    if (video_id && !(video_id.length == 0)) {
      if (isReady) {
        player.loadVideoByUrl(url)
      } else {
        swGetYoutubeVids('player', video_id)
      }
    } else {
      let alert = document.getElementById('alert-message')
      alert.classList.remove('d-none')
    }
  }
}

function onYouTubeIframeAPIReady() {
  let playButton = document.getElementById('play-button')
  playButton.disabled = false
}

function onPlayerReady() {
  isReady = true      
  var playerDiv = document.getElementById('player')
  playerDiv.classList.remove('d-none')
}

function onPlayerError() {
  alert("failed to load the YouTube player, refresh the page")
}

function swGetYoutubeVids(playerById, videoId) {
  player = new YT.Player(playerById, {
    width: "100%",
    height: "480",
    videoId: videoId,
    events: {
      'onReady': onPlayerReady,
      'onError': onPlayerError
    },
    playerVars: {
      enablejsapi: 1,
      modestbranding: 1,
      showinfo: 0
    }
  })
}

function parseToAction(value) {
  var newAction = null 
  
  if (value == 2) {
    newAction = "TwoFingers"
  } else if (value == 3) {
    newAction = "ThreeFingers"
  } else if (value == 4) {
    newAction = "FourFingers"
  } else if (value == 5) {
    newAction = "FiveFingers"
  } else if (value == 6) {
    newAction = "SixFingers"
  } else if (value == 7) {
    newAction = "SevenFingers"
  } else if (value == 8) {
    newAction = "EightFingers"
  }
  return newAction
}

function YTPlayerController(rightHandGesture, leftHandGesture, fingerCount, focusState) {
  if (player == null || isReady == false) {
    return false;
  }

  if (controlsToAction) {
    var currentTime = Date.now()

    if (focusState != null || currentTime - timestampLastCommand > PAUSE_BETWEEN_COMMANDS_IN_MILLIS) {

      var action = 
        (focusState in controlsToAction ? focusState : null) ||
        (rightHandGesture in controlsToAction ? rightHandGesture : null) || 
        (leftHandGesture in controlsToAction ? leftHandGesture : null)

      
      if (!action) {
        if (Number.isInteger(fingerCount))
          action = parseToAction(fingerCount)
      }

      if (action) {
        timestampLastCommand = Date.now()

        if (controlsToAction[action] == "playVideoControl") {
          player.playVideo()
        } else if (controlsToAction[action] == "pauseVideoControl") {
          player.pauseVideo()
        } else if (controlsToAction[action] == "volumeUpVideoControl") {
          var volumeLevel = player.getVolume()

          volumeLevel = volumeLevel + 10
          volumeLevel = Math.min(100, volumeLevel)

          player.setVolume(volumeLevel)

          timestampLastCommand -= PAUSE_BETWEEN_COMMANDS_IN_MILLIS * 0.75

        } else if (controlsToAction[action] == "volumeDownVideoControl") {
          var volumeLevel = player.getVolume()

          volumeLevel = volumeLevel - 10
          volumeLevel = Math.max(0, volumeLevel)

          player.setVolume(volumeLevel)

          timestampLastCommand -= PAUSE_BETWEEN_COMMANDS_IN_MILLIS * 0.75

        } else if (controlsToAction[action] == "muteVideoControl") {
          player.mute()
        } else if (controlsToAction[action] == "unmuteVideoControl") {
          player.unMute()
        }
      }
    }
  }
}
