const http = require('http');
const express = require('express');
const ws = require('ws');

const app = express();

const server = http.createServer(app);
const wss = new ws.Server({ server });

// we're using an ES2015 Set to keep track of every client that's connected
// let sockets = new Set();
let connections = new Map();

wss.on('connection', function connection(ws) {
  // console.log('ws', ws)
  // sockets.add({
  //   socket: ws
  // });

  ws.on('message', function incoming(m) {
    let message = JSON.parse(m); 
    
    
    switch(message.type) {
      case 'PITCH':
        console.log('pitch', message);
        
        break;
      case 'REGISTER':
        console.log('register', message);
        break;
      default:
        console.log('message received without TYPE')
        break;
    }
    
    // console.log(sockets)
  });
  
  ws.on('close', function () {
    // connections.delete(ws);
    // tell everyone a client left
    updateCount();
  });
  
  // tell everyone a client joined
  updateCount();
});

function updateCount() {
  // send an updated client count to every open socket.
  // sockets.forEach(ws => ws.send(JSON.stringify({
  //   type: 'COUNT',
  //   count: sockets.size
  // })));
}
 
// http://expressjs.com/en/starter/static-files.html
app.use(express.static('public'));

// http://expressjs.com/en/starter/basic-routing.html
app.get('/', function(request, response) {
  response.sendFile(__dirname + '/views/index.html');
});

// listen for requests!
const listener = server.listen(process.env.PORT, function() {
  console.log('Your app is listening on port ' + listener.address().port);
});
