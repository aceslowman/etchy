const http = require("http");
const express = require("express");
const ws = require("ws");

const app = express();

const server = http.createServer(app);
const wss = new ws.Server({ server });

class CandidateSignal {
  type: 'candidate' = 'candidate'
  constructor (public candidate: object | null) {}
}

class OfferSignal {
  type: 'offer' = 'offer'
  constructor (public sdp: string) {}
}

class ConnectionChunk {
  // signals = []// Array<OfferSignal | CandidateSignal>

  constructor (id, sdp) {
    this.signals = [new OfferSignal(sdp)]
  }
}

export default class WebSocketContext {
  userId?: string
  createdAt: number
  connectedPeers: {[connectionId: string]: WebSocketId} = {}
  pushQueue: ConnectionChunk[] = []
  pullQueue: string[] = []
  subs: number[] = []
  roomId: string
  constructor (roomId: string) {
    this.roomId = roomId
    this.createdAt = Date.now()
  }
}

const closeWRTC = (ws: UWebSocket) => {
  if (!ws.context) return
  const {userId, roomId, subs} = ws.context
  const redis = getPubSub()
  subs.forEach((subId) => redis.unsubscribe(subId))
  subs.length = 0
  if (userId) {
    redis.publish(`signal/room/${roomId}`, JSON.stringify({type: 'leaveSwarm', userId})).catch()
  }
  delete ws.context
}

const handleAccept = (ws: UWebSocket, payload: SwarmAccept) => {
  ws.context.connectedPeers[payload.id] = payload.userId
  sendSignal(ws, payload)
}

const handleAnswer = (ws: UWebSocket, payload: AnswerPayload) => {
  const to = ws.context.connectedPeers[payload.id]
  getPubSub()
    .publish(
      `signal/user/${to}`,
      JSON.stringify({
        type: 'pubToClient',
        payload
      })
    )
    .catch()
}

const handleCandidate = (ws: UWebSocket, payload: CandidatePayloadToServer) => {
  const {candidate, id} = payload
  const {context} = ws
  // if (!candidate) return
  const to = context.connectedPeers[id]
  if (to) {
    // the receiver is known
    getPubSub()
      .publish(
        `signal/user/${to}`,
        JSON.stringify({
          type: 'pubToClient',
          payload: {type: 'candidate', id, candidate}
        })
      )
      .catch()
    return
  }
  const existingChunk = context.pushQueue.find((connectionChunk) => connectionChunk.id === id)
  if (existingChunk) {
    existingChunk.signals.push(new CandidateSignal(candidate))
  }
}

let connections = new Map();

wss.on("connection", ws => {
  let id;

  ws.on("message", m => {
    let message = JSON.parse(m);
    // console.log(message);
    console.log('connections', connections)
    switch (message.type) {
      case "offer":
        console.log("OFFER", message.id);
        // send offer to all *other* peers        
        if(connections[message.id])
          connections[message.id].socket.send(JSON.stringify(message));
        // connections.forEach(con => {          
        //   // if (con.sid !== message.sid) {            
        //     con.socket.send(
        //       JSON.stringify(message)
        //     );
        //   // }
        // });
        break;
      case "answer":
        console.log("ANSWER", message.id);
        // send answer to all *other* peers\
        // console.log('connections', connections)
        if(connections[message.id])
          connections[message.id].socket.send(JSON.stringify(message));
        // connections.forEach(con => {
        //   // if (con.sid !== message.sid) {
        //     con.socket.send(
        //       JSON.stringify(message)
        //     );
        //   // }
        // });        
        break;
      case "candidate":
        console.log("CANDIDATE", message.id);
        // send ans5wer to all *other* peers
        // console.log('connections', connections)
        if(connections[message.id])
          connections[message.id].socket.send(JSON.stringify(message));        
        // connections.forEach(con => {
        //   // if (con.sid !== message.sid) {1
        //     con.socket.send(
        //       JSON.stringify(message)
        //     );
        //   // }
        // });
        break;
      case "init":
        console.log("initializing user", message.userId);
        id = message.userId;
        connections.set(id, {
          id: id,
          socket: ws
        });
        ws.send(JSON.stringify({type:'registered',id:id}));
        updateCount();
        break;
      default:
        connections.forEach(con => {
          // if (con.userId !== message.userId) {
            con.socket.send(JSON.stringify(message));
          // }
        });
        break;
    }
    
  });

  ws.on("close", () => {
    console.log("deleting connection", id);
    connections.delete(id);
    updateCount();
  });

  updateCount();
});

function updateCount() {
  connections.forEach(con => {
    con.socket.send(
      JSON.stringify({
        type: "count",
        count: connections.size,
        peers: Array.from(connections.values()).map(e => e.id)
      })
    );
  });
}

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
