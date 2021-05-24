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
let localStream, sketchStream, cameraStream;

let started = false;

let countElement = document.querySelector(".count");
let peersElement = document.querySelector("#peers");

let canvas = document.getElementById("mainCanvas");
let ctx = canvas.getContext("2d");
canvas.width = 640;
canvas.height = 480;

let sketchCanvas = document.getElementById("sketchCanvas");
let sketchCtx = sketchCanvas.getContext("2d");
sketchCanvas.width = 640;
sketchCanvas.height = 480;

let cameraCanvas = document.getElementById("cameraCanvas");
let cameraCtx = cameraCanvas.getContext("2d");
cameraCanvas.width = 640;
cameraCanvas.height = 480;

let dragging = false;

let main_update_loop, camera_update_loop;

let update_rate = 100;
let brush_radius = 20;

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
    let ele, sketch_ele;
    if (document.querySelector("#peerRemote")) {
      ele = document.querySelector("#peerRemote");
    } else {
      ele = document.createElement("video");
      document.querySelector("#remoteStreams").appendChild(ele);
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
  };

  // if (isOfferer) {
  // pc.onnegotiationneeded = () => {
  //   sendOffer();
  // };
  // }

  // console.log("PeerConnection created");

  return pc;
};

const sendOffer = () => {
  if (!peer_id) return;
  // console.log("Send offer to " + peer_id);
  return pc
    .createOffer()
    .then(setAndSendLocalDescription)
    .then(() => {
      offer_sent = true;
    });
};

const sendAnswer = () => {
  if (!peer_id) return;
  // console.log("Send answer to " + peer_id);
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
  init();
};

const addCamera = () => {
  return navigator.mediaDevices
    .getUserMedia({
      audio: false,
      video: { width: 640, height: 480 }
    })
    .then(stream => {
      localStream = stream;
      cameraStream = cameraCanvas.captureStream(30); // 10 fps
      sketchStream = sketchCanvas.captureStream(30);

      document.getElementById("local-video").srcObject = localStream;
      document.getElementById("local-sketch").srcObject = sketchStream;
      document.getElementById("local-composite").srcObject = cameraStream;

      initializeSketchCanvas();

      cameraStream
        .getTracks()
        .forEach(track => pc.addTrack(track, cameraStream));

      started = true;

      // startup the main output loop
      if (main_update_loop) {
        clearInterval(main_update_loop);
        main_update_loop = setInterval(updateMainCanvas, update_rate);
      } else {
        main_update_loop = setInterval(updateMainCanvas, update_rate);
      }

      // // startup the main output loop
      // if (camera_update_loop) {
      //   clearInterval(camera_update_loop);
      //   camera_update_loop = setInterval(updateCameraCanvas, update_rate);
      // } else {
      //   camera_update_loop = setInterval(updateCameraCanvas, update_rate);
      // }
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
      // console.log("receiving offer from " + data.from_id, data);
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
      // console.log("received answer from " + data.from_id, data);
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

// composite final output
const updateMainCanvas = () => {
  
  updateSketchCanvas();
  updateCameraCanvas();
  
  let v1 = document.querySelector("#local-composite");
  let v2 = document.querySelector("#peerRemote");

  if (v2) ctx.drawImage(v2, 0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  // ctx.globalCompositeOperation = "overlay";
  // ctx.globalCompositeOperation = "multiply";
  if (v1) ctx.drawImage(v1, 0, 0, canvas.width, canvas.height);

  ctx.restore();
};

// this fades away the sketch while drawing
const updateSketchCanvas = () => {
  sketchCtx.save();
  
  // I can't decide what value this should be at  
  // a longer tail on the fade looks better but
  // leaves the background with artifacts
  sketchCtx.globalAlpha = 0.1;
  sketchCtx.fillStyle = "black";
  sketchCtx.fillRect(0,0,sketchCanvas.width,sketchCanvas.height)
  sketchCtx.restore();
  
  sketchCtx.globalAlpha = 1.0;
};

// here I am masking out the video with the sketch (composite)
const updateCameraCanvas = () => {
  let v1 = document.querySelector("#local-video");
  let v2 = document.querySelector("#local-sketch");

  if (v1)
    cameraCtx.drawImage(v1, 0, 0, cameraCanvas.width, cameraCanvas.height);

  cameraCtx.save();
  // cameraCtx.globalCompositeOperation = "destination-in";
  cameraCtx.globalCompositeOperation = "multiply";
  if (v2) cameraCtx.drawImage(v2, 0, 0, canvas.width, canvas.height);
  cameraCtx.restore();
};

// draw sketch that can be later be used as a mask
const initializeSketchCanvas = () => {
  sketchCtx.clearRect(0, 0, sketchCanvas.width, sketchCanvas.height);
  sketchCtx.fillStyle = "black";
  sketchCtx.fillRect(0,0,sketchCanvas.width,sketchCanvas.height)
};

const handleMouseMove = e => {
  if (dragging) {
    let bounds = canvas.getBoundingClientRect();
    let mouse = { x: e.pageX - bounds.x, y: e.pageY - bounds.y };
    sketchCtx.fillStyle = "white";
    sketchCtx.beginPath();
    sketchCtx.ellipse(
      mouse.x,
      mouse.y,
      brush_radius,
      brush_radius,
      Math.PI / 4,
      0,
      2 * Math.PI
    );
    sketchCtx.fill();
  }
};

const handleMouseDown = e => (dragging = true);
const handleMouseUp = e => (dragging = false);

initializeSketchCanvas();

// document.addEventListener("click", init, false);
document.addEventListener("mousedown", handleMouseDown, false);
document.addEventListener("mousemove", handleMouseMove, false);
document.addEventListener("mouseup", handleMouseUp, false);
