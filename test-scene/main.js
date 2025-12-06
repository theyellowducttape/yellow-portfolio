import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

// ============== QUESTION UI DOM REFERENCES ==============
const questionOverlay = document.getElementById('question-overlay');
const questionTextEl = document.getElementById('question-text');
const questionAnswerEl = document.getElementById('question-answer');
const questionSubmitBtn = document.getElementById('question-submit');
const questionCancelBtn = document.getElementById('question-cancel');

// state
let isQuestionOpen = false;
let currentQuestionId = null; // later you can use this to track which room/question was asked
let questionTriggered1 = false;
let questTrigger1 = null;   // define global trigger reference

// ============== QUESTION BUTTON EVENTS ==============
questionSubmitBtn.addEventListener('click', () => {
  const answer = questionAnswerEl.value.trim();

  console.log('Submitted answer:', {
    question: questionTextEl.textContent,
    answer,
    questionId: currentQuestionId,
  });

  questionTriggered1 = true; // Prevent question from repeating
  closeQuestion();
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
camera.position.set(0, 2, 0);

// ==================== PLAYER CONTROLS (WASD) ====================
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
const light = new THREE.DirectionalLight(0xffffff, 2);
light.position.set(0, 1, 0);
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

    // Question Trigger

    env.traverse((child) => {
  if (child.isMesh && child.name === "questtrigger1") {
    questTrigger1 = child;
    //questTrigger1.visible = false;   // optional: hide trigger mesh
    console.log("Found trigger object:", questTrigger1);
  }
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

  questionOverlay.classList.remove('hidden');
  questionTextEl.textContent = questionText;
  questionAnswerEl.value = '';

  if (controls) controls.unlock(); // release mouse so user can click UI

  // focus input after opening
  setTimeout(() => {
    questionAnswerEl.focus();
  }, 50);
}

function closeQuestion() {
  isQuestionOpen = false;
  currentQuestionId = null;

  questionOverlay.classList.add('hidden');
  questionAnswerEl.blur();
}

// =============== ANIMATE ===============
function animate() {
  requestAnimationFrame(animate);

  // ============= QUESTION TRIGGER CHECK =============
  if (!isQuestionOpen && questTrigger1 && !questionTriggered1) {
    const playerPos = controls.getObject().position;
    const triggerPos = questTrigger1.getWorldPosition(new THREE.Vector3());
    const dist = playerPos.distanceTo(triggerPos);

    if (dist < 4.0) {  // adjust distance if needed
      //questionTriggered1 = true;
      openQuestion(
        "When you pause in this space, what thought, feeling, or truth rises to the surface?",
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
