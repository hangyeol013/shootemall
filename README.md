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

https://github.com/immersive-web/webxr-samples/blob/main/proposals/phone-ar-depth-gpu.html
https://developer.mozilla.org/en-US/docs/Web/API/WebXR_Device_API/Spatial_tracking
3) 3D content
- Using three.js https://threejs.org/examples/
- Load animated mesh
- Find mesh zombies:
  - Using Adobe Mixamo https://www.mixamo.com and the FBX file format (mesh + animations)
  - SEE THIS: https://threejs.org/examples/?q=fbx#webgl_loader_fbx
# TODO

2) 3D reconstruction
- Implement the Atlas or equivalent scene reconstruction
- Integrate to app: send to phone

3) 3D content
- Find meshes, sounds
- Add lightning, mesh, animation, sound effects, ...
  
4) AR content
- camera estimation
- lightning estimation

5) Logic Game
- Logic zombies: move around
- Logic shooting


# Planning

Week 0: getting started
Week 1: upload + phone camera done
Week 2: reconstruction done? (or algo)
Week 3: Threejs + basic mesh rendering
Week 4: Logic + app


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


# Scene reconstruction


- Tried SfM: Colmap, too slow
- Tried Stereo reconstruction: stereo.py