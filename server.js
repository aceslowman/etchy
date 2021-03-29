var server = require("http").createServer(),
  WebSocketServer = require("ws").Server,
  server = require("http").createServer(),
  wss = new WebSocketServer({ server: server }),
  express = require("express"),
  app = express();

// Client stuff
app.use(express.static("public"));
app.get("/", function(request, response) {
  response.sendFile(__dirname + "/views/index.html");
});

// Server stuff
wss.on("connection", function connection(ws) {
  ws.on("message", function incoming(message) {
    ws.send(message);
  });
});

// Listen
server.on("request", app);
server.listen(process.env.PORT, function() {
  console.log("Your app is listening on port " + server.address().port);
});
