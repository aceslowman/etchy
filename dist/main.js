/*
 * ATTENTION: The "eval" devtool has been used (maybe by default in mode: "development").
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ "./src/FriendlyWebSocket.js":
/*!**********************************!*\
  !*** ./src/FriendlyWebSocket.js ***!
  \**********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"default\": () => (/* binding */ FriendlyWebSocket)\n/* harmony export */ });\n/* A Friendly WebSocket */\n\n// FOUND HERE: https://glitch.com/edit/#!/starter-ws\n\n// WebSockets are awesome, but they have a nasty habit of disconnecting\n// and not waking back up. This class is a wrapper around WebSocket that\n// handles automatic reconnection.\n\nclass FriendlyWebSocket {\n  // optional customization of the websocket path\n  constructor({ path = \"/\", url } = {}) {\n    this.path = path;\n    this.url = url;\n    this.connect();\n    this.connected = false;\n    this._listeners = {\n      message: new Set(),\n      open: new Set(),\n      close: new Set()\n    };\n  }\n\n  connect() {\n    let protocol = 'ws://';\n    if (location.protocol === 'https:') {\n      protocol = 'wss://';\n    }\n    \n    let url = this.url || (protocol + location.host + this.path);\n    \n    this.socket = new WebSocket(url);\n\n    // Connection opened\n    this.socket.addEventListener(\"open\", event => {\n      console.log(\"connected!\");\n      this.connected = true;\n      this._emit('open');\n      // this isn't necessary, but it's polite to say hi!\n      // this.socket.send(\"Hello Server!\");\n    });\n\n    this.socket.addEventListener(\"close\", event => {\n      console.log(\"disconnected, trying to reconnect\");\n      this.connected = false;\n      // the server went away, try re-connecting in 1 seconds.\n      this._emit('close');\n      setTimeout(() => this.connect(), 1000);\n    });\n\n    // Listen for messages\n    this.socket.addEventListener(\"message\", event => {\n      // tell the listeners about it\n      this._emit('message', event.data);\n    });\n  }\n\n  _emit(type, data) {\n    this._listeners[type].forEach(handler => {\n      // don't let one listener spoil the batch\n      try {\n        handler(data);\n      } catch (e) {\n        console.warn(\"error in message handler\", e);\n      }\n    });\n  }\n  \n  on(type, handler) {\n    if (type in this._listeners) {\n      this._listeners[type].add(handler);\n    }\n  }\n\n  off(type, handler) {\n    if (type === \"message\") {\n      this.messageHandlers.delete(handler);\n    }\n  }\n\n  send(message) {\n    if (this.connected) {\n      this.socket.send(message);\n    }\n  }\n}\n\n\n//# sourceURL=webpack://etchy/./src/FriendlyWebSocket.js?");

/***/ }),

/***/ "./src/index.js":
/*!**********************!*\
  !*** ./src/index.js ***!
  \**********************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n/* harmony import */ var _FriendlyWebSocket__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./FriendlyWebSocket */ \"./src/FriendlyWebSocket.js\");\n/* harmony import */ var _webrtc_utils__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./webrtc_utils */ \"./src/webrtc_utils.js\");\n/* harmony import */ var _webrtc_utils__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_webrtc_utils__WEBPACK_IMPORTED_MODULE_1__);\n/*\n  ETCHY\n  \n  This project uses webrtc to establish a connection between two users.\n  server/server.js contains the webrtc signaling server\n  \n  When a user establishes a connection, each webcam turns on. Each user\n  can sketch on a canvas, which is used to mask the raw video. The composite\n  canvas (sketch + raw video) is then made into a stream and sent to the other \n  user.\n  \n  Disconnections are frequent which I think is more of a webrtc problem,\n  if they occur it's best to just wait it out or refresh.\n  \n  TODO:\n  \n  fix on ios (works on everything but ios!)\n    video elements all have to be muted, playinline, and autoplay\n    \n    works on safari (atm) but not on chrome ios\n  \n  multiple peers\n  drawing customization\n  add image!\n  variable blend mode \n  (connection-level) blend modes?\n  variable brushes (different types)\n  \n  HELPFUL LINKS:\n  recognizing temporary or full disconnects\n  https://stackoverflow.com/questions/63582725/webrtc-differentiate-between-temporary-disconnect-or-failure-and-permanant\n  \n  NOTE: \n  \n  this project makes use of context-blender\n                https://github.com/Phrogz/context-blender\n  the 'multiply' and 'screen' blend modes in particular don't seem to have good browser\n  compatibility, particularly on mobile.\n*/\n\n\n// import ContextBlender from \"./ContextBlender\";\n\n\n// if the code of conduct has been agreed to\nif (localStorage.getItem(\"agreeToCC\")) {\n  document.getElementById(\"CODEOFCONDUCT\").style.display = \"none\";\n\n  // https://stackoverflow.com/questions/25158696/blend-modemultiply-in-internet-explorer\n  // this helps make 'multiply' more browser compatible!\n  function multiply(v1, v2, c, R=1, G=1, B=1) {\nconsole.log('v1',v1)\n    var a = v1.getImageData(0, 0, c.width, c.height).data;    \n    var b = v2.getImageData(0, 0, c.width, c.height).data;\n    \n    \n    \n    \n\n    // for (var i = 0; i < a.length; i += 4) {\n    //   data[i] = (R * data[i]) / 255;\n    //   data[i + 1] = (G * data[i + 1]) / 255;\n    //   data[i + 2] = (B * data[i + 2]) / 255;\n    // }\n    \n    for (var i = 0; i < b.length; i += 4) {\n      b[i] = (R * a[i]) / 255;\n      b[i + 1] = (G * a[i + 1]) / 255;\n      b[i + 2] = (B * a[i + 2]) / 255;\n    }\n\n    c.putImageData(b, 0, 0);\n  }\n  \n  // https://www.w3.org/TR/compositing-1/#blendingscreen\n  function screen(c) {\n    let _ctx = c.getContext(\"2d\");\n    var imgData = _ctx.getImageData(0, 0, c.width, c.height);\n    var data = imgData.data;\n\n    for (var i = 0; i < data.length; i += 4) {\n      data[i] = (data[i]) / 255;\n      data[i + 1] = (data[i + 1]) / 255;\n      data[i + 2] = (data[i + 2]) / 255;\n    }\n\n    ctx.putImageData(imgData, 0, 0);\n  }\n//   function screen(c0, c1) {\n//     let _ctx0 = c0.getContext(\"2d\");\n//     let _ctx1 = c1.getContext(\"2d\");\n//     var imgData0 = _ctx0.getImageData(0, 0, c0.width, c0.height);\n//     var data0 = imgData0.data;\n//     var imgData1 = _ctx1.getImageData(0, 0, c1.width, c1.height);\n//     var data1 = imgData1.data;\n\n//     for (var i = 0; i < data0.length; i += 4) {\n//       data1[i] = 1 - (1 - data0[i] / 255) * (1 - data1[i] / 255);\n//       data1[i + 1] = 1 - (1 - data0[i + 1] / 255) * (1 - data1[i + 1] / 255);\n//       data1[i + 2] = 1 - (1 - data0[i + 2] / 255) * (1 - data1[i + 2] / 255);\n//     }\n\n//     _ctx1.putImageData(imgData1, 0, 0);\n//   }\n\n  // https://stackoverflow.com/questions/6860853/generate-random-string-for-div-id\n  function guidGenerator() {\n    var S4 = function() {\n      return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);\n    };\n    return S4() + S4();\n  }\n\n  let user_id = guidGenerator();\n\n  let pc;\n  let offer_sent = false;\n  let answer_sent = false;\n  let peer_id = undefined;\n  let localStream, sketchStream, compositeStream;\n\n  let countElement = document.querySelector(\".count\");\n  let peersElement = document.querySelector(\"#peers\");\n\n  let canvas = document.getElementById(\"mainCanvas\");\n  let ctx = canvas.getContext(\"2d\");\n  canvas.width = 640;\n  canvas.height = 480;\n\n  let sketchCanvas = document.getElementById(\"sketchCanvas\");\n  let sketchCtx = sketchCanvas.getContext(\"2d\");\n  sketchCanvas.width = 640;\n  sketchCanvas.height = 480;\n\n  let cameraCanvas = document.getElementById(\"cameraCanvas\");\n  let cameraCtx = cameraCanvas.getContext(\"2d\");\n  cameraCanvas.width = 640;\n  cameraCanvas.height = 480;\n\n  let left_dragging = false;\n  let right_dragging = false;\n  let middle_dragging = false;\n\n  let main_update_loop, camera_update_loop;\n\n  let fade = true;\n  let fadeAmount = 0.1;\n  let update_rate = 50;\n  let brush_radius = 20;\n\n  let mouse;\n\n  let message_index = 0;\n  let current_message = \"\";\n\n  let main_blend_mode = \"screen\";\n  let local_blend_mode = \"multiply\";\n\n  // ------------------------------------------------------------\n  // setting up websocket signaling server\n  const websocket = new _FriendlyWebSocket__WEBPACK_IMPORTED_MODULE_0__.default({ path: \"/\" });\n\n  const createPeerConnection = (isOfferer = false) => {\n    const pc = new RTCPeerConnection({\n      iceServers: [\n        // { urls: \"stun:stun.1.google.com:19302\" },\n        { urls: \"turn:quickturn.glitch.me\", username: \"n/a\", credential: \"n/a\" }\n      ],\n      // offerToReceiveAudio: false,\n      // offerToReceiveVideo: true,\n      voiceActivityDetection: false\n    });\n\n    pc.onicecandidate = () => {\n      if (event.candidate) {\n        send({\n          from_id: user_id,\n          to_id: peer_id,\n          type: \"candidate\",\n          candidate: event.candidate\n        });\n      }\n    };\n\n    pc.onicecandidateerror = err => {\n      // console.error(err);\n    };\n\n    pc.oniceconnectionstatechange = async function() {\n      // console.log(\"ice connection state changed\", pc.iceConnectionState);\n\n      switch (pc.iceConnectionState) {\n        case \"disconnected\":\n          break;\n        case \"closed\":\n          break;\n        case \"failed\":\n          break;\n      }\n\n      let isDisconnectPermanent = await (0,_webrtc_utils__WEBPACK_IMPORTED_MODULE_1__.checkStatePermanent)(\n        pc,\n        pc.iceConnectionState\n      );\n\n      if (isDisconnectPermanent) {\n        alert(\"the person you were connected to has disappeared\");\n        reset();\n      }\n    };\n\n    pc.ontrack = event => {\n      let ele = document.querySelector(\"#peerRemote\");\n\n      if (event.streams && event.streams[0]) {\n        ele.srcObject = event.streams[0];\n      } else {\n        let inboundStream = new MediaStream(event.track);\n        ele.srcObject = inboundStream;\n      }\n\n      ele.autoplay = true;\n      ele.controls = true;\n      ele.playsInline = true;\n      ele.muted = true;\n\n      document.getElementById(\"local-video\").play();\n      document.getElementById(\"local-sketch\").play();\n      document.getElementById(\"local-composite\").play();\n      document.getElementById(\"peerRemote\").play();\n    };\n\n    // TODO: probably still needs to be added\n    // if (isOfferer) {\n    // pc.onnegotiationneeded = () => {\n    //   sendOffer();\n    // };\n    // }\n\n    return pc;\n  };\n\n  const sendOffer = () => {\n    if (!peer_id) return;\n    // console.log(\"Send offer to \" + peer_id);\n    return pc\n      .createOffer()\n      .then(setAndSendLocalDescription)\n      .then(() => {\n        offer_sent = true;\n      })\n      .catch(err => {\n        console.error(err);\n      });\n  };\n\n  const sendAnswer = () => {\n    if (!peer_id) return;\n    // console.log(\"Send answer to \" + peer_id);\n    return pc\n      .createAnswer()\n      .then(setAndSendLocalDescription)\n      .then(() => {\n        answer_sent = true;\n      })\n      .catch(err => {\n        console.error(err);\n      });\n  };\n\n  const setAndSendLocalDescription = sdp => {\n    return pc\n      .setLocalDescription(sdp)\n      .then(() => {\n        send({\n          from_id: user_id,\n          to_id: peer_id,\n          type: sdp.type,\n          sdp: sdp\n        });\n      })\n      .catch(err => {\n        console.error(err);\n      });\n  };\n\n  const handlePeerClick = e => {\n    offer_sent = false;\n    answer_sent = false;\n    peer_id = e.target.innerHTML;\n    addCamera()\n      .then(sendOffer)\n      .catch(err => {\n        console.error(err);\n      });\n    hideLobby();\n    showLoading();\n    // showControls();\n  };\n\n  const addCamera = () => {\n    // if(localStream) return;\n    return navigator.mediaDevices\n      .getUserMedia({\n        audio: false,\n        // video: true\n        video: { width: 640, height: 480 }\n      })\n      .then(stream => {\n        console.log(\"adding camera\");\n        localStream = stream;\n        compositeStream = cameraCanvas.captureStream();\n        sketchStream = sketchCanvas.captureStream();\n\n        initializeSketchCanvas();\n        compositeStream.getTracks().forEach(track => {\n          pc.addTrack(track, compositeStream);\n        });\n\n        document.getElementById(\"local-video\").srcObject = localStream;\n        document.getElementById(\"local-sketch\").srcObject = sketchStream;\n        document.getElementById(\"local-composite\").srcObject = compositeStream;\n\n        document.getElementById(\"local-video\").play();\n        document.getElementById(\"local-sketch\").play();\n        document.getElementById(\"local-composite\").play();\n        // document.getElementById(\"peerRemote\").play();\n\n        // startup the main output loop\n        if (main_update_loop) {\n          clearInterval(main_update_loop);\n          main_update_loop = setInterval(updateMainCanvas, update_rate);\n        } else {\n          main_update_loop = setInterval(updateMainCanvas, update_rate);\n        }\n      })\n      .catch(err => {\n        console.error(err);\n      });\n  };\n\n  // REGISTER when connection opens\n  websocket.on(\"open\", data => {\n    document.querySelector(\".yourId\").innerText = `(you) ${user_id}`;\n    send({ type: \"register\", user_id: user_id });\n    pc = createPeerConnection();\n  });\n\n  // when signaling server sends a message\n  websocket.on(\"message\", data => {\n    data = JSON.parse(event.data);\n\n    switch (data.type) {\n      case \"count\":\n        // clear all buttons\n        Array.from(peersElement.children).forEach(e => {\n          e.removeEventListener(\"click\", handlePeerClick);\n          peersElement.removeChild(e);\n        });\n\n        if (data.peers.length === 1) {\n          let ele = document.createElement(\"em\");\n\n          ele.innerText = \"~ nobody is online! ~\";\n          peersElement.appendChild(ele);\n        } else {\n          for (let i = 0; i < data.peers.length; i++) {\n            if (data.peers[i].user_id !== user_id) {\n              let btn = document.createElement(\"button\");\n              btn.innerHTML = data.peers[i].user_id;\n              btn.addEventListener(\"click\", handlePeerClick);\n              peersElement.appendChild(btn);\n            }\n          }\n        }\n\n        break;\n      case \"offer\":\n        /* \n          when an offer is received, the user on the receiving end\n          should be given the opportunity to accept or deny\n        */\n        if (offer_sent || window.confirm(data.from_id + \" wants to connect\")) {\n          peer_id = data.from_id;\n          document.querySelector(\".peerId\").innerText = `⟷ ${peer_id} (them)`;\n          pc.setRemoteDescription(data.sdp)\n            .then(sendAnswer)\n            .then(addCamera)\n            .then(() => {\n              hideLobby();\n              showControls();\n              if (!offer_sent) sendOffer();\n            })\n            .catch(error => console.error(error));\n        } else {\n          // tell sender no thank you\n          send({\n            from_id: user_id,\n            to_id: data.from_id,\n            type: \"rejectOffer\"\n          });\n        }\n        break;\n      case \"answer\":\n        peer_id = data.from_id;\n        document.querySelector(\".peerId\").innerText = `⟷ ${peer_id} (them)`;\n        pc.setRemoteDescription(data.sdp)\n          .then(addCamera)\n          .then(() => {\n            hideLoading();\n            showControls();\n          })\n          .catch(error => console.error(error));\n        break;\n      case \"candidate\":\n        if (!pc || !pc.remoteDescription) {\n          pc.addIceCandidate(data.candidate);\n        }\n        break;\n      case \"rejectOffer\":\n        alert(\n          \"the other user declined (or just closed their tab, something like that)\"\n        );\n        reset();\n        break;\n      default:\n        break;\n    }\n  });\n\n  const reset = () => {\n    showLobby();\n    hideLoading();\n    hideControls();\n    peer_id = undefined;\n    document.querySelector(\".peerId\").innerText = \"\";\n    offer_sent = false;\n    answer_sent = false;\n\n    // reregister?\n    send({ type: \"register\", user_id: user_id });\n  };\n\n  const send = data => {\n    websocket.send(JSON.stringify(data));\n  };\n\n  const showLobby = () => {\n    document.querySelector(\".center\").style.display = \"flex\";\n  };\n\n  const hideLobby = () => {\n    document.querySelector(\".center\").style.display = \"none\";\n  };\n\n  const showLoading = () => {\n    document.querySelector(\".loading\").style.display = \"flex\";\n  };\n\n  const hideLoading = () => {\n    document.querySelector(\".loading\").style.display = \"none\";\n  };\n\n  const showControls = () => {\n    document.querySelector(\"#controls\").style.display = \"flex\";\n  };\n\n  const hideControls = () => {\n    document.querySelector(\"#controls\").style.display = \"none\";\n  };\n\n  // composite final output\n  const updateMainCanvas = () => {\n    if (fade) updateSketchCanvas();\n    updateCameraCanvas();\n\n    let v1 = document.querySelector(\"#local-composite\");\n    let v2 = document.querySelector(\"#peerRemote\");\n\n        ctx.globalCompositeOperation = \"source-over\";\n\n    if (v2) ctx.drawImage(v2, 0, 0);\n\n    // ctx.save();\n    ctx.globalCompositeOperation = main_blend_mode;\n    if (v1) ctx.drawImage(v1, 0, 0);\n    // if (v1) v1.blendOnto(v2,'screen');\n    // if (v1) screen(canvas);\n    // ctx.restore();\n  };\n\n  // this fades away the sketch while drawing\n  const updateSketchCanvas = () => {\n    sketchCtx.save();\n\n    // I can't decide what value this should be at\n    // a longer tail on the fade looks better but\n    // leaves the background with artifacts\n    sketchCtx.globalAlpha = fadeAmount;\n    sketchCtx.fillStyle = \"black\";\n    sketchCtx.fillRect(0, 0, sketchCanvas.width, sketchCanvas.height);\n    sketchCtx.fillStyle = \"white\";\n    sketchCtx.restore();\n\n    sketchCtx.globalAlpha = 1.0;\n\n    // draw circle\n    if (left_dragging) {\n      sketchCtx.fillStyle = \"white\";\n      sketchCtx.beginPath();\n      sketchCtx.ellipse(\n        mouse.x,\n        mouse.y,\n        brush_radius,\n        brush_radius,\n        Math.PI / 4,\n        0,\n        2 * Math.PI\n      );\n      sketchCtx.fill();\n      sketchCtx.closePath();\n    }\n\n    // erase\n    if (middle_dragging) {\n      sketchCtx.fillStyle = \"black\";\n      sketchCtx.beginPath();\n      sketchCtx.ellipse(\n        mouse.x,\n        mouse.y,\n        brush_radius,\n        brush_radius,\n        Math.PI / 4,\n        0,\n        2 * Math.PI\n      );\n      sketchCtx.fill();\n      sketchCtx.closePath();\n    }\n\n    // draw text\n    if (right_dragging) {\n      let current_symbol = current_message.split(\"\")[message_index];\n      // space out message\n      if (current_frame % 4 === 0) {\n        // draw message\n        sketchCtx.font = brush_radius * 4 + \"px Times New Roman\";\n        sketchCtx.fillStyle = \"white\";\n        sketchCtx.fillText(\n          current_message.split(\"\")[message_index],\n          mouse.x + brush_radius,\n          mouse.y + brush_radius\n        );\n\n        // message_index = (message_index + 1) % current_message.split(\"\").length;\n        message_index++;\n        if (message_index >= current_message.split(\"\").length) {\n          right_dragging = false;\n        }\n      }\n\n      current_frame++;\n    }\n  };\n\n  // here I am masking out the video with the sketch (composite)\n  const updateCameraCanvas = () => {\n    let v1 = document.querySelector(\"#local-video\");\n    let v2 = document.querySelector(\"#local-sketch\");\n\n    cameraCtx.globalCompositeOperation = \"source_over\";\n    if (v1) cameraCtx.drawImage(v1, 0, 0);\n\n    cameraCtx.save();\n\n    cameraCtx.globalCompositeOperation = local_blend_mode;\n    if (v2) cameraCtx.drawImage(v2, 0, 0);\n    // if (v2) multiply(v1, v2, cameraCanvas);\n    // if (v2) v2.blendOnto(v1,'multiply');\n    cameraCtx.restore();\n  };\n\n  // draw sketch that can be later be used as a mask\n  const initializeSketchCanvas = () => {\n    sketchCtx.save();\n    sketchCtx.clearRect(0, 0, sketchCanvas.width, sketchCanvas.height);\n    sketchCtx.fillStyle = \"black\";\n    sketchCtx.fillRect(0, 0, sketchCanvas.width, sketchCanvas.height);\n    sketchCtx.restore();\n  };\n\n  let current_frame = 0;\n  const handleMouseMove = e => {\n    if (right_dragging || left_dragging || middle_dragging) {\n      let event = e.touches ? e.touches[0] : e;\n      let bounds = canvas.getBoundingClientRect();\n      mouse = { x: event.clientX - bounds.x, y: event.clientY - bounds.y };\n    }\n  };\n\n  const handleMouseDown = e => {\n    if (e.button === 0) {\n      left_dragging = true;\n    } else if (e.button === 1) {\n      middle_dragging = true;\n    } else if (e.button === 2) {\n      right_dragging = true;\n      // spell it out from the beginning\n      message_index = 0;\n    }\n\n    if (e.touches) {\n      if (e.touches.length === 1) {\n        left_dragging = true;\n      } else if (e.touches.length === 3) {\n        middle_dragging = true;\n      } else if (e.touches.length === 2) {\n        right_dragging = true;\n        message_index = 0;\n      }\n    }\n\n    let event = e.touches ? e.touches[0] : e;\n    let bounds = canvas.getBoundingClientRect();\n    mouse = { x: event.clientX - bounds.x, y: event.clientY - bounds.y };\n  };\n\n  const handleMouseUp = e => {\n    if (e.button === 0) {\n      left_dragging = false;\n    } else if (e.button === 1) {\n      middle_dragging = false;\n    } else if (e.button === 2) {\n      right_dragging = false;\n    }\n\n    if (e.touches) {\n      if (e.touches.length === 1) {\n        left_dragging = false;\n      } else if (e.touches.length === 3) {\n        middle_dragging = false;\n      } else if (e.touches.length === 2) {\n        right_dragging = false;\n      }\n    }\n\n    let event = e.touches ? e.touches[0] : e;\n    let bounds = canvas.getBoundingClientRect();\n    mouse = { x: event.clientX - bounds.x, y: event.clientY - bounds.y };\n  };\n\n  const handleBrushRadiusChange = e => {\n    document.querySelector(\"#brushRadiusValue\").innerHTML = e.target.value;\n    brush_radius = e.target.value;\n  };\n\n  const handleFadeAmountChange = e => {\n    document.querySelector(\"#fadeAmountValue\").innerHTML = e.target.value;\n    fadeAmount = e.target.value;\n  };\n\n  const handleClearButton = () => {\n    initializeSketchCanvas();\n    // sketchCtx.clearRect(0, 0, sketchCanvas.width, sketchCanvas.height);\n  };\n\n  const handleToggleFade = () => {\n    fade = !fade;\n    document.querySelector(\"#fadeToggle\").innerHTML = fade\n      ? \"dont fade away\"\n      : \"fade away\";\n  };\n\n  const handleSnapButton = () => {\n    /*\n      saves an image of the current canvas\n    */\n    console.log(\"saving snapshot\");\n    let uri = canvas.toDataURL(\"image/png\");\n    let link = document.createElement(\"a\");\n    link.download = `${user_id}`;\n\n    if (window.webkitURL != null) {\n      // Chrome allows the link to be clicked without actually adding it to the DOM.\n      link.href = uri;\n    } else {\n      // Firefox requires the link to be added to the DOM before it can be clicked.\n      link.href = uri;\n      link.onclick = e => document.body.removeChild(e.target);\n      link.style.display = \"none\";\n      document.body.appendChild(link);\n    }\n\n    link.click();\n  };\n\n  const handleLocalBlendMode = e => {\n    console.log(\"handleLocalBlendMode\", e.target.value);\n    local_blend_mode = e.target.value;\n  };\n\n  const handleGlobalBlendMode = e => {\n    console.log(\"handleGlobalBlendMode\", e.target.value);\n    main_blend_mode = e.target.value;\n  };\n\n  const handleContextMenu = e => {\n    e.preventDefault();\n  };\n\n  const handleMessageChange = e => {\n    current_message = e.target.value;\n  };\n\n  initializeSketchCanvas();\n\n  const handleWheel = e => {\n    fadeAmount += (e.deltaY * -1) / 1000;\n\n    if (fadeAmount > 1) fadeAmount = 1;\n    if (fadeAmount <= 0) fadeAmount = 0;\n\n    console.log(e.deltaY);\n\n    document.getElementById(\"fadeAmount\").value = fadeAmount;\n    document.querySelector(\"#fadeAmountValue\").innerHTML = fadeAmount.toFixed(\n      2\n    );\n  };\n\n  window.addEventListener(\n    \"resize\",\n    e => {\n      // if(window.innerWidth < 640 || window.innerHeight < 480) {\n      //   let aspect = 480 / 640;\n      //   canvas.width = window.innerWidth;\n      //   canvas.height = window.innerHeight * aspect;\n      // } else {\n      //   canvas.width = 640;\n      //   canvas.height = 480;\n      // }\n    },\n    true\n  );\n\n  document.addEventListener(\"contextmenu\", handleContextMenu, false);\n\n  document.addEventListener(\"mousedown\", handleMouseDown, false);\n  document.addEventListener(\"mousemove\", handleMouseMove, false);\n  document.addEventListener(\"mouseup\", handleMouseUp, false);\n\n  canvas.addEventListener(\n    \"touchstart\",\n    e => {\n      e.preventDefault();\n      handleMouseDown(e);\n    },\n    false\n  );\n  canvas.addEventListener(\n    \"touchmove\",\n    e => {\n      handleMouseMove(e);\n    },\n    false\n  );\n  canvas.addEventListener(\n    \"touchend\",\n    e => {\n      handleMouseUp(e);\n    },\n    false\n  );\n\n  document.querySelector(\"#brushRadiusValue\").innerHTML = brush_radius;\n  document.querySelector(\"#brushRadiusValue\").value = brush_radius;\n\n  document\n    .querySelector(\"#brushRadius\")\n    .addEventListener(\"input\", handleBrushRadiusChange, false);\n  document\n    .querySelector(\"#clearButton\")\n    .addEventListener(\"click\", handleClearButton, false);\n  document\n    .querySelector(\"#fadeToggle\")\n    .addEventListener(\"click\", handleToggleFade, false);\n  document\n    .querySelector(\"#fadeAmount\")\n    .addEventListener(\"input\", handleFadeAmountChange, false);\n  document\n    .querySelector(\"#snapButton\")\n    .addEventListener(\"click\", handleSnapButton, false);\n\n  document.querySelector(\"#fadeAmountValue\").innerHTML = fadeAmount;\n  document.querySelector(\"#fadeAmountValue\").value = fadeAmount;\n\n  document\n    .querySelector(\"#localBlendMode\")\n    .addEventListener(\"change\", handleLocalBlendMode, false);\n  document\n    .querySelector(\"#globalBlendMode\")\n    .addEventListener(\"change\", handleGlobalBlendMode, false);\n\n  document\n    .querySelector(\"#brushMessage\")\n    .addEventListener(\"input\", handleMessageChange, false);\n\n  document.addEventListener(\"wheel\", handleWheel, false);\n} else {\n  // FOR CODE OF CONDUCT\n\n  document.getElementById(\"CODEOFCONDUCT\").style.display = \"flex\";\n\n  // CODE OF CONDUCT\n  document.getElementById(\"agreeCC\").addEventListener(\"click\", () => {\n    localStorage.setItem(\"agreeToCC\", true);\n    window.location.reload();\n  });\n\n  document.getElementById(\"disagreeCC\").addEventListener(\"click\", () => {\n    localStorage.setItem(\"agreeToCC\", false);\n    window.open(\"https://www.google.com/search?q=am+i+an+asshole\");\n  });\n}\n\n\n//# sourceURL=webpack://etchy/./src/index.js?");

/***/ }),

/***/ "./src/webrtc_utils.js":
/*!*****************************!*\
  !*** ./src/webrtc_utils.js ***!
  \*****************************/
/***/ ((module) => {

eval("// https://stackoverflow.com/questions/63582725/webrtc-differentiate-between-temporary-disconnect-or-failure-and-permanant\nlet con;\n\nconst customdelay = ms => new Promise(res => setTimeout(res, ms));\n\nasync function checkStatePermanent(_con, iceState) {\n  con = _con;\n  videoReceivedBytetCount = 0;\n  audioReceivedByteCount = 0;\n\n  let firstFlag = await isPermanentDisconnect();\n\n  await customdelay(2000);\n\n  let secondFlag = await isPermanentDisconnect(); //Call this func again after 2 seconds to check whether data is still coming in.\n\n  if (secondFlag) {\n    //If permanent disconnect then we hangup i.e no audio/video is fllowing\n    if (iceState == \"disconnected\") {\n      console.log('permanent disconnect')\n      \n      return true;\n      // hangUpCall(); //Hangup instead of closevideo() because we want to record call end in db\n    }\n  }\n  if (!secondFlag) {\n    console.log('temporary failure to connect')\n    \n    //If temp failure then restart ice i.e audio/video is still flowing\n    if (iceState == \"failed\") {\n      con.restartIce();\n    }\n    \n    return false;\n  }\n}\n\nvar videoReceivedBytetCount = 0;\nvar audioReceivedByteCount = 0;\n\nasync function isPermanentDisconnect() {\n  var isPermanentDisconnectFlag = false;\n  var videoIsAlive = false;\n  var audioIsAlive = false;\n\n  await con.getStats(null).then(stats => {\n    stats.forEach(report => {\n      if (\n        report.type === \"inbound-rtp\" &&\n        (report.kind === \"audio\" || report.kind === \"video\")\n      ) {\n        //check for inbound data only\n        if (report.kind === \"audio\") {\n          //Here we must compare previous data count with current\n          if (report.bytesReceived > audioReceivedByteCount) {\n            // If current count is greater than previous then that means data is flowing to other peer. So this disconnected or failed ICE state is temporary\n            audioIsAlive = true;\n          } else {\n            audioIsAlive = false;\n          }\n          audioReceivedByteCount = report.bytesReceived;\n        }\n        if (report.kind === \"video\") {\n          if (report.bytesReceived > videoReceivedBytetCount) {\n            // If current count is greater than previous then that means data is flowing to other peer. So this disconnected or failed ICE state is temporary\n            videoIsAlive = true;\n          } else {\n            videoIsAlive = false;\n          }\n          videoReceivedBytetCount = report.bytesReceived;\n        }\n        if (audioIsAlive || videoIsAlive) {\n          //either audio or video is being recieved.\n          isPermanentDisconnectFlag = false; //Disconnected is temp\n        } else {\n          isPermanentDisconnectFlag = true;\n        }\n      }\n    });\n  });\n\n  return isPermanentDisconnectFlag;\n}\n\nmodule.exports = {\n  checkStatePermanent,\n  isPermanentDisconnect\n};\n\n\n//# sourceURL=webpack://etchy/./src/webrtc_utils.js?");

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat get default export */
/******/ 	(() => {
/******/ 		// getDefaultExport function for compatibility with non-harmony modules
/******/ 		__webpack_require__.n = (module) => {
/******/ 			var getter = module && module.__esModule ?
/******/ 				() => (module['default']) :
/******/ 				() => (module);
/******/ 			__webpack_require__.d(getter, { a: getter });
/******/ 			return getter;
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module can't be inlined because the eval devtool is used.
/******/ 	var __webpack_exports__ = __webpack_require__("./src/index.js");
/******/ 	
/******/ })()
;