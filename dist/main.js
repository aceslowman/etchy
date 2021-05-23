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

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony import */ var _FriendlyWebSocket__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./FriendlyWebSocket */ \"./src/FriendlyWebSocket.js\");\n\n// https://stackoverflow.com/questions/6860853/generate-random-string-for-div-id\nfunction guidGenerator() {\n  var S4 = function() {\n    return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);\n  };\n  return S4() + S4();\n}\n\nlet user_id = guidGenerator();\n\nlet pc;\nlet offer_sent = false;\nlet answer_sent = false;\nlet peer_id = undefined;\nlet localStream;\n\nlet started = false;\n\nlet countElement = document.querySelector(\".count\");\nlet peersElement = document.querySelector(\".peers\");\n\nlet canvas = document.getElementById(\"mainCanvas\");\nlet ctx = canvas.getContext(\"2d\");\ncanvas.width = window.innerWidth;\ncanvas.height = window.innerHeight;\n\n// ------------------------------------------------------------\n// setting up websocket signaling server\nconst websocket = new _FriendlyWebSocket__WEBPACK_IMPORTED_MODULE_0__.default({ path: \"/\" });\n\nconst createPeerConnection = (isOfferer = false) => {\n  const pc = new RTCPeerConnection({\n    iceServers: [{ url: \"stun:stun.1.google.com:19302\" }],\n    offerToReceiveAudio: false,\n    offerToReceiveVideo: true\n  });\n\n  pc.onicecandidate = () => {\n    if (event.candidate) {\n      send({\n        from_id: user_id,\n        to_id: peer_id,\n        type: \"candidate\",\n        candidate: event.candidate\n      });\n    }\n  };\n\n  pc.ontrack = event => {\n    console.log(\"Add streaming element\", event);\n    const ele = document.createElement(\"video\");\n    ele.autoplay = true;\n    ele.controls = true; // TEMP\n\n    if (event.streams && event.streams[0]) {\n      ele.srcObject = event.streams[0];\n    } else {\n      let inboundStream = new MediaStream(event.track);\n      ele.srcObject = inboundStream;\n    }\n\n    ele.play();\n\n    document.querySelector(\"#remoteStreams\").appendChild(ele);\n  };\n\n  // if (isOfferer) {\n  pc.onnegotiationneeded = () => {\n    sendOffer();\n  };\n  // }\n\n  console.log(\"PeerConnection created\");\n\n  // navigator.mediaDevices\n  //   .getUserMedia({ audio: false, video: true })\n  //   .then(stream => {\n  //     localStream = stream;\n  //     document.getElementById(\"local-video\").srcObject = localStream;\n  //     stream.getTracks().forEach(track => pc.addTrack(track, stream));\n  //     started = true;\n  //   })\n  //   .catch(err => {\n  //     console.log(\"Error capturing stream.\", err);\n  //   });\n\n  return pc;\n};\n\nconst sendOffer = () => {\n  if (!peer_id) return;\n  console.log(\"Send offer to \" + peer_id);\n  return pc\n    .createOffer({ voiceActivityDetection: false })\n    .then(sdp => {\n      setAndSendLocalDescription(sdp);\n    })\n    .then(() => {\n      offer_sent = true;\n    })\n    .catch(error => {\n      console.error(\"Send offer failed: \", error);\n    });\n};\n\nconst sendAnswer = () => {\n  if (!peer_id) return;\n  console.log(\"Send answer to \" + peer_id);\n  return pc\n    .createAnswer({ voiceActivityDetection: false })\n    .then(sdp => {\n      setAndSendLocalDescription(sdp);\n    })\n    .then(() => {\n      answer_sent = true;\n    })\n    .catch(error => {\n      console.error(\"Send answer failed: \", error);\n    });\n};\n\nconst setAndSendLocalDescription = sdp => {\n  return pc\n    .setLocalDescription(sdp)\n    .then(() => {\n      send({\n        from_id: user_id,\n        to_id: peer_id,\n        type: sdp.type,\n        sdp: sdp\n      });\n    })\n    .catch(error => {\n      console.error(\"issue with setting local description: \", error);\n    });\n};\n\nconst handlePeerClick = e => {\n  peer_id = e.target.innerHTML;\n  sendOffer();\n};\n\n// REGISTER when connection opens\nwebsocket.on(\"open\", data => {\n  document.querySelector(\".yourId\").innerText = `your id: ${user_id}`;\n  send({ type: \"register\", user_id: user_id });\n  pc = createPeerConnection();\n});\n\n// when signaling server sends a message\nwebsocket.on(\"message\", data => {\n  data = JSON.parse(event.data);\n\n  switch (data.type) {\n    case \"count\":\n      countElement.innerText = `currently online: ${data.count}`;\n      console.log(Array.from(peersElement.children));\n\n      // clear all buttons\n      Array.from(peersElement.children).forEach(e => {\n        e.removeEventListener(\"click\", handlePeerClick);\n        peersElement.removeChild(e);\n      });\n\n      for (let i = 0; i < data.peers.length; i++) {\n        if (data.peers[i].user_id !== user_id) {\n          let btn = document.createElement(\"button\");\n          btn.innerHTML = data.peers[i].user_id;\n          btn.addEventListener(\"click\", handlePeerClick);\n          peersElement.appendChild(btn);\n        }\n      }\n\n      break;\n    case \"offer\":\n      console.log(\"receiving offer from \" + data.from_id, data);\n      peer_id = data.from_id;\n\n      pc.setRemoteDescription(data.sdp)\n        .then(() => {\n          sendAnswer();\n\n          if (!offer_sent) {\n            // localStream.getTracks().forEach(track => pc.addTrack(track, localStream));\n            navigator.mediaDevices\n              .getUserMedia({ audio: false, video: true })\n              .then(stream => {\n                localStream = stream;\n                document.getElementById(\"local-video\").srcObject = localStream;\n                stream.getTracks().forEach(track => pc.addTrack(track, stream));\n                started = true;\n              })\n              .catch(err => {\n                console.log(\"Error capturing stream.\", err);\n              });\n          }\n        })\n        .catch(error => console.error(error));\n      break;\n    case \"answer\":\n      console.log(\"received answer from \" + data.from_id, data);\n      peer_id = data.from_id;\n      pc.setRemoteDescription(data.sdp)\n        .then(() => {\n          \n        })\n        .catch(error => console.error(error));\n      break;\n    case \"candidate\":\n      pc.addIceCandidate(data.ice);\n      break;\n    default:\n      break;\n  }\n});\n\nconst send = data => {\n  websocket.send(JSON.stringify(data));\n};\n\nconst init = () => {\n  if (started) return;\n\n  document.querySelector(\".center\").innerText = \"\";\n\n  // pc = createPeerConnection();\n};\n\nconst drawOnCanvas = () => {};\n\nconst onWindowResize = e => {\n  canvas.width = window.innerWidth;\n  canvas.height = window.innerHeight;\n  drawOnCanvas();\n};\n\n// pc = createPeerConnection();\n\ndrawOnCanvas();\n\ndocument.addEventListener(\"click\", init, false);\nwindow.addEventListener(\"resize\", onWindowResize, false);\n\n\n//# sourceURL=webpack://etchy/./src/index.js?");

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