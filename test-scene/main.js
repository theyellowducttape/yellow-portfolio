import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

// ============== GLOBAL APP DATA ==============
window.appData = {
  topic: "",
  initialBelief: "",
  answers: []
};

// ============== HOME SCREEN REFERENCES ==============
const homeScreen = document.getElementById('home-screen');
const topicInput = document.getElementById('topic-input');
const beliefInput = document.getElementById('belief-input');
const homeBeginBtn = document.getElementById('home-begin');
const reflectionLogEntries = document.getElementById('reflection-log-entries');

const endScreen = document.getElementById('end-screen');
const endLog = document.getElementById('end-log');

const downloadPdfBtn = document.getElementById('download-pdf-btn');
const newSessionBtn = document.getElementById('new-session-btn');

// ============== QUESTION DOOR PROMPT ==============
const doorPrompt = document.getElementById('door-prompt');

let canUnlockDoor = false;

const roomDoorMap = {
  1: "door-1",
  2: "door-2",
  3: "door-3"
};

// ============== PLAYER POSITION ==============
const roomSpawns = {
  1: new THREE.Vector3(0, 5, 30),
  2: new THREE.Vector3(0, 5, 30),
  3: new THREE.Vector3(0, 5, 30)
};

// ============== QUESTION UI DOM REFERENCES ==============
const questionOverlay = document.getElementById('question-overlay');
const questionTextEl = document.getElementById('question-text');
const questionAnswerEl = document.getElementById('question-answer');
const questionSubmitBtn = document.getElementById('question-submit');
//const questionCancelBtn = document.getElementById('question-cancel');

const doorQuestions = {
  "door-1": [
    "How does this impact how I think and how I behave?",
    "Can I put my feelings aside and just think about the field?"
  ],

  "door-2": [
    "Why do I believe this?",
    "Am I making assumptions?",
    "Am I biased?",
    "Can I put my bias aside and be open-minded to new ideas?"
  ],

  "door-3": [
    "Are these my own ideas or am I influenced by other people?",
    "How do I know I am right?",
    "Is it based on emotion or fact?"
  ]

};

let activeDoorId = null;
let currentQuestionIndex = 0;

document.addEventListener('keydown', (e) => {

  if (e.code !== 'Enter') return;
  if (!canUnlockDoor) return;
  if (reflectionState !== 'idle') return;

  const doorId = roomDoorMap[currentRoom];
  startReflectionSequence(doorId);

});

// ============== ROOM LOADERS ==============

let currentRoom = 1;
let currentEnvironment = null;

// ============== HOME BEGIN BUTTON ==============
homeBeginBtn.addEventListener('click', () => {

  const topic = topicInput.value.trim();
  const belief = beliefInput.value.trim();

  if (!topic || !belief) {
    alert("Please fill both fields.");
    return;
  }

  window.appData.topic = topic;
  window.appData.initialBelief = belief;

  addReflectionLog("What I believe about this topic?", belief);

  homeScreen.classList.add('hidden');

  currentRoom = 1;
  loadEnvironment(1);

  controls.lock();

});

// ============== CINEMATIC OVERLAYS ==============
const fadeOverlay = document.getElementById('fade-overlay');
const videoOverlay = document.getElementById('video-overlay');
const reflectionVideo = document.getElementById('reflection-video');

// ============== TEXT AREA AUTO-RESIZE ==============
questionAnswerEl.addEventListener('input', autoResizeTextarea);

function autoResizeTextarea() {
  this.style.height = 'auto';                 // reset height
  this.style.height = this.scrollHeight + 'px'; // grow to fit content
}

// state

let sceneLoaded = false;
let minLoadTimePassed = false;

let isQuestionOpen = false;
let currentQuestionId = null; // later you can use this to track which room/question was asked
let questTrigger1 = null;   // define global trigger reference
let reflectionState = 'idle';
let isSubmittingAnswer = false;

// ============== LOADER CONDITIONS ==============
setTimeout(() => {
  minLoadTimePassed = true;
  tryHideLoader();
}, 3000);

const loaderOverlay = document.getElementById('loader-overlay');

function tryHideLoader() {

  if (minLoadTimePassed) {

    loaderOverlay.style.opacity = '0';
    loaderOverlay.style.transition = 'opacity 0.6s ease';

    setTimeout(() => {
      loaderOverlay.style.display = 'none';

      // SHOW HOME SCREEN
      homeScreen.classList.remove('hidden');

    }, 600);
  }

}

// ============== LOADER CONDITIONS ==============
function addReflectionLog(question, answer) {

  const entry = document.createElement('div');
  entry.className = 'log-entry';

  entry.innerHTML = `
    <div class="log-question">${question}</div>
    <div class="log-answer">${answer}</div>
  `;

  reflectionLogEntries.appendChild(entry);

  // Auto scroll to bottom
  reflectionLogEntries.scrollTop = reflectionLogEntries.scrollHeight;
}

// ============== QUESTION SUBMIT ==============

questionSubmitBtn.addEventListener('click', async () => {

  if (isSubmittingAnswer) return;
  isSubmittingAnswer = true;

  const answer = questionAnswerEl.value.trim();
  if (!answer) {
  isSubmittingAnswer = false;
  return;
}

  // ========== HOME QUESTION ==========
  if (currentQuestionId === "initial-belief") {

    window.appData.initialBelief = answer;
    console.log("Initial belief stored:", answer);

    closeQuestion();
    controls.lock();
    return;
  }

  // ========== DOOR QUESTIONS ==========
  window.appData.answers.push({
    door: activeDoorId,
    question: doorQuestions[activeDoorId][currentQuestionIndex],
    answer
  });

  addReflectionLog(
  doorQuestions[activeDoorId][currentQuestionIndex],
  answer
  );

  currentQuestionIndex++;

  // ---- MORE QUESTIONS REMAIN ----
  if (currentQuestionIndex < doorQuestions[activeDoorId].length) {

    openQuestion(
      doorQuestions[activeDoorId][currentQuestionIndex],
      activeDoorId
    );

    isSubmittingAnswer = false;
    return; 

  }

  // ---- FINISHED ALL QUESTIONS FOR THIS DOOR ----
  closeQuestion();

  videoOverlay.classList.remove('active');
  reflectionVideo.pause();

  reflectionState = 'idle';

  console.log(`${activeDoorId} completed`);

  // ---- ROOM TRANSITION ----
  await wait(800);
  fadeOverlay.classList.add('active');

  await wait(1200);

if (currentRoom < 3) {

  currentRoom++;
  loadEnvironment(currentRoom);

} else {

  // Final room completed
  fadeOverlay.classList.add('active');

  await wait(1500);

  showEndScreen();

}

  fadeOverlay.classList.remove('active');

  isSubmittingAnswer = false;

});

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
function isAnyUIOpen() {
  return (
    !homeScreen.classList.contains('hidden') ||
    isQuestionOpen ||
    !endScreen.classList.contains('hidden')
  );
}

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
function loadEnvironment(roomNumber) {

  const loader = new GLTFLoader();

  const roomFiles = {
    1: './assets/Room1.glb',
    2: './assets/Room2.glb',
    3: './assets/Room3.glb'
  };

  const file = roomFiles[roomNumber];
  if (!file) return;

  loader.load(file, (gltf) => {

    console.log(`Room ${roomNumber} loaded`);

    // Reset per-room state
    currentQuestionIndex = 0;
    activeDoorId = null;
    isSubmittingAnswer = false;
    canUnlockDoor = false;
    reflectionState = 'idle';
    questTrigger1 = null;

    // Remove previous room
    if (currentEnvironment) {
      scene.remove(currentEnvironment);
    }

    const env = gltf.scene;
    currentEnvironment = env;

    env.position.set(0,0,0);

    env.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }

      if (child.name === "questtrigger1") {
        questTrigger1 = child;
      }

    });

    scene.add(env);

    // Reset player position
controls.getObject().position.copy(roomSpawns[roomNumber]);

// Reset rotation
camera.rotation.set(0, 0, 0);
controls.getObject().rotation.set(0, 0, 0);

// Re-lock controls
setTimeout(() => {
  controls.lock();
}, 100);

  });

}

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

// =============== START REFLECTION ===============
async function startReflectionSequence(doorId) {

  // HARD BLOCK
  if (reflectionState !== 'idle') return;

  reflectionState = 'running';
  activeDoorId = doorId;

  // RESET STATE FIRST (important)
  currentQuestionIndex = 0;
  isSubmittingAnswer = false;

  doorPrompt.classList.add('hidden');
  canUnlockDoor = false;

  // 1. Fade to black
  fadeOverlay.classList.add('active');
  await wait(3000);

  // 2. Fade in video
  videoOverlay.classList.add('active');
  reflectionVideo.currentTime = 0;
  reflectionVideo.loop = true;
  reflectionVideo.play();

  if (reflectionVideo.readyState < 3) {
    await once(reflectionVideo, 'canplay');
  }

  // 3. Small pause
  await wait(2000);

  // 4. Show FIRST question
  openQuestion(
    doorQuestions[doorId][0],
    doorId
  );
}

// =============== ANIMATE ===============
function animate() {
  requestAnimationFrame(animate);

if (reflectionState === 'idle' && questTrigger1 && !isQuestionOpen) {

  const playerPos = controls.getObject().position;
  const triggerPos = questTrigger1.getWorldPosition(new THREE.Vector3());
  const dist = playerPos.distanceTo(triggerPos);

  if (dist < 12.0) {

    canUnlockDoor = true;
    doorPrompt.classList.remove('hidden');

  } else {

    canUnlockDoor = false;
    doorPrompt.classList.add('hidden');

  }

}

  // ============= MOVEMENT (DISABLED WHEN UI OPEN) =============
if (!isAnyUIOpen() && controls) {

  direction.set(
    Number(moveRight) - Number(moveLeft),
    0,
    Number(moveForward) - Number(moveBackward)
  );

  if (direction.lengthSq() > 0) {
    direction.normalize();

    const delta = 0.016;

    controls.moveForward(direction.z * WALK_SPEED * delta);
    controls.moveRight(direction.x * WALK_SPEED * delta);
  }

}

  // ============= RENDER FRAME =============
  renderer.render(scene, camera);
}

  // ============= END SCREEN =============
function showEndScreen() {

  endLog.innerHTML = "";

  // Initial belief
  const first = document.createElement('div');
  first.className = "end-entry";
  first.innerHTML = `
    <div class="end-question">What I believe about this topic?</div>
    <div class="end-answer">${window.appData.initialBelief}</div>
  `;
  endLog.appendChild(first);

  // Door answers
  window.appData.answers.forEach(entry => {

    const div = document.createElement('div');
    div.className = "end-entry";

    div.innerHTML = `
      <div class="end-question">${entry.question}</div>
      <div class="end-answer">${entry.answer}</div>
    `;

    endLog.appendChild(div);
  });

  endScreen.classList.remove('hidden');
}

function downloadSessionPDF() {

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  let y = 20;

  // Title
  doc.setFontSize(18);
  doc.text("Thinking Generator Session", 20, y);
  y += 12;

  doc.setFontSize(12);
  doc.text(`Topic: ${window.appData.topic}`, 20, y);
  y += 12;

  // Initial belief
  doc.setFontSize(14);
  doc.text("What I believe about this topic?", 20, y);
  y += 8;

  doc.setFontSize(11);
  doc.text(window.appData.initialBelief, 20, y, { maxWidth: 170 });
  y += 16;

  // Door answers
  window.appData.answers.forEach(entry => {

    if (y > 270) {
      doc.addPage();
      y = 20;
    }

    doc.setFontSize(14);
    doc.text(entry.question, 20, y);
    y += 8;

    doc.setFontSize(11);
    doc.text(entry.answer, 20, y, { maxWidth: 170 });
    y += 16;

  });

  doc.save("thinking-generator-session.pdf");
}

function startNewSession() {

  // Reset data
  window.appData.topic = "";
  window.appData.initialBelief = "";
  window.appData.answers = [];

  reflectionLogEntries.innerHTML = "";
  endLog.innerHTML = "";

  // Reset state
  currentRoom = 1;
  reflectionState = 'idle';
  isQuestionOpen = false;
  currentQuestionIndex = 0;

  // Hide end screen
  endScreen.classList.add('hidden');

  // Show home screen again
  homeScreen.classList.remove('hidden');

  // Clear inputs
  topicInput.value = "";
  beliefInput.value = "";
}

downloadPdfBtn.addEventListener('click', downloadSessionPDF);
newSessionBtn.addEventListener('click', startNewSession);

animate();
