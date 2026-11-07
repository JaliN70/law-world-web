import { AREAS } from '../data/areas.js';
import { LAW_PASS_INTRO_QUESTS } from '../state/storage.js';

const QUEST_AREA = {
  F1: 'fire',
  B1: 'building',
  T1: 'telecom',
  A1: 'accessibility',
  W1: 'water',
  E1: 'electrical',
};

function certificateRowsHtml() {
  return LAW_PASS_INTRO_QUESTS.map((qid) => {
    const areaId = QUEST_AREA[qid];
    const area = AREAS[areaId];
    const quest = area?.quests?.find((q) => q.id === qid);
    const label = area?.domain || areaId;
    const task = quest?.title || qid;
    return `<li><strong>${label}</strong><span>${task}</span></li>`;
  }).join('');
}

export function renderCertificateSheet() {
  return `
    <div class="cert-sheet" role="document">
      <header class="cert-head">
        <div class="cert-brand-bar" aria-hidden="true"></div>
        <h2 id="cert-title" class="cert-title">法規通｜園區完成標記</h2>
        <button type="button" id="btn-cert-close" class="quest-close cert-close" aria-label="關閉">×</button>
      </header>
      <p class="cert-lead">
        你已完成<strong>六大法規領域</strong>的入門任務。中央品牌圖樣與六島岸緣已為你點亮——這是
        <strong>Tysic工程資訊部｜法規園區</strong>的互動成就標記，不代表任何官方執照或法律效力。
      </p>
      <ul class="cert-areas" aria-label="已完成領域">
        ${certificateRowsHtml()}
      </ul>
      <p class="cert-footnote">
        可隨時於「園區任務」面板再次開啟本證書。外站法規連結與導讀內容不受影響。
      </p>
      <button type="button" id="btn-cert-dismiss" class="btn-primary cert-dismiss">關閉並回到園區</button>
    </div>
  `;
}

export function bindCertificate(panelEl, onClose) {
  const close = () => {
    panelEl.classList.add('hidden');
    panelEl.classList.remove('cert-fade-in');
    onClose?.();
  };
  panelEl.querySelector('#btn-cert-close')?.addEventListener('click', close);
  panelEl.querySelector('#btn-cert-dismiss')?.addEventListener('click', close);
  panelEl.addEventListener('click', (e) => {
    if (e.target === panelEl) close();
  });
}

export function showCertificatePanel(panelEl, { reducedMotion = false } = {}) {
  panelEl.innerHTML = renderCertificateSheet();
  panelEl.classList.remove('hidden');
  bindCertificate(panelEl, null);
  if (!reducedMotion) {
    requestAnimationFrame(() => panelEl.classList.add('cert-fade-in'));
  } else {
    panelEl.classList.add('cert-fade-in');
  }
}
