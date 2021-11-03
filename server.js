// https://blog.logrocket.com/websockets-tutorial-how-to-go-real-time-with-node-and-react-8e4693fbf843/


console.log('Started server')

const http = require('http');
const fs = require('fs');

const requestListener = function (req, res) {
  console.log('new connection');
    res.writeHead(200);
    fs.createReadStream('index.html').pipe(res)
};

const port = 8000;

const server = http.createServer(requestListener);
server.listen(port)
