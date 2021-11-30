import * as THREE from 'three';

import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { ARButton } from 'three/examples/jsm/webxr/ARButton.js';
import { XREstimatedLight } from 'three/examples/jsm/webxr/XREstimatedLight.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import {mat4, vec3, mat3, vec2} from 'gl-matrix';

let camera, scene, renderer;
let controller;
let defaultEnvironment;
let xrRefSpace;

let meshes = [];

const clock = new THREE.Clock();

let mixer;

init();
animate();

function init() {
    // In order for lighting estimation to work, 'light-estimation' must be included as either an optional or required feature.
    //document.body.appendChild( ARButton.createButton( renderer, { 
    //    optionalFeatures: [ 'light-estimation' ]
    //} ) );

    // https://github.com/immersive-web/depth-sensing/blob/main/explainer.md
    const sessionInit =  {
        requiredFeatures: ["light-estimation", "depth-sensing"],
        depthSensing: {
            usagePreference: ["cpu-optimized"],
            dataFormatPreference: ["luminance-alpha"]
        }
      };

    const button = document.createElement( 'button' );
    document.body.appendChild(button);
    button.style.display = '';

    button.style.cursor = 'pointer';
    button.style.left = 'calc(50% - 50px)';
    button.style.width = '100px';

    button.textContent = "Start AR";
    button.onclick = function () {
        if ( currentSession === null ) 
            navigator.xr.requestSession( 'immersive-ar', sessionInit ).then( onSessionStarted );
        else 
            currentSession.end();
    };
    
    const container = document.createElement( 'div' );
    document.body.appendChild( container );

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera( 70, window.innerWidth / window.innerHeight, 0.01, 20 );

    const defaultLight = new THREE.AmbientLight( 0xffffff );
    scene.add( defaultLight );

    // model
    const loader = new FBXLoader();

    loader.load( 'models/mad-zombie-run.fbx', function ( object ) {
        object.traverse( function ( child ) {
            if ( child.isMesh ) {
                child.castShadow = true;
                child.receiveShadow = true;
                child.material.opacity = 1.0;
                child.material.transparent = false;
            }
        } );
        object.scale = new THREE.Vector3(0.2, 0.2, 0.2);
        object.translateZ(-2);
        scene.add( object );

        /*mixer = new THREE.AnimationMixer( object );
        const action = mixer.clipAction(object.animations[0]);
        action.play();*/
    } );

    //

    renderer = new THREE.WebGLRenderer( { antialias: true, alpha: true } );
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize( window.innerWidth, window.innerHeight );
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.physicallyCorrectLights = true;
    renderer.xr.enabled = true;
    container.appendChild( renderer.domElement );

    // Don't add the XREstimatedLight to the scene initially.
    // It doesn't have any estimated lighting values until an AR session starts.

    const xrLight = new XREstimatedLight( renderer );

    xrLight.addEventListener( 'estimationstart', () => {

        // Swap the default light out for the estimated one one we start getting some estimated values.
        scene.add( xrLight );
        scene.remove( defaultLight );

        // The estimated lighting also provides an environment cubemap, which we can apply here.
        if ( xrLight.environment ) {

            updateEnvironment( xrLight.environment );

        }

    } );

    xrLight.addEventListener( 'estimationend', () => {

        // Swap the lights back when we stop receiving estimated values.
        scene.add( defaultLight );
        scene.remove( xrLight );

        // Revert back to the default environment.
        updateEnvironment( defaultEnvironment );

    } );

    //

    new RGBELoader()
        .setDataType( THREE.UnsignedByteType )
        .setPath( 'textures/' )
        .load( 'royal_esplanade_1k.hdr', function ( texture ) {

            texture.mapping = THREE.EquirectangularReflectionMapping;

            defaultEnvironment = texture;

            updateEnvironment( defaultEnvironment );

        } );

    const ballGeometry = new THREE.SphereBufferGeometry( 0.175, 32, 32 );
    const ballGroup = new THREE.Group();
    ballGroup.position.z = - 2;

    const rows = 1;
    const cols = 4;

    for ( let i = 0; i < rows; i ++ ) {
        for ( let j = 0; j < cols; j ++ ) {
            let material = new THREE.PointsMaterial({ color: 0xFFFFFF, size: 1 })

            const ballMaterial = new THREE.MeshPhongMaterial( {
                color: 0xdddddd,
                reflectivity: j / cols
            } );
            const ballMesh = new THREE.Mesh( ballGeometry, material );
            ballMesh.position.set( ( i + 0.5 - rows * 0.5 ) * 0.4, ( j + 0.5 - cols * 0.5 ) * 0.4, 0 );
            ballGroup.add( ballMesh );
        }
    }

    scene.add( ballGroup );

    //

    function onSelect() {

        ballGroup.position.set( 0, 0, - 2 ).applyMatrix4( controller.matrixWorld );
        ballGroup.quaternion.setFromRotationMatrix( controller.matrixWorld );

    }

    controller = renderer.xr.getController( 0 );
    controller.addEventListener( 'select', onSelect );
    scene.add( controller );

    //

    window.addEventListener( 'resize', onWindowResize );

    const vertices = [];

    for ( let i = 0; i < 100; i ++ ) {
    
        const x = THREE.MathUtils.randFloatSpread( 10 );
        const y = THREE.MathUtils.randFloatSpread( 10 );
        const z = 2.0;//THREE.MathUtils.randFloatSpread( 10 );
    
        vertices.push( x, y, z );
    }
    
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( vertices, 3 ) );
    
    const material = new THREE.PointsMaterial( { color: 0x888888, size:0.5 } );
    
    const points = new THREE.Points( geometry, material );
    
    scene.add( points );
}

let currentSession = null;

function onSessionEnded( /*event*/ ) {
    currentSession.removeEventListener( 'end', onSessionEnded );
    //sessionInit.domOverlay.root.style.display = 'none';
    currentSession = null;
}

let gl;

async function onSessionStarted(session) {
    // ARBUTTON
    session.addEventListener( 'end', onSessionEnded );
    renderer.xr.setReferenceSpaceType( 'local' );
    await renderer.xr.setSession( session );
    //sessionInit.domOverlay.root.style.display = '';
    currentSession = session;

    // EXPLAINER
    console.log(session.depthUsage);
    console.log(session.depthFormat);
    
    //let canvas = document.createElement('canvas');
    //gl = canvas.getContext('webgl', {
    //    xrCompatible: true
    //});

    //initializeGL();

    if(session.depthUsage != "cpu-optimized") {
        throw new Error("Unsupported depth API usage!");
    }

    //session.updateRenderState({ baseLayer: new XRWebGLLayer(session, gl) });
    session.requestReferenceSpace('local').then((refSpace) => {
      xrRefSpace = refSpace;
      session.requestAnimationFrame(onXRFrame);
    })
}

// https://github.com/immersive-web/webxr-samples/blob/main/proposals/phone-ar-depth.html
// Component-wise multiplication of 2 vec3s:
function scaleByVec(out, lhs, rhs) {
out[0] = lhs[0] * rhs[0];
out[1] = lhs[1] * rhs[1];
out[2] = lhs[2] * rhs[2];

return out;
}

function clamp(out, input, lower_bound, upper_bound) {
out[0] = Math.max(lower_bound[0], Math.min(input[0], upper_bound[0]));
out[1] = Math.max(lower_bound[1], Math.min(input[1], upper_bound[1]));
out[2] = Math.max(lower_bound[2], Math.min(input[2], upper_bound[2]));

return out;
}

function calculateVerticesFromViewCoordinatesSupersampled(depthData, camera_to_world, viewport) {
    const viewport_width = viewport.width;
    const viewport_height = viewport.height;

    const resolution_x = viewport_width / 3;
    const resolution_y = viewport_height / 3;

    const vertices_data = [];
    //console.log(depthData)
    for(let x = 0; x < viewport_width; x = x + resolution_x) {
      for(let y = 0; y < viewport_height; y = y + resolution_y) {
        let nx = x/viewport_width;
        let ny = y/viewport_height;
        const distance = depthData.getDepthInMeters(nx, ny);

        let point_ndc = vec3.create(), point_world = vec3.create();
        vec3.set(point_ndc, (2.0*nx-1)*distance, (2.0*ny-1)*distance, -distance);
        vec3.transformMat4(point_world, point_ndc, camera_to_world);
        vertices_data.push(point_world[0],point_world[1],point_world[2]);
      }
    }

    return vertices_data;
  }

let current_camera_to_world = mat4.create();
let current_world_to_camera = mat4.create();
let mesh = new Float32Array();
let current_frame = 50;
// Called every time a XRSession requests that a new frame be drawn.
function onXRFrame(t, frame) {
    const session = frame.session;
    session.requestAnimationFrame(onXRFrame);

    const baseLayer = session.renderState.baseLayer;

    const pose = frame.getViewerPose(xrRefSpace);

    if (pose) {
        // https://developer.mozilla.org/en-US/docs/Web/API/XRViewerPose/views
        //console.log('views:', pose.views)
        for (const view of pose.views) {
            const camera_to_world = mat4.clone(view.transform.matrix); // CAREFUL OF ORDER, IDK WHY
            mat4.invert(current_world_to_camera, camera_to_world); // CAREFUL OF ORDER, IDK WHY
            current_camera_to_world = mat4.clone(camera_to_world);
            //console.log(view.transform.position);
            const viewport = baseLayer.getViewport(view);
            const depthData = frame.getDepthInformation(view);
            if (depthData && current_frame % 100 == 0) {
                const vertices = calculateVerticesFromViewCoordinatesSupersampled(depthData, camera_to_world, viewport);
                const material = new THREE.MeshBasicMaterial( { color: 0x888888, size: 0.2 } );
                const geometry = new THREE.BufferGeometry();
                geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( vertices, 3 ) );
                console.log(vertices)
                mesh = new THREE.Points(geometry, material);
                scene.add(mesh);
                console.log("Added mesh point");
                
                
            } else {
                console.log("Depth data unavailable in the current frame!");
            }
            //current_frame += 1;
        }
    }
}

function onWindowResize() {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize( window.innerWidth, window.innerHeight );
}

function animate() {
    renderer.setAnimationLoop( render );
}

function render() {
    const m = new THREE.Matrix4();
    m.elements = current_world_to_camera;
    scene.applyMatrix4(m);

    renderer.render( scene, camera );
    m.elements = current_camera_to_world;
    scene.applyMatrix4(m);
    /*scene.traverse( function ( object ) {
        if ( object.isMesh ) console.log(object.position);
    } );*/
    //scene.applyMatrix4(current_camera_to_world);

}

function updateEnvironment( envMap ) {

    scene.traverse( function ( object ) {
        if ( object.isMesh ) object.material.envMap = envMap;
    } );

}