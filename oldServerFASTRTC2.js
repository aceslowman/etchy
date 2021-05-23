const http = require("http");
const express = require("express");
const ws = require("ws");

const app = express();

const server = http.createServer(app);
const wss = new ws.Server({ server });

class CandidateSignal {  
  constructor (sdp) {
    this.type = 'candidate';
    this.candidate = candidate;
  }
}

class OfferSignal {  
  constructor (sdp) {
    this.type = 'offer';
    this.sdp = sdp;
  }
}

class ConnectionChunk {
  constructor (id, sdp) {
    this.signals = [new OfferSignal(sdp)]
  }
}

export default class WebSocketContext {  
  constructor (roomId) {
    this.roomId = roomId
    this.createdAt = Date.now()
    this.userId = "";  
    this.connectedPeers = {}
    this.pushQueue = [];
    this.pullQueue = [];
    this.subs = [];  
  }
}

const closeWRTC = (ws) => {
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

const handleAccept = (ws, payload) => {
  ws.context.connectedPeers[payload.id] = payload.userId
  sendSignal(ws, payload)
}

const handleAnswer = (ws, payload) => {
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

const handleCandidate = (ws, payload) => {
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

// make the closure context as small as possible. there will be dozens of these. DOZENS
const handleMessage = (ws) => (data) => {
  handleSignal(ws, JSON.parse(data))
}

const handleInit = (ws, payload) => {
  const {userId, roomId} = payload

  // exit if a duplicate init payload is sent or not authorized
  if (ws.context.userId) return
  ws.context.userId = userId
  const ps = getPubSub()
  const onMessage = handleMessage(ws)
  ps.publish(
    `signal/room/${roomId}`,
    JSON.stringify({type: 'pubInit', userId, createdAt: ws.context.createdAt})
  ).catch()
  ps.subscribe(`signal/room/${roomId}`, onMessage)
    .then((subId) => ws.context.subs.push(subId))
    .catch()
  ps.subscribe(`signal/user/${userId}`, onMessage)
    .then((subId) => ws.context.subs.push(subId))
    .catch()
}

const handleLeave = (ws, payload) => {
  const {context} = ws
  // not sure how this occurred locally, but it did
  if (!context) return
  const {connectedPeers} = context
  const {userId} = payload
  const id = Object.keys(connectedPeers).find((id) => connectedPeers[id] === userId)
  if (!id) return
  delete connectedPeers[id]
  sendSignal(ws, {type: 'leaveSwarm', id})
}

const handleOffer = (ws, payload) => {
  const {id, sdp} = payload
  const {context} = ws
  const to = context.connectedPeers[id]
  if (to) {
    // the receiver is known
    getPubSub()
      .publish(
        `signal/user/${to}`,
        JSON.stringify({
          type: 'pubToClient',
          payload: {type: 'offer', id, sdp}
        })
      )
      .catch()
    return
  }
  const existingChunk = context.pushQueue.find((connectionChunk) => connectionChunk.id === id)
  if (existingChunk) {
    // the offer is just a piece of a larger connectionChunk
    existingChunk.signals.push(new OfferSignal(sdp))
    return
  }

  context.pushQueue.push(new ConnectionChunk(id, sdp))
  const requestor = context.pullQueue.pop()
  if (requestor) {
    const connectionChunk = context.pushQueue.pop();
    sendChunk(ws, connectionChunk, requestor)
  }
}

const handlePubInit = (ws, payload) => {
  const {context} = ws
  const {userId, createdAt} = payload
  if (userId === context.userId) {
    if (context.createdAt < createdAt) {
      // the publishing websocket used an id that was already taken, kick em out
      getPubSub()
        .publish(`signal/user/${userId}`, JSON.stringify({type: 'pubKickOut', createdAt}))
        .catch()
    }
    return
  }
  const connectionChunk = context.pushQueue.pop()
  if (!connectionChunk) {
    context.pullQueue.push(userId)
  } else {
    sendChunk(ws, connectionChunk, userId)
  }
  // for every successful init, resupply the offer buffer
  sendSignal(ws, {type: 'offerRequest'})
}

const handlePubKickOut = (ws, payload) => {
  if (ws.context.createdAt === payload.createdAt) {
    sendSignal(ws, {type: 'signal_error', message: 'Duplicate id'})
    ws.close(1006, 'Duplicate id')
  }
}

const handlePublishToClient = (ws, data) => {
  sendSignal(ws, data.payload)
}

const handlers = {
  init: handleInit,
  pubInit: handlePubInit,
  pubKickOut: handlePubKickOut,
  offer: handleOffer,
  pubToClient: handlePublishToClient,
  accept: handleAccept,
  answer: handleAnswer,
  candidate: handleCandidate,
  leaveSwarm: handleLeave,
  close: closeWRTC
};

const handleSignal = (ws, payload) => {
  const {type} = payload
  const handler = handlers[type]
  if (handler && ws.context) {
    handler(ws, payload)
  }
}

const sendChunk = (ws, connectionChunk, userId) => {
  const {id, signals} = connectionChunk
  sendSignal(ws, {type: 'offerAccepted', id, userId})
  getPubSub()
    .publish(
      `signal/user/${userId}`,
      JSON.stringify({type: 'accept', signals, id, userId: ws.context.userId})
    )
    .catch()
  // forward future connection requests to the peer
  ws.context.connectedPeers[id] = userId
}

const sendSignal = (socket, signal) => {
  socket.send(JSON.stringify({type: 'WRTC_SIGNAL', signal}))
}

const validateInit = (
  ws,
  payload,
  authToken
) => {
  if (payload.type === 'init') {
    if (ws.context) {
      closeWRTC(ws)
    }
    if (!authToken.tms.includes(payload.roomId)) {
      sendSignal(ws, {type: 'signal_error', message: 'Invalid room ID'})
      return false
    }
    ws.context = new WebSocketContext(payload.roomId)
  } else if (!ws.context) {
    sendSignal(ws, {type: 'signal_error', message: 'Payload sent before init'})
    return false
  }
  return true
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
