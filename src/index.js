var swarm = require('webrtc-swarm');
var signalhub = require('signalhub');

var hub = signalhub('swarm-example', ['https://etchy.glitch.me'])

var sw = swarm(hub, {
  // wrtc: require('wrtc') // don't need this if used in the browser
})

sw.on('peer', function (peer, id) {
  console.log('connected to a new peer:', id)
  console.log('total peers:', sw.peers.length)
})

sw.on('disconnect', function (peer, id) {
  console.log('disconnected from a peer:', id)
  console.log('total peers:', sw.peers.length)
})