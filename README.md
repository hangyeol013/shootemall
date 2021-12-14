# Instructions

- Install latest version of Chrome (or Chrome Canary if it does not work) on your phone
- Verfy that WebXR is working by going to https://immersive-web.github.io/webxr-samples/immersive-ar-session.html
- On your main computer (we will suppose it is running on Linux), install `npm` and `node`
- `git clone` the repository and `cd` to it
- Run `npm install`
- Run `npm run init` to build the static website `dist` folder
- Run `npm start` to serve the website
- Retrieve your computer's ip address with `ip addr` or `ifconfig`
- On your phone, go to `https://enter.your.ip.address:8443` (do not forget the s in https and enter the correct port)
- Click on 'Start AR' and Voila!
- If it does not work, plug your phone to your computer, launch a chrome instance on your computer, go to the url `chrome://inspect`, find and click the corresponding tab, go to the console tab, buy a new phone and cry!

# Done

1) App
- basic server
  - READ THIS: https://binyamin.medium.com/creating-a-node-express-webpack-app-with-dev-and-prod-builds-a4962ce51334
- libraries
  - NodeJS: https://nodejs.org/en/about/
  - express: https://expressjs.com/en/starter/hello-world.html
  - webpack: https://webpack.js.org/ 
  - socket.io: https://socket.io/get-started/chat 
- Ask phone to take video of surroundings
  - SEE THIS: https://github.com/webrtc/samples/blob/gh-pages/src/content/getusermedia/record/js/main.js
  - take picture: https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Taking_still_photos#get_the_video
- Upload to server
- Render phone camera
- Basic UI


2) 3D content
- Using three.js https://threejs.org/examples/
- Load animated mesh
- Find mesh zombies:
  - Using Adobe Mixamo https://www.mixamo.com and the FBX file format (mesh + animations)
  - SEE THIS: https://threejs.org/examples/?q=fbx#webgl_loader_fbx

3) Scene reconstruction
  - WebXR depth API: https://github.com/immersive-web/webxr-samples/blob/main/proposals/phone-ar-depth-gpu.html, https://developer.mozilla.org/en-US/docs/Web/API/WebXR_Device_API/Spatial_tracking

4) AR content
- camera estimation
- lightning estimation

5) Logic Game
- Pathfinding: Dijkstra in heightmap
- Kill zombies: Raycasting 


# TODO

1) Add more logic: attack, die
2) Finish adding gun + rounds
3) Add more evolved UI
4) Fix not realistic object size + position?

# Organisation

- server (run on main computer)
  - https server (port 8443): uses express
  - websocket server (on top of https server): uses socket.io
- client
  - structure of webpage: html
  - layout, visual: css
  - code: js
    - record.js: handles the recording client-side
      - socket.io: chunk / 
    - ar.js: ar part (stack of balls)
  - main entrypoint: index.js
