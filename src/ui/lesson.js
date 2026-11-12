import { AREAS } from '../data/areas.js';
import { QUEST_BY_ID } from '../data/quests.js';
import { esc, sourceRow } from './render.js';

const shuffle = (arr, seed) => {
  const a = [...arr.keys()];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  // 避免剛好是正確順序
  if (a.every((v, i) => v === i) && a.length > 1) a.push(a.shift());
  return a;
};

/**
 * 區域教學（藍圖 §4.2）：領域導覽卡 → 3 張重點導讀卡，每張帶一則任務。
 * 任務可無限重試；答錯顯示提示與原文連結。完成只解鎖裝飾。
 */
export class LessonSheet {
  constructor(el, { progress, onComplete, onScene, onClose }) {
    this.el = el;
    this.progress = progress;
    this.onComplete = onComplete;
    this.onScene = onScene;
    this.onClose = onClose;
    this.area = null;
    this.tab = 0;
    el.addEventListener('click', (e) => this.handle(e));
  }

  get isOpen() {
    return !this.el.classList.contains('hidden');
  }

  open(areaId, cardId = null) {
    this.area = AREAS[areaId];
    this.tab = cardId ? 1 + this.area.cards.findIndex((c) => c.id === cardId) : 0;
    this.render();
    this.el.classList.remove('hidden');
    this.el.querySelector('.sheet-body')?.focus({ preventScroll: true });
  }

  close() {
    this.el.classList.add('hidden');
    this.observer?.disconnect();
  }

  render() {
    const a = this.area;
    const tabs = ['導覽', ...a.cards.map((c) => c.id)];
    const tabBar = tabs
      .map((t, i) => {
        const done = i > 0 && this.progress.isDone(t);
        return `<button type="button" role="tab" aria-selected="${i === this.tab}" data-tab="${i}" class="${done ? 'done' : ''}">${i === 0 ? '導覽' : t}${done ? ' ✓' : ''}</button>`;
      })
      .join('');
    this.el.innerHTML = `
      <div class="sheet-inner" role="dialog" aria-modal="true" aria-labelledby="lesson-title">
        <header class="sheet-head">
          <h2 id="lesson-title">${a.icon} ${esc(a.name)}｜本站教學</h2>
          <button type="button" class="link-btn close-btn" data-act="close" aria-label="關閉教學">✕ 關閉</button>
        </header>
        <div class="tabs" role="tablist">${tabBar}</div>
        <div class="sheet-body" tabindex="-1">${this.tab === 0 ? this.overview() : this.card(a.cards[this.tab - 1])}</div>
      </div>`;
    this.bindRead();
  }

  overview() {
    const a = this.area;
    return `<article class="read-card">
      <p class="eyebrow">領域導覽卡・${esc(a.overview.note)}</p>
      <h3>${a.laws.map((l) => esc(l.name)).join('<br>')}</h3>
      <ul class="outline">${a.overview.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>
      <p class="muted">${a.laws.map((l) => `${esc(l.name)}：修正日 ${esc(l.amended)}`).join('<br>')}</p>
      <div class="card-actions">
        <button type="button" class="btn solid" data-tab="1">開始第一張導讀卡</button>
        <a class="btn outlined" href="${esc(a.siteUrl)}" target="_blank" rel="noopener">進入法規站 ↗</a>
      </div>
    </article>`;
  }

  card(c) {
    const q = QUEST_BY_ID[c.id];
    const compare = c.compare
      ? `<div class="compare">${['left', 'right']
          .map((k) => `<section><h4>${esc(c.compare[k].head)}</h4><ul>${c.compare[k].rows.map((r) => `<li>${esc(r)}</li>`).join('')}</ul></section>`)
          .join('')}</div>`
      : '';
    const fig = c.figure
      ? `<figure class="fig"><img src="${import.meta.env.BASE_URL}${esc(c.figure.src)}" alt="${esc(c.figure.alt)}" loading="lazy" /><figcaption>${esc(c.figure.alt)}・<a href="${esc(c.figure.moj)}" target="_blank" rel="noopener">開啟原檔 ↗</a></figcaption></figure>`
      : '';
    return `<article class="read-card">
      <p class="eyebrow">重點導讀卡 ${c.id}</p>
      <h3>${esc(c.title)}</h3>
      <p class="read-body">${esc(c.body)}</p>
      ${compare}${fig}
      ${sourceRow(c.cite)}
      ${this.quest(q)}
      <div class="sentinel" aria-hidden="true"></div>
    </article>`;
  }

  quest(q) {
    const done = this.progress.isDone(q.id);
    const head = `<header><span class="q-id">任務 ${q.id}</span><strong>${esc(q.title)}</strong><span class="reward">解鎖：${esc(q.reward)}</span></header>`;
    if (done) return `<section class="quiz done">${head}<p class="ok">✓ 已完成。可以再讀一次，或前往下一張卡。</p>${this.nextBtn(q)}</section>`;
    let body = '';
    if (q.type === 'choice') {
      body = `<fieldset><legend>${esc(q.prompt)}</legend>${q.options
        .map((o, i) => `<label class="opt">${q.swatches ? `<span class="swatch" style="background:${q.swatches[i]}"></span>` : ''}<input type="radio" name="q-${q.id}" value="${i}" /><span>${esc(o)}</span></label>`)
        .join('')}</fieldset>`;
    } else if (q.type === 'match') {
      body = `<p class="prompt">${esc(q.prompt)}</p><ol class="match">${q.items
        .map(
          (it, i) => `<li><span>${esc(it.text)}</span><div class="seg" role="radiogroup" aria-label="${esc(it.text)}">${q.categories
            .map((c, j) => `<label><input type="radio" name="m-${q.id}-${i}" value="${j}" /><span>${esc(c)}</span></label>`)
            .join('')}</div></li>`
        )
        .join('')}</ol>`;
    } else if (q.type === 'order') {
      const order = this.orderState?.[q.id] || shuffle(q.items, q.id.charCodeAt(0) + q.id.charCodeAt(1));
      this.orderState = { ...this.orderState, [q.id]: order };
      body = `<p class="prompt">${esc(q.prompt)}</p><ol class="order">${order
        .map(
          (idx, pos) => `<li><span>${esc(q.items[idx])}</span>
          <span class="order-btns"><button type="button" data-move="${pos}" data-dir="-1" aria-label="上移" ${pos === 0 ? 'disabled' : ''}>↑</button><button type="button" data-move="${pos}" data-dir="1" aria-label="下移" ${pos === order.length - 1 ? 'disabled' : ''}>↓</button></span></li>`
        )
        .join('')}</ol>`;
    } else if (q.type === 'scene') {
      return `<section class="quiz">${head}<p class="prompt">${esc(q.prompt)}</p>
        <button type="button" class="btn solid" data-scene="${q.id}">到場景中找</button></section>`;
    } else if (q.type === 'read') {
      return `<section class="quiz">${head}<p class="prompt">${esc(q.prompt)}</p><p class="muted read-progress">讀到卡片最底就完成。</p></section>`;
    }
    return `<section class="quiz" data-quiz="${q.id}">${head}${body}
      <div class="quiz-actions"><button type="button" class="btn solid" data-check="${q.id}">送出答案</button></div>
      <p class="feedback" role="status" aria-live="polite"></p></section>`;
  }

  nextBtn(q) {
    const a = this.area;
    const i = a.cards.findIndex((c) => c.id === q.id);
    if (i < a.cards.length - 1) return `<button type="button" class="btn outlined" data-tab="${i + 2}">下一張：${esc(a.cards[i + 1].title)}</button>`;
    return `<button type="button" class="btn outlined" data-act="close">回到園區</button>`;
  }

  bindRead() {
    this.observer?.disconnect();
    if (this.tab === 0) return;
    const q = QUEST_BY_ID[this.area.cards[this.tab - 1].id];
    if (q.type !== 'read' || this.progress.isDone(q.id)) return;
    const s = this.el.querySelector('.sentinel');
    this.observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          this.observer.disconnect();
          this.finish(q);
        }
      },
      { root: this.el.querySelector('.sheet-body'), threshold: 1 }
    );
    // 給使用者一點時間：至少停留 1.5 秒後才開始判定
    setTimeout(() => s && this.observer.observe(s), 1500);
  }

  check(q) {
    const box = this.el.querySelector(`[data-quiz="${q.id}"]`);
    const fb = box.querySelector('.feedback');
    let ok = false;
    if (q.type === 'choice') {
      const v = box.querySelector('input:checked')?.value;
      if (v === undefined) return this.say(fb, '先選一個答案。', 'warn');
      ok = Number(v) === q.answer;
    } else if (q.type === 'match') {
      const picks = q.items.map((_, i) => box.querySelector(`input[name="m-${q.id}-${i}"]:checked`)?.value);
      if (picks.some((p) => p === undefined)) return this.say(fb, '每一項都要選一個分類。', 'warn');
      ok = picks.every((p, i) => Number(p) === q.items[i].answer);
    } else if (q.type === 'order') {
      ok = this.orderState[q.id].every((v, i) => v === i);
    }
    if (!ok) {
      const card = this.area.cards.find((c) => c.id === q.id);
      const link = card.cite.moj || card.cite.site;
      return this.say(fb, `再想想：${esc(q.hint)} <a href="${esc(link)}" target="_blank" rel="noopener">看原文 ↗</a>`, 'bad', true);
    }
    this.finish(q);
  }

  say(el, msg, kind, html = false) {
    el.className = `feedback ${kind}`;
    if (html) el.innerHTML = msg;
    else el.textContent = msg;
  }

  finish(q) {
    this.onComplete(q.id);
    this.render();
  }

  handle(e) {
    const t = e.target.closest('button, a');
    if (!t) {
      if (e.target === this.el) this.onClose();
      return;
    }
    if (t.dataset.act === 'close') return this.onClose();
    if (t.dataset.tab !== undefined) {
      this.tab = Number(t.dataset.tab);
      this.render();
      this.el.querySelector('.sheet-body').scrollTop = 0;
      return;
    }
    if (t.dataset.check) return this.check(QUEST_BY_ID[t.dataset.check]);
    if (t.dataset.scene) return this.onScene(QUEST_BY_ID[t.dataset.scene]);
    if (t.dataset.move !== undefined) {
      const q = QUEST_BY_ID[this.area.cards[this.tab - 1].id];
      const order = [...this.orderState[q.id]];
      const i = Number(t.dataset.move);
      const j = i + Number(t.dataset.dir);
      [order[i], order[j]] = [order[j], order[i]];
      this.orderState[q.id] = order;
      const scroll = this.el.querySelector('.sheet-body').scrollTop;
      this.render();
      this.el.querySelector('.sheet-body').scrollTop = scroll;
      this.el.querySelector(`[data-move="${j}"][data-dir="${t.dataset.dir}"]`)?.focus() || this.el.querySelector(`[data-move="${j}"]`)?.focus();
    }
  }
}
