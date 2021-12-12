import * as THREE from 'three';

import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { XREstimatedLight } from 'three/examples/jsm/webxr/XREstimatedLight.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import {mat4, vec3, mat3, vec2} from 'gl-matrix';
import {CanvasUI} from '../jsm/CanvasUI';
import { ARButton } from '../jsm/ARButton';
import { nearestPowerOfTwo } from 'three/src/math/MathUtils';

const near = 0.05, far = 20;
const depth_resolution = 20;
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

        window.addEventListener('resize', this.resize.bind(this) );
	}	

    generateGrid() {
        this.gridSize = 100;
        this.gridNumSquare = 4;
        this.gridResolution = this.gridSize*this.gridNumSquare;
        const geometry = new THREE.PlaneBufferGeometry( this.gridSize, this.gridSize, this.gridResolution-1, this.gridResolution-1);
        this.gridGeometry = geometry;
        this.gridVertices = this.gridGeometry.attributes.position;

        const vertices = this.gridVertices;
        const n = vertices.count;
        for(let i = 0; i < n; i++) {
            vertices.setZ(i, -vertices.getY(i));
            vertices.setY(i, 0);
        }

        this.yFloor = -1.5;
        this.yMax = -1;
        this.gridSamplesSum = new Float32Array(n);
        this.gridSamplesCount = new Int32Array(n);
        for(let i = 0; i < n; i++)
            this.gridSamplesSum[i] = 0, this.gridSamplesCount[i] = 0;

        //for(let i = 0; i < n; i++)
        //    vertices.setY(i, i%5);
        this.updateGridColors();

        const material = new THREE.MeshPhongMaterial( {
            color: 0xffffff,
            flatShading: true,
            vertexColors: true,
            shininess: 0
        } );
        const plane = new THREE.Mesh( this.gridGeometry, material );
        plane.position.set(0, this.yFloor, 0);
        //plane.position.set(0, 0, -8);
        this.scene.add( plane );
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
            this.gridVertices.setY(coord, this.gridSamplesSum[coord] / this.gridSamplesCount[coord]);
            this.yFloor = Math.min(this.yFloor, this.gridVertices.getY(coord));
            this.yMax = Math.max(this.yMax, this.gridVertices.getY(coord));
            console.log(x, z, samples[i].y, this.gridSamplesCount[coord], this.gridVertices.getY(coord));
        }

        this.updateGridColors();
    }

    updateGridColors() {
        const vertices = this.gridVertices;
        const n = vertices.count;
        this.gridGeometry.setAttribute( 'color', new THREE.BufferAttribute( new Float32Array(n*3 ), 3 ) );
        const colors = this.gridGeometry.attributes.color;
        const color = new THREE.Color();
        for(let i = 0; i < n; i++) {
            color.setHSL((vertices.getY(i)-this.yFloor)/(this.yMax-this.yFloor), 1, 0.5);
            colors.setXYZ(i, color.r, color.g, color.b);
        }
    }

    createUI() {
        this.ui = new CanvasUI();
        this.ui.updateElement("body", "Hello World");
        this.ui.update();
        this.ui.mesh.position.set(0, 0, -10);
        this.scene.add(this.ui.mesh);
    }
    initScene(){
        this.meshes = [];
        this.mixers = [];
        //this.loadZombie();
    }
    
    loadZombie() {
        const loader = new FBXLoader();
        const self = this;
        loader.load( 'models/hiphop.fbx', function ( object ) {
            /*object.traverse( function ( child ) {
                if ( child.isMesh ) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    child.material.opacity = 1.0;
                    child.material.transparent = false;
                }
            } );*/
            let mixer = new THREE.AnimationMixer( object );
            //const action = mixer.clipAction( object.animations[ 0 ] );
            //action.play();
            object.position.set(0,0,-1);
            self.scene.add(object);
            self.meshes.push(object);
            self.mixers.push(mixer);
            console.log('added mesh', object, mixer)
        } );
    }
    setupXR(){
        this.renderer.xr.enabled = true;
        const self = this;
        let controller;

        function onSelect() {
            const material = new THREE.MeshPhongMaterial({color: 0xFFFFFF * Math.random() });
            const mesh = new THREE.Mesh (self.geometry, material);
            mesh.position.set(0, 0,-0.3).applyMatrix4(controller.matrixWorld);
            mesh.quaternion.setFromRotationMatrix(controller.matrixWorld);
            self.scene.add(mesh);
            self.meshes.push(mesh);
        }
        /*function onSessionStart() {
            self.ui.mesh.position.set(0, 1.5, -1.2);
            self.camera.attach(self.ui.mesh);
        }
        function onSessionEnd() {
            self.camera.remove(self.ui.mesh);
        }*/

        const btn = new ARButton(this.renderer);
        controller = this.renderer.xr.getController(0);
        controller.addEventListener('select', onSelect);
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

        this.renderer.setAnimationLoop( this.render.bind(this) );
        this.i = 0
    }
    
    resize(){
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize( window.innerWidth, window.innerHeight );  
    }
    
    animate(delta) {
        this.mixers.forEach( (mixer) => { mixer.update(delta); });
        this.i += 1;
        this.meshes.forEach( (mesh) => { mesh.rotateY(delta) });
    }

	render(timestamp, frame) { 
        const delta = this.clock.getDelta();
        this.animate(delta)
        this.renderer.render( this.scene, this.camera );
        if(frame)
            this.onXRFrame(timestamp, frame);
        if(this.renderer.xr.isPresenting)
            this.ui.update();
    }

    onXRFrame(t, frame) {
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

                    /*console.log(vertices);

                    let color = new THREE.Color();
                    //console.log(vertices);
                    for(let i = 0; i < vertices.length; i++) {
                        const geometry = new THREE.SphereGeometry( 0.05, 8, 8 );
                        color.setHSL(depths[i] / far, 1, 0.5);
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

