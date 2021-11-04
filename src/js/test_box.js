import * as THREE from 'three';



let camera, scene, renderer;
let mesh;

init();
animate();

function init() {

    camera = new THREE.PerspectiveCamera( 70, window.innerWidth / window.innerHeight, 1, 1000 );
    camera.position.z = 400;

    scene = new THREE.Scene();

    const geometry = new THREE.BoxGeometry( 200, 200, 200 );
    const material = new THREE.MeshPhongMaterial({ color: 0xffffff, side: THREE.DoubleSide } );

    mesh = new THREE.Mesh( geometry, material );
    scene.add( mesh );
    scene.add(new THREE.AmbientLight( 0x333333 )); //ambient light
    scene.add(new THREE.DirectionalLight( 0xFFFFFF, 1.0 )) //directional light


    renderer = new THREE.WebGLRenderer( { antialias: true , alpha: true } );
    renderer.setClearColor( 0x000000, 0 ); // transparent background

    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize( window.innerWidth*0.5, window.innerHeight*0.5 );
    document.body.appendChild( renderer.domElement );

    //

    window.addEventListener( 'resize', onWindowResize );

}

function onWindowResize() {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize( window.innerWidth*0.5, window.innerHeight*0.5);

}

function animate() {

    requestAnimationFrame( animate );

    mesh.rotation.x += 0.005;
    mesh.rotation.y += 0.01;

    renderer.render( scene, camera );

}

/*
let camera, scene, renderer;
let controller;

init();
animate();

function init() {
    console.log("Init AR");
    const container = document.createElement( 'div' );
    document.body.appendChild( container );

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera( 70, window.innerWidth / window.innerHeight, 0.01, 20 );

    const light = new THREE.HemisphereLight( 0xffffff, 0xbbbbff, 1 );
    light.position.set( 0.5, 1, 0.25 );
    scene.add( light );

    //

    renderer = new THREE.WebGLRenderer( { antialias: true, alpha: true } );
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize( window.innerWidth, window.innerHeight );
    renderer.xr.enabled = true;
    container.appendChild( renderer.domElement );

    //

    //document.body.appendChild( ARButton.createButton( renderer ) );

    //

    const geometry = new THREE.CylinderGeometry( 0, 0.05, 0.2, 32 ).rotateX( Math.PI / 2 );

    function onSelect() {

        const material = new THREE.MeshPhongMaterial( { color: 0xffffff * Math.random() } );
        const mesh = new THREE.Mesh( geometry, material );
        mesh.position.set( 0, 0, - 0.3 ).applyMatrix4( controller.matrixWorld );
        mesh.quaternion.setFromRotationMatrix( controller.matrixWorld );
        scene.add( mesh );

    }

    controller = renderer.xr.getController( 0 );
    controller.addEventListener( 'select', onSelect );
    scene.add( controller );

    //

    window.addEventListener( 'resize', onWindowResize );

}

function onWindowResize() {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize( window.innerWidth, window.innerHeight );

}

//

function animate() {
    console.log("Animate AR");

    renderer.setAnimationLoop( render );

}

function render() {
    renderer.render( scene, camera );

}*/