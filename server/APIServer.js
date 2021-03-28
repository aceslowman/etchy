const express = require("express");
const path = require("path");
const { createProxyMiddleware } = require('http-proxy-middleware');
const fs = require("fs");
const app = express(); 
const { nanoid } = require('nanoid');

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
  response.json({
    
  });
});



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

// Start the listener!
const listener = app.listen(port, () => {
  console.log("❇️ Express server is running on port", listener.address().port);
});
