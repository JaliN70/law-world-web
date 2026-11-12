import './styles.css';
import * as THREE from 'three';
import { AREAS, AREA_ORDER } from './data/areas.js';
import { QUESTS, QUEST_BY_ID } from './data/quests.js';
import { Progress } from './state/progress.js';
import { loadPark } from './world/assets.js';
import { World } from './world/World.js';
import { Director } from './world/director.js';
import { confirmCard, listCards, questPanel, certificate } from './ui/render.js';
import { LessonSheet } from './ui/lesson.js';
import { Tutorial } from './ui/tutorial.js';

const $ = (s) => document.querySelector(s);
const el = {
  stage: $('#stage'),
  canvas: $('#world'),
  labels: $('#labels'),
  card: $('#card'),
  cardBody: $('#card-body'),
  lesson: $('#lesson'),
  quests: $('#quests'),
  cert: $('#cert'),
  list: $('#list-view'),
  listCards: $('#list-cards'),
  tut: $('#tutorial'),
  spot: $('#tut-spot'),
  loading: $('#loading'),
  loadBar: $('#loading-bar'),
  toast: $('#toast'),
  sceneTask: $('#scene-task'),
  questCount: $('#quest-count'),
  btnList: $('#btn-list'),
  btnListTop: $('#btn-list-top'),
  btnQuests: $('#btn-quests'),
  btnMotion: $('#btn-motion'),
  btnNight: $('#btn-night'),
  header: $('.topbar'),
  thumb: $('.thumb'),
};

const progress = new Progress();
const mq = window.matchMedia('(max-width: 760px), (orientation: portrait) and (max-width: 1024px)');
const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)');
let reduced = progress.state.prefs.reduceMotion || prefersReduced.matches;

let world = null;
let director = null;
let openArea = null; // 卡片目前對應的建築
let sceneQuest = null; // 進行中的場景任務
let labelsShown = false;
let historyDepth = 0;
const thumbs = {};

/* ───────────────────────── 共用 UI ───────────────────────── */

let toastTimer = null;
function toast(html, ms = 3200) {
  el.toast.innerHTML = html;
  el.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.remove('show'), ms);
}

function updateCounts() {
  el.questCount.textContent = `${progress.doneCount}/${QUESTS.length}`;
  el.btnNight.hidden = !progress.unlocks().has('night_mode');
  el.btnNight.setAttribute('aria-pressed', String(Boolean(progress.state.prefs.night)));
  el.btnMotion.setAttribute('aria-pressed', String(reduced));
}

function setReduced(on, persist = true) {
  reduced = on;
  if (persist) progress.setPref('reduceMotion', on);
  document.documentElement.classList.toggle('reduce-motion', on);
  if (director) director.reduced = on;
  if (world) world.effects.reduced = on;
  updateCounts();
}

/* ───────────────────────── 列表檢視 ───────────────────────── */

function renderList() {
  el.listCards.innerHTML = listCards(progress, thumbs);
}

function showList(on, persist = true) {
  el.list.classList.toggle('hidden', !on);
  el.stage.classList.toggle('hidden', on);
  document.body.classList.toggle('list-mode', on);
  const text = on ? '3D 檢視' : '☰ 列表檢視';
  el.btnList.textContent = text;
  el.btnListTop.innerHTML = on ? '3D' : '☰<span class="txt"> 列表</span>';
  el.btnListTop.setAttribute('aria-label', on ? '切換到 3D 檢視' : '切換到列表檢視');
  if (persist) progress.setPref('list', on);
  if (on) {
    closeCard();
    makeThumbs();
    renderList();
    el.list.querySelector('h2')?.focus();
  }
  if (!on && !world) showList(true, false); // 3D 不可用時留在列表
}

el.listCards.addEventListener('click', (e) => {
  const b = e.target.closest('[data-lesson]');
  if (b) lesson.open(b.dataset.lesson);
});

/* ───────────────────────── 卡片、教學、任務 ───────────────────────── */

const lesson = new LessonSheet(el.lesson, {
  progress,
  onComplete: completeQuest,
  onScene: startSceneQuest,
  onClose: () => lesson.close(),
});

/** 卡片在畫面上的位置（比例），讓鏡頭把建築放在卡片沒蓋到的區域 */
function cardFrame() {
  const r = el.card.getBoundingClientRect();
  const s = el.stage.getBoundingClientRect();
  return {
    top: Math.min(0.9, Math.max(0.3, (r.top - s.top) / s.height)),
    left: (r.left - s.left) / s.width,
  };
}

async function selectArea(id, { fromTutorial = false } = {}) {
  if (!world || sceneQuest) return;
  const switching = Boolean(openArea) && openArea !== id;
  openArea = id;
  world.focus(id);
  el.cardBody.innerHTML = confirmCard(id, progress);
  el.card.classList.remove('hidden');
  el.card.classList.toggle('swap', switching);
  requestAnimationFrame(() => el.card.classList.remove('swap'));
  if (historyDepth === 0) {
    history.pushState({ park: 'card' }, '');
    historyDepth = 1;
  }
  tutorial.notify('card');
  await director.focus(id, { switching, card: cardFrame() });
  if (!fromTutorial) el.card.querySelector('[data-act="lesson"]')?.focus({ preventScroll: true });
}

function closeCard({ fromHistory = false, keepCamera = false } = {}) {
  if (!openArea) return;
  openArea = null;
  el.card.classList.add('hidden');
  world?.focus(null);
  if (!keepCamera) director?.overview(0.5);
  if (historyDepth && !fromHistory) {
    historyDepth = 0;
    history.back();
  }
  historyDepth = 0;
}

window.addEventListener('popstate', () => {
  if (lesson.isOpen) lesson.close();
  if (openArea) closeCard({ fromHistory: true });
  historyDepth = 0;
});

el.card.addEventListener('click', (e) => {
  const t = e.target.closest('[data-act]');
  if (!t) return;
  if (t.dataset.act === 'close') closeCard();
  if (t.dataset.act === 'lesson') lesson.open(openArea);
});

function completeQuest(id) {
  const q = QUEST_BY_ID[id];
  const newAch = progress.complete(id);
  world?.effects.unlock(q.unlock);
  toast(`<strong>任務 ${id} 完成</strong>　解鎖：${q.reward}`);
  newAch.forEach((a, i) => {
    world?.effects.unlock(a.unlock);
    setTimeout(() => toast(`<strong>成就「${a.title}」</strong>　${a.reward}`), 1800 * (i + 1));
  });
  if (newAch.some((a) => a.id === 'lawPass') && !progress.state.certShown) {
    progress.set('certShown', true);
    setTimeout(openCert, 1600);
  }
  if (openArea) el.cardBody.innerHTML = confirmCard(openArea, progress);
  updateCounts();
  if (!el.list.classList.contains('hidden')) renderList();
  // 提示下一則任務
  const next = QUESTS.find((x) => x.area === q.area && !progress.isDone(x.id));
  if (next) setTimeout(() => toast(`下一則：${next.id}・${next.title}`), 1800 * (newAch.length + 1));
}

function openQuests() {
  el.quests.innerHTML = `<div class="sheet-inner" role="dialog" aria-modal="true" aria-label="任務面板"><div class="sheet-body">${questPanel(progress)}</div></div>`;
  el.quests.classList.remove('hidden');
  el.quests.querySelector('.close-btn')?.focus();
}
el.quests.addEventListener('click', (e) => {
  if (e.target === el.quests) return el.quests.classList.add('hidden');
  const t = e.target.closest('button');
  if (!t) return;
  if (t.dataset.act === 'close') el.quests.classList.add('hidden');
  if (t.dataset.act === 'cert') openCert();
  if (t.dataset.quest) {
    el.quests.classList.add('hidden');
    lesson.open(QUEST_BY_ID[t.dataset.quest].area, t.dataset.quest);
  }
});

function openCert() {
  el.cert.innerHTML = certificate(progress);
  el.cert.classList.remove('hidden');
  el.cert.querySelector('[data-act="close"]')?.focus();
}
el.cert.addEventListener('click', (e) => {
  const t = e.target.closest('button');
  if (e.target === el.cert || t?.dataset.act === 'close') el.cert.classList.add('hidden');
  if (t?.dataset.act === 'print') window.print();
});

/* ───────────────────────── 場景任務（A1、A3） ───────────────────────── */

async function startSceneQuest(q) {
  if (!world) {
    toast('3D 場景未啟用：請切換到 3D 檢視後再做這則任務。');
    return;
  }
  lesson.close();
  closeCard({ keepCamera: true });
  sceneQuest = { q, found: new Set() };
  world.setHotspots(q.area, q.targets);
  world.clearFoundMarks();
  world.focus(q.area);
  renderSceneTask();
  el.sceneTask.classList.remove('hidden');
  await director.frame(q.area);
}

function renderSceneTask(msg = '') {
  const { q, found } = sceneQuest;
  el.sceneTask.innerHTML = `<p class="eyebrow">任務 ${q.id}・${q.title}</p>
    <p>${q.prompt}</p>
    <p class="scene-progress">已找到 ${found.size}/${q.targets.length}${found.size ? '：' + q.targets.filter((t) => found.has(t.id)).map((t) => t.label).join('、') : ''}</p>
    <p class="feedback" role="status" aria-live="polite">${msg}</p>
    <div class="card-actions"><button type="button" class="btn outlined" data-act="hint">提示</button><button type="button" class="btn outlined" data-act="quit">結束</button></div>`;
}

el.sceneTask.addEventListener('click', (e) => {
  const t = e.target.closest('button');
  if (!t) return;
  if (t.dataset.act === 'hint') renderSceneTask(sceneQuest.q.hint);
  if (t.dataset.act === 'quit') endSceneQuest();
});

function endSceneQuest() {
  const q = sceneQuest?.q;
  sceneQuest = null;
  world.clearHotspots();
  el.sceneTask.classList.add('hidden');
  world.focus(null);
  director.overview(0.5).then(() => world.clearFoundMarks());
  return q;
}

function sceneTap(x, y) {
  const hit = world.pickHotspot(x, y);
  if (!hit) return renderSceneTask('這裡不是喔，再看看建築入口附近。');
  if (sceneQuest.found.has(hit.id)) return;
  sceneQuest.found.add(hit.id);
  world.markFound(hit.point);
  const t = sceneQuest.q.targets.find((x) => x.id === hit.id);
  if (sceneQuest.found.size >= sceneQuest.q.targets.length) {
    renderSceneTask(`找到「${t.label}」！全部完成。`);
    const q = sceneQuest.q;
    setTimeout(() => {
      endSceneQuest();
      completeQuest(q.id);
      lesson.open(q.area, q.id);
    }, 900);
  } else renderSceneTask(`找到「${t.label}」！`);
}

/* ───────────────────────── 標籤（建築旁永遠有中文名稱） ───────────────────────── */

const labelEls = {};
AREA_ORDER.forEach((id) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'b-label';
  b.textContent = AREAS[id].label;
  b.setAttribute('aria-label', `${AREAS[id].name}：開啟確認卡片`);
  b.addEventListener('click', () => (sceneQuest ? null : selectArea(id)));
  el.labels.appendChild(b);
  labelEls[id] = b;
});

function showLabel(i, on = true) {
  labelEls[AREA_ORDER[i]].classList.toggle('show', on);
}

const lastLabel = {};
function placeLabels() {
  const pos = world.labelPositions();
  const W = world.size.w;
  for (const id of AREA_ORDER) {
    const p = pos[id];
    const x = Math.round(Math.max(36, Math.min(W - 36, p.x)));
    const y = Math.round(Math.max(56, p.y));
    const key = `${x},${y}`;
    if (lastLabel[id] === key) continue;
    lastLabel[id] = key;
    labelEls[id].style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
  }
}

/* ───────────────────────── 教學 ───────────────────────── */

const tutorial = new Tutorial(el.tut, el.spot, {
  onStep: ({ index, action, spot }) => {
    if (action === 'click-spot' && spot) selectArea(spot, { fromTutorial: true });
    if (action === 'demo-lesson') lesson.open('fire', 'F1');
    if (index === 3) lesson.close();
  },
  onFinish: () => progress.set('tutorialDone', true),
});

/* ───────────────────────── 3D 輸入 ───────────────────────── */

function attachInput() {
  const pts = new Map();
  let moved = false;
  let pinch = null;
  el.canvas.addEventListener('pointerdown', (e) => {
    el.canvas.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY });
    moved = false;
    if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: world.iso.zoom };
    }
  });
  el.canvas.addEventListener('pointermove', (e) => {
    const p = pts.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    if (Math.hypot(p.x - p.x0, p.y - p.y0) > 8) moved = true;
    if (pts.size === 2 && pinch) {
      const [a, b] = [...pts.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      world.iso.setZoom(Math.min(2.2, Math.max(0.8, (pinch.z * d) / pinch.d)));
    } else if (pts.size === 1 && moved && !director.tw) {
      world.iso.panBy(dx, dy, world.size.h);
    }
  });
  const end = (e) => {
    const p = pts.get(e.pointerId);
    pts.delete(e.pointerId);
    if (pts.size < 2) pinch = null;
    if (p && !moved && pts.size === 0 && e.type === 'pointerup') onTap(e.clientX, e.clientY);
  };
  el.canvas.addEventListener('pointerup', end);
  el.canvas.addEventListener('pointercancel', end);
  el.canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      world.iso.setZoom(Math.min(2.2, Math.max(0.8, world.iso.zoom * (e.deltaY > 0 ? 0.9 : 1.1))));
    },
    { passive: false }
  );
}

function onTap(x, y) {
  if (sceneQuest) return sceneTap(x, y);
  if (!labelsShown) return;
  const id = world.pickBuilding(x, y);
  if (id) selectArea(id);
  else if (openArea) closeCard(); // 點空白處返回概覽（S6）
}

/* ───────────────────────── 縮圖（列表檢視） ───────────────────────── */

function makeThumbs() {
  if (!world || thumbs.fire) return;
  const r = world.renderer;
  const size = 160;
  const rt = new THREE.WebGLRenderTarget(size, size, { samples: 4 });
  rt.texture.colorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x9fb6c8, 1.2));
  const sun = new THREE.DirectionalLight(0xfff4e0, 1.5);
  sun.position.set(-4, 9, 6);
  scene.add(sun);
  const cam = new THREE.OrthographicCamera(-7, 7, 7, -7, 0.1, 100);
  cam.position.set(20, 16, 20);
  cam.lookAt(0, 4.5, 0);
  const buf = new Uint8Array(size * size * 4);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  for (const id of AREA_ORDER) {
    const m = world.park.templates[id].clone(true);
    m.traverse((o) => {
      if (o.isMesh) o.material = world.park.palette.base;
      if (o.name.startsWith('unlock_')) o.visible = false;
    });
    scene.add(m);
    r.setRenderTarget(rt);
    r.setClearColor(0x000000, 0);
    r.clear();
    r.render(scene, cam);
    r.readRenderTargetPixels(rt, 0, 0, size, size, buf);
    const img = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) img.data.set(buf.subarray((size - 1 - y) * size * 4, (size - y) * size * 4), y * size * 4);
    ctx.putImageData(img, 0, 0);
    thumbs[id] = canvas.toDataURL('image/png');
    scene.remove(m);
  }
  r.setRenderTarget(null);
  rt.dispose();
}

/* ───────────────────────── 版面與迴圈 ───────────────────────── */

function measure() {
  const s = el.stage.getBoundingClientRect();
  const top = el.header.getBoundingClientRect().bottom - s.top + 8;
  const bottom = s.bottom - el.thumb.getBoundingClientRect().top + 8;
  return { w: s.width, h: s.height, reserve: { top: Math.max(0, top), bottom: Math.max(0, bottom) } };
}

function onResize() {
  if (!world) return;
  const changed = world.applyLayout();
  const m = measure();
  world.resize(m.w, m.h, m.reserve);
  if (changed) {
    world.effects.reduced = reduced;
    progress.unlocks().forEach((k) => world.effects.unlock(k, { animate: false }));
  }
  if (changed || !openArea) {
    if (openArea) director.focus(openArea, { card: cardFrame() });
    else if (!sceneQuest) director.overview(0);
  }
  Object.keys(lastLabel).forEach((k) => delete lastLabel[k]);
}

let fpsWin = { t: 0, n: 0, lowFor: 0 };
function watchFps(dt) {
  fpsWin.t += dt;
  fpsWin.n += 1;
  if (fpsWin.t < 1) return;
  const fps = fpsWin.n / fpsWin.t;
  fpsWin.lowFor = fps < 30 ? fpsWin.lowFor + fpsWin.t : 0;
  fpsWin.t = 0;
  fpsWin.n = 0;
  if (fpsWin.lowFor >= 2 && !world.lowEnd) {
    world.enterLowEnd();
    setReduced(true, false);
    onResize();
  }
}

function loop() {
  const clock = new THREE.Clock();
  const frame = () => {
    requestAnimationFrame(frame);
    if (document.hidden || el.stage.classList.contains('hidden')) {
      clock.getDelta();
      return;
    }
    const dt = Math.min(0.1, clock.getDelta());
    director.update(dt);
    if (!director.tw && !sceneQuest) world.iso.relax(dt);
    world.render(dt, clock.elapsedTime);
    placeLabels();
    if (tutorial.active) {
      const b = tutorial.step.spot ? world.buildings[tutorial.step.spot] : null;
      const p = b && world.iso.project(b.center.clone().setY(Math.min(b.top, 8) * 0.45), world.size.w, world.size.h);
      tutorial.placeSpot(p, Math.min(world.size.w, world.size.h) * (world.preset.id === 'grid' ? 0.42 : 0.26));
    }
    if (!world.lowEnd) watchFps(dt);
  };
  frame();
}

/* ───────────────────────── 啟動 ───────────────────────── */

function webglOK() {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

async function boot() {
  updateCounts();
  setReduced(reduced, false);
  el.btnList.addEventListener('click', () => showList(el.list.classList.contains('hidden')));
  el.btnListTop.addEventListener('click', () => showList(el.list.classList.contains('hidden')));
  el.btnQuests.addEventListener('click', openQuests);
  el.btnMotion.addEventListener('click', () => setReduced(!reduced));
  el.btnNight.addEventListener('click', () => {
    const on = !progress.state.prefs.night;
    progress.setPref('night', on);
    world?.setNight(on);
    updateCounts();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!el.cert.classList.contains('hidden')) el.cert.classList.add('hidden');
    else if (!el.quests.classList.contains('hidden')) el.quests.classList.add('hidden');
    else if (lesson.isOpen) lesson.close();
    else if (sceneQuest) endSceneQuest();
    else if (openArea) closeCard();
  });

  if (!webglOK()) {
    el.loading.classList.add('hidden');
    showList(true, false);
    toast('此裝置不支援 3D，已切換到列表檢視。', 5000);
    return;
  }

  // 載入逾 8 秒：先給列表檢視（藍圖 §5）
  const slow = setTimeout(() => {
    if (!world) {
      showList(true, false);
      toast('3D 載入較慢，先用列表檢視；載入完成後可切回 3D。', 5000);
    }
  }, 8000);

  let park;
  try {
    park = await loadPark(`${import.meta.env.BASE_URL}models/park.glb`, (k) => {
      el.loadBar.style.width = `${Math.round(k * 100)}%`;
    });
  } catch (err) {
    console.error(err);
    clearTimeout(slow);
    el.loading.classList.add('hidden');
    showList(true, false);
    toast('3D 模型載入失敗，已切換到列表檢視。', 5000);
    return;
  }
  clearTimeout(slow);

  world = new World(el.canvas, park, { mobileQuery: mq });
  director = new Director(world);
  world.effects.reduced = reduced;
  director.reduced = reduced;
  world.applyLayout();
  const m = measure();
  world.resize(m.w, m.h, m.reserve);
  progress.unlocks().forEach((k) => world.effects.unlock(k, { animate: false }));
  if (progress.state.prefs.night && progress.unlocks().has('night_mode')) world.setNight(true);
  attachInput();
  window.addEventListener('resize', onResize);
  mq.addEventListener('change', onResize);
  if (new URLSearchParams(location.search).has('debug')) window.__park = { world, director, progress };

  el.loading.classList.add('hidden');
  const listWasOpen = !el.list.classList.contains('hidden');
  if (progress.state.prefs.list) showList(true, false);
  else if (listWasOpen) toast('3D 已就緒　<button type="button" class="link-btn" id="go3d">切換到 3D</button>', 6000);
  document.getElementById('go3d')?.addEventListener('click', () => showList(false));

  loop();
  updateCounts();

  if (!progress.state.introSeen) {
    // 首次：S1 降落＋S2 點名
    document.body.classList.add('arriving');
    requestAnimationFrame(() => document.body.classList.add('arrived'));
    await director.intro((i) => showLabel(i));
    progress.set('introSeen', true);
  } else {
    // 回訪：略過 S1–S2，0.4 秒淡入
    document.body.classList.add('return-visit');
    AREA_ORDER.forEach((_, i) => showLabel(i));
  }
  labelsShown = true;
  if (!progress.state.tutorialDone) tutorial.start();
}

boot();
