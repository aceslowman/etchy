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
  // pc.onaddstream = onAddStream;
  pc.ontrack = onAddStream;
  // pc.addTrack(localStream);
  
  //
  if(localStream)
    for (const track of localStream.getTracks()) {
      console.log('adding track')
      pc.addTrack(track, localStream);
    }
  
  console.log("PeerConnection created");
  return pc;
};

const sendOffer = sid => {
  console.log("Send offer");
  peers[sid].createOffer().then(
      sdp => setAndSendLocalDescription(sid, sdp),
      error => {
        console.error("Send offer failed: ", error);
      }
    );
};

const sendAnswer = sid => {
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

const onIceCandidate = event => {
  if (event.candidate) {
    console.log("ICE candidate", event.candidate);
    send({
      type: "candidate",
      candidate: event.candidate
    });
  } else {
    console.log("All ICE candidates have been sent");
  }
};

const onAddStream = event => {
  console.log("Add stream");
  const newRemoteStreamElem = document.createElement("video");
  newRemoteStreamElem.autoplay = true;
  newRemoteStreamElem.srcObject = event.stream;
  document.querySelector("#remoteStreams").appendChild(newRemoteStreamElem);
};

const addPendingCandidates = sid => {
  if (sid in pendingCandidates) {
    pendingCandidates[sid].forEach(candidate => {
      peers[sid].addIceCandidate(new RTCIceCandidate(candidate));
    });
  }
};

const onReceiveOffer = data => {
  peers[data.sid] = createPeerConnection();
  peers[data.sid].setRemoteDescription(new RTCSessionDescription(data));
  sendAnswer(data.sid);
  addPendingCandidates(data.sid);
};

const onReceiveAnswer = data => {
  peers[data.sid].setRemoteDescription(new RTCSessionDescription(data));
};

const onReceiveCandidate = data => {
  if (data.sid in peers) {
    peers[data.sid].addIceCandidate(data.ice);
  } else {
    if (!(data.sid in pendingCandidates)) {
      pendingCandidates[data.sid] = [];
    }
    pendingCandidates[data.sid].push(data.candidate);
  }
};

const onReceiveCount = data => {
  console.log('data',data)
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
});

// when signaling server sends a message
websocket.on("message", data => {
  data = JSON.parse(event.data);

  switch (data.type) {
    case "count":
      onReceiveCount(data);
      break;
    case "offer":
      onReceiveOffer(data);
      break;
    case "answer":
      onReceiveAnswer(data);
      break;
    case "candidate":
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

  navigator.mediaDevices
    .getUserMedia({ audio: false, video: true })
    .then(stream => {
      console.log('got user media', stream);
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

const drawOnCanvas = () => {
  
};

const onWindowResize = e => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  drawOnCanvas();
};

drawOnCanvas();

document.addEventListener("click", init, false);
window.addEventListener("resize", onWindowResize, false);
