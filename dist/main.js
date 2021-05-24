/*
 * ATTENTION: The "eval" devtool has been used (maybe by default in mode: "development").
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./src/FriendlyWebSocket.js":
/*!**********************************!*\
  !*** ./src/FriendlyWebSocket.js ***!
  \**********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"default\": () => (/* binding */ FriendlyWebSocket)\n/* harmony export */ });\n/* A Friendly WebSocket */\n\n// FOUND HERE: https://glitch.com/edit/#!/starter-ws\n\n// WebSockets are awesome, but they have a nasty habit of disconnecting\n// and not waking back up. This class is a wrapper around WebSocket that\n// handles automatic reconnection.\n\nclass FriendlyWebSocket {\n  // optional customization of the websocket path\n  constructor({ path = \"/\", url } = {}) {\n    this.path = path;\n    this.url = url;\n    this.connect();\n    this.connected = false;\n    this._listeners = {\n      message: new Set(),\n      open: new Set(),\n      close: new Set()\n    };\n  }\n\n  connect() {\n    let protocol = 'ws://';\n    if (location.protocol === 'https:') {\n      protocol = 'wss://';\n    }\n    \n    let url = this.url || (protocol + location.host + this.path);\n    \n    this.socket = new WebSocket(url);\n\n    // Connection opened\n    this.socket.addEventListener(\"open\", event => {\n      console.log(\"connected!\");\n      this.connected = true;\n      this._emit('open');\n      // this isn't necessary, but it's polite to say hi!\n      // this.socket.send(\"Hello Server!\");\n    });\n\n    this.socket.addEventListener(\"close\", event => {\n      console.log(\"disconnected\");\n      this.connected = false;\n      // the server went away, try re-connecting in 2 seconds.\n      this._emit('close');\n      setTimeout(() => this.connect(), 2000);\n    });\n\n    // Listen for messages\n    this.socket.addEventListener(\"message\", event => {\n      // tell the listeners about it\n      this._emit('message', event.data);\n    });\n  }\n\n  _emit(type, data) {\n    this._listeners[type].forEach(handler => {\n      // don't let one listener spoil the batch\n      try {\n        handler(data);\n      } catch (e) {\n        console.warn(\"error in message handler\", e);\n      }\n    });\n  }\n  \n  on(type, handler) {\n    if (type in this._listeners) {\n      this._listeners[type].add(handler);\n    }\n  }\n\n  off(type, handler) {\n    if (type === \"message\") {\n      this.messageHandlers.delete(handler);\n    }\n  }\n\n  send(message) {\n    if (this.connected) {\n      this.socket.send(message);\n    }\n  }\n}\n\n\n//# sourceURL=webpack://etchy/./src/FriendlyWebSocket.js?");

/***/ }),

/***/ "./src/index.js":
/*!**********************!*\
  !*** ./src/index.js ***!
  \**********************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony import */ var _FriendlyWebSocket__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./FriendlyWebSocket */ \"./src/FriendlyWebSocket.js\");\n/*\n  ETCHY\n  \n  This project uses webrtc to establish a connection between two users.\n  server/server.js contains the webrtc signaling server\n  \n  When a user establishes a connection, each webcam turns on. Each user\n  can sketch on a canvas, which is used to mask the raw video. The composite\n  canvas (sketch + raw video) is then made into a stream and sent to the other \n  user.\n  \n  TODO:\n  \n  multiple peers\n  drawing customization\n*/\n\n\n// https://stackoverflow.com/questions/6860853/generate-random-string-for-div-id\nfunction guidGenerator() {\n  var S4 = function() {\n    return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);\n  };\n  return S4() + S4();\n}\n\nlet user_id = guidGenerator();\n\nlet pc;\nlet offer_sent = false;\nlet answer_sent = false;\nlet peer_id = undefined;\nlet localStream, sketchStream, cameraStream;\n\nlet countElement = document.querySelector(\".count\");\nlet peersElement = document.querySelector(\"#peers\");\n\nlet canvas = document.getElementById(\"mainCanvas\");\nlet ctx = canvas.getContext(\"2d\");\ncanvas.width = 640;\ncanvas.height = 480;\n\nlet sketchCanvas = document.getElementById(\"sketchCanvas\");\nlet sketchCtx = sketchCanvas.getContext(\"2d\");\nsketchCanvas.width = 640;\nsketchCanvas.height = 480;\n\nlet cameraCanvas = document.getElementById(\"cameraCanvas\");\nlet cameraCtx = cameraCanvas.getContext(\"2d\");\ncameraCanvas.width = 640;\ncameraCanvas.height = 480;\n\nlet dragging = false;\n\nlet main_update_loop, camera_update_loop;\n\nlet update_rate = 100;\nlet brush_radius = 20;\n\n// ------------------------------------------------------------\n// setting up websocket signaling server\nconst websocket = new _FriendlyWebSocket__WEBPACK_IMPORTED_MODULE_0__.default({ path: \"/\" });\n\nconst createPeerConnection = (isOfferer = false) => {\n  const pc = new RTCPeerConnection({\n    iceServers: [{ url: \"stun:stun.1.google.com:19302\" }],\n    offerToReceiveAudio: false,\n    offerToReceiveVideo: true,\n    voiceActivityDetection: false\n  });\n\n  pc.onicecandidate = () => {\n    if (event.candidate) {\n      send({\n        from_id: user_id,\n        to_id: peer_id,\n        type: \"candidate\",\n        candidate: event.candidate\n      });\n    }\n  };\n\n  pc.oniceconnectionstatechange = function() {\n    if (pc.iceConnectionState == \"disconnected\") {\n      console.log(\"Disconnected\");\n      alert(\"the person you were connected to has disappeared\");\n      reset();\n    }\n  };\n\n  pc.ontrack = event => {\n    let ele, sketch_ele;\n    if (document.querySelector(\"#peerRemote\")) {\n      ele = document.querySelector(\"#peerRemote\");\n    } else {\n      ele = document.createElement(\"video\");\n      document.querySelector(\"#remoteStreams\").appendChild(ele);\n    }\n\n    ele.id = \"peerRemote\";\n    ele.autoplay = true;\n    ele.controls = true; // TEMP\n\n    if (event.streams && event.streams[0]) {\n      ele.srcObject = event.streams[0];\n    } else {\n      let inboundStream = new MediaStream(event.track);\n      ele.srcObject = inboundStream;\n    }\n  };\n\n  // if (isOfferer) {\n  // pc.onnegotiationneeded = () => {\n  //   sendOffer();\n  // };\n  // }\n\n  // console.log(\"PeerConnection created\");\n\n  return pc;\n};\n\nconst sendOffer = () => {\n  if (!peer_id) return;\n  // console.log(\"Send offer to \" + peer_id);\n  return pc\n    .createOffer()\n    .then(setAndSendLocalDescription)\n    .then(() => {\n      offer_sent = true;\n    });\n};\n\nconst sendAnswer = () => {\n  if (!peer_id) return;\n  // console.log(\"Send answer to \" + peer_id);\n  return pc\n    .createAnswer()\n    .then(setAndSendLocalDescription)\n    .then(() => {\n      answer_sent = true;\n    });\n};\n\nconst setAndSendLocalDescription = sdp => {\n  return pc.setLocalDescription(sdp).then(() => {\n    send({\n      from_id: user_id,\n      to_id: peer_id,\n      type: sdp.type,\n      sdp: sdp\n    });\n  });\n};\n\nconst handlePeerClick = e => {\n  peer_id = e.target.innerHTML;\n  addCamera().then(sendOffer);\n  hideLobby();\n  showLoading();\n};\n\nconst addCamera = () => {\n  return navigator.mediaDevices\n    .getUserMedia({\n      audio: false,\n      video: { width: 640, height: 480 }\n    })\n    .then(stream => {\n      localStream = stream;\n      cameraStream = cameraCanvas.captureStream(30); // 10 fps\n      sketchStream = sketchCanvas.captureStream(30);\n\n      document.getElementById(\"local-video\").srcObject = localStream;\n      document.getElementById(\"local-sketch\").srcObject = sketchStream;\n      document.getElementById(\"local-composite\").srcObject = cameraStream;\n\n      initializeSketchCanvas();\n\n      cameraStream\n        .getTracks()\n        .forEach(track => pc.addTrack(track, cameraStream));\n\n      // startup the main output loop\n      if (main_update_loop) {\n        clearInterval(main_update_loop);\n        main_update_loop = setInterval(updateMainCanvas, update_rate);\n      } else {\n        main_update_loop = setInterval(updateMainCanvas, update_rate);\n      }\n\n      // // startup the main output loop\n      // if (camera_update_loop) {\n      //   clearInterval(camera_update_loop);\n      //   camera_update_loop = setInterval(updateCameraCanvas, update_rate);\n      // } else {\n      //   camera_update_loop = setInterval(updateCameraCanvas, update_rate);\n      // }\n    });\n};\n\n// REGISTER when connection opens\nwebsocket.on(\"open\", data => {\n  document.querySelector(\".yourId\").innerText = `your id: ${user_id}`;\n  send({ type: \"register\", user_id: user_id });\n  pc = createPeerConnection();\n});\n\n// when signaling server sends a message\nwebsocket.on(\"message\", data => {\n  data = JSON.parse(event.data);\n\n  switch (data.type) {\n    case \"count\":\n      countElement.innerText = `currently online: ${data.count}`;\n\n      // clear all buttons\n      Array.from(peersElement.children).forEach(e => {\n        e.removeEventListener(\"click\", handlePeerClick);\n        peersElement.removeChild(e);\n      });\n\n      for (let i = 0; i < data.peers.length; i++) {\n        if (data.peers[i].user_id !== user_id) {\n          let btn = document.createElement(\"button\");\n          btn.innerHTML = data.peers[i].user_id;\n          btn.addEventListener(\"click\", handlePeerClick);\n          peersElement.appendChild(btn);\n        }\n      }\n\n      break;\n    case \"offer\":\n      /* \n        when an offer is received, the user on the receiving end\n        should be given the opportunity to accept or deny\n      */\n\n      // console.log(\"receiving offer from \" + data.from_id, data);\n      if (offer_sent || window.confirm(data.from_id + \" wants to connect\")) {\n        peer_id = data.from_id;\n        pc.setRemoteDescription(data.sdp)\n          .then(sendAnswer)\n          .then(addCamera)\n          .then(() => {\n            hideLobby();\n            if (!offer_sent) {\n              sendOffer();\n            }\n          })\n          .catch(error => console.error(error));\n      } else {\n        // tell sender no thank you\n        send({\n          from_id: user_id,\n          to_id: data.from_id,\n          type: \"rejectOffer\"\n        });\n      }\n      break;\n    case \"answer\":\n      // console.log(\"received answer from \" + data.from_id, data);\n      peer_id = data.from_id;\n      pc.setRemoteDescription(data.sdp)\n        .then(addCamera)\n        .then(() => {\n          hideLoading();\n        })\n        .catch(error => console.error(error));\n      break;\n    case \"candidate\":\n      pc.addIceCandidate(data.ice);\n      break;\n    case \"rejectOffer\":\n      alert(\"the other user rejected your offer\");\n      reset();\n      break;\n    default:\n      break;\n  }\n});\n\nconst reset = () => {\n  showLobby();\n  hideLoading();\n  peer_id = undefined;\n  offer_sent = false;\n  answer_sent = false;\n  // pc = createPeerConnection();\n};\n\nconst send = data => {\n  websocket.send(JSON.stringify(data));\n};\n\nconst showLobby = () => {\n  document.querySelector(\".center\").style.display = \"flex\";\n};\n\nconst hideLobby = () => {\n  document.querySelector(\".center\").style.display = \"none\";\n};\n\nconst showLoading = () => {\n  document.querySelector(\".loading\").style.display = \"flex\";\n};\n\nconst hideLoading = () => {\n  document.querySelector(\".loading\").style.display = \"none\";\n};\n\n// composite final output\nconst updateMainCanvas = () => {\n  updateSketchCanvas();\n  updateCameraCanvas();\n\n  let v1 = document.querySelector(\"#local-composite\");\n  let v2 = document.querySelector(\"#peerRemote\");\n\n  if (v2) ctx.drawImage(v2, 0, 0, canvas.width, canvas.height);\n\n  ctx.save();\n  ctx.globalCompositeOperation = \"screen\";\n  if (v1) ctx.drawImage(v1, 0, 0, canvas.width, canvas.height);\n\n  ctx.restore();\n};\n\n// this fades away the sketch while drawing\nconst updateSketchCanvas = () => {\n  sketchCtx.save();\n\n  // I can't decide what value this should be at\n  // a longer tail on the fade looks better but\n  // leaves the background with artifacts\n  sketchCtx.globalAlpha = 0.1;\n  sketchCtx.fillStyle = \"black\";\n  sketchCtx.fillRect(0, 0, sketchCanvas.width, sketchCanvas.height);\n  sketchCtx.restore();\n\n  sketchCtx.globalAlpha = 1.0;\n};\n\n// here I am masking out the video with the sketch (composite)\nconst updateCameraCanvas = () => {\n  let v1 = document.querySelector(\"#local-video\");\n  let v2 = document.querySelector(\"#local-sketch\");\n\n  if (v1)\n    cameraCtx.drawImage(v1, 0, 0, cameraCanvas.width, cameraCanvas.height);\n\n  cameraCtx.save();\n  // this is for when there is no 'fade' effect\n  // cameraCtx.globalCompositeOperation = \"destination-in\";\n  cameraCtx.globalCompositeOperation = \"multiply\";\n  if (v2) cameraCtx.drawImage(v2, 0, 0, canvas.width, canvas.height);\n  cameraCtx.restore();\n};\n\n// draw sketch that can be later be used as a mask\nconst initializeSketchCanvas = () => {\n  sketchCtx.clearRect(0, 0, sketchCanvas.width, sketchCanvas.height);\n  sketchCtx.fillStyle = \"black\";\n  sketchCtx.fillRect(0, 0, sketchCanvas.width, sketchCanvas.height);\n};\n\nconst handleMouseMove = e => {\n  if (dragging) {\n    let bounds = canvas.getBoundingClientRect();\n    let mouse = { x: e.pageX - bounds.x, y: e.pageY - bounds.y };\n    sketchCtx.fillStyle = \"white\";\n    sketchCtx.beginPath();\n    sketchCtx.ellipse(\n      mouse.x,\n      mouse.y,\n      brush_radius,\n      brush_radius,\n      Math.PI / 4,\n      0,\n      2 * Math.PI\n    );\n    sketchCtx.fill();\n  }\n};\n\nconst handleMouseDown = e => (dragging = true);\nconst handleMouseUp = e => (dragging = false);\n\ninitializeSketchCanvas();\n\n// document.addEventListener(\"click\", init, false);\ndocument.addEventListener(\"mousedown\", handleMouseDown, false);\ndocument.addEventListener(\"mousemove\", handleMouseMove, false);\ndocument.addEventListener(\"mouseup\", handleMouseUp, false);\n\n\n//# sourceURL=webpack://etchy/./src/index.js?");

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