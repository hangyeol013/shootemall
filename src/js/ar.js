import * as THREE from 'three';

import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { ARButton } from 'three/examples/jsm/webxr/ARButton.js';
import { XREstimatedLight } from 'three/examples/jsm/webxr/XREstimatedLight.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

let camera, scene, renderer;
let controller;
let defaultEnvironment;
let xrRefSpace;

const clock = new THREE.Clock();

let mixer;

init();
animate();

function init() {

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
                child.material.transparent = false;
            }
        } );
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

    //

    // In order for lighting estimation to work, 'light-estimation' must be included as either an optional or required feature.
    document.body.appendChild( ARButton.createButton( renderer, { 
            /*requiredFeatures: ["depth-sensing"],
            depthSensing: {
            usagePreference: ["gpu-optimized"],
            formatPreference: ["luminance-alpha", "float32"]
            }, */
            depthSensing: {
              usagePreference: ["cpu-optimized"],
              dataFormatPreference: ["luminance-alpha"],
            },
        optionalFeatures: [ 'depth-sensing',  'light-estimation' ]
    } ) );

    //

    const ballGeometry = new THREE.SphereBufferGeometry( 0.175, 32, 32 );
    const ballGroup = new THREE.Group();
    ballGroup.position.z = - 2;

    const rows = 1;
    const cols = 4;

    for ( let i = 0; i < rows; i ++ ) {

        for ( let j = 0; j < cols; j ++ ) {

            const ballMaterial = new THREE.MeshPhongMaterial( {
                color: 0xdddddd,
                reflectivity: j / cols
            } );
            const ballMesh = new THREE.Mesh( ballGeometry, ballMaterial );
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


    navigator.xr.requestSession( 'immersive-ar', sessionInit ).then( onSessionStarted );
}

function onSessionStarted(session) {
    let canvas = document.createElement('canvas');
    gl = canvas.getContext('webgl', {
        xrCompatible: true
    });

    initializeGL();

    session.updateRenderState({ baseLayer: new XRWebGLLayer(session, gl) });
    session.requestReferenceSpace('local').then((refSpace) => {
      xrRefSpace = refSpace;
      session.requestAnimationFrame(onXRFrame);
    })
    
    if(session.depthUsage != "cpu-optimized") {
      throw new Error("Unsupported depth API usage!");
    }

    if(session.depthDataFormat != "luminance-alpha") {
      throw new Error("Unsupported depth data format!");
    }
}


function calculateVerticesFromViewCoordinatesSupersampled(depthData, viewport, transform) {
    // For verification only.

    const smaller_depth_dim = Math.min(depthData.width, depthData.height);
    const larger_depth_dim = Math.max(depthData.width, depthData.height);

    const X_RANGE = 0.1;
    const Y_RANGE = 0.1;

    const NUM_SAMPLES_X = Math.trunc(4 * smaller_depth_dim);
    const NUM_SAMPLES_Y = Math.trunc(4 * larger_depth_dim);

    const vertices_data = [];

    for(let x = 0; x <= X_RANGE; x += 1/NUM_SAMPLES_X) {
      for(let y = 0; y <= X_RANGE; y += 1/NUM_SAMPLES_Y ) {
        const distance = depthData.getDepthInMeters(x, y);

        // We need to convert normalized view coordinates to normalized device coordinates,
        // with the origin at the center of a cube with side length = 2 and Y growing upward.
        const depth_coords_ndc = vec3.fromValues(x, y, 0.0);

        // First, fix up the Y axis:
        depth_coords_ndc[1] = 1 - depth_coords_ndc[1];

        // Then, convert to range [-1, 1]:
        depth_coords_ndc[0] = (2.0 * depth_coords_ndc[0]) - 1;
        depth_coords_ndc[1] = (2.0 * depth_coords_ndc[1]) - 1;

        if(depth_coords_ndc[0] > 1 || depth_coords_ndc[0] < -1 ||
           depth_coords_ndc[1] > 1 || depth_coords_ndc[1] < -1) {
          continue;
        }

        const vertex = [depth_coords_ndc[0], depth_coords_ndc[1], distance];

        vertices_data.push(vertex);
      }
    }

    return vertices_data;
  }

// Called every time a XRSession requests that a new frame be drawn.
function onXRFrame(t, frame) {
    const session = frame.session;
    session.requestAnimationFrame(onXRFrame);

    const baseLayer = session.renderState.baseLayer;

    const pose = frame.getViewerPose(xrRefSpace);

    if (pose) {
        for (const view of pose.views) {
            const viewport = baseLayer.getViewport(view);
            const depthData = frame.getDepthInformation(view);
            const perspectiveMatrix = view.transform;
            if (depthData) {
                let viewMatrix = view.transform.inverse.matrix;

                const geometry = calculateVerticesFromViewCoordinatesSupersampled(depthData, viewport, viewMatrix);
                let material = new THREE.PointsMaterial({ color: 0xFFFFFF, size: 0.25 })
                mesh = new THREE.Points(geometry, material)
                scene.add(mesh)
            } else {
                textInfoElement.innerHTML = "Depth data unavailable in the current frame!";
            }
        }
    } else {
        textInfoElement.innerHTML = "Pose unavailable in the current frame!";
    }
}

function onWindowResize() {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize( window.innerWidth, window.innerHeight );

}

/*function animate() {

   
}*/


function animate() {
    
    renderer.setAnimationLoop( render );

}

function render() {

    renderer.render( scene, camera );

}

function updateEnvironment( envMap ) {

    scene.traverse( function ( object ) {

        if ( object.isMesh ) object.material.envMap = envMap;


    } );

}