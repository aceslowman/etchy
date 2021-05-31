/*
  ETCHY
  
  This project uses webrtc to establish a connection between two users.
  server/server.js contains the webrtc signaling server
  
  When a user establishes a connection, each webcam turns on. Each user
  can sketch on a canvas, which is used to mask the raw video. The composite
  canvas (sketch + raw video) is then made into a stream and sent to the other 
  user.
  
  Disconnections are frequent which I think is more of a webrtc problem,
  if they occur it's best to just wait it out or refresh.
  
  TODO:
  
  fix on ios (works on everything but ios!)
    video elements all have to be muted, playinline, and autoplay
    
    works on safari (atm) but not on chrome ios
  
  multiple peers
  drawing customization
  add image!
  variable blend mode 
  (connection-level) blend modes?
  variable brushes (different types)
  
  HELPFUL LINKS:
  recognizing temporary or full disconnects
  https://stackoverflow.com/questions/63582725/webrtc-differentiate-between-temporary-disconnect-or-failure-and-permanant
*/

import FriendlyWebSocket from "./FriendlyWebSocket";
import { isPermanentDisconnect, checkStatePermanent } from "./webrtc_utils";

// if the code of conduct has been agreed to
if (localStorage.getItem("agreeToCC")) {
  document.getElementById("CODEOFCONDUCT").style.display = "none";

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
  let localStream, sketchStream, compositeStream;

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

  let fade = true;
  let fadeAmount = 0.1;
  let update_rate = 100;
  let brush_radius = 20;

  let main_blend_mode = "screen";
  let local_blend_mode = "multiply";

  // ------------------------------------------------------------
  // setting up websocket signaling server
  const websocket = new FriendlyWebSocket({ path: "/" });

  const createPeerConnection = (isOfferer = false) => {
    const pc = new RTCPeerConnection({
      // iceServers: [
      //   { urls: "stun:stun.1.google.com:19302" },
      //   { urls: "turn:quickturn.glitch.me", username: "n/a", credential: "n/a" }
      // ],
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

    pc.onicecandidateerror = err => {
      console.error(err);
    };

    pc.oniceconnectionstatechange = async function() {
      console.log("ice connection state changed", pc.iceConnectionState);

      switch (pc.iceConnectionState) {
        case "disconnected":
          break;
        case "closed":
          break;
        case "failed":
          break;
      }

      let isDisconnectPermanent = await checkStatePermanent(
        pc,
        pc.iceConnectionState
      );

      if (isDisconnectPermanent) {
        alert("the person you were connected to has disappeared");
        reset();
      }
    };

    pc.ontrack = event => {
      let ele = document.querySelector("#peerRemote");

      if (event.streams && event.streams[0]) {
        ele.srcObject = event.streams[0];
      } else {
        let inboundStream = new MediaStream(event.track);
        ele.srcObject = inboundStream;
      }

      ele.autoplay = true;
      ele.controls = true;
      ele.playsInline = true;
      ele.muted = true;

      document.getElementById("local-video").play();
      document.getElementById("local-sketch").play();
      document.getElementById("local-composite").play();
      document.getElementById("peerRemote").play();
    };

    // TODO: probably still needs to be added
    // if (isOfferer) {
    // pc.onnegotiationneeded = () => {
    //   sendOffer();
    // };
    // }

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
      })
      .catch(err => {
        console.error(err);
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
      })
      .catch(err => {
        console.error(err);
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
      .catch(err => {
        console.error(err);
      });
  };

  const handlePeerClick = e => {
    offer_sent = false;
    answer_sent = false;
    peer_id = e.target.innerHTML;
    addCamera()
      .then(sendOffer)
      .catch(err => {
        console.error(err);
      });
    hideLobby();
    showLoading();
    // showControls();
  };

  const addCamera = () => {
    // if(localStream) return;
    return navigator.mediaDevices
      .getUserMedia({
        audio: false,
        // video: true
        video: { width: 640, height: 480 }
      })
      .then(stream => {
        console.log('adding camera')
        localStream = stream;
        compositeStream = cameraCanvas.captureStream();
        sketchStream = sketchCanvas.captureStream();

        initializeSketchCanvas();
        compositeStream.getTracks().forEach(track => {
          pc.addTrack(track, compositeStream);
        });

        document.getElementById("local-video").srcObject = localStream;
        document.getElementById("local-sketch").srcObject = sketchStream;
        document.getElementById("local-composite").srcObject = compositeStream;

        document.getElementById("local-video").play();
        document.getElementById("local-sketch").play();
        document.getElementById("local-composite").play();
        // document.getElementById("peerRemote").play();

        // startup the main output loop
        if (main_update_loop) {
          clearInterval(main_update_loop);
          main_update_loop = setInterval(updateMainCanvas, update_rate);
        } else {
          main_update_loop = setInterval(updateMainCanvas, update_rate);
        }
      })
      .catch(err => {
        console.error(err);
      });
  };

  // REGISTER when connection opens
  websocket.on("open", data => {
    document.querySelector(".yourId").innerText = `(you) ${user_id}`;
    send({ type: "register", user_id: user_id });
    pc = createPeerConnection();
  });

  // when signaling server sends a message
  websocket.on("message", data => {
    data = JSON.parse(event.data);

    switch (data.type) {
      case "count":
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
        /* 
          when an offer is received, the user on the receiving end
          should be given the opportunity to accept or deny
        */
        if (offer_sent || window.confirm(data.from_id + " wants to connect")) {
          peer_id = data.from_id;
          document.querySelector(".peerId").innerText = `⟷ ${peer_id} (them)`;
          pc.setRemoteDescription(data.sdp)
            .then(sendAnswer)
            .then(addCamera)
            .then(() => {
              hideLobby();
              showControls();
              if (!offer_sent) sendOffer();
            })
            .catch(error => console.error(error));
        } else {
          // tell sender no thank you
          send({
            from_id: user_id,
            to_id: data.from_id,
            type: "rejectOffer"
          });
        }
        break;
      case "answer":
        peer_id = data.from_id;
        document.querySelector(".peerId").innerText = `⟷ ${peer_id} (them)`;
        pc.setRemoteDescription(data.sdp)
          .then(addCamera)
          .then(() => {
            hideLoading();
            showControls();
          })
          .catch(error => console.error(error));
        break;
      case "candidate":
        if (!pc || !pc.remoteDescription) {
          pc.addIceCandidate(data.candidate);
        }
        break;
      case "rejectOffer":
        alert(
          "the other user declined (or just closed their tab, something like that)"
        );
        reset();
        break;
      default:
        break;
    }
  });

  const reset = () => {
    showLobby();
    hideLoading();
    hideControls();
    peer_id = undefined;
    document.querySelector(".peerId").innerText = "";
    offer_sent = false;
    answer_sent = false;

    // reregister?
    send({ type: "register", user_id: user_id });
  };

  const send = data => {
    websocket.send(JSON.stringify(data));
  };

  const showLobby = () => {
    document.querySelector(".center").style.display = "flex";
  };

  const hideLobby = () => {
    document.querySelector(".center").style.display = "none";
  };

  const showLoading = () => {
    document.querySelector(".loading").style.display = "flex";
  };

  const hideLoading = () => {
    document.querySelector(".loading").style.display = "none";
  };

  const showControls = () => {
    document.querySelector("#controls").style.display = "flex";
  };

  const hideControls = () => {
    document.querySelector("#controls").style.display = "none";
  };

  // composite final output
  const updateMainCanvas = () => {
    if (fade) updateSketchCanvas();
    updateCameraCanvas();

    let v1 = document.querySelector("#local-composite");
    let v2 = document.querySelector("#peerRemote");

    if (v2) ctx.drawImage(v2, 0, 0);

    ctx.save();
    ctx.globalCompositeOperation = main_blend_mode;
    if (v1) ctx.drawImage(v1, 0, 0);
    ctx.restore();
  };

  // this fades away the sketch while drawing
  const updateSketchCanvas = () => {
    sketchCtx.save();

    // I can't decide what value this should be at
    // a longer tail on the fade looks better but
    // leaves the background with artifacts
    sketchCtx.globalAlpha = fadeAmount;
    sketchCtx.fillStyle = "black";
    sketchCtx.fillRect(0, 0, sketchCanvas.width, sketchCanvas.height);
    sketchCtx.restore();

    sketchCtx.globalAlpha = 1.0;
  };

  // here I am masking out the video with the sketch (composite)
  const updateCameraCanvas = () => {
    let v1 = document.querySelector("#local-video");
    let v2 = document.querySelector("#local-sketch");

    if (v1) cameraCtx.drawImage(v1, 0, 0);

    cameraCtx.save();
    cameraCtx.globalCompositeOperation = local_blend_mode;
    if (v2) cameraCtx.drawImage(v2, 0, 0);
    cameraCtx.restore();
  };

  // draw sketch that can be later be used as a mask
  const initializeSketchCanvas = () => {
    sketchCtx.save();
    sketchCtx.clearRect(0, 0, sketchCanvas.width, sketchCanvas.height);
    sketchCtx.fillStyle = "black";
    sketchCtx.fillRect(0, 0, sketchCanvas.width, sketchCanvas.height);
    sketchCtx.restore();
  };

  const handleMouseMove = e => {
    let event = e.touches ? e.touches[0] : e;

    if (dragging) {
      e.preventDefault();
      let bounds = canvas.getBoundingClientRect();
      let mouse = { x: event.clientX - bounds.x, y: event.clientY - bounds.y };
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

  const handleBrushRadiusChange = e => {
    document.querySelector("#brushRadiusValue").innerHTML = e.target.value;
    brush_radius = e.target.value;
  };

  const handleFadeAmountChange = e => {
    document.querySelector("#fadeAmountValue").innerHTML = e.target.value;
    fadeAmount = e.target.value;
  };

  const handleClearButton = () => {
    initializeSketchCanvas();
    // sketchCtx.clearRect(0, 0, sketchCanvas.width, sketchCanvas.height);
  };

  const handleToggleFade = () => {
    fade = !fade;
    document.querySelector("#fadeToggle").innerHTML = fade
      ? "dont fade away"
      : "fade away";
  };

  const handleSnapButton = () => {
    /*
      saves an image of the current canvas
    */
    console.log("saving snapshot");
    let uri = canvas.toDataURL("image/png");
    let link = document.createElement("a");
    link.download = `${user_id}`;

    if (window.webkitURL != null) {
      // Chrome allows the link to be clicked without actually adding it to the DOM.
      link.href = uri;
    } else {
      // Firefox requires the link to be added to the DOM before it can be clicked.
      link.href = uri;
      link.onclick = e => document.body.removeChild(e.target);
      link.style.display = "none";
      document.body.appendChild(link);
    }

    link.click();
  };

  const handleLocalBlendMode = e => {
    console.log("handleLocalBlendMode", e.target.value);
    local_blend_mode = e.target.value;
  };

  const handleGlobalBlendMode = e => {
    console.log("handleGlobalBlendMode", e.target.value);
    main_blend_mode = e.target.value;
  };

  initializeSketchCanvas();

  window.addEventListener(
    "resize",
    e => {
      // canvas.width =
    },
    true
  );

  document.addEventListener("mousedown", handleMouseDown, false);
  document.addEventListener("mousemove", handleMouseMove, false);
  document.addEventListener("mouseup", handleMouseUp, false);

  document.addEventListener("touchstart", handleMouseDown, false);
  document.addEventListener("touchmove", handleMouseMove, false);
  document.addEventListener("touchend", handleMouseUp, false);

  document.querySelector("#brushRadiusValue").innerHTML = brush_radius;
  document.querySelector("#brushRadiusValue").value = brush_radius;

  document
    .querySelector("#brushRadius")
    .addEventListener("input", handleBrushRadiusChange, false);
  document
    .querySelector("#clearButton")
    .addEventListener("click", handleClearButton, false);
  document
    .querySelector("#fadeToggle")
    .addEventListener("click", handleToggleFade, false);
  document
    .querySelector("#fadeAmount")
    .addEventListener("input", handleFadeAmountChange, false);
  document
    .querySelector("#snapButton")
    .addEventListener("click", handleSnapButton, false);

  document.querySelector("#fadeAmountValue").innerHTML = fadeAmount;
  document.querySelector("#fadeAmountValue").value = fadeAmount;

  document
    .querySelector("#localBlendMode")
    .addEventListener("change", handleLocalBlendMode, false);
  document
    .querySelector("#globalBlendMode")
    .addEventListener("change", handleGlobalBlendMode, false);
} else {
  // FOR CODE OF CONDUCT

  document.getElementById("CODEOFCONDUCT").style.display = "flex";

  // CODE OF CONDUCT
  document.getElementById("agreeCC").addEventListener("click", () => {
    localStorage.setItem("agreeToCC", true);
    window.location.reload();
  });

  document.getElementById("disagreeCC").addEventListener("click", () => {
    localStorage.setItem("agreeToCC", false);
    window.open("https://www.google.com/search?q=am+i+an+asshole");
  });
}
