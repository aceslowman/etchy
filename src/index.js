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
import { mat4 } from "./glMatrix.js";

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
  let mainGl = canvas.getContext("webgl");
  let ctx = canvas.getContext("2d");
  canvas.width = 640;
  canvas.height = 480;

  let sketchCanvas = document.getElementById("sketchCanvas");
  // let sketchGl = sketchCanvas.getContext("webgl");
  let sketchCtx = sketchCanvas.getContext("2d");
  sketchCanvas.width = 640;
  sketchCanvas.height = 480;

  let cameraCanvas = document.getElementById("cameraCanvas");
  let compositeGl = cameraCanvas.getContext("webgl");
  // let cameraCtx = cameraCanvas.getContext("2d");
  cameraCanvas.width = 640;
  cameraCanvas.height = 480;

  let extraCanvas = document.getElementById("extraCanvas");
  let extraGl = extraCanvas.getContext("webgl");
  // let extraCtx = extraCanvas.getContext("2d");
  extraCanvas.width = 640;
  extraCanvas.height = 480;

  let left_dragging = false;
  let right_dragging = false;
  let middle_dragging = false;

  let main_update_loop, camera_update_loop;

  let fade = true;
  let fadeAmount = 0.1;
  let update_rate = 500;
  let brush_radius = 20;

  let mouse;

  let message_index = 0;
  let current_message = "";

  let main_blend_mode = "screen";
  let local_blend_mode = "multiply";

  // SHADERS ----------------------------------------------------
  let compositeInfo, compositeProgram, compositeBuffers;
  let mainInfo, mainProgram, mainBuffers;
  let composite_texture0, composite_texture1, main_texture0, main_texture1;

  let videos_loaded = false;

  const setupShaders = () => {
    // set up textures
    composite_texture0 = initTexture(compositeGl);
    composite_texture1 = initTexture(compositeGl);
    main_texture0 = initTexture(mainGl);
    main_texture1 = initTexture(mainGl);

    // set up composite    --------------------------------------
    compositeProgram = initShaderProgram(
      compositeGl,
      multiplyVert,
      multiplyFrag
    );
    compositeBuffers = initBuffers(compositeGl);

    compositeInfo = {
      program: compositeProgram,
      attribLocations: {
        vertexPosition: compositeGl.getAttribLocation(
          compositeProgram,
          "aVertexPosition"
        ),
        textureCoord: compositeGl.getAttribLocation(
          compositeProgram,
          "aTextureCoord"
        )
      },
      uniformLocations: {
      }
    };

    // set up main---------------------------------------------
    mainProgram = initShaderProgram(mainGl, screenVert, screenFrag);
    mainBuffers = initBuffers(mainGl);

    mainInfo = {
      program: mainProgram,
      attribLocations: {
        vertexPosition: mainGl.getAttribLocation(
          mainProgram,
          "aVertexPosition"
        ),
        textureCoord: mainGl.getAttribLocation(mainProgram, "aTextureCoord")
      },
      uniformLocations: {

      }
    };
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
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

    gl.bufferData(
      gl.ARRAY_BUFFER, 
      new Float32Array([ 
        -1.0, -1.0, 0.0,
         1.0, -1.0, 0.0,
        -1.0,  1.0, 0.0,
        -1.0,  1.0, 0.0,
         1.0, -1.0, 0.0,
         1.0,  1.0, 0.0
      ]), 
      gl.STATIC_DRAW
    );

    // Now set up the texture coordinates for the faces.
    const textureCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, textureCoordBuffer);

    const textureCoordinates = [
      0.0, 0.0, 
      1.0, 0.0, 
      1.0, 1.0, 
      0.0, 1.0
    ];

    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array(textureCoordinates),
      gl.STATIC_DRAW
    );

    // Build the element array buffer; this specifies the indices
    // into the vertex arrays for each face's vertices.

    // const indexBuffer = gl.createBuffer();
    // gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);

    // This array defines each face as two triangles, using the
    // indices into the vertex array to specify each triangle's
    // position.
    // const indices = [
    //   0,
    //   1,
    //   2,
    //   0,
    //   2,
    //   3 // front
    // ];

    // Now send the element array to GL

    // gl.bufferData(
    //   gl.ELEMENT_ARRAY_BUFFER,
    //   new Uint16Array(indices),
    //   gl.STATIC_DRAW
    // );

    return {
      position: positionBuffer,
      textureCoord: textureCoordBuffer,
      // indices: indexBuffer
    };
  }

  function initTexture(gl) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);

    // Because video has to be download over the internet
    // they might take a moment until it's ready so
    // put a single pixel in the texture so we can
    // use it immediately.
    const level = 0;
    const internalFormat = gl.RGBA;
    const width = 1;
    const height = 1;
    const border = 0;
    const srcFormat = gl.RGBA;
    const srcType = gl.UNSIGNED_BYTE;
    const pixel = new Uint8Array([0, 0, 255, 255]); // opaque blue
    gl.texImage2D(
      gl.TEXTURE_2D,
      level,
      internalFormat,
      width,
      height,
      border,
      srcFormat,
      srcType,
      pixel
    );

    // Turn off mips and set  wrapping to clamp to edge so it
    // will work regardless of the dimensions of the video.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

    return texture;
  }

  function updateTexture(gl, texture, video) {
    const level = 0;
    const internalFormat = gl.RGBA;
    const srcFormat = gl.RGBA;
    const srcType = gl.UNSIGNED_BYTE;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      level,
      internalFormat,
      srcFormat,
      srcType,
      video
    );
  }

  function drawScene(gl, programInfo, buffers, texture0, texture1) {
//     gl.clearColor(0.0, 0.0, 0.0, 1.0); // Clear to black, fully opaque
//     gl.clearDepth(1.0); // Clear everything
//     gl.enable(gl.DEPTH_TEST); // Enable depth testing
//     gl.depthFunc(gl.LEQUAL); // Near things obscure far things

//     gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Tell WebGL how to pull out the positions from the position
    // buffer into the vertexPosition attribute.
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
    gl.vertexAttribPointer(
      programInfo.attribLocations.vertexPosition,
      3,
      gl.FLOAT,
      false,
      0,
      0
    );
    gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);

    // tell webgl how to pull out the texture coordinates from buffer    
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.textureCoord);
    gl.vertexAttribPointer(
      programInfo.attribLocations.textureCoord,
      2,
      gl.FLOAT,
      false,
      0,
      0
    );
    gl.enableVertexAttribArray(programInfo.attribLocations.textureCoord);

    // Tell WebGL which indices to use to index the vertices
    // gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indices);

    // Tell WebGL to use our program when drawing
    gl.useProgram(programInfo.program);

    // Tell WebGL we want to affect texture unit 0
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture0);
    gl.uniform1i(programInfo.uniformLocations.tex0, 0);

    // Tell WebGL we want to affect texture unit 1
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, texture1);
    gl.uniform1i(programInfo.uniformLocations.tex1, 1);
 
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
  // Draw the scene repeatedly
  let then = 0;
  const drawMain = now => {
    now *= 0.001; // convert to seconds
    const deltaTime = now - then;
    then = now;

    let v1 = document.querySelector("#local-composite");
    let v2 = document.querySelector("#peerRemote");

    if (videos_loaded) {
      updateTexture(mainGl, main_texture0, v1);
      updateTexture(mainGl, main_texture1, v2);
    }

    drawSketch();
    drawComposite();

    drawScene(mainGl, mainInfo, mainBuffers, main_texture0, main_texture1);

    requestAnimationFrame(drawMain);
  };

  const drawComposite = () => {
    let v1 = document.querySelector("#local-video");
    let v2 = document.querySelector("#local-sketch");

    if (videos_loaded) {
      updateTexture(compositeGl, composite_texture0, v1);
      updateTexture(compositeGl, composite_texture1, v2);
    }

    drawScene(
      compositeGl,
      compositeInfo,
      compositeBuffers,
      composite_texture0,
      composite_texture1
    );
  };

  const drawSketch = () => {
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

      // document.getElementById("local-video").play();
      // document.getElementById("local-sketch").play();
      // document.getElementById("local-composite").play();
      // document.getElementById("peerRemote").play();
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

        // initializeSketchCanvas();
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

        // setup gl
        setupShaders();

        // startup the main output loop
        // if (main_update_loop) {
        //   clearInterval(main_update_loop);
        //   // main_update_loop = setInterval(updateMainCanvas, update_rate);
        //   main_update_loop = setInterval(drawMain, update_rate);
        // } else {
        //   // main_update_loop = setInterval(updateMainCanvas, update_rate);
        //   main_update_loop = setInterval(drawMain, update_rate);
        // }

        requestAnimationFrame(drawMain);
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
            // WE ARE DONE CONNECTING!
            hideLoading();
            showControls();

            videos_loaded = true;
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
    // initializeSketchCanvas();
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

  // initializeSketchCanvas();

  const handleWheel = e => {
    fadeAmount += (e.deltaY * -1) / 1000;

    if (fadeAmount > 1) fadeAmount = 1;
    if (fadeAmount <= 0) fadeAmount = 0;

    document.getElementById("fadeAmount").value = fadeAmount;
    document.querySelector("#fadeAmountValue").innerHTML = fadeAmount.toFixed(
      2
    );
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
