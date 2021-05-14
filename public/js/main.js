/* global FriendlyWebSocket, ml5, guidGenerator */

let user_id = guidGenerator();
let paired = false;
let peers = {};
let pendingCandidates = {};

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
// setting up websocket signaling server
const websocket = new FriendlyWebSocket({ path: "/" });

let createPeerConnection = () => {
  const pc = new RTCPeerConnection(conConfig);
  pc.onicecandidate = onIceCandidate;
  pc.onaddstream = onAddStream;
  pc.addStream(localStream);
  console.log("PeerConnection created");
  return pc;
};

let sendOffer = sid => {
  console.log("Send offer");
  peers[sid].createOffer().then(
    sdp => setAndSendLocalDescription(sid, sdp),
    error => {
      console.error("Send offer failed: ", error);
    }
  );
};

let sendAnswer = sid => {
  console.log("Send answer");
  peers[sid].createAnswer().then(
    sdp => setAndSendLocalDescription(sid, sdp),
    error => {
      console.error("Send answer failed: ", error);
    }
  );
};

const setAndSendLocalDescription = (sid, sessionDescription) => {
  peers[sid].setLocalDescription(sessionDescription);
  console.log("Local description set");
  send({ sid, type: sessionDescription.type, sdp: sessionDescription.sdp });
};

const onReceivePair = data => {
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

const onReceiveUnpair = data => {
  document.querySelector(".paired").innerText = `UNPAIRED!`;
  paired = false;
  rtcConn.removeTrack(sendTrack);
  sendTrack = undefined;
  drawOnCanvas(false);
};

const onReceiveOffer = data => {
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

const onReceiveAnswer = data => {
  rtcConn.setRemoteDescription(new RTCSessionDescription(data.answer));
};

const onReceiveCandidate = data => {
  if (data.ice && rtcConn.localDescription && rtcConn.remoteDescription) {
    rtcConn.addIceCandidate(data.ice).catch(e => {
      console.log("Failure during addIceCandidate(): " + e.name, e);
    });
  }
};

const onReceiveCount = data => {
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

const send = data => {
  websocket.send(JSON.stringify(data));
};

const init = () => {
  if (started) return;
  document.querySelector(".center").innerText = "";

  var AudioContext = window.AudioContext || window.webkitAudioContext;
  audioContext = new AudioContext();

  function startMicrophone(stream) {
    gainNode = audioContext.createGain();
    gainNode.connect(audioContext.destination);

    gainNode.gain.setValueAtTime(0.4, audioContext.currentTime);

    microphoneStream = audioContext.createMediaStreamSource(stream);
    microphoneStream.connect(gainNode);

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
};

const drawOnCanvas = () => {
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
};

const onWindowResize = e => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  drawOnCanvas();
};

drawOnCanvas();

document.addEventListener("click", init, false);
window.addEventListener("resize", onWindowResize, false);
