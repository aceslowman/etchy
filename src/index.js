import FriendlyWebSocket from "./FriendlyWebSocket";
// https://stackoverflow.com/questions/6860853/generate-random-string-for-div-id
function guidGenerator() {
  var S4 = function() {
    return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
  };
  return S4() + S4();
}

let user_id = guidGenerator();

let pc;
let offer_sent = false;
let answer_sent = false;
let peer_id = undefined;
let localStream;

let started = false;

let countElement = document.querySelector(".count");
let peersElement = document.querySelector(".peers");

let canvas = document.getElementById("mainCanvas");
let ctx = canvas.getContext("2d");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// ------------------------------------------------------------
// setting up websocket signaling server
const websocket = new FriendlyWebSocket({ path: "/" });

const createPeerConnection = (isOfferer = false) => {
  const pc = new RTCPeerConnection({
    iceServers: [{ url: "stun:stun.1.google.com:19302" }],
    offerToReceiveAudio: false,
    offerToReceiveVideo: true
  });

  pc.onicecandidate = () => {
    if (event.candidate) {
      send({
        from_id: user_id,
        to_id: peer_id,
        type: "candidate",
        candidate: event.candidate
      });
    }
  };

  pc.ontrack = event => {
    console.log("Add streaming element", event);
    const ele = document.createElement("video");
    ele.autoplay = true;
    ele.controls = true; // TEMP

    if (event.streams && event.streams[0]) {
      ele.srcObject = event.streams[0];
    } else {
      let inboundStream = new MediaStream(event.track);
      ele.srcObject = inboundStream;
    }

    ele.play();

    document.querySelector("#remoteStreams").appendChild(ele);
  };

  // if (isOfferer) {
  pc.onnegotiationneeded = () => {
    sendOffer();
  };
  // }

  console.log("PeerConnection created");

  navigator.mediaDevices
    .getUserMedia({ audio: false, video: true })
    .then(stream => {
      localStream = stream;
      document.getElementById("local-video").srcObject = localStream;
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
      started = true;
    })
    .catch(err => {
      console.log("Error capturing stream.", err);
    });

  return pc;
};

const sendOffer = () => {
  if (!peer_id) return;
  console.log("Send offer to " + peer_id);
  return pc
    .createOffer({ voiceActivityDetection: false })
    .then(sdp => {
      setAndSendLocalDescription(sdp);
    })
    .then(() => {
      offer_sent = true;
    })
    .catch(error => {
      console.error("Send offer failed: ", error);
    });
};

const sendAnswer = () => {
  if (!peer_id) return;
  console.log("Send answer to " + peer_id);
  return pc
    .createAnswer({ voiceActivityDetection: false })
    .then(sdp => {
      setAndSendLocalDescription(sdp);
    })
    .then(() => {
      answer_sent = true;      
    })
    .catch(error => {
      console.error("Send answer failed: ", error);
    });
};

const setAndSendLocalDescription = sdp => {
  return pc
    .setLocalDescription(sdp)
    .then(() => {
      send({
        from_id: user_id,
        to_id: peer_id,
        type: sdp.type,
        sdp: sdp
      });
    })
    .catch(error => {
      console.error("issue with setting local description: ", error);
    });
};

const handlePeerClick = e => {
  peer_id = e.target.innerHTML;
  sendOffer();
};

// REGISTER when connection opens
websocket.on("open", data => {
  document.querySelector(".yourId").innerText = `your id: ${user_id}`;
  send({ type: "register", user_id: user_id });
  pc = createPeerConnection();
});

// when signaling server sends a message
websocket.on("message", data => {
  data = JSON.parse(event.data);

  switch (data.type) {
    case "count":
      countElement.innerText = `currently online: ${data.count}`;
      console.log(Array.from(peersElement.children));

      // clear all buttons
      Array.from(peersElement.children).forEach(e => {
        e.removeEventListener("click", handlePeerClick);
        peersElement.removeChild(e);
      });

      for (let i = 0; i < data.peers.length; i++) {
        if (data.peers[i].user_id !== user_id) {
          let btn = document.createElement("button");
          btn.innerHTML = data.peers[i].user_id;
          btn.addEventListener("click", handlePeerClick);
          peersElement.appendChild(btn);
        }
      }

      break;
    case "offer":
      console.log("receiving offer from " + data.from_id, data);
      peer_id = data.from_id;

      pc.setRemoteDescription(data.sdp)
        .then(() => {
          sendAnswer();
        })
        .catch(error => console.error(error));
      break;
    case "answer":
      console.log("received answer from " + data.from_id, data);
      peer_id = data.from_id;
      pc.setRemoteDescription(data.sdp)
        .then(() => {})
        .catch(error => console.error(error));
      break;
    case "candidate":
      pc.addIceCandidate(data.ice);
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

  // pc = createPeerConnection();
};

const drawOnCanvas = () => {};

const onWindowResize = e => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  drawOnCanvas();
};

// pc = createPeerConnection();

drawOnCanvas();

document.addEventListener("click", init, false);
window.addEventListener("resize", onWindowResize, false);
