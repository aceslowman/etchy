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
      case "REGISTER":
        console.log("registering user", message.uuid);
        id = message.uuid;
        connections.set(id, { uuid: id, socket: ws });
        updateCount();
        break;
      case "PITCH":
        let con = connections.get(id);
        connections.set(id, { ...con, pitch: message.pitch });
        break;
      case "OFFER":
        console.log("OFFER", message.sdp);
        break;
      case "ANSWER":
        console.log("ANSWER");
        break;
      case "CANDIDATE":
        console.log("CANDIDATE", message.candidate);
        break;
      default:
        console.log("message received without TYPE");
        break;
    }

    // check for any matching frequencies, within bounds
    checkForPairing();
  });

  ws.on("close", () => {
    console.log("deleting connection", id);
    connections.delete(id);
    updateCount();
  });

  updateCount();
});

function checkForPairing() {
  let tolerance = 50;
  // TODO: min pitch
  // TODO: max pitch

  connections.forEach(con => {
    let a = con.pitch;

    if (con.pitch) {
      connections.forEach(_con => {
        // only check other connections
        if (_con.uuid !== con.uuid) {
          if (_con.pitch) {
            let b = _con.pitch;
            let diff = Math.abs(b - a);
            let match = diff < tolerance;

            if (match) {
              // connections.forEach(con => {
                // mark both as paired...
                con.pairedWith = _con.uuid;
                _con.pairedWith = con.uuid;
                
                con.socket.send(
                  JSON.stringify({
                    type: "PAIRED",
                    pair: [
                      { uuid: con.uuid, pitch: a },
                      { uuid: _con.uuid, pitch: b } 
                    ]
                  })
                );
                
                _con.socket.send(
                  JSON.stringify({
                    type: "PAIRED",
                    pair: [
                      { uuid: con.uuid, pitch: a },
                      { uuid: _con.uuid, pitch: b } 
                    ]
                  })
                );
              // });
            }
            
            
            
          }
        }
      });
    }
  });
}

function updateCount() {
  connections.forEach(con => {
    con.socket.send(
      JSON.stringify({
        type: "COUNT",
        count: connections.size,
        peers: Array.from(connections.values()).map(e => e.uuid)
      })
    );
  });
}

app.use(express.static("public"));

app.get("/", function(request, response) {
  response.sendFile(__dirname + "/views/index.html");
});

const listener = server.listen(process.env.PORT, function() {
  console.log("Your app is listening on port " + listener.address().port);
});
