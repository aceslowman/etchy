const http = require("http");
const express = require("express");
const path = require("path");
const { createProxyMiddleware } = require('http-proxy-middleware');
const fs = require("fs").promises;
const WebSocket = require("ws");
const markdownit = require("markdown-it")();
const {nanoid} = require("nanoid");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server: server });

function checkHttps(req, res, next){
  // protocol check, if http, redirect to https
  
  if(req.get('X-Forwarded-Proto').indexOf("https")!=-1){
    return next()
  } else {
    res.redirect('https://' + req.hostname + req.url);
  }
}

app.all("*", checkHttps);

// Renders the README as HTML
// app.get("/", async (request, response) => {
//   const handle = await fs.open(path.join(__dirname, 'README.md'), 'r')
//   try {
//     const contents = await handle.readFile('utf-8')
//     const html = markdownit.render(contents)
//     response.send(html);
//   } finally {
//     handle.close()
//   }
// });

class Clients {
  constructor() {
    this.clientList = {};
    this.saveClient = this.saveClient.bind(this);
  }
  
  saveClient(username, client){
    this.clientList[username] = client;
  }
}

const clients = new Clients(); 
 
app.use(express.static('client'));

app.get("/", async (request, response) => {
  const handle = await fs.open(path.join(__dirname, "public/index.html"), "r");

  try {
    const contents = await handle.readFile("utf-8");
    response.send(contents);
  } finally {
    handle.close();
  }
});

wss.on("connection", function connection(ws) {
  function handleRegistration(config) {
    console.log("handle registration", config);
    
    // add user to list
    clients.saveClient(config.nickname, ws);

    ws.send(JSON.stringify({uuid: nanoid(), message: "you are registering!", ...config}));
    
    console.log('client list:', Object.keys(clients.clientList))
  }

  ws.on("message", function incoming(m) {
    let message = JSON.parse(m);
    // ws.send('reply: ' + message)

    switch (message.type) {
      case "REGISTER":
        handleRegistration(message);
        break;
    }
  });

  ws.send(JSON.stringify({ message: "something" }));
});

server.listen(process.env.PORT);

// Express port-switching logic
let port;
console.log("❇️ NODE_ENV is", process.env.NODE_ENV);
if (process.env.NODE_ENV === "production") {
  port = process.env.PORT || 3000;
  app.use(express.static(path.join(__dirname, "../build")));
  app.use(express.static(path.join(__dirname, "../public")));
  app.get("*", (request, response) => {
    response.sendFile(path.join(__dirname, "../build", "index.html"));
  });
} else {
  port = 3001;
}

const listener = app.listen(port, () => {
  console.log("❇️ Express server is running on port", listener.address().port);
});
