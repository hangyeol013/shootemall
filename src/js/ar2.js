import * as THREE from 'three';

import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { XREstimatedLight } from 'three/examples/jsm/webxr/XREstimatedLight.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

import {mat4, vec3, mat3, vec2} from 'gl-matrix';
import {CanvasUI} from '../jsm/CanvasUI';
import { ARButton } from '../jsm/ARButton';
//import { nearestPowerOfTwo } from 'three/src/math/MathUtils';
import {Player} from '../jsm/Player';
import socket from './websocket';
import * as PriorityQueue from 'js-priority-queue';
import { ceilPowerOfTwo } from 'three/src/math/MathUtils';

const near = 0.05, far = 20;
const depth_resolution = 30;
function calculateVerticesFromViewCoordinatesSupersampled(depthData, viewport, camera) {
    const viewport_width = viewport.width;
    const viewport_height = viewport.height;

    const resolution_x = viewport_width / depth_resolution;
    const resolution_y = viewport_height / depth_resolution;

    const vertices_data = [];
    const depths_data = [];
    for(let x = 0; x < viewport_width; x = x + resolution_x) {
      for(let y = 0; y < viewport_height; y = y + resolution_y) {
        let nx = x/viewport_width;
        let ny = y/viewport_height;
        const depth = depthData.getDepthInMeters(nx, ny); // normalized
        let dir = new THREE.Vector3();
        dir.set(2.0*nx-1,1-2.0*ny, 0.5).unproject(camera).sub(camera.position);
        let point_ndc = dir.normalize().multiplyScalar(depth+near).add(camera.position);
        vertices_data.push(point_ndc);
        depths_data.push(depth);
      }
    }

    return [vertices_data, depths_data];
}

function dataURLtoBlob(dataurl) {
    var arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
        bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
    while(n--){
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], {type:mime});
  }

class App{
	constructor(){
		const container = document.createElement( 'div' );
		document.body.appendChild( container );
        
        this.clock = new THREE.Clock();
        
		this.camera = new THREE.PerspectiveCamera (70, window.innerWidth / window.innerHeight, near, far );
		this.scene = new THREE.Scene();
		this.scene.add( new THREE.HemisphereLight( 0x606060, 0x404040 ) );

        const light = new THREE.DirectionalLight( 0xffffff );
        light.position.set( 1, 1, 1 ).normalize();
		this.scene.add( light );
			
		this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true } );
		this.renderer.setPixelRatio( window.devicePixelRatio );
		this.renderer.setSize( window.innerWidth, window.innerHeight );
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        
		container.appendChild( this.renderer.domElement );
        
        //this.controls = new OrbitControls( this.camera, this.renderer.domElement );
        //this.controls.target.set(0, 3.5, 0);
        //this.controls.update();
        
        this.initScene();
        this.createUI();
        this.setupXR();
        this.generateGrid();
        this.renderer.setAnimationLoop( this.render.bind(this) );
        this.i = 0;

        window.addEventListener('resize', this.resize.bind(this) );
	}	

    spawnPortals(count) {
        const vertices = this.gridVertices;
        const self = this;
        function randomCell() {
            const position = Math.floor(self.gridVertices.count * Math.random());
            return position;
        }
        for(let i = 0; i < count; i++) {
            const reticle = new THREE.Mesh(
                new THREE.RingBufferGeometry(0.15,0.2,32).rotateX(-Math.PI/2),
                new THREE.MeshBasicMaterial()
            );
            let coord = randomCell();
            while(this.gridSamplesCount[coord] < 100 && vertices.getY(coord) > this.yFloor + 1)
                coord = randomCell();
            let position = this.cell_to_position(coord);
            reticle.position.set(position.x, position.y, position.z);
            this.portalPositions.push(position);
            this.portalReticles.push(reticle);
            this.scene.add(reticle);
        }
        console.log("Spawned portals")
    }

    spawnZombies(delta) {
        this.zombiePerPortalFreq = 0.02;
        const portalCount = this.portalPositions.length;
        for(let i = 0; i < portalCount; i++) {
            const p = Math.min(this.zombiePerPortalFreq * delta, 0.1)
            if(Math.random() <= p) {
                this.spawnZombie(this.portalPositions[i]);
            }
        }
    }

    cell_to_position(cell) {
        const x = cell%this.gridResolution, z = (cell-x)/this.gridResolution;
        return new THREE.Vector3(x/this.gridNumSquare - this.gridSize/2, this.gridVertices.getY(cell), z/this.gridNumSquare - this.gridSize/2);
    }

    position_to_cell(pos) {
        let x = Math.round((pos.x+this.gridSize/2)*this.gridNumSquare), z = Math.round((pos.z+this.gridSize/2)*this.gridNumSquare);
        if(x < 0 || x >= this.gridResolution || z < 0 || z >= this.gridResolution)
            return -1;
        return x+z*this.gridResolution;
    }

    update_gradientfield() {
        const vertices = this.gridVertices;
        const maxHeightDiff = 0.5;
        const n = vertices.count;
        for(let i = 0; i < n; i++)
            this.distanceField[i] = -1, this.gradientField[i] = new THREE.Vector3(0,0,0);
        
        const gridStep = 1.0/this.gridNumSquare;
        const self = this;
        const queue = new PriorityQueue({
            comparator: function(a,b) { return -(self.distanceField[b]-self.distanceField[a]); }
        });

        const u0 = this.position_to_cell(this.camera.position);
        this.distanceField[u0] = 0, this.gradientField[u0] = new THREE.Vector3(0,0,0);
        queue.queue(u0);

        while(queue.length != 0) {
            let u = queue.dequeue();
            const pos = this.cell_to_position(u);
            for(let dx = -1; dx <= 1; dx++) {
                for(let dz = -1; dz <= 1; dz++) {
                    let v = this.position_to_cell(new THREE.Vector3(pos.x+dx*gridStep, 0, pos.z+dz*gridStep));
                    if(v < 0)
                        continue;
                    if(this.distanceField[v] < 0 && vertices.getY(v) <= this.yFloor + 1 && this.gridSamplesCount[v] >= 5)
                        this.distanceField[v] = this.distanceField[u]+1, queue.queue(v), this.gradientField[v] = new THREE.Vector3(-dx, 0, -dz).normalize();
                }
            }
        }

        /*for(let i = 0; i < n; i++) {
            vertices.setY(i, this.distanceField[i]/1000), this.gridSamplesCount[i] = 100;
        }
        this.updateGridColors()*/
    }

    update_pathfinding() {
        const gridStep = 1.0/this.gridNumSquare;

        for(const zombie of this.zombies) {
            //const dist = this.camera.position.distanceTo(zombie.position);
            let position = this.gradientField[this.position_to_cell(zombie.object.position)].clone(), position2 = position.clone();
            position2.multiplyScalar(zombie.speed*gridStep).add(zombie.object.position);
            zombie.calculatedPath = [position2];
            zombie.setTargetDirection();

            //zombie.object.position.setY(this.gridVertices.getY(this.position_to_cell(zombie.object.position)));
        }
    }

    initShoot() {
        this.maxCartridges = 20;
        this.reloadTime = 3;

        this.nCartridges = this.maxCartridges;
        this.reloading = false;
        this.lastReload = performance.now(); // ms
        this.nKilled = 0;
    }

    onShoot() {
        if(this.nCartridges > 0)
            this.nCartridges -= 1;
    }

    updateShoot() {
        if(this.reloading && (performance.now()-this.lastReload) >= this.reloadTime) {
            this.reloading = false;
            this.nCartridges = this.maxCartridges;
            console.log('Reloaded');
        }
    }


    generateGrid() {
        this.isConstructing = true;
        this.gridSize = 30;
        this.gridNumSquare = 4;
        this.gridResolution = this.gridSize*this.gridNumSquare;
        const geometry = new THREE.PlaneBufferGeometry( this.gridSize, this.gridSize, this.gridResolution-1, this.gridResolution-1);
        this.gridGeometry = geometry;
        this.gridVertices = this.gridGeometry.attributes.position;
        this.yFloor = 0;

        const vertices = this.gridVertices;
        const n = vertices.count;
        for(let i = 0; i < n; i++) {
            vertices.setZ(i, -vertices.getY(i));
            vertices.setY(i, 0);
        }

        this.gridSamplesSum = new Float32Array(n);
        this.distanceField = new Float32Array(n);
        this.gradientField = new Array(n);
        
        this.gridSamplesCount = new Int32Array(n);
        for(let i = 0; i < n; i++)
            this.gridSamplesSum[i] = 0, this.gridSamplesCount[i] = 0, this.gradientField[i] = new THREE.Vector3(0,0,0), this.distanceField[i] = 0;

        this.updateGridColors();

        const material = new THREE.MeshPhongMaterial( {
            color: 0xffffff,
            flatShading: true,
            vertexColors: true,
            shininess: 0
        } );
        const plane = new THREE.Mesh( this.gridGeometry, material );
        plane.position.set(0, -2, 0);
        //plane.position.set(0, 0, -8);
        this.gridMesh = plane;
        this.scene.add( plane );
        this.gridMesh.visible = this.isConstructing;
    }

    updateGrid(samples) {
        const n = samples.length;
        for(let i = 0; i < n; i++) {
            let x = Math.round((samples[i].x+this.gridSize/2)*this.gridNumSquare), z = Math.round((samples[i].z+this.gridSize/2)*this.gridNumSquare);
            
            if(x < 0 || x >= this.gridResolution || z < 0 || z >= this.gridResolution)
                continue;

            const coord = x+z*this.gridResolution;
            this.gridSamplesSum[coord] += samples[i].y;
            this.gridSamplesCount[coord] += 1;
            const y = this.gridSamplesSum[coord] / this.gridSamplesCount[coord]
            this.gridVertices.setY(coord, y);
            this.yFloor = y;

        }

        this.updateGridColors();
    }

    updateGridColors() {
        const vertices = this.gridVertices;
        const n = vertices.count;
        let yFloor = 0, yMax = 0;
        for(let i = 0; i < n; i++) {
            yFloor = Math.min(yFloor, vertices.getY(i));
            yMax = Math.max(yMax, vertices.getY(i));
        }
        this.gridGeometry.setAttribute( 'position', vertices );

        this.gridGeometry.setAttribute( 'color', new THREE.BufferAttribute( new Float32Array(n*4 ), 4 ) );
        const colors = this.gridGeometry.attributes.color;
        const color = new THREE.Color();
        for(let i = 0; i < n; i++) {
            //const z =(vertices.getY(i)-yFloor)/(yMax-yFloor)
            const z = vertices.getY(i)
            color.setHSL((z <= this.yFloor + 1) ? 0.75 : 0.25, 1, Math.min(this.gridSamplesCount[i]/200, 0.5));
            colors.setXYZW(i, color.r, color.g, color.b, 0.5);
        }
    }

    takepicture_grid() {
        const context = canvas.getContext('2d');
        canvas.width = this.gridResolution
        canvas.height = this.gridResolution

        const imgData = context.createImageData(this.gridResolution, this.gridResolution)
        const u8data = imgData.data;

        const vertices = this.gridVertices;
        const n = vertices.count;
        const color = new THREE.Color();
        for(let i = 0; i < n; i++) {
            color.setHSL((vertices.getY(i)-this.yFloor)/(this.yMax-this.yFloor), 1, Math.min(this.gridSamplesCount[i]/200, 0.5));
            u8data[4*i] = 255*color.r;
            u8data[4*i+1] = 255*color.g;
            u8data[4*i+2] = 255*color.b;
            u8data[4*i+3] = 255; 
        }

        context.putImageData(imgData, 0, 0);      
        let data = canvas.toDataURL('image/png');
        canvas.width = 0
        canvas.height = 0
      
        data = dataURLtoBlob(data);
        socket.emit('upload-screenshot', data);
        console.log('took screenshot:', data.length)
    }

    createUI() {
        const self = this;
        const content = {
            info: "Hello", 
            cons: "Stop Build",
            spawn: "Start"
        }
        function onSpawn() {
            self.finishedLoading = true;
            self.startGame()

            const msg = "Portals spawned";
            console.log(msg);
            self.ui.updateElement("info", msg);
        }

        function onConstruct() {
            if(!self.isConstructing)
                return;
            const msg = (self.isConstructing) ? "Stopped build" : "Started build";
            self.isConstructing = !self.isConstructing;
            console.log(msg);
            self.gridMesh.visible = self.isConstructing;
            self.ui.updateElement("info", msg);
            content.cons = (self.isConstructing) ? "Stop Build" : "Start Build";

            if(!self.isConstructing)
                self.takepicture_grid()
        }
        const config = {
            panelSize: {width: 2, height: 0.5},
            height: 128,
            info: { type: "text",   position: {top:6,   left: 6}, width: 500, height: 58, backgroundColor: "#aaa", fontColor: "#000" },
            cons: { type: "button", position: {top: 64, left: 0}, width: 200, fontColor: "#ff0", onSelect: onConstruct},
            spawn:{ type: "button", position: {top: 64, right: 0}, width: 200, fontColor: "#ff0", onSelect: onSpawn},
            renderer: this.renderer
        }

        this.ui = new CanvasUI(content, config);
        //this.ui.updateElement("body", "Hello World");
        //this.ui.update();
        this.ui.mesh.position.set(0, 0, -3);
        this.scene.add(this.ui.mesh);


        /*const sprite1 = new THREE.Sprite( new THREE.SpriteMaterial( { color: '#69f' } ) );
        sprite1.position.set( 0, 0, -1 );
        sprite1.scale.set( 2, 5, 1 );
        const group = new THREE.Group();
        group.add(sprite1)
        this.scene.add( group );*/
    }

    startGame() {
        this.spawnPortals(5);
    }

    initScene(){
        this.meshes = [];
        this.mixers = [];
        this.zombies = [];
        this.zombieModels = [];
        this.zombiesGroup = new THREE.Group();
        this.scene.add(this.zombiesGroup);



        this.portalReticles = [];
        this.portalPositions = [];

        this.finishedLoading = false;
        const self = this;

        const loader = new GLTFLoader();
        const models = ['models/survivor.gltf', 'models/pumpkin.gltf'];

        for(let i = 0; i < models.length; i++) {
            this.zombieModels.push(undefined);
        }

        //const animations = ['walk', 'run', 'die', 'attack']
        let nLoaded = 0;
        for(let i = 0; i < models.length; i++) {
            loader.load( models[i], function ( gltf ) {
                console.log('Loaded mesh ', models[i], gltf)
                self.zombieModels[i] = gltf;
                nLoaded += 1;
                if(nLoaded == models.length && self.ui) {
                    self.ui.updateElement("info", "Meshes loaded: get ready to start!");

                }
            } );
        }
        console.log('Loading mesh files...');
    }

    spawnZombie(position) {
        const animations = ['walk', 'run'];
        const speeds = [0.5, 0.2];

        const iModel = Math.floor(Math.random() * this.zombieModels.length);
        if(this.zombieModels[iModel] === undefined)
            return;

        const gltf = this.zombieModels[iModel];

        const object = SkeletonUtils.clone(gltf.scene);
        const scale = 0.05;
        object.scale.set(scale, scale, scale);
        object.position.set(position.x, position.y, position.z);
        object.quaternion.set(0,0,0,1);
        object.updateMatrix();
        const options = {
            object: object,
            speed: speeds[iModel],
            animations: gltf.animations,
            npc: false
        };
        
        const zombie = new Player(options);
        zombie.action = animations[iModel];
        this.zombies.push(zombie);
        this.zombiesGroup.add(object)

        console.log('added mesh', object)
    }

    onPointerMove( event ) {
        if(!this.renderer.xr.isPresenting)
            return;
        const pointer = new THREE.Vector2();
        pointer.x = ( event.clientX / window.innerWidth ) * 2 - 1;
        pointer.y = - ( event.clientY / window.innerHeight ) * 2 + 1;

        this.raycaster.setFromCamera( pointer, this.camera );

        const intersects = this.raycaster.intersectObject( this.zombiesGroup, true );
        console.log('intersected ', intersects, this.zombiesGroup)

        if ( intersects.length > 0 ) {
            const res = intersects.filter( function ( res ) {
                return res && res.object;
            } )[ 0 ];

            //console.log('intersected ', intersects)

            if ( res && res.object ) {
                console.log('Removing ', res.object);
                const selectedObject = res.object.parent.parent;
                //selectedObject.material.color.set( '#f00' );
                selectedObject.visible = false;
                this.scene.remove(selectedObject)

                /*const zombieGroups = this.zombiesGroup.children;
                for(let i = 0; i < zombieGroups.length; i++) {
                    if(zombieGroups[i].visible == false)
                    console.log('DELETED FROM GROUP: ', zombieGroups[i]), zombieGroups.splice(i, 1);
                }*/
                const zombiePlayers = this.zombies;
                for(let i = 0; i < zombiePlayers.length; i++) {
                    if(zombiePlayers[i].object.visible == false) {
                        console.log('DELETED FROM PLAYERS: ', zombiePlayers[i]), zombiePlayers.splice(i, 1);
                        this.nKilled += 1;
                        self.ui.updateElement("info", `Killed ${this.nKilled} zombies!`);

                    }
                }

                /*const index = this.zombies.indexOf(selectedObject);
                if (index > -1) 
                    this.zombies.splice(index, 1);*/
            }
        }
    }

    setupXR(){
        this.renderer.xr.enabled = true;
        const self = this;
        let controller;

        this.raycaster = new THREE.Raycaster();


        /*function onSessionStart() {
            self.ui.mesh.position.set(0, 1.5, -1.2);
            self.camera.attach(self.ui.mesh);
        }
        function onSessionEnd() {
            self.camera.remove(self.ui.mesh);
        }*/

        const btn = new ARButton(this.renderer);
        controller = this.renderer.xr.getController(0);

        document.addEventListener('pointerup', this.onPointerMove.bind(this));
        //controller.addEventListener('select', 
        this.scene.add(controller);

            // https://github.com/immersive-web/depth-sensing/blob/main/explainer.md
        const sessionInit =  {
            requiredFeatures: ["light-estimation", "depth-sensing"],
            depthSensing: {
                usagePreference: ["cpu-optimized"],
                dataFormatPreference: ["luminance-alpha"]
            }
        };

        document.body.appendChild(
            ARButton.createButton(this.renderer, sessionInit)//, {onSessionStart, onSessionEnd})
        );
    }
    
    resize(){
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize( window.innerWidth, window.innerHeight );  
    }

	render(timestamp, frame) { 
        this.i += 1;
        const delta = this.clock.getDelta();

        
        this.update_gradientfield();

        if(this.finishedLoading) {
            this.update_gradientfield();
            this.update_pathfinding();
            this.spawnZombies(delta);
            this.zombies.forEach( (zombie) => { zombie.update(delta); });

        }
        if(frame)
            this.onXRFrame(timestamp, frame);
        if(this.renderer.xr.isPresenting)
            this.ui.update();
        this.renderer.render( this.scene, this.camera );

        if(this.i % 50 == 0)
            console.log(this.zombies)

        //this.ui.mesh.applyMatrix4(this.camera.matrixWorld.invert());
        
    }

    onXRFrame(t, frame) {
        if(this.isConstructing)
            this.handleDepthInfo(frame);
    }

    handleDepthInfo(frame) {
        if(this.i % 25 != 0)
            return;
        const session = frame.session;

        const baseLayer = session.renderState.baseLayer;
        const pose = frame.getViewerPose(this.renderer.xr.getReferenceSpace());
        const controller = this.renderer.xr.getController(0);
        if (pose) {
            // https://developer.mozilla.org/en-US/docs/Web/API/XRViewerPose/views
            for (const view of pose.views) {
                const viewport = baseLayer.getViewport(view);
                const depthData = frame.getDepthInformation(view);

                if (depthData && depthData.getDepthInMeters(0.5,0.5) != 0) {
                    console.log("Adding mesh point");
                    const [vertices, depths] = calculateVerticesFromViewCoordinatesSupersampled(depthData, viewport, this.camera);

                    //const material = new THREE.PointsMaterial({ color: 0xFFFFFF, size: 0.1 })
                    //const geometry = new THREE.BufferGeometry();

                    //geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( vertices, 3 ) );
                    //geometry.setAttribute( 'color', new THREE.Float32BufferAttribute(colors, 3 ) );

                    //const n = this.gridVertices.count;
                    //for(let i = 0; i < vertices.length; i++) {
                    //    this.gridVertices.setY(i, vertices[i].z*10);
                   // }
                    //this.updateGridColors();

                    //console.log(vertices);

                    /*let color = new THREE.Color();
                    //console.log(vertices);
                    for(let i = 0; i < vertices.length; i++) {
                        const geometry = new THREE.SphereGeometry( 0.01, 8, 8 );
                        color.setHSL((vertices[i].y-this.yFloor) / (this.yMax-this.yFloor), 1, 0.5);
                        const material = new THREE.MeshBasicMaterial( { color: color } );
                        const sphere = new THREE.Mesh( geometry, material );
                        sphere.position.set(vertices[i].x, vertices[i].y, vertices[i].z);
                        this.scene.add( sphere );
                    }*/

                    this.updateGrid(vertices)

                    //const mesh = new THREE.Points(geometry, material);

                    //const referenceSpace = this.renderer.xr.getReferenceSpace();
                    //const pose = hit.getPose( referenceSpace );
                    //mesh.position.applyMatrix4(controller.matrixWorld);
                    //mesh.quaternion.setFromRotationMatrix(controller.matrixWorld);

                    //this.scene.add(mesh);
                }
            }
        }
    }
}

const app = new App();
console.log('Done');

