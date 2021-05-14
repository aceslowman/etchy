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
          pitch: 0,
          pairedWith: null
        });
        updateCount();
        break;
      case "pitch":
        let con = connections.get(id);
        connections.set(id, { ...con, pitch: message.pitch });
        break;
      case "offer":
        console.log("OFFER", message);
        // send offer to all *other* peers
        connections.forEach(con => {          
          if (con.sid !== message.sid) {            
            con.socket.send(
              JSON.stringify(message)
            );
          }
        });
        break;
      case "answer":
        console.log("ANSWER", message);
        // send answer to all *other* peers
        connections.forEach(con => {
          if (con.sid !== message.sid) {
            con.socket.send(
              JSON.stringify(message)
            );
          }
        });        
        break;
      case "candidate":
        console.log("CANDIDATE", message);
        // send answer to all *other* peers
        connections.forEach(con => {
          if (con.sid !== message.sid) {
            con.socket.send(
              JSON.stringify(message)
            );
          }
        });
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

    // if it's already paired, check to see if the
    // pair has broken
    if (con.pairedWith !== null) {
      let conA = con;
      console.log("pairedWith", conA.pairedWith);
      let conB = connections.get(conA.pairedWith);

      // if(conB)
      let b = conB.pitch;
      let diff = Math.abs(b - a);
      let match = diff > tolerance; // if NOT within range
      console.log("diff", diff);

      if (match) {
        // mark both as paired...
        conA.pairedWith = null;
        conB.pairedWith = null;

        //A
        conA.socket.send(
          JSON.stringify({
            type: "pair"
          })
        );

        //B
        conB.socket.send(
          JSON.stringify({
            type: "unpair"
          })
        );
      }

    // otherwise, check unpaired
    } else if (con.pitch) {
      connections.forEach(_con => {
        // only check other connections (that are unpaired)
        if (_con.sid !== con.sid && _con.pitch && _con.pairedWith === null) {
          let b = _con.pitch;
          let diff = Math.abs(b - a);
          let match = diff < tolerance;

          if (match) {
            // mark both as paired...
            con.pairedWith = _con.sid;
            _con.pairedWith = con.sid;

            //A
            con.socket.send(
              JSON.stringify({
                type: "pair",
                pairWith: _con.sid,
                pair: [
                  { sid: con.sid, pitch: a },
                  { sid: _con.sid, pitch: b }
                ]
              })
            );

            //B
            _con.socket.send(
              JSON.stringify({
                type: "pair",
                pairWith: con.sid,
                pair: [
                  { sid: con.sid, pitch: a },
                  { sid: _con.sid, pitch: b }
                ]
              })
            );
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

app.use(express.static("public"));

app.get("/", function(request, response) {
  response.sendFile(__dirname + "/views/index.html");
});

const listener = server.listen(process.env.PORT, function() {
  console.log("Your app is listening on port " + listener.address().port);
});
