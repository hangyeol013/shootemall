import path from 'path'
import express from 'express'
import webpack from 'webpack'
import webpackDevMiddleware from 'webpack-dev-middleware'
import webpackHotMiddleware from 'webpack-hot-middleware'
import config from '../../webpack.dev.config.js'
import https from 'https'
import fs from 'fs'
import { Server } from "socket.io"
import compression from 'compression' 

// Express
// *******
const app = express()
const DIST_DIR = __dirname
const HTML_FILE = path.join(DIST_DIR, 'index.html')
const compiler = webpack(config)

app.use(webpackDevMiddleware(compiler, {
  publicPath: config.output.publicPath
}))
app.use(webpackHotMiddleware(compiler))

function shouldCompress (req, res) {
  if (req.headers['x-no-compression']) {
    return false
  }
  return compression.filter(req, res)
}

app.use(compression({ filter: shouldCompress }))

app.get('*', (req, res, next) => {
  compiler.outputFileSystem.readFile(HTML_FILE, (err, result) => {
  if (err) {
    return next(err)
  }
  res.set('content-type', 'text/html')
  res.send(result)
  res.end()
  })
})

// HTTPS
// *****

const privateKey  = fs.readFileSync('./certs/server.key', 'utf8');
const certificate = fs.readFileSync('./certs/server.crt', 'utf8');
const credentials = {key: privateKey, cert: certificate};

const httpsServer = https.createServer(credentials, app);

// Socket.io
// *********

const io = new Server(httpsServer);

io.on('connection', (socket) => {
  console.log('a user connected');
  var chunks = [];
  socket.on('chunk', (chunk) => {
    chunks.push(Buffer.from(chunk));
    console.log(`Chunk size=${chunk.byteLength}`)
  });
  socket.on('upload-video', () => {
    console.log(`Received n=${chunks.length} chunks`);
    // https://stackoverflow.com/questions/40137880/save-video-blob-to-filesystem-electron-node-js
    const buffer = Buffer.concat(chunks);
    console.log(`${buffer.length}`)
    fs.writeFile('output/recordings/video.webm', buffer, {}, (err, res) => {
        if(err){
            console.error(err)
            return
        }
        console.log('video saved')
    })
    chunks = []
  })
  socket.on('upload-screenshot', (data) => {
    console.log('image length:', data.length)

    let num = 1;
    while (fs.existsSync(`output/recordings/screen${num}.png`))
      ++num;

    fs.writeFile(`output/recordings/screen${num}.png`, data, {}, (err, res) => {
        if(err){
            console.error(err)
            return
        }
        console.log('image saved')
    })
  })

  socket.on('disconnect', () => {
    console.log('user disconnected');
  });
});

// Run

httpsServer.listen(8443, () => {
  console.log(`App listening to 8443....`)
  console.log('Press Ctrl+C to quit.')
})
