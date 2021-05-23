import FriendlyWebSocket from "./FriendlyWebSocket";
// https://stackoverflow.com/questions/6860853/generate-random-string-for-div-id
function guidGenerator() {
  var S4 = function() {
    return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
  };
  return S4() + S4();
}

let user_id = guidGenerator();

let peer;
let peer_id = "B";
let pendingCandidates = {};
let localStream;

let started = false;

let canvas = document.getElementById("mainCanvas");
let ctx = canvas.getContext("2d");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let conConfig = {
  iceServers: [{ url: "stun:stun.1.google.com:19302" }],
  offerToReceiveAudio: false,
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
    pc.addTrack(track, localStream);
  }

  return pc;
};

const sendOffer = () => {
  console.log("Send offer to " + peer_id);
  peer
    .createOffer()
    .then(sdp => setAndSendLocalDescription(sdp))
    .catch(error => {
      console.error("Send offer failed: ", error);
    });
};

const sendAnswer = () => {
  console.log("Send answer to " + peer_id);
  peer
    .createAnswer()
    .then(sdp => setAndSendLocalDescription(sdp))
    .catch(error => {
      console.error("Send answer failed: ", error);
    });
};

const setAndSendLocalDescription = (sessionDescription) => {
  console.log("sessionDescription", sessionDescription);
  peer
    .setLocalDescription(sessionDescription)
    .then(() => {
      send({
        fromId: user_id,
        toId: peer_id,
        type: sessionDescription.type,
        sdp: sessionDescription
      });
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
      fromId: user_id,
      toId: peer_id,
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
      peer.addIceCandidate(candidate);
    });
  }
};

// REGISTER when connection opens
websocket.on("open", data => {
  document.querySelector(".yourId").innerText = `your id: ${user_id}`;
  send({ type: "register", user_id: user_id });
});

// when signaling server sends a message
websocket.on("message", data => {
  data = JSON.parse(event.data);
  const sid = data.sid;
  delete data.sid;

  switch (data.type) {
    case "count":
      document.querySelector(
        ".count"
      ).innerText = `currently online: ${data.count}`;
      document.querySelector(
        ".peers"
      ).innerText = `currently online: [${JSON.stringify(data.peers)}]`;
      for (let i = 0; i < data.peers.length; i++) {
        let btn = document.createElement("button");
        btn.innerHTML = data.peers[i].user_id;
        btn.addEventListener("click", e => {
          console.log("click", e.target.innerHTML);
          
          // set peer
          peer = createPeerConnection();
          peer_id = e.target.innerHTML;
          sendOffer(peer_id);
        });
        document.querySelector(".peers").appendChild(btn);
      }
      break;
    case "offer":
      console.log("receiving offer from " + sid, data);
      peer = createPeerConnection();
      peer.setRemoteDescription(data.sdp).then(() => {
        sendAnswer(sid);
        addPendingCandidates(sid);
      });
      break;
    case "answer":
      console.log("receiving answer from " + sid, data);
      // if (sid !== user_id) peers[sid].setRemoteDescription(data.sdp);
      peer.setRemoteDescription(data.sdp);
      break;
    case "candidate":
      // if (sid in peers) {
      peer.addIceCandidate(data.ice);
      // } else {
      //   if (!(sid in pendingCandidates)) {
      //     pendingCandidates[sid] = [];
      //   }
      //   pendingCandidates[sid].push(data.candidate);
      // }
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
      // peer = createPeerConnection();

      // sendOffer(user_id);

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
