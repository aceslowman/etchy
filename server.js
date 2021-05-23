const http = require("http");
const express = require("express");
const ws = require("ws");

const swarm = require('webrtc-swarm');
const signalhub = require("signalhub");
const hub = signalhub('etchy', ['https://etchy.glitch.me']);

const app = express();

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

const server = http.createServer(app);
// const wss = new ws.Server({ server });

// let connections = new Map();

// wss.on("connection", ws => {
//   let id;

//   ws.on("message", m => {
//     let message = JSON.parse(m);
//     // console.log(message);
//     console.log('connections', connections)
//     switch (message.type) {
//       case "offer":
//         console.log("OFFER", message.id);
//         // send offer to all *other* peers        
//         if(connections[message.id])
//           connections[message.id].socket.send(JSON.stringify(message));
//         // connections.forEach(con => {          
//         //   // if (con.sid !== message.sid) {            
//         //     con.socket.send(
//         //       JSON.stringify(message)
//         //     );
//         //   // }
//         // });
//         break;
//       case "answer":
//         console.log("ANSWER", message.id);
//         // send answer to all *other* peers\
//         // console.log('connections', connections)
//         if(connections[message.id])
//           connections[message.id].socket.send(JSON.stringify(message));
//         // connections.forEach(con => {
//         //   // if (con.sid !== message.sid) {
//         //     con.socket.send(
//         //       JSON.stringify(message)
//         //     );
//         //   // }
//         // });        
//         break;
//       case "candidate":
//         console.log("CANDIDATE", message.id);
//         // send ans5wer to all *other* peers
//         // console.log('connections', connections)
//         if(connections[message.id])
//           connections[message.id].socket.send(JSON.stringify(message));        
//         // connections.forEach(con => {
//         //   // if (con.sid !== message.sid) {1
//         //     con.socket.send(
//         //       JSON.stringify(message)
//         //     );
//         //   // }
//         // });
//         break;
//       case "init":
//         console.log("initializing user", message.userId);
//         id = message.userId;
//         connections.set(id, {
//           id: id,
//           socket: ws
//         });
//         ws.send(JSON.stringify({type:'registered',id:id}));
//         updateCount();
//         break;
//       default:
//         connections.forEach(con => {
//           // if (con.userId !== message.userId) {
//             con.socket.send(JSON.stringify(message));
//           // }
//         });
//         break;
//     }
    
//   });

//   ws.on("close", () => {
//     console.log("deleting connection", id);
//     connections.delete(id);
//     updateCount();
//   });

//   updateCount();
// });

// function updateCount() {
//   connections.forEach(con => {
//     con.socket.send(
//       JSON.stringify({
//         type: "count",
//         count: connections.size,
//         peers: Array.from(connections.values()).map(e => e.id)
//       })
//     );
//   });
// }

function checkHttps(req, res, next) {
  if (req.get("X-Forwarded-Proto").indexOf("https") != -1) {
    return next();
  } else {
    res.redirect("https://" + req.hostname + req.url);
  }
}

app.all("*", checkHttps);

app.use(express.static("dist"));

const listener = server.listen(process.env.PORT, function() {
  console.log("Your app is listening on port " + listener.address().port);
});
