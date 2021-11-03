// https://blog.logrocket.com/websockets-tutorial-how-to-go-real-time-with-node-and-react-8e4693fbf843/


console.log('Started server')

var http = require('http');
var https = require('https');
var fs = require('fs');
var WebSocketServer = require('websocket').server;

const keyFilePath = "/etc/ssl/private/apache-selfsigned.key";
const certFilePath = "/etc/ssl/private/apache-selfsigned.crt";

var httpsOptions = {
    key: null,
    cert: null
  };
  
  try {
    httpsOptions.key = fs.readFileSync(keyFilePath);
    try {
      httpsOptions.cert = fs.readFileSync(certFilePath);
    } catch(err) {
      httpsOptions.key = null;
      httpsOptions.cert = null;
    }
  } catch(err) {
    httpsOptions.key = null;
    httpsOptions.cert = null;
  }
  
  // If we were able to get the key and certificate files, try to
  // start up an HTTPS server.
  
  var webServer = null;
  
  try {
    if (httpsOptions.key && httpsOptions.cert) {
      webServer = https.createServer(httpsOptions, handleWebRequest);
    }
  } catch(err) {
    webServer = null;
  }
  
  if (!webServer) {
    try {
      webServer = http.createServer({}, handleWebRequest);
    } catch(err) {
      webServer = null;
      console.log(`Error attempting to create HTTP(s) server: ${err.toString()}`);
    }
  }
  
  
  // Our HTTPS server does nothing but service WebSocket
  // connections, so every request just returns 404. Real Web
  // requests are handled by the main server on the box. If you
  // want to, you can return real HTML here and serve Web content.
  
  function handleWebRequest(request, response) {
    console.log ("Received request for " + request.url);
    response.writeHead(404);
    response.end();
  }
  
  // Spin up the HTTPS server on the port assigned to this sample.
  // This will be turned into a WebSocket port very shortly.
  
  webServer.listen(6503, function() {
    console.log("Server is listening on port 6503");
  });
  
  // Create the WebSocket server by converting the HTTPS server into one.
  
  var wsServer = new WebSocketServer({
    httpServer: webServer,
    autoAcceptConnections: false
  });
  
  if (!wsServer) {
    console.log("ERROR: Unable to create WbeSocket server!");
  }
  
  // Set up a "connect" message handler on our WebSocket server. This is
  // called whenever a user connects to the server's port using the
  // WebSocket protocol.
  
  wsServer.on('request', function(request) {
    // Accept the request and get a connection.
    // Do stuff
    console.log('Hello')

    // Set up a handler for the "message" event received over WebSocket. This
    // is a message sent by a client, and may be text to share with other
    // users, a private message (text or signaling) for one user, or a command
    // to the server.
  
    connection.on('message', function(message) {
    });
  
    // Handle the WebSocket "close" event; this means a user has logged off
    // or has been disconnected.
    connection.on('close', function(reason, description) {
    });
  });
