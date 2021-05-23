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
let localStream, sketchStream;

let started = false;

let countElement = document.querySelector(".count");
let peersElement = document.querySelector(".peers");

let canvas = document.getElementById("mainCanvas");
let ctx = canvas.getContext("2d");
// canvas.width = window.innerWidth;
// canvas.height = window.innerHeight;
canvas.width = 640;
canvas.height = 480;

let sketchCanvas = document.getElementById("sketchCanvas");
let sketchCtx = sketchCanvas.getContext("2d");
sketchCanvas.width = 640;
sketchCanvas.height = 480;
let dragging = false;
let mouse = { x: 0, y: 0 };

let update_loop;

// ------------------------------------------------------------
// setting up websocket signaling server
const websocket = new FriendlyWebSocket({ path: "/" });

const createPeerConnection = (isOfferer = false) => {
  const pc = new RTCPeerConnection({
    iceServers: [{ url: "stun:stun.1.google.com:19302" }],
    offerToReceiveAudio: false,
    offerToReceiveVideo: true,
    voiceActivityDetection: false
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
    console.log("track add", event);
    let ele, sketch_ele;
    if (document.querySelector("#peerRemote")) {
      ele = document.querySelector("#peerRemote");
      sketch_ele = document.querySelector("#sketchRemote");
      console.log("update streaming element", ele);

    } else {
      console.log("Add streaming element", event);
      ele = document.createElement("video");
      sketch_ele = document.createElement("video");

      document.querySelector("#remoteStreams").appendChild(ele);
      document.querySelector("#remoteStreams").appendChild(sketch_ele);
    }

    ele.id = "peerRemote";
    ele.autoplay = true;
    ele.controls = true; // TEMP

    if (event.streams && event.streams[0]) {
      ele.srcObject = event.streams[0];
    } else {
      let inboundStream = new MediaStream(event.track);
      ele.srcObject = inboundStream;
    }
    
    sketch_ele.id = "sketchRemote";
    sketch_ele.autoplay = true;
    sketch_ele.controls = true; // TEMP

//     localStream
//         .getTracks()
//         .forEach(track => pc.addTrack(track, localStream, sketchStream));
    
    if (event.streams && event.streams[1]) {
      sketch_ele.srcObject = event.streams[1];
    } else {
      // let inboundStream = new MediaStream(event.track);
      // sketch_ele.srcObject = inboundStream;
    }
  };

  // if (isOfferer) {
  // pc.onnegotiationneeded = () => {
  //   sendOffer();
  // };
  // }

  console.log("PeerConnection created");

  return pc;
};

const sendOffer = () => {
  if (!peer_id) return;
  console.log("Send offer to " + peer_id);
  return pc
    .createOffer()
    .then(setAndSendLocalDescription)
    .then(() => {
      offer_sent = true;
    });
};

const sendAnswer = () => {
  if (!peer_id) return;
  console.log("Send answer to " + peer_id);
  return pc
    .createAnswer()
    .then(setAndSendLocalDescription)
    .then(() => {
      answer_sent = true;
    });
};

const setAndSendLocalDescription = sdp => {
  return pc.setLocalDescription(sdp).then(() => {
    send({
      from_id: user_id,
      to_id: peer_id,
      type: sdp.type,
      sdp: sdp
    });
  });
};

const handlePeerClick = e => {
  peer_id = e.target.innerHTML;
  addCamera().then(sendOffer);
};

const addCamera = () => {
  return navigator.mediaDevices
    .getUserMedia({
      audio: false,
      video: { width: 640, height: 480 }
    })
    .then(stream => {
      localStream = stream;
      sketchStream = sketchCanvas.captureStream(10); // 10 fps

      document.getElementById("local-video").srcObject = localStream;
      document.getElementById("local-sketch").srcObject = sketchStream;

      drawOnCanvas();

      
      localStream
        .getTracks()
        .forEach(track => pc.addTrack(track, localStream, sketchStream));
      sketchStream.getTracks().forEach(track => pc.addTrack(track, localStream, sketchStream));

      started = true;
      console.log("camera added");

      // startup the canvas loop
      if (update_loop) {
        clearInterval(update_loop);
        update_loop = setInterval(updateCanvas, 700);
      } else {
        update_loop = setInterval(updateCanvas, 700);
      }
    });
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
        .then(sendAnswer)
        .then(addCamera)
        .then(() => {
          if (!offer_sent) {
            sendOffer();
          }
        })
        .catch(error => console.error(error));
      break;
    case "answer":
      console.log("received answer from " + data.from_id, data);
      peer_id = data.from_id;
      pc.setRemoteDescription(data.sdp)
        .then(addCamera)
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
};

const updateCanvas = () => {
  // console.log('updating canvas');
  let v1 = document.querySelector("#local-video");
  let v2 = document.querySelector("#peerRemote");
  let sk1 = document.querySelector("#local-sketch");
  let sk2 = document.querySelector("#peerSketch");

  if (v1) ctx.drawImage(v1, 0, 0, canvas.width, canvas.height);
  if (v2) ctx.drawImage(v2, canvas.width / 2, 0, canvas.width, canvas.height);
};

const drawOnCanvas = () => {
  sketchCtx.fillStyle = "white";
  sketchCtx.beginPath();
  sketchCtx.ellipse(100, 100, 50, 75, Math.PI / 4, 0, 2 * Math.PI);
  sketchCtx.fill();
};

const onWindowResize = e => {
  // canvas.width = window.innerWidth;
  // canvas.height = window.innerHeight;
  drawOnCanvas();
};

const handleMouseDown = e => {
  dragging = true;
};

const handleMouseMove = e => {
  if (dragging) {
    mouse = { x: e.offsetX, y: e.offsetY };
    sketchCtx.fillStyle = "white";
    sketchCtx.beginPath();
    sketchCtx.ellipse(mouse.x, mouse.y, 50, 50, Math.PI / 4, 0, 2 * Math.PI);
    sketchCtx.fill();
  }
};

const handleMouseUp = e => {
  dragging = false;
};

drawOnCanvas();

document.addEventListener("click", init, false);
document.addEventListener("mousedown", handleMouseDown, false);
document.addEventListener("mousemove", handleMouseMove, false);
document.addEventListener("mouseup", handleMouseUp, false);
window.addEventListener("resize", onWindowResize, false);