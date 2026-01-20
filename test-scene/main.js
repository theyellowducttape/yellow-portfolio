import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';


// ============== QUESTION UI DOM REFERENCES ==============
const questionOverlay = document.getElementById('question-overlay');
const questionTextEl = document.getElementById('question-text');
const questionAnswerEl = document.getElementById('question-answer');
const questionSubmitBtn = document.getElementById('question-submit');
const questionCancelBtn = document.getElementById('question-cancel');

// ============== CINEMATIC OVERLAYS ==============
const fadeOverlay = document.getElementById('fade-overlay');
const videoOverlay = document.getElementById('video-overlay');
const reflectionVideo = document.getElementById('reflection-video');

// ============== TEXTAREA AUTO-RESIZE ==============
questionAnswerEl.addEventListener('input', autoResizeTextarea);

function autoResizeTextarea() {
  this.style.height = 'auto';                 // reset height
  this.style.height = this.scrollHeight + 'px'; // grow to fit content
}

// state

let sceneLoaded = false;
let minLoadTimePassed = false;
let pebblesTarget = null;

let isQuestionOpen = false;
let currentQuestionId = null; // later you can use this to track which room/question was asked
let questTrigger1 = null;   // define global trigger reference
let reflectionState = 'idle';

// ============== LOADER CONDITIONS ==============
setTimeout(() => {
  minLoadTimePassed = true;
  tryHideLoader();
}, 3000);

const loaderOverlay = document.getElementById('loader-overlay');

function tryHideLoader() {
  if (sceneLoaded && minLoadTimePassed) {
    loaderOverlay.style.opacity = '0';
    loaderOverlay.style.transition = 'opacity 0.6s ease';

    setTimeout(() => {
      loaderOverlay.style.display = 'none';
    }, 600);
  }
}

// ============== RETURN TO ENVIRONMENT ==============
function returnToEnvironmentFacingPebbles() {
  if (!controls || !pebblesTarget) return;

  // Fully unlock first
  controls.unlock();

  // Reset camera completely
  camera.rotation.set(0, 0, 0);

  const player = controls.getObject();
  const playerPos = player.position;
  const targetPos = pebblesTarget.getWorldPosition(new THREE.Vector3());

  const dir = new THREE.Vector3(
    targetPos.x - playerPos.x,
    0,
    targetPos.z - playerPos.z
  ).normalize();

  player.rotation.set(0, Math.atan2(dir.x, dir.z), 0);

  // Lock on next frame
  requestAnimationFrame(() => {
    controls.lock();
  });
}

questionSubmitBtn.addEventListener('click', async () => {
  if (reflectionState !== 'running') return;

  reflectionState = 'completed';

  // 1. Hide question UI
  closeQuestion();

  // 2. Fade out video & overlay
  videoOverlay.classList.remove('active');
  reflectionVideo.pause();
  fadeOverlay.classList.remove('active');

  // 3. Let visuals settle
  await wait(150);

  // 4. Clean return to environment
  returnToEnvironmentFacingPebbles();
});

//questionCancelBtn.addEventListener('click', () => {
//  closeQuestion();
//});


console.log("Three.js imported via Import Map");

// =============== SCENE ===============
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x202020);

// =============== CAMERA ===============
const camera = new THREE.PerspectiveCamera(35,window.innerWidth / window.innerHeight,0.1,1000);
camera.position.set(0, 5, 30);

// ==================== PLAYER CONTROLS ====================
let controls;

controls = new PointerLockControls(camera, document.body);
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
    case 'ArrowUp': moveForward = true; break;
    case 'ArrowDown': moveBackward = true; break;
    case 'ArrowLeft': moveLeft = true; break;
    case 'ArrowRight': moveRight = true; break;
  }
});

document.addEventListener('keyup', (event) => {
  switch (event.code) {
    case 'ArrowUp': moveForward = false; break;
    case 'ArrowDown': moveBackward = false; break;
    case 'ArrowLeft': moveLeft = false; break;
    case 'ArrowRight': moveRight = false; break;
  }
});

// movement vectors
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();

const WALK_SPEED = 10; // adjust for speed preference

// =============== RENDERER ===============
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
document.body.appendChild(renderer.domElement);

// =============== LIGHT RENDERING ===============
renderer.physicallyCorrectLights = true;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

// =============== HDRI (REFLECTIONS ONLY) ===============
const rgbeLoader = new RGBELoader();
const pmremGenerator = new THREE.PMREMGenerator(renderer);
pmremGenerator.compileEquirectangularShader();

rgbeLoader.load('./assets/reflection.hdr', (hdrTexture) => {
  const envMap = pmremGenerator.fromEquirectangular(hdrTexture).texture;

  scene.environment = envMap;

  // Rotate HDRI (THIS is the correct way)
  scene.environmentRotation = new THREE.Euler(
    0,
    0,
    0
  );

  hdrTexture.dispose();
  pmremGenerator.dispose();
});


// =============== TEST CUBE ===============
//const cube = new THREE.Mesh(
//  new THREE.BoxGeometry(2, 2, 2),
//  new THREE.MeshStandardMaterial({ color: 0xff0000 })
//);
//cube.position.set(0, 1, 0);
//scene.add(cube);

// =============== LOAD GLTF ENVIRONMENT ===============
const loader = new GLTFLoader();

loader.load('./assets/POCroom3.glb',(gltf) =>
  {
    console.log('GLTF loaded:', gltf);

    const env = gltf.scene;

    // Optional: adjust scale if your scene is huge or tiny
    //env.scale.set(1, 1, 1);

    // Center it if needed
    env.position.set(0, 0, 0);

    env.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    scene.add(env);
    sceneLoaded = true;
    tryHideLoader();

    // Question Trigger

    env.traverse((child) => {
  if (child.isMesh && child.name === "questtrigger1") {
    questTrigger1 = child;
    //questTrigger1.visible = false;   // optional: hide trigger mesh
    console.log("Found trigger object:", questTrigger1);
  }

  if (child.name === 'Pebbles') {
    pebblesTarget = child;
    console.log('Found Pebbles target:', pebblesTarget);
  }

  //HDR Reflection Control
 if (!child.isMesh || !child.material) return;

  if (['questtrigger1'].includes(child.name)) {
    child.material.envMapIntensity = 0.4;
    child.material.roughness = Math.min(child.material.roughness, 0.05);
  } else {
    child.material.envMapIntensity = 0;
  } 
    child.material.needsUpdate = true;
  
});

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

// ============== QUESTION UI FUNCTIONS ==============
function openQuestion(questionText, questionId = null) {
  isQuestionOpen = true;
  currentQuestionId = questionId;

  questionTextEl.textContent = questionText;
  questionAnswerEl.value = '';
  questionAnswerEl.style.height = 'auto';

  questionOverlay.classList.add('active');

  if (controls) controls.unlock();

  setTimeout(() => {
    questionAnswerEl.focus();
  }, 50);
}

function closeQuestion() {
  isQuestionOpen = false;
  currentQuestionId = null;

  questionOverlay.classList.remove('active');
  questionAnswerEl.blur();
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function once(element, event) {
  return new Promise(resolve => {
    element.addEventListener(event, resolve, { once: true });
  });
}

// Start reflection sequence
async function startReflectionSequence(questionText, questionId) {
  if (reflectionState !== 'running') return;

  // 1. Fade to black (3s)
  fadeOverlay.classList.add('active');
  await wait(3000);

  // 2. Fade in video
  videoOverlay.classList.add('active');
  reflectionVideo.currentTime = 0;
  reflectionVideo.play();

  // Wait until video is ready
  if (reflectionVideo.readyState < 3) {
    await once(reflectionVideo, 'canplay');
  }

  // 3. Let video play for 3 seconds
  await wait(3000);

  // 4. Show question UI
  openQuestion(questionText, questionId);
}


// =============== ANIMATE ===============
function animate() {
  requestAnimationFrame(animate);

if (reflectionState === 'idle' && questTrigger1) {
  const playerPos = controls.getObject().position;
  const triggerPos = questTrigger1.getWorldPosition(new THREE.Vector3());
  const dist = playerPos.distanceTo(triggerPos);

  if (dist < 12.0) {
    reflectionState = 'running';
    startReflectionSequence(
      "Why do I believe this?",
      "question-1"
    );
  }
}

  // ============= MOVEMENT (DISABLED WHEN UI OPEN) =============
  if (!isQuestionOpen && controls) {
    direction.z = Number(moveForward) - Number(moveBackward);
    direction.x = Number(moveRight) - Number(moveLeft);
    direction.normalize();

    const delta = 0.016; // ~60fps

    if (moveForward || moveBackward) {
      controls.moveForward(direction.z * WALK_SPEED * delta);
    }
    if (moveLeft || moveRight) {
      controls.moveRight(direction.x * WALK_SPEED * delta);
    }
  }

  // ============= RENDER FRAME =============
  renderer.render(scene, camera);
}

animate();
