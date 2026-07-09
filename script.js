import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { HandLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/vision_bundle.mjs";

const IS_MOBILE = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth < 780;
const DEBUG_HAND = new URLSearchParams(location.search).has("debug");

const EXAMPLES = [
  { label: "Água", cid: 962 },
  { label: "Etanol", cid: 702 },
  { label: "Benzeno", cid: 241 },
  { label: "Cafeína", cid: 2519 },
  { label: "Aspirina", cid: 2244 },
  { label: "Dopamina", cid: 681 },
  { label: "Glicose", cid: 5793 },
  { label: "Serotonina", cid: 5202 },
  { label: "Adrenalina", cid: 5816 },
  { label: "Vitamina C", cid: 54670067 },
  { label: "CBD", cid: 644019 }
];

const ELEMENT_SYMBOLS = {
  1: "H", 5: "B", 6: "C", 7: "N", 8: "O", 9: "F", 11: "Na", 12: "Mg",
  13: "Al", 14: "Si", 15: "P", 16: "S", 17: "Cl", 19: "K", 20: "Ca",
  24: "Cr", 26: "Fe", 29: "Cu", 30: "Zn", 35: "Br", 53: "I", 80: "Hg"
};

const ELEMENT_COLORS = {
  H: "#f5f5f5", C: "#242424", N: "#2f55d4", O: "#e21b23", F: "#7bd75b",
  P: "#ff8a00", S: "#f2c230", Cl: "#34b233", Br: "#8b2b20", I: "#6c2e8f",
  Na: "#7f55d9", Mg: "#40c050", Ca: "#44cc44", Fe: "#d66a36", Cu: "#b87333",
  Zn: "#7c7fae", default: "#8f8f8f"
};

const ATOM_RADII = {
  H: 0.14, C: 0.22, N: 0.21, O: 0.21, F: 0.20, P: 0.24, S: 0.24,
  Cl: 0.24, Br: 0.25, I: 0.27, Na: 0.25, Mg: 0.24, Ca: 0.26,
  Fe: 0.23, Cu: 0.23, Zn: 0.23, default: 0.22
};

const LOCAL_FALLBACKS = {
  962: {
    name: "Water", cid: 962,
    atoms: [
      { el: "O", pos: [0, 0, 0] },
      { el: "H", pos: [0.9572, 0, 0] },
      { el: "H", pos: [-0.239, 0.927, 0] }
    ],
    bonds: [[0, 1], [0, 2]], bo: [1, 1]
  },
  702: {
    name: "Ethanol", cid: 702,
    atoms: [
      { el: "C", pos: [-0.748, 0.015, 0.024] }, { el: "C", pos: [0.748, -0.015, -0.024] },
      { el: "O", pos: [1.306, 1.210, 0.354] }, { el: "H", pos: [-1.146, 0.987, -0.284] },
      { el: "H", pos: [-1.126, -0.756, -0.662] }, { el: "H", pos: [-1.135, -0.213, 1.024] },
      { el: "H", pos: [1.134, 0.212, -1.025] }, { el: "H", pos: [1.151, -0.988, 0.282] },
      { el: "H", pos: [2.252, 1.168, 0.275] }
    ],
    bonds: [[0, 1], [1, 2], [0, 3], [0, 4], [0, 5], [1, 6], [1, 7], [2, 8]],
    bo: [1, 1, 1, 1, 1, 1, 1, 1]
  },
  241: {
    name: "Benzene", cid: 241,
    atoms: [
      { el: "C", pos: [1.396, 0, 0] }, { el: "C", pos: [0.698, 1.209, 0] },
      { el: "C", pos: [-0.698, 1.209, 0] }, { el: "C", pos: [-1.396, 0, 0] },
      { el: "C", pos: [-0.698, -1.209, 0] }, { el: "C", pos: [0.698, -1.209, 0] },
      { el: "H", pos: [2.479, 0, 0] }, { el: "H", pos: [1.240, 2.147, 0] },
      { el: "H", pos: [-1.240, 2.147, 0] }, { el: "H", pos: [-2.479, 0, 0] },
      { el: "H", pos: [-1.240, -2.147, 0] }, { el: "H", pos: [1.240, -2.147, 0] }
    ],
    bonds: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], [0, 6], [1, 7], [2, 8], [3, 9], [4, 10], [5, 11]],
    bo: [2, 1, 2, 1, 2, 1, 1, 1, 1, 1, 1, 1]
  }
};

const TARGET_BOND_LENGTH = 1.0;
const SINGLE_BOND_RADIUS = 0.052;
const MULTIPLE_BOND_RADIUS = 0.032;
const MULTIPLE_BOND_OFFSET = 0.085;
const DETECT_INTERVAL_MS = IS_MOBILE ? 140 : 100;

const canvas = document.getElementById("scene");
const handCanvas = document.getElementById("handOverlay");
const handCtx = handCanvas?.getContext("2d", { alpha: true });
if (DEBUG_HAND && handCanvas) handCanvas.classList.add("visible");
const video = document.getElementById("cameraVideo");
const examplesBox = document.getElementById("examples");
const searchForm = document.getElementById("searchForm");
const queryInput = document.getElementById("queryInput");
const galleryModeButton = document.getElementById("galleryMode");
const arModeButton = document.getElementById("arMode");
const nameEl = document.getElementById("moleculeName");
const formulaEl = document.getElementById("moleculeFormula");
const metaEl = document.getElementById("moleculeMeta");
const loading = document.getElementById("loading");
const loadingText = document.getElementById("loadingText");
const toastBox = document.getElementById("toastBox");
const handStatusEl = document.getElementById("handStatus");

const renderer = new THREE.WebGLRenderer({ canvas, antialias: !IS_MOBILE, alpha: false, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, IS_MOBILE ? 1.25 : 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0xeeeeee, 1);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color("#eeeeee");

const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 120);
camera.position.set(0, 0.25, 7.2);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.enablePan = false;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.75;
controls.minDistance = 2.0;
controls.maxDistance = 30;

scene.add(new THREE.AmbientLight("#ffffff", 1.45));
const keyLight = new THREE.DirectionalLight("#ffffff", 1.55);
keyLight.position.set(4.5, 6.5, 6.0);
scene.add(keyLight);
const fillLight = new THREE.DirectionalLight("#ffffff", 0.55);
fillLight.position.set(-4.0, -2.5, 5.0);
scene.add(fillLight);

let moleculeGroup = null;
let currentMolecule = null;
let arVideoTexture = null;
let isAR = false;
let tracker = null;
let streamRef = null;
let detectTimer = null;
let handDetected = false;
let handSeenAt = 0;
let handValue = 0.72;
let touchFallbackActive = false;
let touchStartX = 0;
let touchStartY = 0;
let touchStartDistance = 0;
let touchRotationX = 0;
let touchRotationY = 0;
let touchScale = 0.8;

const arTargetPosition = new THREE.Vector3(0, 0.18, 0);
const arTargetQuaternion = new THREE.Quaternion();
const arTargetScale = new THREE.Vector3(0.8, 0.8, 0.8);
const arEuler = new THREE.Euler();

const structureCache = new Map();
const atomGeometryCache = new Map();
const bondGeometryCache = new Map();

function mobileARBaseScale() {
  const atoms = currentMolecule?.atoms?.length || 12;
  if (atoms > 45) return 0.42;
  if (atoms > 25) return 0.50;
  if (atoms > 14) return 0.62;
  return 0.78;
}

function arSafeAnchor() {
  return new THREE.Vector3(0, IS_MOBILE ? 0.16 : 0.05, 0);
}

function getAtomColor(el) { return ELEMENT_COLORS[el] || ELEMENT_COLORS.default; }
function getAtomRadius(el) { return ATOM_RADII[el] || ATOM_RADII.default; }

function getSphereGeometry(radius) {
  const key = radius.toFixed(3);
  if (!atomGeometryCache.has(key)) atomGeometryCache.set(key, new THREE.SphereGeometry(radius, IS_MOBILE ? 28 : 36, IS_MOBILE ? 22 : 28));
  return atomGeometryCache.get(key);
}

function getCylinderGeometry(radius, length) {
  const key = `${radius.toFixed(3)}-${length.toFixed(3)}`;
  if (!bondGeometryCache.has(key)) bondGeometryCache.set(key, new THREE.CylinderGeometry(radius, radius, length, IS_MOBILE ? 14 : 18));
  return bondGeometryCache.get(key);
}

function materialForAtom(el) {
  return new THREE.MeshPhongMaterial({ color: getAtomColor(el), shininess: 88, specular: new THREE.Color("#c9c9c9") });
}

function materialForBond() {
  return new THREE.MeshPhongMaterial({ color: "#8f8f8f", shininess: 34, specular: new THREE.Color("#666666") });
}

function showLoading(text = "Carregando...") { loadingText.textContent = text; loading.classList.remove("hidden"); }
function hideLoading() { loading.classList.add("hidden"); }

function toast(message, type = "info") {
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = message;
  toastBox.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
  setTimeout(() => { el.classList.remove("show"); setTimeout(() => el.remove(), 250); }, 3600);
}

function setHandStatus(text, detected = false) {
  if (!handStatusEl) return;
  handStatusEl.classList.remove("hidden");
  handStatusEl.classList.toggle("detected", detected);
  handStatusEl.textContent = text;
}

function fetchWithTimeout(url, ms = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

async function findCIDByName(name) {
  const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(name)}/cids/JSON`;
  const response = await fetchWithTimeout(url, 10000);
  if (!response.ok) throw new Error(`CID não encontrado para ${name}`);
  const data = await response.json();
  const cid = data?.IdentifierList?.CID?.[0];
  if (!cid) throw new Error(`CID não encontrado para ${name}`);
  return cid;
}

async function fetchPubChemCompound(cid) {
  const urls = [
    `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/record/JSON?record_type=3d`,
    `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/record/JSON?record_type=2d`,
    `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/record/JSON`
  ];
  let lastError = null;
  for (const url of urls) {
    try {
      const response = await fetchWithTimeout(url, 14000);
      if (!response.ok) { lastError = new Error(`HTTP ${response.status}`); continue; }
      const data = await response.json();
      const comp = data?.PC_Compounds?.[0];
      if (comp) {
        const parsed = parsePubChemCompound(comp, cid);
        if (parsed.atoms.length && parsed.bonds.length) return parsed;
      }
    } catch (error) { lastError = error; }
  }
  throw lastError || new Error("Estrutura PubChem indisponível");
}

function parsePubChemCompound(comp, cid) {
  const atomAids = comp?.atoms?.aid || [];
  const elements = comp?.atoms?.element || [];
  const coordsBlocks = comp?.coords || [];
  const coordsBlock = coordsBlocks.find(block => block?.conformers?.[0]?.x?.length) || coordsBlocks[0];
  const conformer = coordsBlock?.conformers?.[0];
  if (!conformer?.x?.length) throw new Error("Coordenadas indisponíveis no PubChem");

  const coordAids = coordsBlock?.aid || atomAids;
  const elementByAid = new Map();
  atomAids.forEach((aid, i) => elementByAid.set(aid, elements[i] || 6));

  const atoms = [];
  const aidToIndex = new Map();
  for (let i = 0; i < conformer.x.length; i++) {
    const aid = coordAids[i] ?? atomAids[i] ?? (i + 1);
    const atomicNumber = elementByAid.get(aid) || elements[i] || 6;
    const el = ELEMENT_SYMBOLS[atomicNumber] || "X";
    aidToIndex.set(aid, i);
    atoms.push({ el, pos: [Number(conformer.x[i]) || 0, Number(conformer.y?.[i]) || 0, Number(conformer.z?.[i]) || 0] });
  }

  const bonds = [];
  const bo = [];
  const bd = comp?.bonds || {};
  for (let i = 0; i < (bd.aid1 || []).length; i++) {
    const a = aidToIndex.get(bd.aid1[i]);
    const b = aidToIndex.get(bd.aid2[i]);
    if (Number.isInteger(a) && Number.isInteger(b) && a !== b) {
      bonds.push([a, b]);
      const rawOrder = Number(bd.order?.[i] || 1);
      bo.push(rawOrder >= 1 && rawOrder <= 3 ? rawOrder : 1);
    }
  }
  return normalizeMolecule({ name: `CID ${cid}`, cid, atoms, bonds, bo });
}

function normalizeMolecule(molecule) {
  const atoms = molecule.atoms.map(atom => ({ ...atom, pos: [...atom.pos], color: getAtomColor(atom.el), radius: getAtomRadius(atom.el) }));
  const center = new THREE.Vector3();
  for (const atom of atoms) center.add(new THREE.Vector3(...atom.pos));
  center.divideScalar(Math.max(atoms.length, 1));
  for (const atom of atoms) { atom.pos[0] -= center.x; atom.pos[1] -= center.y; atom.pos[2] -= center.z; }

  const lengths = [];
  for (const [a, b] of molecule.bonds) {
    const len = new THREE.Vector3(...atoms[a].pos).distanceTo(new THREE.Vector3(...atoms[b].pos));
    if (Number.isFinite(len) && len > 0.05) lengths.push(len);
  }
  let scale = 1;
  if (lengths.length) {
    lengths.sort((a, b) => a - b);
    const median = lengths[Math.floor(lengths.length / 2)];
    scale = TARGET_BOND_LENGTH / median;
  }
  for (const atom of atoms) { atom.pos[0] *= scale; atom.pos[1] *= scale; atom.pos[2] *= scale; }
  return { ...molecule, atoms, formula: hillFormula(atoms) };
}

function hillFormula(atoms) {
  const counts = {};
  for (const atom of atoms) counts[atom.el] = (counts[atom.el] || 0) + 1;
  const parts = [];
  if (counts.C) { parts.push(`C${counts.C > 1 ? counts.C : ""}`); delete counts.C; }
  if (counts.H) { parts.push(`H${counts.H > 1 ? counts.H : ""}`); delete counts.H; }
  Object.keys(counts).sort().forEach(el => parts.push(`${el}${counts[el] > 1 ? counts[el] : ""}`));
  return parts.join("");
}

function createBondCylinder(start, end, radius, offset = new THREE.Vector3()) {
  const s = start.clone().add(offset);
  const e = end.clone().add(offset);
  const midpoint = s.clone().add(e).multiplyScalar(0.5);
  const direction = e.clone().sub(s);
  const length = direction.length();
  if (!Number.isFinite(length) || length < 0.001) return null;
  const mesh = new THREE.Mesh(getCylinderGeometry(radius, length), materialForBond());
  mesh.position.copy(midpoint);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
  return mesh;
}

function perpendicularVector(direction) {
  const dir = direction.clone().normalize();
  const ref = Math.abs(dir.dot(new THREE.Vector3(0, 1, 0))) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  return new THREE.Vector3().crossVectors(dir, ref).normalize();
}

function createBond(atomA, atomB, order = 1) {
  const group = new THREE.Group();
  const start = new THREE.Vector3(...atomA.pos);
  const end = new THREE.Vector3(...atomB.pos);
  const direction = end.clone().sub(start);
  if (direction.length() < 0.001) return group;
  if (order >= 3) {
    const perp = perpendicularVector(direction).multiplyScalar(MULTIPLE_BOND_OFFSET);
    [new THREE.Vector3(), perp, perp.clone().negate()].forEach(offset => {
      const cylinder = createBondCylinder(start, end, MULTIPLE_BOND_RADIUS, offset);
      if (cylinder) group.add(cylinder);
    });
    return group;
  }
  if (order === 2) {
    const perp = perpendicularVector(direction).multiplyScalar(MULTIPLE_BOND_OFFSET);
    [perp, perp.clone().negate()].forEach(offset => {
      const cylinder = createBondCylinder(start, end, MULTIPLE_BOND_RADIUS, offset);
      if (cylinder) group.add(cylinder);
    });
    return group;
  }
  const cylinder = createBondCylinder(start, end, SINGLE_BOND_RADIUS);
  if (cylinder) group.add(cylinder);
  return group;
}

function createAtom(atom) {
  const mesh = new THREE.Mesh(getSphereGeometry(atom.radius), materialForAtom(atom.el));
  mesh.position.set(...atom.pos);
  return mesh;
}

function buildMoleculeGroup(molecule) {
  const group = new THREE.Group();
  const bondsGroup = new THREE.Group();
  const atomsGroup = new THREE.Group();
  molecule.bonds.forEach(([a, b], index) => {
    if (molecule.atoms[a] && molecule.atoms[b]) bondsGroup.add(createBond(molecule.atoms[a], molecule.atoms[b], molecule.bo[index] || 1));
  });
  molecule.atoms.forEach(atom => atomsGroup.add(createAtom(atom)));
  group.add(bondsGroup);
  group.add(atomsGroup);
  return group;
}

function fitCameraToMolecule(group) {
  const box = new THREE.Box3().setFromObject(group);
  const center = new THREE.Vector3();
  const size = new THREE.Vector3();
  box.getCenter(center);
  box.getSize(size);
  group.position.sub(center);
  const maxDim = Math.max(size.x, size.y, size.z, 2.2);
  const fov = THREE.MathUtils.degToRad(camera.fov);
  const distance = Math.min(Math.max((maxDim / (2 * Math.tan(fov / 2))) * 1.55, 3.6), 18);
  camera.position.set(0, Math.max(0.18, maxDim * 0.06), distance);
  camera.near = Math.max(0.05, distance / 100);
  camera.far = distance * 20;
  camera.updateProjectionMatrix();
  controls.target.set(0, 0, 0);
  controls.update();
}

function displayMolecule(molecule, displayName, source = "PubChem") {
  if (moleculeGroup) scene.remove(moleculeGroup);
  currentMolecule = molecule;
  moleculeGroup = buildMoleculeGroup(molecule);
  scene.add(moleculeGroup);
  fitCameraToMolecule(moleculeGroup);
  if (isAR) {
    arTargetPosition.copy(arSafeAnchor());
    const base = mobileARBaseScale();
    arTargetScale.set(base, base, base);
    moleculeGroup.position.copy(arTargetPosition);
    moleculeGroup.scale.copy(arTargetScale);
  }
  nameEl.textContent = displayName || molecule.name || `CID ${molecule.cid || ""}`;
  formulaEl.textContent = molecule.formula || "—";
  metaEl.textContent = `${molecule.atoms.length} átomos · ${molecule.bonds.length} ligações · ball-and-stick · ${source}${molecule.cid ? ` CID ${molecule.cid}` : ""}`;
}

async function loadByCID(cid, displayName = null) {
  const numericCID = Number(cid);
  setActiveExample(numericCID);
  showLoading(`Carregando CID ${numericCID} no PubChem...`);
  try {
    let molecule = structureCache.get(numericCID);
    if (!molecule) {
      molecule = await fetchPubChemCompound(numericCID);
      structureCache.set(numericCID, molecule);
    }
    hideLoading();
    displayMolecule(molecule, displayName || `CID ${numericCID}`, "PubChem");
    toast(`Carregado: ${molecule.formula}`, "success");
  } catch (error) {
    const fallback = LOCAL_FALLBACKS[numericCID];
    if (fallback) {
      const normalized = normalizeMolecule(fallback);
      hideLoading();
      displayMolecule(normalized, displayName || fallback.name, "fallback local");
      toast("PubChem indisponível. Usando fallback local.", "info");
    } else {
      hideLoading();
      toast("Não foi possível carregar. Tente outro nome ou CID.", "error");
      console.error(error);
    }
  }
}

async function loadByQuery(query) {
  const text = query.trim();
  if (!text) return;
  if (/^\d+$/.test(text)) { await loadByCID(Number(text), `CID ${text}`); return; }
  showLoading(`Buscando ${text} no PubChem...`);
  try {
    const cid = await findCIDByName(text);
    hideLoading();
    await loadByCID(cid, text);
  } catch (error) {
    hideLoading();
    toast("Molécula não encontrada. Tente nome em inglês ou CID.", "error");
    console.error(error);
  }
}

function createExampleButtons() {
  EXAMPLES.forEach(example => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "example-button";
    button.textContent = example.label;
    button.dataset.cid = String(example.cid);
    button.addEventListener("click", () => loadByCID(example.cid, example.label));
    examplesBox.appendChild(button);
  });
}

function setActiveExample(cid) {
  document.querySelectorAll(".example-button").forEach(button => {
    button.classList.toggle("active", Number(button.dataset.cid) === Number(cid));
  });
}

function distance2D(a, b) { return Math.hypot((a.x || 0) - (b.x || 0), (a.y || 0) - (b.y || 0)); }

function openness(hand) {
  const wrist = hand[0];
  const indexMcp = hand[5];
  const pinkyMcp = hand[17];
  const palmWidth = distance2D(indexMcp, pinkyMcp) || 0.0001;
  const tips = [8, 12, 16, 20].map(i => hand[i]);
  const mcps = [5, 9, 13, 17].map(i => hand[i]);
  let score = 0;
  for (let i = 0; i < tips.length; i++) {
    const dTip = distance2D(tips[i], wrist);
    const dMcp = distance2D(mcps[i], wrist);
    score += (dTip - dMcp) / palmWidth;
  }
  const thumbOpen = distance2D(hand[4], hand[8]) / palmWidth;
  score += Math.max(0, thumbOpen - 0.25) * 0.8;
  return THREE.MathUtils.clamp((score - 1.0) / 4.2, 0, 1);
}

async function buildTracker() {
  if (tracker) return tracker;
  const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm");
  tracker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
      delegate: "CPU"
    },
    runningMode: "VIDEO",
    numHands: 1,
    minHandDetectionConfidence: 0.2,
    minHandPresenceConfidence: 0.2,
    minTrackingConfidence: 0.2
  });
  return tracker;
}

async function startCamera() {
  if (!window.isSecureContext) throw new Error("Abra esta página em HTTPS. No GitHub Pages isso já ocorre automaticamente.");
  if (!navigator.mediaDevices?.getUserMedia) throw new Error("Este navegador não oferece suporte à câmera.");
  streamRef = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      facingMode: "user",
      width: { ideal: IS_MOBILE ? 320 : 640 },
      height: { ideal: IS_MOBILE ? 240 : 480 },
      frameRate: { ideal: IS_MOBILE ? 24 : 30, max: 30 }
    }
  });
  video.srcObject = streamRef;
  await new Promise((resolve, reject) => {
    const onMeta = async () => { try { await video.play(); resolve(); } catch (e) { reject(e); } };
    video.addEventListener("loadedmetadata", onMeta, { once: true });
  });
}

function stopCamera() {
  if (streamRef) {
    streamRef.getTracks().forEach(track => track.stop());
    streamRef = null;
  }
  video.srcObject = null;
}

function setARFromHand(hand) {
  handValue = openness(hand);
  handSeenAt = performance.now();
  handDetected = true;
  setHandStatus("Mão detectada — gire/incline a mão", true);

  const wrist = hand[0];
  const indexBase = hand[5];
  const middleBase = hand[9];
  const pinkyBase = hand[17];
  const cx = (wrist.x + indexBase.x + middleBase.x + pinkyBase.x) / 4;
  const cy = (wrist.y + indexBase.y + middleBase.y + pinkyBase.y) / 4;
  const acrossX = indexBase.x - pinkyBase.x;
  const acrossY = indexBase.y - pinkyBase.y;
  const verticalY = middleBase.y - wrist.y;

  const angleZ = Math.atan2(acrossY, acrossX);
  const angleY = (0.5 - cx) * Math.PI * (IS_MOBILE ? 1.35 : 1.7);
  const angleX = (cy - 0.5) * Math.PI * (IS_MOBILE ? 0.85 : 1.1) + verticalY * 1.1;
  arEuler.set(angleX, angleY, -angleZ);
  arTargetQuaternion.setFromEuler(arEuler);

  arTargetPosition.copy(arSafeAnchor());
  const base = mobileARBaseScale();
  const scale = THREE.MathUtils.clamp(base * (0.80 + handValue * 0.45), base * 0.72, base * 1.28);
  arTargetScale.set(scale, scale, scale);
}

function drawHandDebug(hand) {
  if (!handCtx || !DEBUG_HAND) return;
  const w = window.innerWidth;
  const h = window.innerHeight;
  handCanvas.width = Math.floor(w * Math.min(window.devicePixelRatio || 1, 1.5));
  handCanvas.height = Math.floor(h * Math.min(window.devicePixelRatio || 1, 1.5));
  handCanvas.style.width = `${w}px`;
  handCanvas.style.height = `${h}px`;
  const dpr = handCanvas.width / w;
  handCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  handCtx.clearRect(0, 0, w, h);
  if (!hand) return;
  const connections = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];
  handCtx.lineWidth = 2;
  handCtx.strokeStyle = "rgba(30,190,120,.9)";
  for (const [a,b] of connections) {
    const pa = hand[a], pb = hand[b];
    handCtx.beginPath();
    handCtx.moveTo((1 - pa.x) * w, pa.y * h);
    handCtx.lineTo((1 - pb.x) * w, pb.y * h);
    handCtx.stroke();
  }
  handCtx.fillStyle = "rgba(255,255,255,.95)";
  for (const p of hand) {
    handCtx.beginPath();
    handCtx.arc((1 - p.x) * w, p.y * h, 4, 0, Math.PI * 2);
    handCtx.fill();
  }
}

function clearHandDebug() {
  if (handCtx) handCtx.clearRect(0, 0, handCanvas.width, handCanvas.height);
}

function detectStep() {
  if (!isAR || !tracker || video.readyState < 2) return;
  try {
    const result = tracker.detectForVideo(video, performance.now());
    if (result?.landmarks?.length) {
      const hand = result.landmarks[0];
      setARFromHand(hand);
      drawHandDebug(hand);
    } else {
      handDetected = false;
      if (performance.now() - handSeenAt > 900) setHandStatus("Mostre a mão aberta ou use toque para girar/zoom", false);
      clearHandDebug();
    }
  } catch (error) {
    setHandStatus("Rastreamento temporariamente indisponível", false);
    console.warn(error);
  }
}

async function startARMode() {
  if (isAR) return;
  showLoading("Iniciando câmera e HandLandmarker...");
  try {
    await buildTracker();
    await startCamera();
    arVideoTexture = new THREE.VideoTexture(video);
    arVideoTexture.colorSpace = THREE.SRGBColorSpace;
    arVideoTexture.wrapS = THREE.RepeatWrapping;
    arVideoTexture.repeat.x = -1;
    arVideoTexture.offset.x = 1;
    scene.background = arVideoTexture;
    renderer.setClearColor(0x000000, 1);
    isAR = true;
    touchFallbackActive = true;
    controls.autoRotate = false;
    controls.enabled = false;
    const base = mobileARBaseScale();
    arTargetPosition.copy(arSafeAnchor());
    arTargetQuaternion.identity();
    arTargetScale.set(base, base, base);
    if (moleculeGroup) {
      moleculeGroup.position.copy(arTargetPosition);
      moleculeGroup.quaternion.identity();
      moleculeGroup.scale.copy(arTargetScale);
    }
    galleryModeButton.classList.remove("active");
    arModeButton.classList.add("active");
    clearInterval(detectTimer);
    detectTimer = setInterval(detectStep, DETECT_INTERVAL_MS);
    setHandStatus("Mostre a mão aberta ou use toque para girar/zoom", false);
    hideLoading();
    toast("AR com HandLandmarker ativo. A detecção usa a mesma abordagem do projeto mol.", "success");
  } catch (error) {
    hideLoading();
    toast(error?.message || "Não foi possível iniciar o AR.", "error");
    console.error(error);
    stopARMode();
  }
}

function stopARMode() {
  clearInterval(detectTimer);
  detectTimer = null;
  stopCamera();
  if (arVideoTexture) { arVideoTexture.dispose(); arVideoTexture = null; }
  scene.background = new THREE.Color("#eeeeee");
  renderer.setClearColor(0xeeeeee, 1);
  isAR = false;
  touchFallbackActive = false;
  handDetected = false;
  clearHandDebug();
  if (handStatusEl) handStatusEl.classList.add("hidden");
  controls.enabled = true;
  controls.autoRotate = true;
  galleryModeButton.classList.add("active");
  arModeButton.classList.remove("active");
  if (moleculeGroup) {
    moleculeGroup.position.set(0, 0, 0);
    moleculeGroup.quaternion.identity();
    moleculeGroup.scale.set(1, 1, 1);
    fitCameraToMolecule(moleculeGroup);
  }
}

function touchDistance(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.hypot(dx, dy);
}

canvas.addEventListener("touchstart", event => {
  if (!isAR || !touchFallbackActive || !moleculeGroup) return;
  event.preventDefault();
  if (event.touches.length === 1) {
    touchStartX = event.touches[0].clientX;
    touchStartY = event.touches[0].clientY;
  }
  if (event.touches.length === 2) touchStartDistance = touchDistance(event.touches);
}, { passive: false });

canvas.addEventListener("touchmove", event => {
  if (!isAR || !touchFallbackActive || !moleculeGroup) return;
  event.preventDefault();
  if (event.touches.length === 1) {
    const x = event.touches[0].clientX;
    const y = event.touches[0].clientY;
    touchRotationY += (x - touchStartX) * 0.008;
    touchRotationX += (y - touchStartY) * 0.008;
    touchRotationX = THREE.MathUtils.clamp(touchRotationX, -Math.PI / 2, Math.PI / 2);
    touchStartX = x;
    touchStartY = y;
    if (!handDetected || performance.now() - handSeenAt > 700) {
      arEuler.set(touchRotationX, touchRotationY, 0);
      arTargetQuaternion.setFromEuler(arEuler);
      arTargetPosition.copy(arSafeAnchor());
    }
  }
  if (event.touches.length === 2) {
    const d = touchDistance(event.touches);
    const delta = d - touchStartDistance;
    touchScale = THREE.MathUtils.clamp(touchScale + delta * 0.004, 0.35, 1.35);
    touchStartDistance = d;
    if (!handDetected || performance.now() - handSeenAt > 700) {
      const base = mobileARBaseScale();
      const corrected = THREE.MathUtils.clamp(touchScale * base, base * 0.65, base * 1.45);
      arTargetScale.set(corrected, corrected, corrected);
    }
  }
}, { passive: false });

function handleResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  if (moleculeGroup && !isAR) fitCameraToMolecule(moleculeGroup);
  clearHandDebug();
}

function animate() {
  requestAnimationFrame(animate);
  if (moleculeGroup) {
    if (isAR) {
      moleculeGroup.position.lerp(arTargetPosition, 0.16);
      moleculeGroup.quaternion.slerp(arTargetQuaternion, 0.14);
      moleculeGroup.scale.lerp(arTargetScale, 0.14);
    } else {
      moleculeGroup.rotation.y += 0.0004;
    }
  }
  controls.update();
  renderer.render(scene, camera);
}

searchForm.addEventListener("submit", event => { event.preventDefault(); loadByQuery(queryInput.value); });
galleryModeButton.addEventListener("click", stopARMode);
arModeButton.addEventListener("click", startARMode);
window.addEventListener("resize", handleResize);
window.addEventListener("orientationchange", () => setTimeout(handleResize, 250));
document.addEventListener("visibilitychange", () => {
  if (document.hidden && isAR) clearInterval(detectTimer);
  else if (!document.hidden && isAR) { clearInterval(detectTimer); detectTimer = setInterval(detectStep, DETECT_INTERVAL_MS); }
});
window.addEventListener("beforeunload", stopCamera);

createExampleButtons();
animate();
loadByCID(241, "Benzeno");
