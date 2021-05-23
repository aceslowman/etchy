const http = require("http");
const express = require("express");
const ws = require("ws");

const signalhub = require("signalhub");
const hub = signalhub('etchy', ['https://etchy.glitch.me:3000']);

hub.subscribe('etchy')
  .on('data', function (message) {
    console.log('new message received', message)
  })

hub.broadcast('etchy', {hello: 'world'})

const app = express();

const server = http.createServer(app);

function checkHttps(req, res, next) {
  if (req.get("X-Forwarded-Proto").indexOf("https") != -1) {
    return next();
  } else {
    res.redirect("https://" + req.hostname + req.url);
  }
}

app.all("*", checkHttps);

app.use(express.static("dist"));

const listener = server.listen(process.env.PORT, function() {
  console.log("Your app is listening on port " + listener.address().port);
});
