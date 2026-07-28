import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

/* ============================================================
   CONFIG
   ============================================================ */

const ROOM_COUNT = 3;
const WALK_SPEED = 10;
const DOOR_TRIGGER_DISTANCE = 12;
const TRIGGER_MESH_NAME = 'questtrigger1';

const ROOM_FILES = {
  1: './assets/Room1.glb',
  2: './assets/Room2.glb',
  3: './assets/Room3.glb'
};

const ROOM_VIDEOS = {
  1: './assets/R1_seq.mp4',
  2: './assets/R2_seq.mp4',
  3: './assets/R3_seq.mp4'
};

const ROOM_DOORS = {
  1: 'door-1',
  2: 'door-2',
  3: 'door-3'
};

/* One HDRI per room. Swap these filenames for the real assets.
   Anything that fails to load falls back to FALLBACK_HDRI, so placeholder
   names will not break the scene, they will just log a warning. */
const ROOM_HDRIS = {
  1: './assets/room1.hdr',
  2: './assets/room2.hdr',
  3: './assets/room3.hdr'
};

const FALLBACK_HDRI = './assets/reflection.hdr';

// All three rooms have windows, so the HDRI is the visible sky.
// Set false to fall back to the flat backdrop below, useful when debugging.
const HDRI_AS_BACKGROUND = true;
const FLAT_BACKGROUND = new THREE.Color(0x202020);

const ROOM_SPAWNS = {
  1: new THREE.Vector3(0, 3, 0),
  2: new THREE.Vector3(0, 1.5, -5),
  3: new THREE.Vector3(0, 1.5, -5)
};

const DOOR_QUESTIONS = {
  'door-1': [
    'How does this impact how I think and how I behave?',
    'Can I put my feelings aside and just think about the field?'
  ],
  'door-2': [
    'Why do I believe this?',
    'Am I making assumptions?',
    'Am I biased?',
    'Can I put my bias aside and be open-minded to new ideas?'
  ],
  'door-3': [
    'Are these my own ideas or am I influenced by other people?',
    'How do I know I am right?',
    'Is it based on emotion or fact?'
  ]
};

const BELIEF_QUESTION = 'What do I believe about this topic?';

/* Per-room lighting compensation.
   The GLBs carry their own punctual lights, so brightness drifts between rooms
   depending on how each was authored. These are seeded to neutral values, so
   the look is unchanged until you tune a row.

   exposure             renderer.toneMappingExposure while this room is active
   envMapIntensity      how strongly the HDRI lights the room's materials
   fill                 hemisphere fill light intensity; 0 adds no light at all
   backgroundIntensity  brightness of the sky seen through the windows, applied
                        independently of envMapIntensity
   backgroundBlurriness 0 is sharp, 1 is fully diffuse; a little hides a
                        low-resolution HDRI and reads as depth of field
   rotationY            radians of yaw, to aim the good part of the HDRI at the
                        window. Requires three r163+, see note in applyRoomLighting */
const ROOM_LIGHTING = {
  1: {
    exposure: 0.75,
    envMapIntensity: 0.75,
    fill: 0,
    backgroundIntensity: 1,
    backgroundBlurriness: 0,
    rotationY: 0
  },
  2: {
    exposure: 1.5,
    envMapIntensity: 1,
    fill: 0,
    backgroundIntensity: 1,
    backgroundBlurriness: 0,
    rotationY: 0
  },
  3: {
    exposure: 0.75,
    envMapIntensity: 0.5,
    fill: 0,
    backgroundIntensity: 0.75,
    backgroundBlurriness: 0,
    rotationY: 0
  }
};

// Set to true to print a lighting audit for each room to the console.
const DEBUG_LIGHTING = false;

const MOVE_KEYS = {
  ArrowUp: 'forward',
  ArrowDown: 'backward',
  ArrowLeft: 'left',
  ArrowRight: 'right'
};

/* Ambience. One looping track for the entire session. It plays continuously
   across the onboarding screens, the rooms, the reflection videos, the question
   UI and the end screen. Replace the filename with the real asset. */
const AMBIENT_AUDIO = './assets/soundscape.mp3';

// Ceiling volume, 0 to 1. The opening fade targets this, never 1.
const AMBIENT_VOLUME = 0.5;

// Length of the single fade-up when the track first starts.
const AUDIO_FADE_IN = 2500;

const LOADER_MIN_DURATION = 3000;

// Cinematic fade to black. Must match the #fade-overlay transition in uistyles.css.
const FADE_TO_BLACK = 2000;

// How long the reflection video runs before the first question appears. The
// black is lifting during the first FADE_TO_BLACK ms of this window.
const VIDEO_HOLD = 3500;

// Crossfade half-duration for swapping question text. Must match the
// #question-text / #question-answer transition in uistyles.css.
const QUESTION_FADE = 350;

// Session reset transition. RESET_FADE must match #fade-overlay.is-quick.
const RESET_FADE = 800;
const RESET_LOADER_HOLD = 1600;

/* ============================================================
   STATE
   ============================================================ */

// phase: 'loading' | 'onboarding' | 'entering' | 'exploring' | 'reflecting' | 'complete'
const state = {
  phase: 'loading',
  currentRoom: 1,
  activeDoorId: null,
  questionIndex: 0,
  canUnlockDoor: false,
  isQuestionOpen: false,
  isSubmitting: false,
  isResetting: false,
  isMuted: false
};

const session = {
  name: '',
  topic: '',
  entries: [] // { id, question, answer }
};

// Exposed for debugging only.
window.appData = session;

const move = { forward: false, backward: false, left: false, right: false };

let activeButton = null;
let currentEnvironment = null;
let doorTrigger = null;

/* ============================================================
   DOM REFERENCES
   ============================================================ */

const loaderOverlay = document.getElementById('loader-overlay');
const loaderState = document.getElementById('loader-state');
const homeState = document.getElementById('home-state');

const nameStep = document.getElementById('name-step');
const topicStep = document.getElementById('topic-step');
const beliefStep = document.getElementById('belief-step');

const nameInput = document.getElementById('name-input');
const topicInput = document.getElementById('topic-input');
const qstn0Input = document.getElementById('qstn0-input');

const startBtn = document.getElementById('start-btn');
const continueBtn = document.getElementById('continue-btn');
const submitBtn = document.getElementById('submit-btn');

const greetingText = document.getElementById('greeting-text');

const navHint = document.getElementById('nav-hint');
const navAudioLabel = document.getElementById('nav-audio-label');
const doorPrompt = document.getElementById('door-prompt');

const reflectionLog = document.getElementById('reflection-log');
const reflectionLogEntries = document.getElementById('reflection-log-entries');

const fadeOverlay = document.getElementById('fade-overlay');
const videoOverlay = document.getElementById('video-overlay');
const reflectionVideo = document.getElementById('reflection-video');

const questionOverlay = document.getElementById('question-overlay');
const questionBox = document.getElementById('question-box');
const questionTextEl = document.getElementById('question-text');
const questionAnswerEl = document.getElementById('question-answer');
const questionSubmitBtn = document.getElementById('question-submit');

const loaderGif = document.querySelector('.loader-gif');

const endScreen = document.getElementById('end-screen');
const endTopicBlock = document.getElementById('end-topic-block');
const endTopic = document.getElementById('end-topic');
const endLog = document.getElementById('end-log');
const downloadPdfBtn = document.getElementById('download-pdf-btn');
const newSessionBtn = document.getElementById('new-session-btn');

/* ============================================================
   UTILITIES
   ============================================================ */

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isUIBlockingMovement() {
  return state.phase !== 'exploring' || state.isQuestionOpen;
}

function resetMovement() {
  move.forward = false;
  move.backward = false;
  move.left = false;
  move.right = false;
}

/* #fade-overlay sits at z-index 1000, above every other layer including the
   video, the question box and the end screen. That means it must always be
   lifted again, or whatever is underneath stays invisible. Use these two
   helpers in pairs rather than touching the class directly. */

/** Fades to black and resolves once it is fully opaque. */
async function fadeToBlack(duration = FADE_TO_BLACK) {
  fadeOverlay.classList.add('active');
  await wait(duration);
}

/** Starts lifting the black. Does not wait for it to finish. */
function clearBlack() {
  fadeOverlay.classList.remove('active');
}

/** Builds a two-line entry block without using innerHTML. */
function buildEntry(wrapperClass, questionClass, answerClass, question, answer) {
  const wrapper = document.createElement('div');
  wrapper.className = wrapperClass;

  const q = document.createElement('div');
  q.className = questionClass;
  q.textContent = question;

  const a = document.createElement('div');
  a.className = answerClass;
  a.textContent = answer;

  wrapper.append(q, a);
  return wrapper;
}

/* ============================================================
   AMBIENCE

   One looping track for the whole session. Browsers refuse programmatic
   playback until the user has interacted, so it starts on the first
   interaction, and from that point it never stops or dips: it plays across the
   onboarding screens, the rooms, the reflection videos, the question UI and the
   end screen. Mute is the only thing that silences it.
   ============================================================ */

const ambientAudio = new Audio();
ambientAudio.src = AMBIENT_AUDIO;
ambientAudio.loop = true;
ambientAudio.preload = 'auto';
ambientAudio.volume = 0;

ambientAudio.addEventListener('error', () => {
  console.warn(`Ambience "${AMBIENT_AUDIO}" could not be loaded.`);
});

// loop should make this unreachable, but browsers do occasionally fire ended on
// a decode or network hiccup. Restarting here guarantees the track cannot die
// partway through a session, which matters for an unattended installation.
ambientAudio.addEventListener('ended', () => {
  ambientAudio.currentTime = 0;
  ambientAudio.play().catch(() => {});
});

let ambienceStarted = false;

// Incremented on every new fade so a superseded fade abandons its own loop
// instead of fighting the new one. Only the opening fade uses this today, but
// it is what would make a future volume dip safe.
let audioFadeId = 0;

/** Tweens volume. Resolves true if it finished, false if a newer fade took over. */
function fadeAudio(target, duration) {
  const id = ++audioFadeId;
  const from = ambientAudio.volume;
  const to = Math.min(Math.max(target, 0), 1);

  if (duration <= 0) {
    ambientAudio.volume = to;
    return Promise.resolve(true);
  }

  const startedAt = performance.now();

  return new Promise((resolve) => {
    function tick(now) {
      if (id !== audioFadeId) {
        resolve(false);
        return;
      }

      const t = Math.min((now - startedAt) / duration, 1);
      ambientAudio.volume = from + (to - from) * t;

      if (t < 1) requestAnimationFrame(tick);
      else resolve(true);
    }

    requestAnimationFrame(tick);
  });
}

function detachAmbienceTriggers() {
  document.removeEventListener('pointerdown', startAmbience);
  document.removeEventListener('keydown', startAmbience);
}

function confirmAmbienceStarted() {
  ambienceStarted = true;
  detachAmbienceTriggers();
  fadeAudio(AMBIENT_VOLUME, AUDIO_FADE_IN);
}

/** Starts the track once and fades it up. Every later call is a no-op. */
function startAmbience() {
  if (ambienceStarted) return;

  ambientAudio.volume = 0;
  const attempt = ambientAudio.play();

  // Older browsers return undefined instead of a promise.
  if (!attempt) {
    confirmAmbienceStarted();
    return;
  }

  attempt.then(confirmAmbienceStarted).catch(() => {
    // Triggers stay attached on purpose, so the next interaction retries.
    // No warning here: one refusal before the browser is satisfied is normal.
  });
}

/* Any interaction is a valid trigger and each one retries until playback
   sticks, which is why nothing else in the app has to call startAmbience. */
document.addEventListener('pointerdown', startAmbience);
document.addEventListener('keydown', startAmbience);

/* Mute uses the muted property rather than volume, so it never fights the
   opening fade. It covers the reflection video too, since a mute key that only
   silenced half the piece would be surprising. */
function applyMuteState() {
  ambientAudio.muted = state.isMuted;
  reflectionVideo.muted = state.isMuted;

  navAudioLabel.textContent = state.isMuted ? 'unmute' : 'mute';
}

function toggleMute() {
  state.isMuted = !state.isMuted;
  applyMuteState();
}

/* ============================================================
   THREE.JS SETUP
   ============================================================ */

const scene = new THREE.Scene();
scene.background = FLAT_BACKGROUND;

const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.75;
document.body.appendChild(renderer.domElement);

// PointerLockControls rotates the camera directly, so controls.getObject() === camera.
const controls = new PointerLockControls(camera, document.body);
scene.add(camera);

controls.addEventListener('unlock', resetMovement);

// A lock() call that lands outside a fresh user gesture is rejected by the browser.
// The canvas click handler below is the recovery path, so this stays a warning.
document.addEventListener('pointerlockerror', () => {
  console.warn('Pointer lock was refused. Click the scene to look around.');
});

const clock = new THREE.Clock();
const gltfLoader = new GLTFLoader();
const moveDirection = new THREE.Vector3();
const triggerWorldPos = new THREE.Vector3();

// ---- Image based lighting ----
// The generator is deliberately never disposed. Disposing it frees its internal
// render targets, which would break every subsequent fromEquirectangular call.
const pmremGenerator = new THREE.PMREMGenerator(renderer);
pmremGenerator.compileEquirectangularShader();

const rgbeLoader = new RGBELoader();

// path -> { background, environment }, kept for the app lifetime so returning to
// a room never re-decodes its HDRI.
const hdriCache = new Map();

/* Two textures per HDRI:
   background  the full resolution equirect, so the view through a window stays sharp
   environment the PMREM cubemap, which is what should light the materials
   The source is intentionally not disposed, because it is the background. */
async function getRoomMaps(path) {
  if (!path) return null;
  if (hdriCache.has(path)) return hdriCache.get(path);

  const source = await rgbeLoader.loadAsync(path);
  source.mapping = THREE.EquirectangularReflectionMapping;

  const maps = {
    background: source,
    environment: pmremGenerator.fromEquirectangular(source).texture
  };

  hdriCache.set(path, maps);
  return maps;
}

function applyRoomMaps(maps) {
  scene.environment = maps.environment;
  scene.background = HDRI_AS_BACKGROUND ? maps.background : FLAT_BACKGROUND;
}

/** Resolves once the room's HDRI is live. Never rejects. */
async function loadRoomEnvironmentMap(roomNumber) {
  const path = ROOM_HDRIS[roomNumber];

  try {
    const maps = await getRoomMaps(path);
    if (maps) {
      applyRoomMaps(maps);
      return;
    }
    console.warn(`No HDRI mapped for room ${roomNumber}.`);
  } catch (error) {
    console.warn(`HDRI for room ${roomNumber} ("${path}") failed to load.`, error);
  }

  try {
    const fallback = await getRoomMaps(FALLBACK_HDRI);
    if (fallback) applyRoomMaps(fallback);
  } catch (error) {
    console.warn(
      `Fallback HDRI ("${FALLBACK_HDRI}") failed too. Rooms will be lit only by the lights inside their GLB.`,
      error
    );
    scene.background = FLAT_BACKGROUND;
  }
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Click the canvas to re-capture the mouse.
renderer.domElement.addEventListener('click', () => {
  if (state.phase === 'exploring' && !state.isQuestionOpen && !controls.isLocked) {
    controls.lock();
  }
});

window.addEventListener('blur', resetMovement);

/* ============================================================
   ENVIRONMENT LOAD / UNLOAD
   ============================================================ */

function setHudVisible(visible) {
  navHint.classList.toggle('hidden', !visible);
  reflectionLog.classList.toggle('hidden', !visible);
}

function hideDoorPrompt() {
  state.canUnlockDoor = false;
  doorPrompt.classList.add('is-faded');
}

/** Applies the per-room exposure, IBL strength, sky settings and fill light. */
function applyRoomLighting(env, roomNumber) {
  const config = ROOM_LIGHTING[roomNumber] ?? ROOM_LIGHTING[1];

  renderer.toneMappingExposure = config.exposure;

  // Sky seen through the windows. Guarded because these properties arrived in
  // different three versions; unsupported ones are simply skipped.
  if ('backgroundIntensity' in scene) {
    scene.backgroundIntensity = config.backgroundIntensity ?? 1;
  }

  if ('backgroundBlurriness' in scene) {
    scene.backgroundBlurriness = config.backgroundBlurriness ?? 0;
  }

  // backgroundRotation and environmentRotation need three r163+. The importmap
  // in index.html pins r160, so a non-zero rotationY warns instead of silently
  // doing nothing.
  if ('backgroundRotation' in scene) {
    scene.backgroundRotation.set(0, config.rotationY ?? 0, 0);
    scene.environmentRotation.set(0, config.rotationY ?? 0, 0);
  } else if (config.rotationY) {
    console.warn(
      `Room ${roomNumber} sets rotationY, but scene.backgroundRotation needs three r163+. ` +
        'Either bump the importmap in index.html or rotate the HDRI in your image editor.'
    );
  }

  env.traverse((child) => {
    if (!child.isMesh || !child.material) return;

    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => {
      if (material && 'envMapIntensity' in material) {
        material.envMapIntensity = config.envMapIntensity;
        material.needsUpdate = true;
      }
    });
  });

  // Parented to the room group so it is removed with the room.
  if (config.fill > 0) {
    env.add(new THREE.HemisphereLight(0xffffff, 0x404040, config.fill));
  }
}

/** Console report explaining why a room renders the way it does. */
function auditRoomLighting(env, roomNumber) {
  const lights = [];
  const materialTypes = new Set();
  let meshCount = 0;
  let emissiveCount = 0;

  env.traverse((child) => {
    if (child.isLight) {
      lights.push({
        type: child.type,
        name: child.name || '(unnamed)',
        intensity: child.intensity,
        color: `#${child.color.getHexString()}`,
        distance: child.distance ?? 'n/a',
        angle: child.angle ?? 'n/a'
      });
    }

    if (child.isMesh) {
      meshCount += 1;
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => {
        if (!material) return;
        materialTypes.add(material.type);
        const emissive = material.emissive?.getHex() ?? 0;
        if (emissive !== 0 && (material.emissiveIntensity ?? 1) > 0) emissiveCount += 1;
      });
    }
  });

  console.group(`Room ${roomNumber} lighting audit`);
  console.log(`meshes: ${meshCount}`);
  console.log(`punctual lights in GLB: ${lights.length}`);
  if (lights.length) console.table(lights);
  const config = ROOM_LIGHTING[roomNumber] ?? ROOM_LIGHTING[1];

  console.log('material types:', [...materialTypes].join(', ') || 'none');
  console.log(`emissive materials: ${emissiveCount} (emissive casts no light in three.js)`);
  console.log('HDRI:', ROOM_HDRIS[roomNumber] ?? 'none mapped');
  console.log('scene.environment loaded:', Boolean(scene.environment));
  console.log('background is HDRI:', scene.background?.isTexture === true);
  console.log('envMapIntensity:', config.envMapIntensity);
  console.log('backgroundIntensity:', scene.backgroundIntensity ?? 'unsupported');
  console.log('backgroundBlurriness:', scene.backgroundBlurriness ?? 'unsupported');
  console.log('rotation support:', 'backgroundRotation' in scene ? 'yes' : 'no (needs r163+)');
  console.log('toneMappingExposure:', renderer.toneMappingExposure);
  console.groupEnd();
}

async function loadEnvironment(roomNumber) {
  const file = ROOM_FILES[roomNumber];
  if (!file) {
    console.warn(`No GLB mapped for room ${roomNumber}`);
    return;
  }

  let gltf;
  try {
    // In parallel, so the HDRI is live before the room is ever revealed.
    // loadRoomEnvironmentMap handles its own failures and never rejects.
    [gltf] = await Promise.all([
      gltfLoader.loadAsync(file),
      loadRoomEnvironmentMap(roomNumber)
    ]);
  } catch (error) {
    console.error(`Room ${roomNumber} failed to load`, error);
    return;
  }

  unloadEnvironment();

  // Reset per-room state
  state.questionIndex = 0;
  state.activeDoorId = null;
  state.isSubmitting = false;
  doorTrigger = null;
  hideDoorPrompt();

  const env = gltf.scene;
  env.position.set(0, 0, 0);

  env.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
    if (child.name === TRIGGER_MESH_NAME) {
      doorTrigger = child;
    }
  });

  if (!doorTrigger) {
    console.warn(`Room ${roomNumber} has no mesh named "${TRIGGER_MESH_NAME}"`);
  }

  applyRoomLighting(env, roomNumber);
  if (DEBUG_LIGHTING) auditRoomLighting(env, roomNumber);

  scene.add(env);
  currentEnvironment = env;

  // Reset the player
  camera.position.copy(ROOM_SPAWNS[roomNumber]);
  camera.rotation.set(0, 0, 0);

  setHudVisible(true);
}

function unloadEnvironment() {
  if (!currentEnvironment) return;

  scene.remove(currentEnvironment);

  currentEnvironment.traverse((child) => {
    if (child.geometry) child.geometry.dispose();

    if (child.material) {
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => material.dispose());
    }
  });

  currentEnvironment = null;
  doorTrigger = null;

  setHudVisible(false);
  hideDoorPrompt();
}

/* ============================================================
   ONBOARDING
   ============================================================ */

let loaderRevealed = false;

function revealHomeState() {
  if (loaderRevealed || state.phase !== 'loading') return;
  loaderRevealed = true;

  loaderState.classList.remove('active');

  setTimeout(() => {
    homeState.classList.remove('hidden');
    homeState.classList.add('active');
    loaderOverlay.classList.add('home-active');

    state.phase = 'onboarding';
    activeButton = startBtn;
    nameInput.focus();
  }, 300);
}

setTimeout(revealHomeState, LOADER_MIN_DURATION);
loaderOverlay.addEventListener('click', revealHomeState);

nameInput.addEventListener('input', () => {
  startBtn.disabled = nameInput.value.trim().length === 0;
});

topicInput.addEventListener('input', () => {
  continueBtn.disabled = topicInput.value.trim().length === 0;
});

qstn0Input.addEventListener('input', () => {
  submitBtn.disabled = qstn0Input.value.trim().length === 0;
});

// Step 1 → 2
startBtn.addEventListener('click', () => {
  const name = nameInput.value.trim();
  if (!name) return;

  session.name = name;
  greetingText.textContent = `Hello, ${name}`;

  nameStep.classList.add('hidden');
  startBtn.classList.add('hidden');

  greetingText.classList.remove('hidden');
  greetingText.classList.add('is-visible');
  topicStep.classList.remove('hidden');
  continueBtn.classList.remove('hidden');

  loaderOverlay.classList.add('header-mode');
  activeButton = continueBtn;
  topicInput.focus();
});

// Step 2 → 3
continueBtn.addEventListener('click', () => {
  const topic = topicInput.value.trim();
  if (!topic) return;

  session.topic = topic;
  greetingText.textContent = topic;

  topicStep.classList.add('hidden');
  continueBtn.classList.add('hidden');

  beliefStep.classList.remove('hidden');
  submitBtn.classList.remove('hidden');

  activeButton = submitBtn;
  qstn0Input.focus();
});

// Step 3 → enter the environment
submitBtn.addEventListener('click', () => {
  const belief = qstn0Input.value.trim();
  if (!belief) return;

  session.entries.push({
    id: 'qstn-0',
    question: BELIEF_QUESTION,
    answer: belief
  });

  addReflectionLog(BELIEF_QUESTION, belief);

  greetingText.classList.add('hidden');
  beliefStep.classList.add('hidden');
  submitBtn.classList.add('hidden');
  activeButton = null;

  enterEnvironment();
});

async function enterEnvironment() {
  state.phase = 'entering';

  // Back to the loader while the first room streams in
  homeState.classList.remove('active');
  homeState.classList.add('hidden');
  loaderOverlay.classList.remove('header-mode', 'home-active');
  loaderState.classList.add('active');

  await wait(600);

  state.currentRoom = 1;
  await loadEnvironment(1);

  loaderState.classList.remove('active');
  await wait(600);

  loaderOverlay.classList.add('hidden');
  state.phase = 'exploring';
  controls.lock();
}

/* ============================================================
   REFLECTION LOG
   ============================================================ */

function addReflectionLog(question, answer) {
  reflectionLogEntries.appendChild(
    buildEntry('log-entry', 'log-question', 'log-answer', question, answer)
  );
  reflectionLogEntries.scrollTop = reflectionLogEntries.scrollHeight;
}

/* ============================================================
   QUESTION OVERLAY
   ============================================================ */

questionAnswerEl.addEventListener('input', () => {
  questionAnswerEl.style.height = 'auto';
  questionAnswerEl.style.height = `${questionAnswerEl.scrollHeight}px`;
});

function openQuestion(questionText) {
  state.isQuestionOpen = true;

  questionBox.classList.remove('is-swapping');
  questionTextEl.textContent = questionText;
  questionAnswerEl.value = '';
  questionAnswerEl.style.height = 'auto';

  questionOverlay.classList.add('active');
  controls.unlock();

  setTimeout(() => questionAnswerEl.focus(), 50);
}

/** Fades the current question out, swaps the text, fades the next one in. */
async function swapQuestion(questionText) {
  questionBox.classList.add('is-swapping');
  await wait(QUESTION_FADE);

  questionTextEl.textContent = questionText;
  questionAnswerEl.value = '';
  questionAnswerEl.style.height = 'auto';

  questionBox.classList.remove('is-swapping');
  await wait(QUESTION_FADE);

  questionAnswerEl.focus();
}

/** Fades the contents out without swapping, for the last answer of a door. */
async function fadeQuestionOut() {
  questionBox.classList.add('is-swapping');
  await wait(QUESTION_FADE);
}

function closeQuestion() {
  state.isQuestionOpen = false;
  questionOverlay.classList.remove('active');
  questionBox.classList.remove('is-swapping');
  questionAnswerEl.blur();
}

/* ============================================================
   REFLECTION SEQUENCE
   ============================================================ */

async function startReflectionSequence(doorId) {
  if (state.phase !== 'exploring') return;

  state.phase = 'reflecting';
  state.activeDoorId = doorId;
  state.questionIndex = 0;
  hideDoorPrompt();

  const videoSrc = ROOM_VIDEOS[state.currentRoom];
  if (videoSrc) {
    reflectionVideo.src = videoSrc;
    reflectionVideo.load();
  }

  unloadEnvironment();

  // 1. Fade to black over the room
  await fadeToBlack();

  // 2. Bring the video up behind the black, start it, then lift the black.
  //    Doing it in this order hides the video overlay's own fade-in.
  videoOverlay.classList.remove('hidden');
  videoOverlay.classList.add('active');
  reflectionVideo.currentTime = 0;
  reflectionVideo.play().catch((error) => {
    console.warn('Reflection video could not autoplay', error);
  });

  clearBlack();

  // 3. Let it breathe, then ask
  await wait(VIDEO_HOLD);
  openQuestion(DOOR_QUESTIONS[doorId][0]);
}

questionSubmitBtn.addEventListener('click', handleAnswerSubmit);

async function handleAnswerSubmit() {
  if (state.isSubmitting) return;

  const answer = questionAnswerEl.value.trim();
  if (!answer) return;

  const doorId = state.activeDoorId;
  const questions = DOOR_QUESTIONS[doorId];
  if (!questions) return;

  state.isSubmitting = true;

  const question = questions[state.questionIndex];

  session.entries.push({ id: doorId, question, answer });
  addReflectionLog(question, answer);

  state.questionIndex += 1;

  // More questions behind this door
  if (state.questionIndex < questions.length) {
    await swapQuestion(questions[state.questionIndex]);
    state.isSubmitting = false;
    return;
  }

  // Door complete
  await fadeQuestionOut();
  closeQuestion();
  await advanceRoom();
  state.isSubmitting = false;
}

async function advanceRoom() {
  // Fade out over the video, then cut it
  await fadeToBlack();

  // The screen is fully black here, so drop the video overlay instantly.
  // Letting it cross-fade would stack a second black veil over the new room.
  videoOverlay.classList.remove('active');
  videoOverlay.classList.add('hidden');
  reflectionVideo.pause();

  if (state.currentRoom < ROOM_COUNT) {
    state.currentRoom += 1;
    await loadEnvironment(state.currentRoom);

    state.phase = 'exploring';
    clearBlack();
    controls.lock();
    return;
  }

  // Final room complete
  unloadEnvironment();
  showEndScreen();
  clearBlack();
}

/* ============================================================
   END SCREEN
   ============================================================ */

function showEndScreen() {
  state.phase = 'complete';
  controls.unlock();

  setHudVisible(false);

  if (session.topic) {
    endTopic.textContent = session.topic;
    endTopicBlock.classList.remove('hidden');
  } else {
    endTopicBlock.classList.add('hidden');
  }

  endLog.textContent = '';

  session.entries.forEach((entry) => {
    if (!entry.question || !entry.answer) return;
    endLog.appendChild(
      buildEntry('end-entry', 'end-question', 'end-answer', entry.question, entry.answer)
    );
  });

  endScreen.classList.remove('hidden');
}

function downloadSessionPDF() {
  const jsPDF = window.jspdf?.jsPDF;
  if (!jsPDF) {
    console.error('jsPDF is unavailable.');
    return;
  }

  const doc = new jsPDF();

  const MARGIN = 20;
  const MAX_WIDTH = 170;
  const PAGE_BOTTOM = 275;

  let y = MARGIN;

  const writeBlock = (text, fontSize, lineHeight, gapAfter) => {
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(text, MAX_WIDTH);

    lines.forEach((line) => {
      if (y > PAGE_BOTTOM) {
        doc.addPage();
        y = MARGIN;
      }
      doc.text(line, MARGIN, y);
      y += lineHeight;
    });

    y += gapAfter;
  };

  writeBlock('Thinking Generator Reflection', 20, 9, 6);

  if (session.name) writeBlock(`Name: ${session.name}`, 12, 6, 0);
  if (session.topic) writeBlock(`Topic: ${session.topic}`, 12, 6, 0);
  writeBlock(new Date().toLocaleDateString(), 12, 6, 8);

  session.entries.forEach((entry) => {
    if (!entry.question || !entry.answer) return;
    writeBlock(entry.question, 14, 7, 2);
    writeBlock(entry.answer, 11, 6, 8);
  });

  doc.save('thinking-generator-session.pdf');
}

/** Re-decodes the loader GIF so a finite-loop animation plays again. */
function restartLoaderGif() {
  if (!loaderGif) return;
  const base = loaderGif.src.split('?')[0];
  loaderGif.src = `${base}?t=${Date.now()}`;
}

/** Wipes all session data and rebuilds the onboarding DOM at step 1. */
function resetToStepOne() {
  // Data
  session.name = '';
  session.topic = '';
  session.entries = [];

  reflectionLogEntries.textContent = '';
  endLog.textContent = '';
  endTopic.textContent = '';

  // State
  state.currentRoom = 1;
  state.activeDoorId = null;
  state.questionIndex = 0;
  state.canUnlockDoor = false;
  state.isQuestionOpen = false;
  state.isSubmitting = false;
  resetMovement();

  // Teardown
  unloadEnvironment();
  closeQuestion();
  endScreen.classList.add('hidden');
  videoOverlay.classList.remove('active');
  videoOverlay.classList.add('hidden');
  reflectionVideo.pause();
  reflectionVideo.removeAttribute('src');

  // Fields
  nameInput.value = '';
  topicInput.value = '';
  qstn0Input.value = '';
  startBtn.disabled = true;
  continueBtn.disabled = true;
  submitBtn.disabled = true;

  // Step visibility
  nameStep.classList.remove('hidden');
  startBtn.classList.remove('hidden');

  greetingText.textContent = '';
  greetingText.classList.add('hidden');
  greetingText.classList.remove('is-visible');
  topicStep.classList.add('hidden');
  continueBtn.classList.add('hidden');
  beliefStep.classList.add('hidden');
  submitBtn.classList.add('hidden');

  // Overlay back to its loading appearance
  loaderOverlay.classList.remove('hidden', 'header-mode', 'home-active');
  homeState.classList.remove('hidden', 'active');
  restartLoaderGif();
  loaderState.classList.add('active');
}

async function startNewSession() {
  if (state.isResetting) return;
  state.isResetting = true;

  // 1. Fade the end screen out to black
  fadeOverlay.classList.add('is-quick', 'active');
  await wait(RESET_FADE);

  // 2. Rebuild everything while the screen is covered
  resetToStepOne();
  state.phase = 'loading';
  loaderRevealed = false;
  activeButton = null;

  // 3. Fade back in on the loader
  fadeOverlay.classList.remove('active');
  await wait(RESET_FADE);
  fadeOverlay.classList.remove('is-quick');

  // 4. Hold on the loader, then reveal step 1. Clicking skips the hold,
  //    same as on first load.
  setTimeout(revealHomeState, RESET_LOADER_HOLD);
  state.isResetting = false;
}

downloadPdfBtn.addEventListener('click', downloadSessionPDF);
newSessionBtn.addEventListener('click', startNewSession);

/* ============================================================
   KEYBOARD INPUT
   ============================================================ */

document.addEventListener('keydown', (event) => {
  const target = event.target;
  const isTyping =
    target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

  // ---- Mute ----
  // Guarded against isTyping, otherwise typing "m" in a reflection would
  // silently toggle the audio.
  if ((event.key === 'm' || event.key === 'M') && !isTyping) {
    event.preventDefault();
    toggleMute();
    return;
  }

  // ---- Enter ----
  if (event.key === 'Enter') {
    // Onboarding: Enter advances the current step (Shift+Enter = newline)
    if (state.phase === 'onboarding' && target.classList?.contains('form-input')) {
      if (target.tagName === 'TEXTAREA' && event.shiftKey) return;
      event.preventDefault();
      if (activeButton && !activeButton.disabled) activeButton.click();
      return;
    }

    // Exploring: Enter unlocks the door
    if (state.phase === 'exploring' && state.canUnlockDoor) {
      event.preventDefault();
      startReflectionSequence(ROOM_DOORS[state.currentRoom]);
    }
    return;
  }

  // ---- Movement ----
  const direction = MOVE_KEYS[event.code];
  if (direction && state.phase === 'exploring') {
    event.preventDefault();
    move[direction] = true;
  }
});

document.addEventListener('keyup', (event) => {
  const direction = MOVE_KEYS[event.code];
  if (direction) move[direction] = false;
});

/* ============================================================
   RENDER LOOP
   ============================================================ */

function animate() {
  requestAnimationFrame(animate);

  const delta = Math.min(clock.getDelta(), 0.05);

  // ---- Door proximity ----
  if (state.phase === 'exploring' && doorTrigger && !state.isQuestionOpen) {
    doorTrigger.getWorldPosition(triggerWorldPos);
    const withinRange = camera.position.distanceTo(triggerWorldPos) < DOOR_TRIGGER_DISTANCE;

    state.canUnlockDoor = withinRange;
    doorPrompt.classList.toggle('is-faded', !withinRange);
  }

  // ---- Movement ----
  if (!isUIBlockingMovement()) {
    moveDirection.set(
      Number(move.right) - Number(move.left),
      0,
      Number(move.forward) - Number(move.backward)
    );

    if (moveDirection.lengthSq() > 0) {
      moveDirection.normalize();
      controls.moveForward(moveDirection.z * WALK_SPEED * delta);
      controls.moveRight(moveDirection.x * WALK_SPEED * delta);
    }
  }

  // ---- Render ----
  if (currentEnvironment) {
    renderer.render(scene, camera);
  }
}

applyMuteState();
animate();