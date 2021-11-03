// https://blog.logrocket.com/websockets-tutorial-how-to-go-real-time-with-node-and-react-8e4693fbf843/

console.log('Started server')

const http = require('http');
// Spinning the http server and the websocket server.

const requestListener = function (req, res) {
  console.log('new connection');
    res.writeHead(200);
    res.end("My first server!");
};

const server = http.createServer(requestListener);

const port = 8001;
// bug: do not specify host
server.listen(port);
