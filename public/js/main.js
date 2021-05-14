/* global FriendlyWebSocket, ml5, guidGenerator */

let user_id = guidGenerator();
let paired = false;
let peerConnections = [];

let localStream;
let sendTrack;
let canvas = document.getElementById("mainCanvas");
let audioelement = document.getElementById("remoteAudio");
let ctx = canvas.getContext("2d");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
let audioContext, audioInput, microphoneStream, gainNode;
let started = false;

let conConfig = {
  iceServers: [{ url: "stun:stun.1.google.com:19302" }]
};

// ------------------------------------------------------------
// setting up WebRTC
// PUBLIC STUN SERVERS: https://gist.github.com/zziuni/3741933

let handleOnTrack = data => {
  window.stream = data.streams[0];
  audioelement.srcObject = data.streams[0];
};

let handleOnIceCandidate = event => {
  if (event.candidate) {
    send({
      type: "CANDIDATE",
      ice: event.candidate
    });
  } else {
    console.log("All ICE candidates have been sent");
  }
};

let rtcConn = new RTCPeerConnection(conConfig);
rtcConn.ontrack = handleOnTrack;
rtcConn.onicecandidate = handleOnIceCandidate;

// ------------------------------------------------------------
// setting up websocket
let websocket = new FriendlyWebSocket({ path: "/" });

let onReceivePair = data => {
  document.querySelector(
    ".paired"
  ).innerText = `PAIRED! with your new friend: ${data.pairWith}`;

  paired = true;

  if (!sendTrack) {
    localStream.getAudioTracks().forEach(track => {
      sendTrack = rtcConn.addTrack(track, localStream);
    });
  }

  audioelement.play();
  localStream.getAudioTracks().forEach(track => {
    // rtcConn.addTrack(track, localStream);
  });

  rtcConn
    .createOffer({
      offerToReceiveAudio: true,
      voiceActivityDetection: false
    })
    .then(offer => rtcConn.setLocalDescription(offer))
    .then(() => {
      send({
        uuid: user_id,
        type: "OFFER",
        offer: rtcConn.localDescription
      });
    })
    .catch(err => {
      console.log("trouble making offer", err);
    });

  drawOnCanvas(true);
};

let onReceiveUnpair = data => {
  document.querySelector(".paired").innerText = `UNPAIRED!`;
  paired = false;
  rtcConn.removeTrack(sendTrack);
  sendTrack = undefined;
  drawOnCanvas(false);
};

let onReceiveOffer = data => {
  rtcConn.setRemoteDescription(new RTCSessionDescription(data.offer));
  rtcConn
    .createAnswer()
    .then(answer => {
      rtcConn.setLocalDescription(answer);
      send({
        uuid: user_id,
        type: "ANSWER",
        answer: answer
      });
    })
    .catch(err => console.log("ERR", err));
};

let onReceiveAnswer = data => {
  rtcConn.setRemoteDescription(new RTCSessionDescription(data.answer));
};

let onReceiveCandidate = data => {
  if (data.ice && rtcConn.localDescription && rtcConn.remoteDescription) {
    rtcConn.addIceCandidate(data.ice).catch(e => {
      console.log("Failure during addIceCandidate(): " + e.name, e);
    });
  }
};

let onReceiveCount = data => {
  document.querySelector(
    ".count"
  ).innerText = `currently online: ${data.count}`;
  document.querySelector(
    ".peers"
  ).innerText = `currently online: [${data.peers}]`;
};

// REGISTER when connection opens
websocket.on("open", data => {
  document.querySelector(".yourId").innerText = `your id: ${user_id}`;
  send({ type: "REGISTER", uuid: user_id });
});

// when signaling server sends a message
websocket.on("message", data => {
  data = JSON.parse(event.data);

  switch (data.type) {
    case "COUNT":
      onReceiveCount(data);
      break;
    case "PAIR":
      onReceivePair(data);
      break;
    case "UNPAIR":
      onReceiveUnpair(data);
      break;
    case "OFFER":
      onReceiveOffer(data);
      break;
    case "ANSWER":
      onReceiveAnswer(data);
      break;
    case "CANDIDATE":
      onReceiveCandidate(data);
      break;
    default:
      break;
  }
});

function send(data) {
  websocket.send(JSON.stringify(data));
}

function init() {
  if (started) return;
  document.querySelector(".center").innerText = "";

  var AudioContext = window.AudioContext || window.webkitAudioContext;
  audioContext = new AudioContext();

  function startMicrophone(stream) {
    gain_node = audioContext.createGain();
    gain_node.connect(audioContext.destination);

    gain_node.gain.setValueAtTime(0.4, audioContext.currentTime);

    microphone_stream = audioContext.createMediaStreamSource(stream);
    microphone_stream.connect(gain_node);

    // set up pitch detection!
    const pitch = ml5.pitchDetection(
      "./model/pitch-detection/crepe/",
      audioContext,
      stream,
      () => drawOnCanvas()
    );

    // as pitches come in...
    setInterval(
      () =>
        pitch.getPitch(function(err, frequency) {
          document.querySelector(".pitch").innerText = frequency;
          send({
            uuid: user_id,
            type: "PITCH",
            pitch: frequency
          });
        }),
      200
    );
  }

  navigator.mediaDevices
    .getUserMedia({ audio: true, video: false })
    .then(stream => {
      startMicrophone(stream);
      document.querySelector(".microphone").innerText = "mic enabled!";

      localStream = stream;

      audioelement.play();
      localStream.getAudioTracks().forEach(track => {
        // rtcConn.addTrack(track, localStream);
      });

      rtcConn
        .createOffer({
          offerToReceiveAudio: true,
          voiceActivityDetection: false
        })
        .then(offer => rtcConn.setLocalDescription(offer))
        .then(() =>
          send({
            uuid: user_id,
            type: "OFFER",
            offer: rtcConn.localDescription
          })
        )
        .catch(err => console.log("trouble making offer", err));

      started = true;
    })
    .catch(err => {
      console.log("Error capturing audio.", err);
    });
}

function drawOnCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "white";
  ctx.beginPath();
  ctx.save();
  if (!paired) ctx.setLineDash([1, 3]);
  ctx.ellipse(canvas.width / 2, canvas.height / 2, 50, 50, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "white";
  ctx.moveTo(canvas.width / 2, 0);
  ctx.lineTo(canvas.width / 2, canvas.height / 2 - 50);
  ctx.stroke();
  ctx.restore();

  if (paired) {
    ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.ellipse(canvas.width / 2, canvas.height / 2, 50, 50, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "white";
    ctx.moveTo(canvas.width / 2, canvas.height / 2 + 50);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.stroke();
  }
}

function onWindowResize(e) {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  drawOnCanvas();
}

drawOnCanvas();

document.addEventListener("click", init, false);
window.addEventListener("resize", onWindowResize, false);
