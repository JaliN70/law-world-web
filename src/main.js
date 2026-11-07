import * as THREE from 'three';
import { createWorldScene, setBuildingSaturation, applyUnlocks } from './scene/world.js';
import { createIsoCamera, resizeCamera, CameraRig } from './scene/camera.js';
import { attachPanZoom } from './scene/controls.js';
import { TourDirector } from './scene/tour.js';
import { pickBuilding } from './interaction/raycast.js';
import { LABELS_ZH, BUILDING_NAMES } from './scene/layouts.js';
import { AREAS } from './data/areas.js';
import {
  loadProgress,
  saveProgress,
  markVisitDay,
  countAreasWithQuest,
} from './state/storage.js';
import { renderConfirmCard, bindCardActions } from './ui/card.js';
import { openLessonSheet } from './ui/lesson.js';
import { renderListCards } from './ui/listView.js';
import { upgradeBuildingsToGlb, collectPulseMeshes } from './scene/glbBuildings.js';
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
const questPanel = document.getElementById('quest-panel');

const progress = loadProgress();
markVisitDay(progress);

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

const labelHeights = Object.fromEntries(modelStats.map((r) => [r.name, r.max[1]]));

const tour = new TourDirector({
  rig,
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
  btn.addEventListener('click', () => onBuildingSelect(id));
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
    pulseMeshes = collectPulseMeshes(buildings);
    applyUnlocks(scene, progress.unlocks);
  } catch (e) {
    console.warn('[law-world] GLB load failed, using MVP color blocks', e);
  }
}

function rebuildLayout() {
  world = createWorldScene({ isMobile, reducedMotion });
  scene = world.scene;
  buildings = world.buildings;
  clickable = world.clickable;
  pulseMeshes = world.pulseMeshes;
  tour.buildings = buildings;
  applyUnlocks(scene, progress.unlocks);
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
    const top = g.position.clone();
    top.y += (labelHeights[id] || 8) + 1;
    const s = rig.worldToScreen(top, width, height);
    const el = labelEls[id];
    if (s.behind) {
      el.style.visibility = 'hidden';
      return;
    }
    el.style.visibility = 'visible';
    el.style.transform = `translate(${s.x}px, ${s.y - 28}px) translate(-50%, -100%)`;
  });
}

function onBuildingSelect(id) {
  if (panLocked && !focusedId) return;
  const b = buildings[id];
  if (!b) return;
  const switching = focusedId && focusedId !== id;
  focusedId = id;
  setBuildingSaturation(buildings, id);
  activeTransition = tour.focusTransition(b, switching ? 0.5 : 0.6, () => {
    openCard(id);
  });
  pushHistoryState();
}

function openCard(areaId) {
  cardBody.innerHTML = renderConfirmCard(areaId, progress);
  confirmCard.classList.remove('hidden');
  bindCardActions(cardBody, {
    external: (id) => window.open(AREAS[id].siteUrl, '_blank', 'noopener'),
    lesson: (id) => {
      openLessonSheet(lessonSheet, id, progress, () => {
        applyUnlocks(scene, progress.unlocks);
        maybeCrossUnlocks();
      });
    },
  });
}

function closeCard() {
  confirmCard.classList.add('hidden');
  lessonSheet.classList.add('hidden');
  focusedId = null;
  setBuildingSaturation(buildings, null);
  activeTransition = tour.backTransition(0.5);
}

function pushHistoryState() {
  history.pushState({ lawWorld: 'focus' }, '');
}

window.addEventListener('popstate', () => {
  if (!confirmCard.classList.contains('hidden')) closeCard();
});

attachPanZoom(canvas, rig, {
  reducedMotion,
  onTap: (x, y) => {
    if (panLocked) return;
    const id = pickBuilding(camera, clickable, x, y, canvas);
    if (id) onBuildingSelect(id);
    else if (!confirmCard.classList.contains('hidden')) closeCard();
  },
});

document.getElementById('btn-card-close').addEventListener('click', closeCard);
document.getElementById('btn-toggle-view').addEventListener('click', toggleList);
document.getElementById('btn-fallback-list').addEventListener('click', () => showList(true));
document.getElementById('btn-quests').addEventListener('click', openQuests);
document.getElementById('btn-quest-close').addEventListener('click', () => questPanel.classList.add('hidden'));

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
  if (btn) openLessonSheet(lessonSheet, btn.dataset.listLesson, progress, () => applyUnlocks(scene, progress.unlocks));
});

function openQuests() {
  const ul = document.getElementById('quest-list');
  ul.innerHTML = Object.values(AREAS)
    .map((a) => {
      const q = a.quests[0];
      const done = progress.questsDone[q?.id];
      return `<li>${a.buildingName} — ${q?.title || '—'} ${done ? '✓' : ''}</li>`;
    })
    .join('');
  questPanel.classList.remove('hidden');
}

function maybeCrossUnlocks() {
  const n = countAreasWithQuest(progress);
  if (n >= 3) progress.unlocks.deco_street_lamp = true;
  if (n >= 6) progress.unlocks.deco_plaza_badge = true;
  saveProgress(progress);
  applyUnlocks(scene, progress.unlocks);
}

/* Tutorial */
const TUTORIAL_STEPS = [
  '法規園區有六個領域，每棟建築都有自己的導讀與任務。',
  '請點選一座建築（建議消防站），會出現確認卡片。',
  '按「本站教學／任務」可閱讀導讀卡，例如第 14 條滅火器摘要。',
  '完成小題會點亮裝飾；想看全文可按「進入法規站」或「查看原文」。',
];

function runTutorial() {
  if (progress.tutorialDone) return;
  let step = progress.tutorialStep || 0;
  tutorialOverlay.classList.remove('hidden');
  const text = document.getElementById('tutorial-text');
  const next = document.getElementById('btn-tutorial-next');
  const skip = document.getElementById('btn-tutorial-skip');

  const renderStep = () => {
    text.textContent = TUTORIAL_STEPS[step] || '';
    next.textContent = step >= TUTORIAL_STEPS.length - 1 ? '開始探索' : '下一步';
  };
  renderStep();

  skip.onclick = () => finishTutorial();
  next.onclick = () => {
    if (step >= TUTORIAL_STEPS.length - 1) finishTutorial();
    else {
      step += 1;
      progress.tutorialStep = step;
      saveProgress(progress);
      renderStep();
      if (step === 1) highlightBuilding('fire');
    }
  };
}

function highlightBuilding(id) {
  labelEls[id]?.classList.add('pulse');
}

function finishTutorial() {
  tutorialOverlay.classList.add('hidden');
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
  resizeCamera(camera, width, height);
  updateLabels();
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
loadBuildingModels();
clearTimeout(loadTimer);
document.getElementById('load-fallback').classList.add('hidden');
onResize();
animate();
