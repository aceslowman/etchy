const http = require("http");
const express = require("express");
const path = require("path");
const fs = require("fs").promises;
const WebSocket = require("ws");
const markdownit = require("markdown-it")();

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

app.get("/", async (request, response) => {
  const handle = await fs.open(path.join(__dirname, "index.html"), "r");

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

    ws.send(JSON.stringify(config);
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
