/* global FriendlyWebSocket, guidGenerator */

let user_id = guidGenerator();
let peers = {};
let pendingCandidates = {};
let localStream;

let started = false;

let canvas = document.getElementById("mainCanvas");
let ctx = canvas.getContext("2d");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let conConfig = {
  iceServers: [{ url: "stun:stun.1.google.com:19302" }],
  offerToReceiveAudio: true,
  offerToReceiveVideo: true
};

// ------------------------------------------------------------
// setting up websocket signaling server
const websocket = new FriendlyWebSocket({ path: "/" });

const createPeerConnection = () => {
  const pc = new RTCPeerConnection(conConfig);
  pc.onicecandidate = onIceCandidate;
  pc.ontrack = handleOnTrack;

  console.log("PeerConnection created");

  for (const track of localStream.getTracks()) {
    console.log("adding track to peer connection", track);
    pc.addTra1ck(track, localStream);
  }

  return pc;
};

const sendOffer = sid => {
  console.log("Send offer to " + sid);
  peers[sid]
    .createOffer()
    .then(sdp => setAndSendLocalDescription(sid, sdp))
    .catch(error => {
      console.error("Send offer failed: ", error);
    });
};

const sendAnswer = sid => {
  console.log("Send answer to " + sid);
  peers[sid]
    .createAnswer()
    .then(sdp => setAndSendLocalDescription(sid, sdp))
    .catch(error => {
      console.error("Send answer failed: ", error);
    });
};

const setAndSendLocalDescription = (sid, sessionDescription) => {
  console.log("sessionDescription", sessionDescription);
  peers[sid]
    .setLocalDescription(sessionDescription)
    .then(() => {
      send({ sid, type: sessionDescription.type, sdp: sessionDescription });
      console.log("Local description set", sessionDescription);
    })
    .catch(error => {
      console.error("issue with setting local description: ", error);
    });
};

const onIceCandidate = event => {
  if (event.candidate) {
    console.log("ICE candidate", event);
    send({
      sid: user_id,
      type: "candidate",
      candidate: event.candidate
    });
  } else {
    console.log("All ICE candidates have been sent");
  }
};

const handleOnTrack = event => {
  console.log("Add streaming element", event);
  const newRemoteStreamElem = document.createElement("video");
  newRemoteStreamElem.autoplay = true;
  newRemoteStreamElem.controls = true; // TEMP

  if (event.streams && event.streams[0]) {
    newRemoteStreamElem.srcObject = event.streams[0];
  } else {
    let inboundStream = new MediaStream(event.track);
    newRemoteStreamElem.srcObject = inboundStream;
  }
  
  newRemoteStreamElem.play();

  document.querySelector("#remoteStreams").appendChild(newRemoteStreamElem);
};

const addPendingCandidates = sid => {
  if (sid in pendingCandidates) {
    pendingCandidates[sid].forEach(candidate => {
      peers[sid].addIceCandidate(candidate);
    });
  }
};

const onReceiveOffer = (sid, data) => {
  console.log("receiving offer from " + sid, data);
  peers[sid] = createPeerConnection();
  peers[sid].setRemoteDescription(data.sdp).then(() => {
    sendAnswer(sid);
    addPendingCandidates(sid);
  });
};

const onReceiveAnswer = (sid, data) => {
  console.log("receiving answer from " + sid, data);
  // if (sid !== user_id) peers[sid].setRemoteDescription(data.sdp);
  peers[sid].setRemoteDescription(data.sdp);
};

const onReceiveCandidate = (sid, data) => {
  if (sid in peers) {
    peers[sid].addIceCandidate(data.ice);
  } else {
    if (!(sid in pendingCandidates)) {
      pendingCandidates[sid] = [];
    }
    pendingCandidates[sid].push(data.candidate);
  }
};

const onReceiveCount = (sid, data) => {
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
  send({ type: "register", sid: user_id });
  // peers[user_id] = createPeerConnection();
});

// when signaling server sends a message
websocket.on("message", data => {
  data = JSON.parse(event.data);
  const sid = data.sid;
  delete data.sid;

  switch (data.type) {
    case "count":
      onReceiveCount(sid, data);
      break;
    case "offer":
      onReceiveOffer(sid, data);
      break;
    case "answer":
      onReceiveAnswer(sid, data);
      break;
    case "candidate":
      onReceiveCandidate(sid, data);
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

  navigator.mediaDevices
    .getUserMedia({ audio: false, video: true })
    .then(stream => {
      console.log("got user media", stream);
      localStream = stream;

      // initial connection
      peers[user_id] = createPeerConnection();

      sendOffer(user_id);

      started = true;
    })
    .catch(err => {
      console.log("Error capturing stream.", err);
    });
};

const drawOnCanvas = () => {};

const onWindowResize = e => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  drawOnCanvas();
};

drawOnCanvas();

document.addEventListener("click", init, false);
window.addEventListener("resize", onWindowResize, false);
