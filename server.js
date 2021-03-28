const express = require("express");
const app = express();

const { nanoid } = require('nanoid');
const WebSocket = require('ws');
// make all the files in 'public' available
// https://expressjs.com/en/starter/static-files.html
app.use(express.static("public")); 

const wss = new WebSocket.Server({ port: 3000 });

wss.on('connection', function connection(ws) {
  ws.on('message', function incoming(data) {
    wss.clients.forEach(function each(client) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  });
});

function checkHttps(req, res, next){
   // protocol check, if http, redirect to https
  if(req.get('X-Forwarded-Proto').indexOf("https")!=-1){
    return next()
  } else {
    res.redirect('https://' + req.hostname + req.url);
  }
} 

app.all("*", checkHttps);

// A test route to make sure the server is up.
app.get("/api/data", (request, response) => {
  console.log("❇️ Received GET request to /api/data");
  response.json({"message": "hello world"});
});

app.get("/api/shaders", (request, response) => {
  // response.json(shader_collection);
});

app.get("/api/sphere/info", (request, response) => {
  response.json({
    name: 'test sphere',
    size: 0,
    
  });
});

app.get("/api/members", (request, response) => {
  response.json([{
     
  }]);
});

app.get("/api/member", (request, response) => {
  response.json({
    // uuid: 
    // nickname:
    // address:   // inherit from a 'node' class
  });
});

app.get("/api/garden", (request, response) => {
  response.json({
    // uuid:
    // nickname:
    // address:   // inherit from a 'node' class
    // size:  
  });
});
// listen for requests :)
// const listener = app.listen(process.env.PORT, () => {
//   console.log("Your app is listening on port " + listener.address().port);
// });
