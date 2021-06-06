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
  
  NOTE: 
  
  this project makes use of context-blender
                https://github.com/Phrogz/context-blender
  the 'multiply' and 'screen' blend modes in particular don't seem to have good browser
  compatibility, particularly on mobile.
*/

import FriendlyWebSocket from "./FriendlyWebSocket";
import { screenVert, screenFrag, multiplyVert, multiplyFrag } from "./shaders";
import { isPermanentDisconnect, checkStatePermanent } from "./webrtc_utils";
import { mat4 } from './glMatrix.js';

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
  let gl = canvas.getContext("webgl");
  let ctx = canvas.getContext("2d");
  canvas.width = 640;
  canvas.height = 480;

  let sketchCanvas = document.getElementById("sketchCanvas");
  let sketchGl = sketchCanvas.getContext("webgl");
  let sketchCtx = sketchCanvas.getContext("2d");
  sketchCanvas.width = 640;
  sketchCanvas.height = 480;

  let cameraCanvas = document.getElementById("cameraCanvas");
  let cameraGl = cameraCanvas.getContext("webgl");
  let cameraCtx = cameraCanvas.getContext("2d");
  cameraCanvas.width = 640;
  cameraCanvas.height = 480;

  let extraCanvas = document.getElementById("extraCanvas");
  let extraGl = extraCanvas.getContext("webgl");
  let extraCtx = extraCanvas.getContext("2d");
  extraCanvas.width = 640;
  extraCanvas.height = 480;

  let left_dragging = false;
  let right_dragging = false;
  let middle_dragging = false;

  let main_update_loop, camera_update_loop;

  let fade = true;
  let fadeAmount = 0.1;
  let update_rate = 50;
  let brush_radius = 20;

  let mouse;

  let message_index = 0;
  let current_message = "";

  let main_blend_mode = "screen";
  let local_blend_mode = "multiply";

  // SHADERS ----------------------------------------------------

  const setupShaders = () => {
    let compositeProgram = initShaderProgram(
      cameraGl,
      multiplyVert,
      multiplyFrag
    );
  };

  function initShaderProgram(gl, vsSource, fsSource) {
    const vertexShader = createShader(gl, vsSource, gl.VERTEX_SHADER);
    const fragmentShader = createShader(gl, fsSource, gl.FRAGMENT_SHADER);

    // Create the shader program

    const shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    // If creating the shader program failed, alert

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
      alert(
        "Unable to initialize the shader program: " +
          gl.getProgramInfoLog(shaderProgram)
      );
      return null;
    }

    return shaderProgram;
  }

  function createShader(gl, sourceCode, type) {
    // Compiles either a shader of type gl.VERTEX_SHADER or gl.FRAGMENT_SHADER
    var shader = gl.createShader(type);
    gl.shaderSource(shader, sourceCode);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      var info = gl.getShaderInfoLog(shader);
      throw "Could not compile WebGL program. \n\n" + info;
    }

    return shader;
  }

  function initBuffers(gl) {
    // Create a buffer for the square's positions.

    const positionBuffer = gl.createBuffer();

    // Select the positionBuffer as the one to apply buffer
    // operations to from here out.

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

    // Now create an array of positions for the square.

    const positions = [-1.0, 1.0, 1.0, 1.0, -1.0, -1.0, 1.0, -1.0];

    // Now pass the list of positions into WebGL to build the
    // shape. We do this by creating a Float32Array from the
    // JavaScript array, then use it to fill the current buffer.

    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

    return {
      position: positionBuffer
    };
  }

  function drawScene(gl, programInfo, buffers) {
    gl.clearColor(0.0, 0.0, 0.0, 1.0); // Clear to black, fully opaque
    gl.clearDepth(1.0); // Clear everything
    gl.enable(gl.DEPTH_TEST); // Enable depth testing
    gl.depthFunc(gl.LEQUAL); // Near things obscure far things

    // Clear the canvas before we start drawing on it.

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Create a perspective matrix, a special matrix that is
    // used to simulate the distortion of perspective in a camera.
    // Our field of view is 45 degrees, with a width/height
    // ratio that matches the display size of the canvas
    // and we only want to see objects between 0.1 units
    // and 100 units away from the camera.

    const fieldOfView = (45 * Math.PI) / 180; // in radians
    const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
    const zNear = 0.1;
    const zFar = 100.0;
    const projectionMatrix = mat4.create();

    // note: glmatrix.js always has the first argument
    // as the destination to receive the result.
    mat4.perspective(projectionMatrix, fieldOfView, aspect, zNear, zFar);

    // Set the drawing position to the "identity" point, which is
    // the center of the scene.
    const modelViewMatrix = mat4.create();

    // Now move the drawing position a bit to where we want to
    // start drawing the square.

    mat4.translate(
      modelViewMatrix, // destination matrix
      modelViewMatrix, // matrix to translate
      [-0.0, 0.0, -6.0]
    ); // amount to translate

    // Tell WebGL how to pull out the positions from the position
    // buffer into the vertexPosition attribute.
    {
      const numComponents = 2; // pull out 2 values per iteration
      const type = gl.FLOAT; // the data in the buffer is 32bit floats
      const normalize = false; // don't normalize
      const stride = 0; // how many bytes to get from one set of values to the next
      // 0 = use type and numComponents above
      const offset = 0; // how many bytes inside the buffer to start from
      gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
      gl.vertexAttribPointer(
        programInfo.attribLocations.vertexPosition,
        numComponents,
        type,
        normalize,
        stride,
        offset
      );
      gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);
    }

    // Tell WebGL to use our program when drawing

    gl.useProgram(programInfo.program);

    // Set the shader uniforms

    gl.uniformMatrix4fv(
      programInfo.uniformLocations.projectionMatrix,
      false,
      projectionMatrix
    );
    gl.uniformMatrix4fv(
      programInfo.uniformLocations.modelViewMatrix,
      false,
      modelViewMatrix
    );

    {
      const offset = 0;
      const vertexCount = 4;
      gl.drawArrays(gl.TRIANGLE_STRIP, offset, vertexCount);
    }
  }

  const drawComposite = () => {};

  const drawSketch = () => {};

  const drawMain = () => {};

  // ------------------------------------------------------------
  // setting up websocket signaling server
  const websocket = new FriendlyWebSocket({ path: "/" });

  const createPeerConnection = iceServers => {
    // console.log('ice', iceServers)
    const pc = new RTCPeerConnection({
      iceServers,
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
      // console.log("ice connection state changed", pc.iceConnectionState);

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
  };

  const addCamera = () => {
    return navigator.mediaDevices
      .getUserMedia({
        audio: false,
        video: { width: 640, height: 480 }
      })
      .then(stream => {
        console.log("adding camera");
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
        document.getElementById("peerRemote").play();

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

        if (data.peers.length === 1) {
          let ele = document.createElement("em");

          ele.innerText = "~ nobody is online! ~";
          peersElement.appendChild(ele);
        } else {
          for (let i = 0; i < data.peers.length; i++) {
            if (data.peers[i].user_id !== user_id) {
              let btn = document.createElement("button");
              btn.innerHTML = data.peers[i].user_id;
              btn.addEventListener("click", handlePeerClick);
              peersElement.appendChild(btn);
            }
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
      case "authenticate":
        // now that we can connect to iceServers, make connection
        pc = createPeerConnection(data.iceServers);
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

  // this fades away the sketch while drawing
  const updateSketchCanvas = () => {
    sketchCtx.save();

    // I can't decide what value this should be at
    // a longer tail on the fade looks better but
    // leaves the background with artifacts
    sketchCtx.globalAlpha = fadeAmount;
    sketchCtx.fillStyle = "black";
    sketchCtx.fillRect(0, 0, sketchCanvas.width, sketchCanvas.height);
    sketchCtx.fillStyle = "white";
    sketchCtx.restore();

    sketchCtx.globalAlpha = 1.0;

    // draw circle
    if (left_dragging) {
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
      sketchCtx.closePath();
    }

    // erase
    if (middle_dragging) {
      sketchCtx.fillStyle = "black";
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
      sketchCtx.closePath();
    }

    // draw text
    if (right_dragging) {
      let current_symbol = current_message.split("")[message_index];
      // space out message
      if (current_frame % 4 === 0) {
        // draw message
        sketchCtx.font = brush_radius * 4 + "px Times New Roman";
        sketchCtx.fillStyle = "white";
        sketchCtx.fillText(
          current_message.split("")[message_index],
          mouse.x + brush_radius,
          mouse.y + brush_radius
        );

        message_index++;
        if (message_index >= current_message.split("").length) {
          right_dragging = false;
        }
      }

      current_frame++;
    }
  };

  // composite final output
  const updateMainCanvas = () => {
    if (fade) updateSketchCanvas();
    updateCameraCanvas();

    let v1 = document.querySelector("#local-composite");
    let v2 = document.querySelector("#peerRemote");

    extraCtx.drawImage(v2, 0, 0);
    ctx.drawImage(v1, 0, 0);
    // lighter(canvas, extraCanvas);

        ctx.globalCompositeOperation = "source-over";
        ctx.drawImage(v1, 0, 0);
        ctx.globalCompositeOperation = main_blend_mode;
        ctx.drawImage(v2, 0, 0);
  };

  // here I am masking out the video with the sketch (composite)
  const updateCameraCanvas = () => {
    let v1 = document.querySelector("#local-video");
    let v2 = document.querySelector("#local-sketch");

    extraCtx.drawImage(v2, 0, 0);
    cameraCtx.drawImage(v1, 0, 0);
    // multiply(cameraCanvas, extraCanvas);

    cameraCtx.globalCompositeOperation = "source-over";
    cameraCtx.drawImage(v1, 0, 0);
    cameraCtx.globalCompositeOperation = local_blend_mode;
    cameraCtx.drawImage(v2, 0, 0);
  };

  // draw sketch that can be later be used as a mask
  const initializeSketchCanvas = () => {
    sketchCtx.save();
    sketchCtx.clearRect(0, 0, sketchCanvas.width, sketchCanvas.height);
    sketchCtx.fillStyle = "black";
    sketchCtx.fillRect(0, 0, sketchCanvas.width, sketchCanvas.height);
    sketchCtx.restore();
  };

  let current_frame = 0;
  const handleMouseMove = e => {
    if (right_dragging || left_dragging || middle_dragging) {
      let event = e.touches ? e.touches[0] : e;
      let bounds = canvas.getBoundingClientRect();
      mouse = { x: event.clientX - bounds.x, y: event.clientY - bounds.y };
    }
  };

  const handleMouseDown = e => {
    if (e.button === 0) {
      left_dragging = true;
    } else if (e.button === 1) {
      middle_dragging = true;
    } else if (e.button === 2) {
      right_dragging = true;
      // spell it out from the beginning
      message_index = 0;
    }

    if (e.touches) {
      if (e.touches.length === 1) {
        left_dragging = true;
      } else if (e.touches.length === 3) {
        middle_dragging = true;
      } else if (e.touches.length === 2) {
        right_dragging = true;
        message_index = 0;
      }
    }

    let event = e.touches ? e.touches[0] : e;
    let bounds = canvas.getBoundingClientRect();
    mouse = { x: event.clientX - bounds.x, y: event.clientY - bounds.y };
  };

  const handleMouseUp = e => {
    if (e.button === 0) {
      left_dragging = false;
    } else if (e.button === 1) {
      middle_dragging = false;
    } else if (e.button === 2) {
      right_dragging = false;
    }

    if (e.touches) {
      if (e.touches.length === 1) {
        left_dragging = false;
      } else if (e.touches.length === 3) {
        middle_dragging = false;
      } else if (e.touches.length === 2) {
        right_dragging = false;
      }
    }

    let event = e.touches ? e.touches[0] : e;
    let bounds = canvas.getBoundingClientRect();
    mouse = { x: event.clientX - bounds.x, y: event.clientY - bounds.y };
  };

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

  const handleContextMenu = e => {
    e.preventDefault();
  };

  const handleMessageChange = e => {
    current_message = e.target.value;
  };

  initializeSketchCanvas();

  const handleWheel = e => {
    fadeAmount += (e.deltaY * -1) / 1000;

    if (fadeAmount > 1) fadeAmount = 1;
    if (fadeAmount <= 0) fadeAmount = 0;

    document.getElementById("fadeAmount").value = fadeAmount;
    document.querySelector("#fadeAmountValue").innerHTML = fadeAmount.toFixed(
      2
    );
  };

  window.addEventListener("resize", e => {}, true);

  document.addEventListener("contextmenu", handleContextMenu, false);
  document.addEventListener("mousedown", handleMouseDown, false);
  document.addEventListener("mousemove", handleMouseMove, false);
  document.addEventListener("mouseup", handleMouseUp, false);

  canvas.addEventListener(
    "touchstart",
    e => {
      e.preventDefault();
      handleMouseDown(e);
    },
    false
  );
  canvas.addEventListener(
    "touchmove",
    e => {
      handleMouseMove(e);
    },
    false
  );
  canvas.addEventListener(
    "touchend",
    e => {
      handleMouseUp(e);
    },
    false
  );

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

  document
    .querySelector("#brushMessage")
    .addEventListener("input", handleMessageChange, false);

  document.addEventListener("wheel", handleWheel, false);
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
