import FriendlyWebSocket from "./FriendlyWebSocket";
import FastRTCSwarm from "@mattkrick/fast-rtc-swarm";

// const cam = await navigator.mediaDevices.getUserMedia({video: true, audio: false})
const socket = new FriendlyWebSocket({ path: "/" }).socket;

socket.addEventListener("open", () => {
  const swarm = new FastRTCSwarm();

  navigator.mediaDevices
    .getUserMedia({ audio: false, video: true })
    .then(stream => {
      console.log("got user media", stream);
      localStream = stream;
      started = true;
      // swarm.addStreams({ [user_id]: localStream.getTracks().tracks[0] });

      for (const track of localStream.getTracks()) {
        console.log("adding track to peer connection", track);
        // pc.addTrack(track, localStream);
        // swarm.addStreams({ [user_id]: track });
        swarm.addStreams(track);
      }
    })
    .catch(err => {
      console.log("Error capturing stream.", err);
    });

  // send the signal to the signaling server
  swarm.on("signal", signal => {
    console.log("signaling");
    socket.send(JSON.stringify(signal));
  });

  // when the signal come back, dispatch it to the swarm
  socket.addEventListener("message", event => {
    console.log("got a message", event.data);

    const payload = JSON.parse(event.data);

    switch (payload.type) {
      case "registered":
        console.log("registered", payload.userId);
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
    console.log("Add streaming element", event);
    const el = document.createElement("video");
    el.autoplay = true;
    el.controls = true; // TEMP

    if (event.streams && event.streams[0]) {
      el.srcObject = event.streams[0];
    } else {
      let inboundStream = new MediaStream(event.track);
      el.srcObject = inboundStream;
    }

    el.play();

    document.querySelector("#remoteStreams").appendChild(el);
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

const init = () => {
  if (started) return;

  //   document.querySelector(".center").innerText = "";

  //   navigator.mediaDevices
  //     .getUserMedia({ audio: false, video: true })
  //     .then(stream => {
  //       console.log("got user media", stream);
  //       localStream = stream;
  //       started = true;
  //     })
  //     .catch(err => {
  //       console.log("Error capturing stream.", err);
  //     });
};

const drawOnCanvas = () => {};

const onWindowResize = e => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  drawOnCanvas();
};

drawOnCanvas();

document.addEventListener("click", init, false);
window.addEventListener("resize", onWindowResize, false);
