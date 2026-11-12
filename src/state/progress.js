import { QUESTS, ACHIEVEMENTS } from '../data/quests.js';

const KEY = 'law-park-v2';

const fresh = () => ({
  v: 2,
  introSeen: false, // S1–S2 首次進場已播過
  tutorialDone: false,
  done: {}, // questId → ISO 時間
  visitDays: [],
  prefs: { list: false, reduceMotion: false, night: false },
  certShown: false,
});

/** 進度只存在本機（藍圖 §4.5：無帳號、無後端） */
export class Progress {
  constructor() {
    this.state = fresh();
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s?.v === 2) this.state = { ...fresh(), ...s, prefs: { ...fresh().prefs, ...s.prefs } };
      }
    } catch {
      /* 隱私模式或資料毀損：用全新進度 */
    }
    this.listeners = new Set();
    this.markVisit();
  }

  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.state));
    } catch {
      /* ignore */
    }
    this.listeners.forEach((fn) => fn(this.state));
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  markVisit() {
    const day = new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD（本地時區）
    if (!this.state.visitDays.includes(day)) {
      this.state.visitDays = [...this.state.visitDays, day].slice(-30);
      this.save();
    }
  }

  isDone(id) {
    return Boolean(this.state.done[id]);
  }

  /** 完成任務；回傳這次新解鎖的成就 */
  complete(id) {
    if (this.state.done[id]) return [];
    const before = this.achievements();
    this.state.done = { ...this.state.done, [id]: new Date().toISOString() };
    this.save();
    const after = this.achievements();
    return ACHIEVEMENTS.filter((a) => after.has(a.id) && !before.has(a.id));
  }

  achievements() {
    return new Set(ACHIEVEMENTS.filter((a) => a.test(this.state.done, this.state)).map((a) => a.id));
  }

  /** 目前所有已解鎖的裝飾 key */
  unlocks() {
    const keys = new Set(QUESTS.filter((q) => this.state.done[q.id]).map((q) => q.unlock));
    const ach = this.achievements();
    ACHIEVEMENTS.filter((a) => ach.has(a.id)).forEach((a) => keys.add(a.unlock));
    return keys;
  }

  areaCount(area) {
    const qs = QUESTS.filter((q) => q.area === area);
    return { done: qs.filter((q) => this.state.done[q.id]).length, total: qs.length };
  }

  get doneCount() {
    return Object.keys(this.state.done).length;
  }

  setPref(key, value) {
    this.state.prefs = { ...this.state.prefs, [key]: value };
    this.save();
  }

  set(key, value) {
    this.state[key] = value;
    this.save();
  }

  reset() {
    this.state = fresh();
    this.save();
  }
}
