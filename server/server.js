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

const http = require("http");
const express = require("express");
const ws = require("ws");

const app = express();

const server = http.createServer(app);
const wss = new ws.Server({ server });

let connections = new Map();

wss.on("connection", function connection(ws) {
  let id = guidGenerator();
  connections.set(id, { uuid: id, socket: ws });

  ws.on("message", function incoming(m) {
    let message = JSON.parse(m);

    switch (message.type) {
      case "PITCH":
        console.log("pitch", message);
        let con = connections.get(id);
        connections.set(message.uuid, { ...con, pitch: message.pitch });
        break;
      case "REGISTER": 
        console.log("register", message);
        break;
      default:
        console.log("message received without TYPE");
        break;
    }
  });

  ws.on("close", function() { 
    console.log('deleting connection')
    connections.delete(id); 
    updateCount();
  });

  updateCount();
});

function updateCount() {
  connections.forEach(con => {
    con.socket.send(
      JSON.stringify({
        type: "COUNT",
        count: connections.size
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
