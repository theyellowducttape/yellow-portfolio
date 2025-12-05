import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

console.log("Three.js imported via Import Map");

// =============== SCENE ===============
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x202020);

// =============== CAMERA ===============
const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 1, 0);

// ==================== PLAYER CONTROLS (WASD) ====================
const controls = new PointerLockControls(camera, document.body);
scene.add(controls.getObject());

// click to lock mouse look
document.addEventListener('click', () => {
  controls.lock();
});

// movement state
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;

// keyboard events
document.addEventListener('keydown', (event) => {
  switch (event.code) {
    case 'KeyW': moveForward = true; break;
    case 'KeyS': moveBackward = true; break;
    case 'KeyA': moveLeft = true; break;
    case 'KeyD': moveRight = true; break;
  }
});

document.addEventListener('keyup', (event) => {
  switch (event.code) {
    case 'KeyW': moveForward = false; break;
    case 'KeyS': moveBackward = false; break;
    case 'KeyA': moveLeft = false; break;
    case 'KeyD': moveRight = false; break;
  }
});

// movement vectors
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();

const WALK_SPEED = 3; // adjust for speed preference

// =============== RENDERER ===============
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
document.body.appendChild(renderer.domElement);

// =============== LIGHT ===============
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(3, 5, 4);
scene.add(light);

// =============== TEST CUBE ===============
//const cube = new THREE.Mesh(
//  new THREE.BoxGeometry(2, 2, 2),
//  new THREE.MeshStandardMaterial({ color: 0xff0000 })
//);
//cube.position.set(0, 1, 0);
//scene.add(cube);

// =============== LOAD GLTF ENVIRONMENT ===============
const loader = new GLTFLoader();

loader.load(
  './assets/testscene.gltf',
  (gltf) => {
    console.log('GLTF loaded:', gltf);

    const env = gltf.scene;

    // Optional: adjust scale if your scene is huge or tiny
    // Try with and without this line if things look weird
    env.scale.set(1, 1, 1);

    // Center it if needed
    env.position.set(0, 0, 0);

    env.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    scene.add(env);

    console.log('Environment added to scene.');
  },
  (xhr) => {
    if (xhr.total) {
      console.log(`GLTF loading: ${(xhr.loaded / xhr.total * 100).toFixed(1)}%`);
    } else {
      console.log(`GLTF loading: ${xhr.loaded} bytes`);
    }
  },
  (error) => {
    console.error('Error loading GLTF:', error);
  }
);

// =============== RESIZE ===============
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// =============== ANIMATE ===============
function animate() {
  requestAnimationFrame(animate);

  // spin the cube so we know it's alive
  //cube.rotation.y += 0.01;

  // movement vector
  direction.z = Number(moveForward) - Number(moveBackward);
  direction.x = Number(moveRight) - Number(moveLeft);

  direction.normalize();

  // frame-rate independent movement
  const delta = 0.016; // ~60fps
  if (moveForward || moveBackward) controls.moveForward(direction.z * WALK_SPEED * delta);
  if (moveLeft || moveRight) controls.moveRight(direction.x * WALK_SPEED * delta);

  renderer.render(scene, camera);
}
animate();
