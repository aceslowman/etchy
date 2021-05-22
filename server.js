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
    console.log("check here", message);

    switch (message.type) {
      case "init":
        console.log("initializing user", message.userId);
        id = message.userId;
        connections.set(id, {
          userId: id,
          socket: ws
        });
        ws.send(JSON.stringify({type:'registered',userId:id}));
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
        peers: Array.from(connections.values()).map(e => e.userId)
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
