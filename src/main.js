import * as THREE from 'three';
import { createWorldScene, setBuildingSaturation, applyUnlocks, disposeWorld } from './scene/world.js';
import { bindGlowMaterials, setLawPassGlow, updateLawPassGlow } from './scene/shorelineGlow.js';
import { createIsoCamera, fitOverview, CameraRig } from './scene/camera.js';
import { attachPanZoom } from './scene/controls.js';
import { TourDirector } from './scene/tour.js';
import { pickBuilding, pickIsland } from './interaction/raycast.js';
import { LABELS_ZH, BUILDING_NAMES, getLayoutPreset } from './scene/layouts.js';
import { updateWaterSurface, setWaterMotion } from './scene/waterSurface.js';
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
import { installPark } from './scene/parkAssets.js';
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

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
/** DPR 上限 1.5；低階機（FPS < 30 持續 2 s）再降到 1 */
const DPR_CAP = 1.5;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, DPR_CAP));

let width = canvas.clientWidth;
let height = canvas.clientHeight;
renderer.setSize(width, height, false);

const camera = createIsoCamera(width, height);
const rig = new CameraRig(camera);

let world = createWorldScene({ isMobile, reducedMotion });
let scene = world.scene;
let buildings = world.buildings;
let clickable = world.clickable;
let pulseMeshes = [];
let islandPickables = world.islandPickables;
let waterMesh = world.water;

const labelHeights = Object.fromEntries(modelStats.map((r) => [r.name, r.max[1]]));

if (new URLSearchParams(location.search).has('debug')) {
  window.__lw = { renderer, camera, scene: () => scene, rig };
}

const tour = new TourDirector({
  rig,
  camera,
  buildings,
  reducedMotion,
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

fitCamera();
updateQuestThumb();

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

function collectPulseMeshes() {
  return Object.values(buildings).flatMap((p) => p.userData.pulseRings || []);
}

function syncLawPassGlow() {
  setLawPassGlow(Boolean(progress.unlocks.deco_logo_inlay), { reducedMotion });
}

/** 單一 park.glb：建築、六島地形、中央平台一次到位 */
async function loadParkModels() {
  const target = world;
  try {
    const report = await installPark(target);
    if (target !== world) return; // 載入期間版面已切換，交給新的場景處理
    window.__lawWorldParkReport = report;
    pulseMeshes = collectPulseMeshes();
    bindGlowMaterials(world.materials);
    applyUnlocks(scene, progress.unlocks);
    syncLawPassGlow();
    if (focusedId) setBuildingSaturation(buildings, focusedId);
  } catch (e) {
    console.warn('[law-world] park.glb load failed, using color-block fallback', e);
  }
}

function fitCamera() {
  const thumb = document.querySelector('.thumb-zone');
  fitOverview(camera, width, height, {
    margin: isMobile ? 1.04 : 1.08,
    // 手機直式：底部拇指區疊在畫布上時，把群島置中在可見區
    reserveBottom: thumb && thumb.getBoundingClientRect().top < canvas.getBoundingClientRect().bottom - 1
      ? canvas.getBoundingClientRect().bottom - thumb.getBoundingClientRect().top
      : 0,
  });
  rig.setPanBounds(getLayoutPreset() === 'grid' ? 55 : 32);
  if (tour.view === 'island' && tour.activeIsland) {
    rig.setZoom(tour.islandZoom(tour.activeIsland));
  }
}

function rebuildLayout() {
  closeCard();
  disposeWorld(world);
  world = createWorldScene({ isMobile, reducedMotion });
  scene = world.scene;
  buildings = world.buildings;
  clickable = world.clickable;
  pulseMeshes = [];
  islandPickables = world.islandPickables;
  waterMesh = world.water;
  tour.buildings = buildings;
  tour.view = 'overview';
  tour.activeIsland = null;
  rig.resetOverview();
  fitCamera();
  updateMinimap();
  applyUnlocks(scene, progress.unlocks);
  loadParkModels();
  if (window.__lw) window.__lw.scene = () => scene;
}

mqMobile.addEventListener('change', () => {
  isMobile = mqMobile.matches;
  document.body.classList.toggle('layout-grid', isMobile);
  rebuildLayout();
});
document.body.classList.toggle('layout-grid', isMobile);

const _labelTop = new THREE.Vector3();
const _labelScreen = {};
const _labelCache = {};
function updateLabels() {
  // 標籤不得鑽到小地圖底下
  const mm = minimapEl && minimapEl.offsetParent ? minimapEl.offsetTop + minimapEl.offsetHeight + 8 : 0;
  const mmRight = mm ? minimapEl.offsetLeft + minimapEl.offsetWidth : 0;
  BUILDING_NAMES.forEach((id) => {
    const g = buildings[id];
    if (!g) return;
    g.getWorldPosition(_labelTop);
    _labelTop.y += (labelHeights[id] || 8) + 1;
    const s = rig.worldToScreen(_labelTop, width, height, _labelScreen);
    const el = labelEls[id];
    const pad = 12;
    const lx = Math.round(Math.min(width - pad, Math.max(pad, s.x)));
    let ly = Math.round(Math.min(height - pad, Math.max(pad + 40, s.y - 6)));
    if (mm && lx < mmRight + 60 && ly - 44 < mm) ly = mm + 44;
    // 島嶼視圖只留目前這座的標籤，鄰島標籤不再擠在畫面邊緣
    const off = s.behind || (tour.view === 'island' && tour.activeIsland && tour.activeIsland !== id);
    const key = off ? 'hidden' : `${lx},${ly}`;
    if (_labelCache[id] === key) return; // 沒動就不碰 DOM
    _labelCache[id] = key;
    el.style.visibility = off ? 'hidden' : 'visible';
    if (!off) el.style.transform = `translate(${lx}px, ${ly}px) translate(-50%, -100%)`;
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
  tour.reducedMotion = reducedMotion;
  activeTransition = tour.flyToIsland(id, 0.8, () => {
    if (openBuildingAfter) onBuildingSelect(openBuildingAfter);
  });
  updateMinimap();
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
  activeTransition = tour.focusBuilding(b, () => openCard(id), { cardLift: isMobile ? 0.2 : 0.14 });
  pushHistoryState({ view: 'card', island: id });
}

/** 藍圖 S4：點建築（或其標籤、或其島）→ 鏡頭推近 → 確認卡片，一步到位 */
function onLabelActivate(id) {
  onBuildingSelect(id);
}

function goOverview() {
  closeCard();
  islandFocusedId = null;
  tour.reducedMotion = reducedMotion;
  activeTransition = tour.flyToOverview(0.8, () => updateMinimap());
  updateMinimap();
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
  const wasOpen = !confirmCard.classList.contains('hidden');
  if (wasOpen && tour.view === 'island' && tour.activeIsland) {
    activeTransition = tour.flyToIsland(tour.activeIsland, 0.35);
  }
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
    const id = pickBuilding(camera, clickable, x, y, canvas) || pickIsland(camera, islandPickables, x, y, canvas);
    if (id && !(tour.view === 'island' && tour.activeIsland === id && focusedId === id)) {
      onBuildingSelect(id);
      return;
    }
    // 點空白處：卡片開著先收卡片，再點一次回概覽（S6）
    if (!confirmCard.classList.contains('hidden')) closeCard();
    else if (tour.view === 'island') goOverview();
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
  document.body.classList.toggle('view-island', tour.view === 'island');
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
  onBuildingSelect(btn.dataset.island);
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
  applyUnlocks(scene, progress.unlocks);
  syncLawPassGlow();
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
    body: '六座島各代表一個法規領域，中央是品牌平台。點任一座島或建築，鏡頭會推近並開啟確認卡。',
    spotlight: null,
  },
  {
    title: '確認卡：教學、任務與原文',
    body: '卡片可開始本站教學／任務，或進入法規站、查看原文。六島從第一秒都能進，任務只解鎖裝飾。',
    spotlight: 'fire',
  },
  {
    title: '開始本區教學',
    body: '示範消防區導讀卡——「第 14 條·滅火器」的白話摘要與底部出處列。',
    spotlight: 'fire',
  },
  {
    title: '任務與原文',
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
  tour.reducedMotion = reducedMotion;
  setWaterMotion(waterMesh, !reducedMotion);
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

/** 藍圖 §3：低階機改 0.2 s 淡入淡出、關閉脈動與水波；另把 DPR 降到 1 */
let lowEndMode = false;
function enterLowEndMode() {
  lowEndMode = true;
  reducedMotion = true;
  tour.reducedMotion = true;
  setWaterMotion(waterMesh, false);
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
}

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
      else if (performance.now() - fpsLowSince > 2000 && !lowEndMode) enterLowEndMode();
    } else fpsLowSince = null;
    frames = 0;
    fpsT = 0;
  }

  tour.update(dt);
  if (activeTransition) {
    // onDone 可能已接上下一段（飛到島 → 推近建築），不能被這一段的回傳值蓋掉
    const step = activeTransition;
    const next = step(dt);
    if (activeTransition === step) activeTransition = next || null;
  }
  rig.update();
  camera.updateMatrixWorld();
  updateWaterSurface(waterMesh, clock.elapsedTime);
  updateLawPassGlow(dt);

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

applyUnlocks(scene, progress.unlocks);
loadParkModels();
updateMinimap();
clearTimeout(loadTimer);
document.getElementById('load-fallback').classList.add('hidden');
onResize();
animate();
