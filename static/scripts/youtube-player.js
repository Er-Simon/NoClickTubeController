const YOUTUBE_LINK_REGEX = /(youtu.*be.*)\/(watch\?v=|embed\/|v|shorts|)(.*?((?=[&#?])|$))/gi

const PAUSE_BETWEEN_COMMANDS_IN_MILLIS = 900;

const INCREASE_VOLUME_VALUE = 10;
const DECREASE_VOLUME_VALUE = -10;

const ACTIONS_TO_EMOJI = {
  focus: '👀',
  noFocus: '🙈',
  closed_fist: '✊',
  open_palm: '✋',
  mute: '🤫',
  stop: '✋',
  call: '🤙',
  ok: '👌',
  dislike: '👎',
  like: '👍',
  peace: '✌️',
  rock: '🤘',
  TwoFingers: '2️⃣',
  ThreeFingers: '3️⃣',
  FourFingers: '4️⃣',
  FiveFingers: '5️⃣',
  SevenFingers: '6️⃣',
  SevenFingers: '7️⃣',
  EightFingers: '8️⃣'
};

const MIN_FOCUS_NOFOCUS_TIME = 1800;


var player = undefined;
var isReady = false;

var timestampLastCommand = Date.now();

var lastAction;
var lastModality;
var disableEyeFocus;

function handleYouTubeURL() {
  let url = document.getElementById('youtube-url').value
  let matches = url.matchAll(YOUTUBE_LINK_REGEX)

  if (matches) {    
    let video_id = null

    for (const match of matches) {
      video_id = match[3]
    }

    if (video_id && !(video_id.length === 0)) {
      if (isReady) {
        player.loadVideoById(video_id);
      } else {
        swGetYoutubeVids('player', video_id);
      }
    } else {
      showErrorMessage(true);
    }
  }
}

function onYouTubeIframeAPIReady() {
  let playButton = document.getElementById('play-button');
  playButton.disabled = false;
}

function onPlayerReady() {
  isReady = true      

  var playerDiv = document.getElementById('player');
  playerDiv.classList.remove('d-none');
}

function onPlayerError() {
  alert("failed to load the YouTube player, refresh the page!");
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
      showinfo: 0,
      origin: window.location.hostname
    }
  });
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

function changePlayerVolume(value) {
  var volumeLevel = player.getVolume();

  volumeLevel = volumeLevel + value;

  if (value > 0) {
    volumeLevel = Math.min(100, volumeLevel);
  } else {
    volumeLevel = Math.max(0, volumeLevel);
  }

  player.setVolume(volumeLevel);
}


async function YTPlayerController(recognition) {
  if (isReady === false) {
    return false;
  }

  var currentTime = Date.now();

  if (currentTime - timestampLastCommand > MIN_FOCUS_NOFOCUS_TIME) {

    var modality = recognition.type;
    var data = recognition.data;

    if (!modality || !data) return;

    var action;

    if (modality === 'gesture') {
      var fingerCount = 0;

      for (let index = 0; index < data.length; index++) {
        result = data[index];

        if (result.recognizedGesture in controlsToAction) {
          action = result.recognizedGesture;
          break;

        } else {
          fingerCount += result.fingerCount;
        }
      }

      if (action === undefined) {
        if (Number.isInteger(fingerCount))
          action = parseToAction(fingerCount)
      }
      
    } else if (modality === 'face') {
      if (!disableEyeFocus) {
        action = data;

        if (action === lastAction) {
          if (firstEyeNoFocus === undefined) {
            firstEyeNoFocus = currentTime;
          } else if (currentTime - firstEyeNoFocus < PAUSE_BETWEEN_COMMANDS_IN_MILLIS) {
            action = undefined;
          }
        } else {
          firstEyeNoFocus = undefined;
        }
      }
    }

    if (action) {
      if (controlsToAction[action] == "playVideoControl") {
        player.playVideo();

        if (modality === 'gesture') disableEyeFocus = false;

      } else if (controlsToAction[action] == "pauseVideoControl") {
        player.pauseVideo();

        if (modality === 'gesture') disableEyeFocus = true;

      } else if (controlsToAction[action] == "muteVideoControl") {
        player.mute();
      } else if (controlsToAction[action] == "unmuteVideoControl") {
        player.unMute();

      } else if (action in controlsToAction) {
        if (controlsToAction[action] == "volumeUpVideoControl") {
          changePlayerVolume(INCREASE_VOLUME_VALUE);
        } else if (controlsToAction[action] == "volumeDownVideoControl") {
          changePlayerVolume(DECREASE_VOLUME_VALUE);
        }

        timestampLastCommand -= PAUSE_BETWEEN_COMMANDS_IN_MILLIS * 0.75;
      }

      if (action !== lastAction) {
        var toastEle = document.getElementById('liveToast');
        var toastBody = document.getElementById('toast-body-content');
  
        var toast = bootstrap.Toast.getOrCreateInstance(toastEle);
  
        if (toast.isShown()) {
          toast.dispose();
        }
  
        var toast = bootstrap.Toast.getOrCreateInstance(toastEle);
  
        var toastTextContent = `Action recognized: ${action} ${ACTIONS_TO_EMOJI[action]}`;
        toastBody.innerHTML = toastTextContent;
      
        await toast.show();
      }

      lastAction = action;
      lastModality = modality;
      timestampLastCommand = Date.now();
    }
  }
}
