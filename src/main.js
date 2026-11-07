import * as THREE from 'three';
import { createWorldScene, setBuildingSaturation, applyUnlocks } from './scene/world.js';
import { updateShorelineGlowFade, resetShorelineGlow } from './scene/shorelineGlow.js';
import { createIsoCamera, resizeCamera, CameraRig } from './scene/camera.js';
import { attachPanZoom } from './scene/controls.js';
import { TourDirector } from './scene/tour.js';
import { pickBuilding, pickIsland } from './interaction/raycast.js';
import { LABELS_ZH, BUILDING_NAMES, computeIslandBounds } from './scene/layouts.js';
import { updateWaterSurface } from './scene/waterSurface.js';
import { AREAS } from './data/areas.js';
import {
  loadProgress,
  saveProgress,
  markVisitDay,
  countIntroQuestsComplete,
  isLawPassComplete,
} from './state/storage.js';
import { renderConfirmCard, bindCardActions } from './ui/card.js';
import { openLessonSheet } from './ui/lesson.js';
import { renderListCards } from './ui/listView.js';
import { renderQuestPanel } from './ui/questPanel.js';
import { showCertificatePanel } from './ui/certificate.js';
import { countCompletedQuests } from './data/parkQuests.js';
import { upgradeBuildingsToGlb, collectPulseMeshes } from './scene/glbBuildings.js';
import { upgradeIslandsDeco } from './scene/islandGlbDeco.js';
import { installArchipelagoGlb } from './scene/islandAssets.js';
import modelStats from './data/model-stats.json';

const canvas = document.getElementById('world-canvas');
const labelsLayer = document.getElementById('labels-layer');
const confirmCard = document.getElementById('confirm-card');
const cardBody = document.getElementById('card-body');
const listView = document.getElementById('list-view');
const listCards = document.getElementById('list-cards');
const canvasWrap = document.getElementById('canvas-wrap');
const lessonSheet = document.getElementById('lesson-sheet');
const tutorialOverlay = document.getElementById('tutorial-overlay');
const tutorialSpotlight = document.getElementById('tutorial-spotlight');
const questPanel = document.getElementById('quest-panel');
const certificatePanel = document.getElementById('certificate-panel');
const minimapEl = document.getElementById('archipelago-minimap');
const btnBackArchipelago = document.getElementById('btn-back-archipelago');

const progress = loadProgress();
markVisitDay(progress);
if (isLawPassComplete(progress)) {
  progress.unlocks.deco_logo_inlay = true;
  progress.unlocks.deco_shore_glow = true;
  saveProgress(progress);
}

const mqMobile = window.matchMedia('(max-width: 768px), (max-aspect-ratio: 1/1)');
let isMobile = mqMobile.matches;
let reducedMotion =
  progress.reduceMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

let width = canvas.clientWidth;
let height = canvas.clientHeight;
renderer.setSize(width, height, false);

const camera = createIsoCamera(width, height);
const rig = new CameraRig(camera);

let world = createWorldScene({ isMobile, reducedMotion });
let scene = world.scene;
let buildings = world.buildings;
let clickable = world.clickable;
let pulseMeshes = world.pulseMeshes;
let worldBounds = world.worldBounds;
let islandPickables = world.islandPickables;
let waterMesh = world.water;

const labelHeights = Object.fromEntries(modelStats.map((r) => [r.name, r.max[1]]));

rig.setPanBounds(worldBounds.islandRadius);
fitCamera();
updateQuestThumb();

const tour = new TourDirector({
  rig,
  camera,
  buildings,
  reducedMotion,
  isMobile,
  onBeat: (type, i) => {
    if (type === 'label') showLabelsUpTo(i);
    if (type === 'labels-all') showLabelsUpTo(6);
    if (type === 'tour-done') {
      unlockPan();
      progress.introSeen = true;
      progress.visited = true;
      saveProgress(progress);
    }
  },
});

let panLocked = true;
let focusedId = null;
let activeTransition = null;
let fpsLowSince = null;
let hidden = document.hidden;
let loadTimer = null;

const labelEls = {};
BUILDING_NAMES.forEach((id) => {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'b-label hidden';
  btn.textContent = LABELS_ZH[id];
  btn.dataset.building = id;
  btn.addEventListener('click', () => onLabelActivate(id));
  labelsLayer.appendChild(btn);
  labelEls[id] = btn;
});

function showLabelsUpTo(n) {
  BUILDING_NAMES.forEach((id, idx) => {
    labelEls[id].classList.toggle('hidden', idx >= n);
  });
}

function unlockPan() {
  panLocked = false;
  BUILDING_NAMES.forEach((id) => labelEls[id].classList.remove('hidden'));
}

async function loadBuildingModels() {
  try {
    await upgradeBuildingsToGlb({
      buildings,
      onReport: (report) => {
        window.__lawWorldGlbReport = report;
      },
    });
    await installArchipelagoGlb({
      islands: world.islands,
      islandPickables,
      scene,
      onReport: (report) => {
        window.__lawWorldIslandGlbReport = report;
      },
    });
    await upgradeIslandsDeco({
      islands: world.islands,
      onReport: (report) => {
        window.__lawWorldDecoReport = report;
      },
    });
    pulseMeshes = collectPulseMeshes(buildings);
    applyUnlocks(scene, progress.unlocks, { reducedMotion });
  } catch (e) {
    console.warn('[law-world] GLB load failed, using fallbacks', e);
  }
}

function fitCamera() {
  const bounds =
    tour.view === 'island' && tour.activeIsland
      ? computeIslandBounds(tour.activeIsland, { pad: isMobile ? 4.5 : 3.8 })
      : worldBounds;
  resizeCamera(camera, width, height, bounds, isMobile);
  tour.viewportW = width;
  tour.viewportH = height;
}

function rebuildLayout() {
  resetShorelineGlow();
  world = createWorldScene({ isMobile, reducedMotion });
  scene = world.scene;
  buildings = world.buildings;
  clickable = world.clickable;
  pulseMeshes = world.pulseMeshes;
  worldBounds = world.worldBounds;
  islandPickables = world.islandPickables;
  waterMesh = world.water;
  tour.buildings = buildings;
  rig.setPanBounds(worldBounds.islandRadius);
  fitCamera();
  applyUnlocks(scene, progress.unlocks, { reducedMotion });
  if (focusedId) setBuildingSaturation(buildings, focusedId);
  loadBuildingModels();
}

mqMobile.addEventListener('change', () => {
  isMobile = mqMobile.matches;
  rebuildLayout();
});

function updateLabels() {
  BUILDING_NAMES.forEach((id) => {
    const g = buildings[id];
    if (!g) return;
    const top = new THREE.Vector3();
    g.getWorldPosition(top);
    top.y += (labelHeights[id] || 8) + 1;
    const s = rig.worldToScreen(top, width, height);
    const el = labelEls[id];
    if (s.behind) {
      el.style.visibility = 'hidden';
      return;
    }
    el.style.visibility = 'visible';
    const pad = 12;
    const lx = Math.min(width - pad, Math.max(pad, s.x));
    const ly = Math.min(height - pad, Math.max(pad + 48, s.y - 20));
    el.style.transform = `translate(${lx}px, ${ly}px) translate(-50%, -100%)`;
  });
}

function updateQuestThumb() {
  const n = countCompletedQuests(progress);
  const el = document.getElementById('quest-thumb-count');
  if (el) el.textContent = `${n}/6`;
}

function updateTutorialSpotlight(buildingId) {
  if (!buildingId || !buildings[buildingId]) {
    tutorialSpotlight.classList.add('hidden');
    return;
  }
  const g = buildings[buildingId];
  const top = new THREE.Vector3();
  g.getWorldPosition(top);
  top.y += (labelHeights[buildingId] || 8) * 0.55;
  const s = rig.worldToScreen(top, width, height);
  const size = Math.min(width, height) * (isMobile ? 0.34 : 0.22);
  tutorialSpotlight.classList.remove('hidden');
  tutorialSpotlight.style.left = `${s.x}px`;
  tutorialSpotlight.style.top = `${s.y}px`;
  tutorialSpotlight.style.width = `${size}px`;
  tutorialSpotlight.style.height = `${size}px`;
}

let islandFocusedId = null;

function onIslandSelect(id, { openBuildingAfter } = {}) {
  if (panLocked) return;
  if (tour.view === 'island' && tour.activeIsland === id && !openBuildingAfter) return;
  closeCard();
  islandFocusedId = id;
  if (!progress.areaProgress[id]) progress.areaProgress[id] = {};
  progress.areaProgress[id].visited = true;
  saveProgress(progress);
  const dur = reducedMotion ? 0.2 : 0.8;
  activeTransition = tour.flyToIsland(id, dur, () => {
    fitCamera();
    updateMinimap();
    if (openBuildingAfter) onBuildingSelect(openBuildingAfter);
  });
  pushHistoryState({ view: 'island', island: id });
}

function onBuildingSelect(id) {
  if (panLocked) return;
  if (tour.view !== 'island' || tour.activeIsland !== id) {
    onIslandSelect(id, { openBuildingAfter: id });
    return;
  }
  const b = buildings[id];
  if (!b) return;
  focusedId = id;
  setBuildingSaturation(buildings, id);
  activeTransition = tour.focusBuilding(b, () => {
    openCard(id);
  });
  pushHistoryState({ view: 'card', island: id });
}

function onLabelActivate(id) {
  if (tour.view === 'overview') onIslandSelect(id);
  else onBuildingSelect(id);
}

function goOverview() {
  closeCard();
  islandFocusedId = null;
  activeTransition = tour.flyToOverview(reducedMotion ? 0.2 : 0.8, () => {
    fitCamera();
    updateMinimap();
  });
}

function openCard(areaId) {
  cardBody.innerHTML = renderConfirmCard(areaId, progress);
  confirmCard.classList.remove('hidden');
  bindCardActions(cardBody, {
    external: (id) => window.open(AREAS[id].siteUrl, '_blank', 'noopener'),
    lesson: (id) => {
      openLessonSheet(lessonSheet, id, progress, () => {
        maybeCrossUnlocks({ fromQuest: true });
        updateQuestThumb();
      });
    },
    close: closeCard,
  });
}

function closeCard() {
  confirmCard.classList.add('hidden');
  lessonSheet.classList.add('hidden');
  focusedId = null;
  setBuildingSaturation(buildings, null);
}

function pushHistoryState(extra = {}) {
  history.pushState({ lawWorld: 'nav', ...extra }, '');
}

window.addEventListener('popstate', () => {
  if (!confirmCard.classList.contains('hidden')) closeCard();
  else if (tour.view === 'island') goOverview();
});

attachPanZoom(canvas, rig, {
  reducedMotion,
  onTap: (x, y) => {
    if (panLocked) return;
    if (tour.view === 'island') {
      const id = pickBuilding(camera, clickable, x, y, canvas);
      if (id) onBuildingSelect(id);
      else if (confirmCard.classList.contains('hidden')) goOverview();
      else closeCard();
      return;
    }
    const island = pickIsland(camera, islandPickables, x, y, canvas);
    if (island) onIslandSelect(island);
    else {
      const id = pickBuilding(camera, clickable, x, y, canvas);
      if (id) onIslandSelect(id);
    }
  },
});

btnBackArchipelago?.addEventListener('click', goOverview);

const QUEST_PREFIX = {
  fire: 'F',
  building: 'B',
  telecom: 'T',
  accessibility: 'A',
  water: 'W',
  electrical: 'E',
};

function updateMinimap() {
  if (!minimapEl) return;
  btnBackArchipelago?.classList.toggle('hidden', tour.view !== 'island');
  minimapEl.querySelectorAll('[data-island]').forEach((btn) => {
    const id = btn.dataset.island;
    const visited = progress.areaProgress?.[id]?.visited;
    const p = QUEST_PREFIX[id] || '';
    const done = p && Object.keys(progress.questsDone).some((k) => k.startsWith(p));
    btn.classList.toggle('active', tour.activeIsland === id);
    btn.classList.toggle('visited', Boolean(visited));
    btn.classList.toggle('done', done);
    btn.setAttribute('aria-current', tour.activeIsland === id ? 'true' : 'false');
  });
}

minimapEl?.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-island]');
  if (!btn || panLocked) return;
  onIslandSelect(btn.dataset.island);
});

document.getElementById('btn-toggle-view').addEventListener('click', toggleList);
document.getElementById('btn-toggle-view-top')?.addEventListener('click', toggleList);
document.getElementById('btn-fallback-list').addEventListener('click', () => showList(true));
document.getElementById('btn-quests').addEventListener('click', openQuests);
function toggleList() {
  const show = listView.classList.contains('hidden');
  showList(show);
}

function showList(show) {
  listView.classList.toggle('hidden', !show);
  canvasWrap.classList.toggle('hidden', show);
  progress.preferList = show;
  saveProgress(progress);
  document.getElementById('btn-toggle-view').textContent = show ? '3D 檢視' : '列表檢視';
}

renderListCards(listCards);
listCards.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-list-lesson]');
  if (btn)
    openLessonSheet(lessonSheet, btn.dataset.listLesson, progress, () => maybeCrossUnlocks({ fromQuest: true }));
});

function openCertificate({ keepQuestOpen = false } = {}) {
  showCertificatePanel(certificatePanel, { reducedMotion });
  if (!keepQuestOpen) questPanel.classList.add('hidden');
}

function openQuests() {
  renderQuestPanel(questPanel, progress);
  questPanel.classList.remove('hidden');
  questPanel.querySelector('#btn-open-cert')?.addEventListener('click', () => {
    openCertificate({ keepQuestOpen: false });
  });
  questPanel.querySelector('#btn-quest-close')?.addEventListener('click', () => {
    questPanel.classList.add('hidden');
  });
  questPanel.addEventListener(
    'click',
    (e) => {
      if (e.target === questPanel) questPanel.classList.add('hidden');
    },
    { once: true }
  );
}

function maybeCrossUnlocks({ fromQuest = false } = {}) {
  const introDone = countIntroQuestsComplete(progress);
  if (introDone >= 3) progress.unlocks.lamp_dock = true;
  if (progress.questsDone.F2 && progress.questsDone.B3) {
    progress.unlocks.unlock_flag_fire = true;
    progress.unlocks.unlock_flag_building = true;
  }
  if (progress.visitDays.length >= 4) progress.unlocks.night_mode = true;
  const lawPass = isLawPassComplete(progress);
  if (lawPass) {
    progress.unlocks.deco_logo_inlay = true;
    progress.unlocks.deco_shore_glow = true;
  }
  saveProgress(progress);
  applyUnlocks(scene, progress.unlocks, { reducedMotion });
  updateQuestThumb();
  updateMinimap();

  if (fromQuest && lawPass && !progress.lawPassCertAutoShown) {
    progress.lawPassCertAutoShown = true;
    saveProgress(progress);
    openCertificate();
  }
}

/* Tutorial */
const TUTORIAL_STEPS = [
  {
    title: '一法規，一座島',
    body: '六座島圍成一圈，中央是品牌平台。點一座島，鏡頭會飛越水面到該島。',
    spotlight: null,
  },
  {
    title: '再點建築開啟確認卡',
    body: '到島上後點建築或標籤，可開啟本站教學／任務。六島從第一秒都能進，任務只解鎖裝飾。',
    spotlight: 'fire',
  },
  {
    title: '開始本區教學',
    body: '示範消防區導讀卡——「第 14 條·滅火器」的白話摘要與底部出處列。',
    spotlight: 'fire',
  },
  {
    title: '任務與原⽂',
    body: '完成小題會點亮建築裝飾；想看全文按「進入法規站」或「查看原文」。',
    spotlight: null,
  },
];

let tutorialStepIndex = 0;
let tutorialActive = false;

function runTutorial() {
  if (progress.tutorialDone) return;
  tutorialStepIndex = progress.tutorialStep || 0;
  tutorialActive = true;
  tutorialOverlay.classList.remove('hidden');
  const text = document.getElementById('tutorial-text');
  const title = document.getElementById('tutorial-title');
  const stepLabel = document.getElementById('tutorial-step-label');
  const next = document.getElementById('btn-tutorial-next');
  const skip = document.getElementById('btn-tutorial-skip');

  const renderStep = () => {
    const cur = TUTORIAL_STEPS[tutorialStepIndex];
    title.textContent = cur.title;
    text.textContent = cur.body;
    stepLabel.textContent = `教學 ${tutorialStepIndex + 1} / ${TUTORIAL_STEPS.length}`;
    next.textContent = tutorialStepIndex >= TUTORIAL_STEPS.length - 1 ? '開始探索' : '下一步';
    Object.values(labelEls).forEach((el) => el.classList.remove('pulse'));
    if (cur.spotlight) {
      labelEls[cur.spotlight]?.classList.add('pulse');
      updateTutorialSpotlight(cur.spotlight);
    } else {
      updateTutorialSpotlight(null);
    }
  };
  renderStep();

  skip.onclick = () => finishTutorial();
  next.onclick = () => {
    if (tutorialStepIndex >= TUTORIAL_STEPS.length - 1) finishTutorial();
    else {
      tutorialStepIndex += 1;
      progress.tutorialStep = tutorialStepIndex;
      saveProgress(progress);
      renderStep();
    }
  };
}

function finishTutorial() {
  tutorialActive = false;
  tutorialOverlay.classList.add('hidden');
  tutorialSpotlight.classList.add('hidden');
  progress.tutorialDone = true;
  saveProgress(progress);
  Object.values(labelEls).forEach((el) => el.classList.remove('pulse'));
}

document.getElementById('btn-reduce-motion').addEventListener('click', (e) => {
  reducedMotion = !reducedMotion;
  progress.reduceMotion = reducedMotion;
  saveProgress(progress);
  e.currentTarget.setAttribute('aria-pressed', String(reducedMotion));
});

/* WebGL fallback timer */
loadTimer = setTimeout(() => {
  document.getElementById('load-fallback').classList.remove('hidden');
}, 8000);

function onResize() {
  width = canvas.clientWidth;
  height = canvas.clientHeight;
  renderer.setSize(width, height, false);
  fitCamera();
  updateLabels();
  if (tutorialActive) {
    const cur = TUTORIAL_STEPS[tutorialStepIndex];
    if (cur?.spotlight) updateTutorialSpotlight(cur.spotlight);
  }
}

window.addEventListener('resize', onResize);

document.addEventListener('visibilitychange', () => {
  hidden = document.hidden;
});

const clock = new THREE.Clock();
let frames = 0;
let fpsT = 0;

function animate() {
  requestAnimationFrame(animate);
  if (hidden) return;
  const dt = clock.getDelta();
  fpsT += dt;
  frames += 1;
  if (fpsT >= 2) {
    const fps = frames / fpsT;
    if (fps < 30) {
      if (!fpsLowSince) fpsLowSince = performance.now();
      else if (performance.now() - fpsLowSince > 2000) reducedMotion = true;
    } else fpsLowSince = null;
    frames = 0;
    fpsT = 0;
  }

  tour.update(dt);
  tour.applyLifts();
  if (activeTransition) activeTransition = activeTransition(dt) || null;
  rig.update();
  updateWaterSurface(waterMesh, clock.elapsedTime);
  updateShorelineGlowFade(dt);

  if (!reducedMotion) {
    const t = performance.now() * 0.002;
    pulseMeshes.forEach((m, i) => {
      const s = 1 + Math.sin(t + i) * 0.06;
      m.scale.set(s, s, s);
    });
  }

  updateLabels();
  renderer.render(scene, camera);
}

if (progress.preferList) showList(true);

if (progress.introSeen || progress.visited) {
  tour.startReturnVisit();
  unlockPan();
  if (!progress.tutorialDone) runTutorial();
} else {
  tour.startFirstVisit();
  runTutorial();
}

applyUnlocks(scene, progress.unlocks, { reducedMotion });
loadBuildingModels();
updateMinimap();
clearTimeout(loadTimer);
document.getElementById('load-fallback').classList.add('hidden');
onResize();
animate();
