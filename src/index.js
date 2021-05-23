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
let peer_id = undefined;
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

  pc.onicecandidate = () => {
    if (event.candidate) {
      console.log("ICE candidate", event);
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
  console.log("Send offer to " + peer_id);
  pc.createOffer()
    .then(sdp => setAndSendLocalDescription(sdp))
    .catch(error => {
      console.error("Send offer failed: ", error);
    });
};

const sendAnswer = () => {
  console.log("Send answer to " + peer_id);
  pc.createAnswer()
    .then(sdp => setAndSendLocalDescription(sdp))
    .catch(error => {
      console.error("Send answer failed: ", error);
    });
};

const setAndSendLocalDescription = sessionDescription => {
  console.log("sessionDescription", sessionDescription);
  pc.setLocalDescription(sessionDescription)
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
          peer_id = e.target.innerHTML;
          sendOffer(true);
        });
        document.querySelector(".peers").appendChild(btn);
      }
      break;
    case "offer":
      console.log("receiving offer from " + data.from_id, data);
      // peer_id = data.from_id;

      pc.setRemoteDescription(data.sdp)
        .then(() => {
          sendAnswer();
        })
        .catch(error => console.error(error));
      break;
    case "answer":
      // peer_id = data.from_id;
      pc.setRemoteDescription(data.sdp)
        .then(() => {
          if (!peer_id) {
            peer_id = data.from_id;
            sendOffer();
          }
          console.log("received answer from " + data.from_id, data);
        })
        .catch(error => console.error(error));
      break;
    case "candidate":
      console.log("candidate");
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

  pc = createPeerConnection();
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
