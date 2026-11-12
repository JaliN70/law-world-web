/**
 * 首次全站教學（藍圖 §4.1）：4 步，任何一步都能「略過教學」。
 * 第 2 步不擋操作：使用者真的點一棟建築，就自動進到第 3 步。
 */
const STEPS = [
  { title: '歡迎來到法規園區', body: '法規園區有六個領域，每棟建築都有自己的導讀與任務。', next: '下一步' },
  { title: '點一棟建築', body: '試著點消防站（也可以點其他棟），鏡頭會推近並帶出確認卡片。', spot: 'fire', next: '幫我點消防站', waitFor: 'card' },
  { title: '開始本區教學', body: '這是消防區第一張導讀卡：「第 14 條·滅火器」的白話摘要，底部是出處列。', next: '下一步', action: 'demo-lesson' },
  { title: '任務與原文', body: '完成小題會點亮建築裝飾；想看全文，按「進入法規站」或「查看原文」。任務從不鎖住內容。', next: '開始探索' },
];

export class Tutorial {
  constructor(el, spotEl, { onStep, onFinish }) {
    this.el = el;
    this.spot = spotEl;
    this.onStep = onStep;
    this.onFinish = onFinish;
    this.i = -1;
    el.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.act === 'skip') this.finish();
      if (b.dataset.act === 'next') this.next(true);
    });
  }

  get active() {
    return this.i >= 0;
  }

  get step() {
    return STEPS[this.i];
  }

  start() {
    this.i = -1;
    this.next(false);
  }

  /** 外部事件（例如卡片開了）推進教學 */
  notify(event) {
    if (this.active && this.step.waitFor === event) this.next(false);
  }

  next(byButton) {
    const cur = this.step;
    if (byButton && cur?.waitFor) {
      // 「幫我點」：由程式代點，再等卡片事件推進
      this.onStep({ action: 'click-spot', spot: cur.spot });
      return;
    }
    this.i += 1;
    if (this.i >= STEPS.length) return this.finish();
    const s = this.step;
    this.el.innerHTML = `<div class="tut-box" role="dialog" aria-live="polite" aria-labelledby="tut-title">
      <p class="eyebrow">教學 ${this.i + 1} / ${STEPS.length}</p>
      <h2 id="tut-title">${s.title}</h2>
      <p>${s.body}</p>
      <div class="card-actions">
        <button type="button" class="btn outlined" data-act="skip">略過教學</button>
        <button type="button" class="btn solid" data-act="next">${s.next}</button>
      </div>
    </div>`;
    this.el.classList.remove('hidden');
    this.el.classList.toggle('at-bottom', Boolean(s.spot)); // 聚焦建築時把說明框移到下方，不擋建築
    this.el.dataset.step = String(this.i);
    this.onStep({ index: this.i, spot: s.spot, action: s.action });
    this.el.querySelector('[data-act="next"]').focus({ preventScroll: true });
  }

  /** 每幀由 main 呼叫：把聚光圈放在建築上 */
  placeSpot(pos, size) {
    if (!this.active || !this.step.spot || !pos) {
      this.spot.classList.add('hidden');
      return;
    }
    this.spot.classList.remove('hidden');
    this.spot.style.transform = `translate(${pos.x - size / 2}px, ${pos.y - size / 2}px)`;
    this.spot.style.width = this.spot.style.height = `${size}px`;
  }

  finish() {
    this.i = -1;
    this.el.classList.add('hidden');
    this.spot.classList.add('hidden');
    this.onFinish();
  }
}
