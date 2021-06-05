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

// Download the helper library from https://www.twilio.com/docs/node/install
// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = require("twilio")(accountSid, authToken);

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
        console.log("registering user", message.user_id);

        // gets a username, password, and array of iceServers
        client.tokens.create().then(token => {
          // first, set up connection
          id = message.user_id;
          connections.set(id, {
            user_id: id,
            peer_id: null,
            socket: ws,
            paired: false
          });
          updateCount();

          // now inform user of their creds
          let { username, pw, iceServers } = token;
          connections
            .get(id)
            .socket.send(
              JSON.stringify({ type: "authenticate", username, pw, iceServers })
            );

          console.log(token);
        });

        break;

      case "offer":
        console.log("OFFER", [message.from_id, message.to_id]);
        if (connections.get(message.to_id)) {
          connections.get(message.to_id).peer_id = message.from_id;
          connections.get(message.to_id).socket.send(JSON.stringify(message));
        }

        break;
      case "answer":
        console.log("ANSWER", [message.from_id, message.to_id]);
        if (connections.get(message.to_id)) {
          connections.get(message.to_id).peer_id = message.from_id;
          connections.get(message.to_id).paired = true;
          connections.get(message.to_id).socket.send(JSON.stringify(message));
        }

        break;
      case "candidate":
        console.log("CANDIDATE", [message.from_id, message.to_id]);
        if (connections.get(message.to_id)) {
          connections.get(message.to_id).socket.send(JSON.stringify(message));
        }

        break;
      case "rejectOffer":
        console.log("REJECTOFFER", [message.from_id, message.to_id]);
        if (connections.get(message.to_id)) {
          connections.get(message.to_id).peer_id = undefined;
          connections.get(message.to_id).paired = false;
          connections.get(message.to_id).socket.send(JSON.stringify(message));
        }

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
        peers: Array.from(connections.values())
          .filter(a => !a.paired)
          .map(e => ({
            user_id: e.user_id,
            peer_id: e.peer_id
          }))
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
