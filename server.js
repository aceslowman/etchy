// var server = require("http").createServer(),
//   WebSocketServer = require("ws").Server,
//   server = require("http").createServer(),
//   wss = new WebSocketServer({ server: server }),
//   express = require("express"),
//   app = express();

// // Client stuff
// app.use(express.static("public"));
// app.get("/", function(request, response) {
//   response.sendFile(__dirname + "/views/index.html");
// });

// // Server stuff
// wss.on("connection", function connection(ws) {
//   ws.on("message", function incoming(message) {
//     ws.send(message);
//   });
// });

// // Listen
// server.on("request", app);
// server.listen(process.env.PORT, function() {
//   console.log("Your app is listening on port " + server.address().port);
// });

const express = require('express');
const app = express();

var expressWs = require('express-ws')(app);
 
app.use(function (req, res, next) {
  console.log('middleware');
  req.testing = 'testing';
  return next();
});
 
app.get('/', function(req, res, next){
  console.log('get route', req.testing);
  res.end();
});
 
app.ws('/', function(ws, req) {
  ws.on('message', function(msg) {
    console.log(msg);
  });
  console.log('socket', req.testing);
});
 
app.listen(process.env.PORT);