const http = require("http");
const express = require("express");
const path = require("path");
const fs = require("fs").promises;
const WebSocket = require("ws");
const markdownit = require("markdown-it")();
const {nanoid} = require("nanoid");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server: server });

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
  const handle = await fs.open(path.join(__dirname, "client/index.html"), "r");

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
