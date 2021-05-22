// https://stackoverflow.com/questions/6860853/generate-random-string-for-div-id
function guidGenerator() {
  var S4 = function() {
    return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
  };
  return (
    S4() +
    S4() +
    "-" +
    S4() +
    "-" +
    S4() +
    "-" +
    S4() +
    "-" +
    S4() +
    S4() +
    S4()
  );
}

// https://stackoverflow.com/questions/6454198/check-if-a-value-is-within-a-range-of-numbers
function between(x, min, max) {
  return x >= min && x <= max;
}

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
      case "register":
        console.log("registering user", message.sid);
        id = message.sid;
        connections.set(id, {
          sid: id,
          socket: ws,
        });
        updateCount();
        break;
      case "offer":
        console.log("OFFER", message.sid);
        // send offer to all *other* peers
        connections.forEach(con => {          
          // if (con.sid !== message.sid) {            
            con.socket.send(
              JSON.stringify(message)
            );
          // }
        });
        break;
      case "answer":
        console.log("ANSWER", message.sid);
        // send answer to all *other* peers
        connections.forEach(con => {
          // if (con.sid !== message.sid) {
            con.socket.send(
              JSON.stringify(message)
            );
          // }
        });        
        break;
      case "candidate":
        console.log("CANDIDATE", message.sid);
        // send answer to all *other* peers
        connections.forEach(con => {
          // if (con.sid !== message.sid) {
            con.socket.send(
              JSON.stringify(message)
            );
          // }
        });
        break;
      default:
        console.log("message received without TYPE");
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
        peers: Array.from(connections.values()).map(e => e.sid)
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

app.get("/", function(request, response) {
  response.sendFile(__dirname + "/views/index.html");
});

const listener = server.listen(process.env.PORT, function() {
  console.log("Your app is listening on port " + listener.address().port);
});