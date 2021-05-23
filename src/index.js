import FriendlyWebSocket from "./FriendlyWebSocket";
// https://stackoverflow.com/questions/6860853/generate-random-string-for-div-id
function guidGenerator() {
  var S4 = function() {
    return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
  };
  return S4() + S4();
}

let user_id = guidGenerator();

let peer, mycon;
let peer_id = "B";
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

  return pc;
};

const sendOffer = () => {
  console.log("Send offer to " + peer_id);
  mycon
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

const setAndSendLocalDescription = sessionDescription => {
  console.log("sessionDescription", sessionDescription);
  mycon
    .setLocalDescription(sessionDescription)
    .then(() => {
      send({
        from_id: user_id,
        to_id: peer_id,
        type: sessionDescription.type,
        sdp: sessionDescription
      });
      console.log("Local description set", sessionDescription);
    })
    .catch(error => {
      console.error("issue with setting local description: ", error);
    });
  
  peer.setRemoteDescription(sessionDescription)
};

const onIceCandidate = (event) => {
console.log('hit')
  if (event.candidate) {
    console.log("ICE candidate", event);
    send({
      from_id: user_id,
      to_id: peer_id,
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

// REGISTER when connection opens
websocket.on("open", data => {
  document.querySelector(".yourId").innerText = `your id: ${user_id}`;
  send({ type: "register", user_id: user_id });
});

// when signaling server sends a message
websocket.on("message", data => {
  data = JSON.parse(event.data);
  console.log("data", data);

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
      console.log("receiving offer from " + data.from_id, data);
      peer = createPeerConnection();
      peer_id = data.from_id;
      peer
        .setRemoteDescription(data.sdp)
        .then(() => {
          sendAnswer();
          // addPendingCandidates();
          mycon.addIceCandidate(data.ice).catch(e => {
            console.log("Failure during addIceCandidate(): " + e.name);
          });
          localStream
            .getTracks()
            .forEach(track => peer.addTrack(track, localStream));
        })
        .catch(error => console.error(error));
      break;
    case "answer":
      console.log("receiving answer from " + data.from_id, data);
      peer
        .setRemoteDescription(data.sdp)
        .then(() => {
          // peer.addIceCandidate(data.ice);
          localStream
            .getTracks()
            .forEach(track => peer.addTrack(track, localStream));
        })
        .catch(error => console.error(error));

      // localStream.getTracks().forEach(track => peer.addTrack(track, localStream));
      break;
    case "candidate":
      console.log("candidate");
      peer.addIceCandidate(data.ice);
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

      // document.getElementById("local-video").srcObject = localStream;

      // initial connection
      mycon = createPeerConnection();

      stream.getTracks().forEach(track => mycon.addTrack(track, stream));

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
