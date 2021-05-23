import FriendlyWebSocket from "./FriendlyWebSocket";
import FastRTCSwarm from "@mattkrick/fast-rtc-swarm";

// const cam = await navigator.mediaDevices.getUserMedia({video: true, audio: false})
const socket = new FriendlyWebSocket({ path: "/" }).socket;
// const socket = new WebSocket('wss://etchy.glitch.me/');

socket.addEventListener("open", () => {
  navigator.mediaDevices
    .getUserMedia({ audio: false, video: true })
    .then(stream => {
      const swarm = new FastRTCSwarm();

      console.log("got user media", stream);
      localStream = stream;
      started = true;

      swarm.on("signal", signal => {
        console.log('sending signal', signal)
        socket.send(JSON.stringify(signal));
      });

      socket.addEventListener("message", event => {        
        const payload = JSON.parse(event.data);
        console.log("got a message", payload);

        switch (payload.type) {
          case "registered":
            document.querySelector(".yourId").innerText = `your id: ${payload.id}`;
            user_id = payload.id;
            console.log("registered", payload.id);
            for (const track of localStream.getTracks()) {
              console.log("adding track to peer connection", track);
              swarm.addStreams({ track });
            }
            break;
          case "count":
            console.log('message', payload)
            document.querySelector(
              ".count"
            ).innerText = `currently online: ${payload.count}`;
            document.querySelector(
              ".peers"
            ).innerText = `currently online: [${payload.peers}]`;
            break;
          default:
            swarm.dispatch(payload);
        }
      });

      // when the connection is open, say hi to your new peer
      swarm.on("dataOpen", peer => {
        console.log("data channel open!");
        peer.send("hi");
      });

      // when your peer says hi, log it
      swarm.on("data", (data, peer) => {
        console.log("data received", data, peer);
      });

      // fired when a peer creates or updates an audio/video track.
      swarm.on("stream", (stream, peer) => {
        console.log("Add streaming element", stream);
        //         const el = document.createElement("video");
        //         el.autoplay = true;
        //         el.controls = true; // TEMP

        //         if (event.streams && event.streams[0]) {
        //           el.srcObject = event.streams[0];
        //         } else {
        //           let inboundStream = new MediaStream(event.track);
        //           el.srcObject = inboundStream;
        //         }

        //         el.play();

        //         document.querySelector("#remoteStreams").appendChild(el);
      });

      swarm.on("error", (error, peer) => {
        console.error(error);
      });
    
      swarm.on('connection', (stream, peer) => {
        console.log('connection change', peer)
      })
    })
    .catch(err => {
      console.log("Error capturing stream.", err);
    });
});

let user_id;
let peers = {};
let pendingCandidates = {};
let localStream;

let started = false;

let canvas = document.getElementById("mainCanvas");
let ctx = canvas.getContext("2d");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const send = data => {
  socket.send(JSON.stringify(data));
};

// const init = () => {
//   if (started) return;

//   //   document.querySelector(".center").innerText = "";

//   //   navigator.mediaDevices
//   //     .getUserMedia({ audio: false, video: true })
//   //     .then(stream => {
//   //       console.log("got user media", stream);
//   //       localStream = stream;
//   //       started = true;
//   //     })
//   //     .catch(err => {
//   //       console.log("Error capturing stream.", err);
//   //     });
// };

const drawOnCanvas = () => {};

const onWindowResize = e => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  drawOnCanvas();
};

drawOnCanvas();

// document.addEventListener("click", init, false);
window.addEventListener("resize", onWindowResize, false);
