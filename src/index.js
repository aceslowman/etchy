import FriendlyWebSocket from './FriendlyWebSocket';
import FastRTCSwarm from '@mattkrick/fast-rtc-swarm';

const socket = new FriendlyWebSocket({ path: "/" }).socket;

socket.addEventListener('open', () => {
  const swarm = new FastRTCSwarm();
  
  navigator.mediaDevices
    .getUserMedia({ audio: false, video: true })
    .then(stream => {
      console.log("got user media", stream);
      localStream = stream;
      started = true;
      swarm.addStreams(localStream);
    })
    .catch(err => {
      console.log("Error capturing stream.", err);
    });
  
  // send the signal to the signaling server
  swarm.on('signal', (signal) => {
    socket.send(JSON.stringify(signal))
  })
  // when the signal come back, dispatch it to the swarm
  socket.addEventListener('message', (event) => {
    console.log('got a message', event.data)
    
    const payload = JSON.parse(event.data)    
    
    switch(payload.type) {
      case 'registered':
        console.log('registered', payload.userId)
        break;
      default:
        swarm.dispatch(payload);    
    }    
  })
  // when the connection is open, say hi to your new peer
  swarm.on('dataOpen', (peer) => {
    console.log('data channel open!')
    peer.send('hi')
  })
  // when your peer says hi, log it
  swarm.on('data', (data, peer) => {
    console.log('data received', data, peer)
  })
  // fired when a peer creates or updates an audio/video track.   
  swarm.on('stream', (stream, peer) => {
    console.log('a stream has been updated or created')
    const el = document.getElementById('video')
    el.srcObject = stream
  })
})

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

  document.querySelector(".center").innerText = "";

  navigator.mediaDevices
    .getUserMedia({ audio: false, video: true })
    .then(stream => {
      console.log("got user media", stream);
      localStream = stream;
      started = true;
    })
    .catch(err => {
      console.log("Error capturing stream.", err);
    });
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
