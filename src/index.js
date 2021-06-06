/*
  ETCHY
  
  This project uses webrtc to establish a connection between two users.
  server/server.js contains the webrtc signaling server
  
  When a user establishes a connection, each webcam turns on. Each user
  can sketch on a canvas, which is used to mask the raw video. The composite
  canvas (sketch + raw video) is then made into a stream and sent to the other 
  user.
  
  NOTES:
  this could be done much easier with globalCompositeOperation on the videos
  (which you can see in my blendmode_old.js copy at the root of the directory)
  but iOS in particular doesn't support 'multiply' or 'screen' modes. 
  
  I attempted to make custom blend functions for the canvas but they were too
  slow and inefficient. as a result I am using webgl shaders for the blending,
  located in ./shaders.js.
  
  some misc helpers are also located in webrtc_utils.js, particularly for
  recognizing disconnected peers. FriendlyWebSocket.js helps with websocket 
  reconnects.
  
  HELPFUL LINKS:
  recognizing temporary or full disconnects in webrtc
  https://stackoverflow.com/questions/63582725/webrtc-differentiate-between-temporary-disconnect-or-failure-and-permanant
  
  webgl textures
  https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Tutorial/Using_textures_in_WebGL
  
  fullscreen quads
  https://stackoverflow.com/questions/24104939/rendering-a-fullscreen-quad-using-webgl
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
  let sketchCanvas = document.getElementById("sketchCanvas");
  let sketchCtx = sketchCanvas.getContext("2d"); // 2d only for the sketch
  let cameraCanvas = document.getElementById("cameraCanvas");
  let compositeGl = cameraCanvas.getContext("webgl");

  // interaction
  let mouse;
  let left_dragging = false;
  let right_dragging = false;
  let middle_dragging = false;
  let current_message = "hello";
  let message_index = 0;

  let main_update_loop, camera_update_loop;

  // sketch params
  let fadeAmount = 0.1;
  let update_rate = 50;
  let brush_radius = 20;

  // SHADERS ----------------------------------------------------
  let compositeInfo, compositeProgram, compositeBuffers;
  let mainInfo, mainProgram, mainBuffers;
  let composite_texture0, composite_texture1, main_texture0, main_texture1;

  let videos_loaded = false;

  const setupShaders = () => {
    canvas.width = 640;
    canvas.height = 480;
    cameraCanvas.width = 640;
    cameraCanvas.height = 480;
    sketchCanvas.width = 640;
    sketchCanvas.height = 480;    

    compositeGl.viewport(
      0,
      0,
      compositeGl.drawingBufferWidth,
      compositeGl.drawingBufferHeight
    );
    mainGl.viewport(
      0,
      0,
      mainGl.drawingBufferWidth,
      mainGl.drawingBufferHeight
    );

    // set up textures
    composite_texture0 = initTexture(compositeGl);
    composite_texture1 = initTexture(compositeGl);
    main_texture0 = initTexture(mainGl);
    main_texture1 = initTexture(mainGl);

    // set up composite render target (sketch * localvideo)  
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
        tex0: compositeGl.getUniformLocation(compositeProgram, 'tex0'),
        tex1: compositeGl.getUniformLocation(compositeProgram, 'tex1'),
        resolution: compositeGl.getUniformLocation(compositeProgram, 'resolution'), 
        texdim0: compositeGl.getUniformLocation(compositeProgram, 'texdim0'),
        texdim1: compositeGl.getUniformLocation(compositeProgram, 'texdim1'),
      }
    };

    // set up main render target (peervideo + compositevideo)
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
        tex0: mainGl.getUniformLocation(mainProgram, 'tex0'),
        tex1: mainGl.getUniformLocation(mainProgram, 'tex1'),
        resolution: mainGl.getUniformLocation(mainProgram, 'resolution'), 
        texdim0: mainGl.getUniformLocation(mainProgram, 'texdim0'),
        texdim1: mainGl.getUniformLocation(mainProgram, 'texdim1'),
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

  // setup vertex position and texture coordinate buffers
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
      0,   0, 1.0, 
      0,   0, 1.0, 
      0, 1.0, 1.0, 
      0, 1.0, 1.0
    ];
    
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array(textureCoordinates),
      gl.STATIC_DRAW
    );

    return {
      position: positionBuffer,
      textureCoord: textureCoordBuffer
    };
  }

  function initTexture(gl) {
    // initializes single pixel texture
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      1, // just to init
      1, // just to init
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array([0, 0, 0, 255])
    );

    // Turn off mips and set  wrapping to clamp to edge so it
    // will work regardless of the dimensions of the video.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

    return texture;
  }

  function updateTexture(gl, texture, video) {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
  }

  function drawScene(gl, programInfo, buffers, texture0, texture1) {
    // gl.disable( gl.DEPTH_TEST );
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

    // Tell WebGL to use our program when drawing
    gl.useProgram(programInfo.program);

    gl.uniform2fv(programInfo.uniformLocations.resolution, [gl.canvas.width, gl.canvas.height]);
    
    // Tell WebGL we want to affect texture unit 0
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture0);
    gl.uniform1i(programInfo.uniformLocations.tex0, 0);
    // gl.uniform2fv(programInfo.uniformLocations.texdim0, [640, 480]);

    // Tell WebGL we want to affect texture unit 1
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, texture1);
    gl.uniform1i(programInfo.uniformLocations.tex1, 1);
    // gl.uniform2fv(programInfo.uniformLocations.texdim1, [640, 480]);
    

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
      
      // mainGl.uniform2fv(mainInfo.uniformLocations.resolution, [640,480]);
//       console.log('dims',[[v1.videoWidth, v1.videoHeight],
// [v2.videoWidth, v2.videoHeight]])
      mainGl.uniform2fv(mainInfo.uniformLocations.resolution, [mainGl.canvas.width, mainGl.canvas.height]);

      mainGl.uniform2fv(mainInfo.uniformLocations.texdim0, [v1.videoWidth, v1.videoHeight]);
      mainGl.uniform2fv(mainInfo.uniformLocations.texdim1, [v2.videoWidth, v2.videoHeight]);
    }

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
      
      // console.log(v1.videoWidth)
      
      // compositeGl.uniform2fv(compositeInfo.uniformLocations.resolution, [640,480]);
//       console.log('dims',[[v1.videoWidth, v1.videoHeight],
// [v2.videoWidth, v2.videoHeight]])
            compositeGl.uniform2fv(compositeInfo.uniformLocations.resolution, [compositeGl.canvas.width, compositeGl.canvas.height]);

      compositeGl.uniform2fv(compositeInfo.uniformLocations.texdim0, [v1.videoWidth, v1.videoHeight]);
      compositeGl.uniform2fv(compositeInfo.uniformLocations.texdim1, [v2.videoWidth, v2.videoHeight]);
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
      console.log('hello', current_frame)
      let current_symbol = current_message.split("")[message_index];
      // space out message
      if (current_frame % 4 === 0) {
        console.log('sym', current_symbol)
        console.log(mouse)
        console.log(message_index)
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
        // alert("the person you were connected to has disappeared");
        // reset();
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
        if (main_update_loop) {
          clearInterval(main_update_loop);
          main_update_loop = setInterval(drawSketch, update_rate);
          // main_update_loop = setInterval(drawMain, update_rate);
        } else {
          main_update_loop = setInterval(drawSketch, update_rate);
        //   main_update_loop = setInterval(drawMain, update_rate);
        }

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
    sketchCtx.save();
    sketchCtx.clearRect(0, 0, sketchCanvas.width, sketchCanvas.height);
    sketchCtx.fillStyle = "black";
    sketchCtx.fillRect(0, 0, sketchCanvas.width, sketchCanvas.height);
    sketchCtx.restore();
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
    document.querySelector("#fadeAmountValue").innerText = fadeAmount.toFixed ? fadeAmount.toFixed(
      2
    ) : fadeAmount;
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

  window.addEventListener("resize", e => {
    compositeGl.viewport(
      0,
      0,
      compositeGl.canvas.width,
      compositeGl.canvas.height
    );
    mainGl.viewport(
      0,
      0,
      mainGl.canvas.width,
      mainGl.canvas.height
    );
  }, true);

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
    .querySelector("#fadeAmount")
    .addEventListener("input", handleFadeAmountChange, false);
  document
    .querySelector("#snapButton")
    .addEventListener("click", handleSnapButton, false);

  document.querySelector("#fadeAmountValue").innerHTML = fadeAmount;
  document.querySelector("#fadeAmountValue").value = fadeAmount;

  document
    .querySelector("#brushMessage")
    .addEventListener("input", handleMessageChange, false);

  document.addEventListener("wheel", handleWheel, false);
} else {
  // FOR CODE OF CONDUCT
  document.getElementById("CODEOFCONDUCT").style.display = "flex";

  document.getElementById("agreeCC").addEventListener("click", () => {
    localStorage.setItem("agreeToCC", true);
    window.location.reload();
  });

  document.getElementById("disagreeCC").addEventListener("click", () => {
    localStorage.setItem("agreeToCC", false);
    window.open("https://www.google.com/search?q=am+i+an+asshole");
  });
}
