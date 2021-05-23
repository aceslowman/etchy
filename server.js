const http = require("http");
const express = require("express");
const ws = require("ws");

const app = express();

const server = http.createServer(app);
const wss = new ws.Server({ server });

let connections = new Map();

wss.on("connection", ws => {
  let id;

  ws.on("message", m => {
    let message = JSON.parse(m);
    
    switch (message.type) {
      case "offer":
        console.log("OFFER", message);
        // send offer to all *other* peers
        console.log('connections', connections)
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
        console.log("ANSWER", message);
        // send answer to all *other* peers\
        console.log('connections', connections)
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
        console.log("CANDIDATE", message);
        // send ans5wer to all *other* peers
        console.log('connections', connections)
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
        console.log("initializing user", message);
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
