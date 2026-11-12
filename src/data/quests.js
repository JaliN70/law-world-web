/**
 * 18 則任務＋4 項跨區成就（藍圖 §4.4、§4.5）。
 * 任務只解鎖裝飾，從不鎖住導讀卡、進入法規站或查看原文（藍圖原則 1）。
 *
 * 題型：
 *   choice   單選（options，answer 為正解索引）
 *   match    配對（items 各自選一個 categories）
 *   order    排序（items 依正確順序列出，畫面上打散）
 *   scene    在 3D 場景中點選目標（targets：建築上的熱點）
 *   read     讀完比較卡（捲到底）
 */

export const QUESTS = [
  /* 消防 */
  {
    id: 'F1', area: 'fire', title: '設置義務入門', type: 'choice',
    prompt: '下列哪一條規定「滅火器」的設置義務？',
    options: ['第 14 條', '第 15 條', '第 19 條', '第 31 條'], answer: 0,
    hint: '第 15 條是室內消防栓；第 31 條是滅火器的「配置與標識」，屬設置規定。',
    unlock: 'fire_hydrant', reward: '消火栓亮燈',
  },
  {
    id: 'F2', area: 'fire', title: '排煙設備', type: 'choice',
    prompt: '「防煙區劃」規定在哪一條？',
    options: ['第 28 條', '第 188 條', '第 189 條', '第 190 條'], answer: 1,
    hint: '第 28 條是排煙設備的設置義務；第 189 條是特別安全梯排煙；第 190 條是免設情形。',
    unlock: 'fire_smoke', reward: '監看塔排煙動畫',
  },
  {
    id: 'F3', area: 'fire', title: '119 火災通報', type: 'match',
    prompt: '把每個條號放到正確的分類。',
    categories: ['設置義務', '設置規定'],
    items: [
      { text: '第 22-1 條 119 通報裝置', answer: 0 },
      { text: '第 145-1 條 119 火災通報裝置', answer: 1 },
      { text: '第 14 條 滅火器', answer: 0 },
      { text: '第 31 條 滅火器配置與標識', answer: 1 },
    ],
    hint: '「哪些場所要設」是設置義務；「要怎麼設」是設置規定。',
    unlock: 'fire_truck', reward: '消防車出庫',
  },
  /* 建築技術 */
  {
    id: 'B1', area: 'building', title: '樓梯、欄杆、坡道', type: 'choice',
    prompt: '第二章第七節（第 33～39 條）涵蓋哪三類構件？',
    options: ['樓梯、電梯、坡道', '樓梯、欄杆、坡道', '欄杆、陽臺、屋頂', '樓梯、走廊、出入口'], answer: 1,
    hint: '看節名：「樓梯、欄杆、坡道」。',
    unlock: 'building_compass', reward: '圓規雕塑轉動',
  },
  {
    id: 'B2', area: 'building', title: '建蔽率與容積率', type: 'match',
    prompt: '把名詞放到它所在的節或章。',
    categories: ['第二章第四節（第 25–29 條）', '第九章 容積設計（第 160–166-1 條）', '第二章第七節（第 33–39 條）'],
    items: [
      { text: '建蔽率', answer: 0 },
      { text: '容積率', answer: 1 },
      { text: '樓梯、欄杆、坡道', answer: 2 },
    ],
    hint: '第二章第五節的容積率條文已刪除，容積相關規定在第九章。',
    unlock: 'building_grille', reward: '立面格柵點燈',
  },
  {
    id: 'B3', area: 'building', title: '防火避難跨域', type: 'read',
    prompt: '把比較卡讀到最後，看看同一主題在兩部法規各怎麼規定。',
    suggestAfter: 'F2',
    unlock: 'bridge_fire_building', reward: '消防站與建築技術館之間出現連通步道',
  },
  /* 電信 */
  {
    id: 'T1', area: 'telecom', title: '設置義務與責任分界', type: 'choice',
    prompt: '建築物建造時，依第 4 條由誰設置屋內外電信設備？',
    options: ['市內網路業務經營者', '起造人', '主管建築機關', '承租的住戶'], answer: 1,
    hint: '建造階段的設置義務落在起造人身上。',
    unlock: 'telecom_rings', reward: '天線信號環啟動',
  },
  {
    id: 'T2', area: 'telecom', title: '洽辦審查審驗', type: 'order',
    prompt: '依條號順序排列三個步驟。',
    items: ['設計時向市內網路業務經營者洽辦', '設置完成後檢具文件申請審驗', '審驗合格後接續辦理電信服務'],
    hint: '先洽辦（第 11 條）→ 再審驗（第 12 條）→ 合格之後（第 13 條）。',
    unlock: 'telecom_windows', reward: '機房窗燈點亮',
  },
  {
    id: 'T3', area: 'telecom', title: '認識附圖', type: 'choice',
    prompt: '打開附圖一。圖中的「責任分界點」標在哪裡？',
    options: ['公眾電信網路的人孔', '建築物端子板的介接端子', '用戶自備的電信終端設備', '電信室的出入口'], answer: 1,
    hint: '看圖中央：業者設置於建築物端子板的介接端子，與用戶側端子板之間。',
    unlock: 'telecom_dish', reward: '屋頂衛星碟',
  },
  /* 無障礙 */
  {
    id: 'A1', area: 'accessibility', title: '無障礙通路', type: 'scene',
    prompt: '在場景中點出民眾中心的三項通路設施：坡道、入口門廊、導盲磚。',
    targets: [
      { id: 'ramp', label: '坡道', local: [-2.7, 0.45, 2.65], r: 1.4 },
      { id: 'porch', label: '入口門廊', local: [0, 0.8, 2.4], r: 1.3 },
      { id: 'tactile', label: '導盲磚', local: [-1.7, 0.2, 3.75], r: 1.2 },
    ],
    hint: '坡道在入口左側；導盲磚是地面的黃色條。',
    unlock: 'access_tactile', reward: '導盲磚發光',
  },
  {
    id: 'A2', area: 'accessibility', title: '廁所盥洗室', type: 'choice',
    prompt: '「廁所盥洗室」是規範的第幾章？',
    options: ['第二章', '第四章', '第五章', '第六章'], answer: 2,
    hint: '第四章是昇降設備，第六章是浴室。',
    unlock: 'access_door', reward: '寬門自動開啟',
  },
  {
    id: 'A3', area: 'accessibility', title: '無障礙標誌', type: 'scene',
    prompt: '在場景中找到民眾中心入口旁的高對比導視牌，點一下。',
    targets: [{ id: 'sign', label: '導視牌', local: [2.3, 1.7, 3.0], r: 1.3 }],
    hint: '藍底白圖，在入口右側。',
    unlock: 'access_sign', reward: '廣場無障礙標誌牌',
  },
  /* 給排水 */
  {
    id: 'W1', area: 'water', title: '系統分開（自來水）', type: 'choice',
    prompt: '哪一種配管符合「自來水與非自來水系統應完全分開」？',
    options: [
      '自來水管與地下水管在水塔前用三通接在一起',
      '雨水回收管接上自來水管，中間加裝逆止閥',
      '自來水與雨水回收各有獨立的管路與水塔，互不連通',
    ],
    answer: 2,
    hint: '「完全分開」代表兩個系統之間沒有任何連接。',
    unlock: 'water_tank', reward: '水塔滿水動畫',
  },
  {
    id: 'W2', area: 'water', title: '雨污分流（下水道）', type: 'match',
    prompt: '把每一種排水放進正確的管渠。',
    categories: ['污水管渠', '雨水管渠'],
    items: [
      { text: '馬桶排水', answer: 0 },
      { text: '廚房洗碗排水', answer: 0 },
      { text: '屋頂落水頭的雨水', answer: 1 },
      { text: '基地地面的雨水', answer: 1 },
    ],
    hint: '生活污水進污水管渠；雨水進雨水管渠，兩者不得混接。',
    unlock: 'water_flow', reward: '水渠流水',
  },
  {
    id: 'W3', area: 'water', title: '排水通氣', type: 'choice',
    prompt: '建築物給水排水設備設計技術規範是依據哪一部法規訂定？',
    options: ['自來水法', '下水道法', '建築技術規則建築設備編', '電業法'], answer: 2,
    hint: '看規範 1.1「依據」。',
    unlock: 'water_bubbles', reward: '管線冒泡泡',
  },
  /* 電氣 */
  {
    id: 'E1', area: 'electrical', title: '通則第一步', type: 'choice',
    prompt: '條文沒有指明電壓時，本規則適用於？',
    options: ['所有電壓的工程', '六百伏特以下之低壓工程', '一百一十伏特以下之工程', '高壓用電設備'], answer: 1,
    hint: '第 4 條。',
    unlock: 'electrical_face', reward: '變壓器眨眼表情',
  },
  {
    id: 'E2', area: 'electrical', title: '導線識別', type: 'choice',
    prompt: '哪一種顏色的導線不得作為非接地導線使用？',
    options: ['紅色', '黑色', '白色'], swatches: ['#C0392B', '#1F2937', '#F8FAFC'], answer: 2,
    hint: '第 32 條：白色或淺灰色。',
    unlock: 'electrical_insulators', reward: '絕緣子亮燈',
  },
  {
    id: 'E3', area: 'electrical', title: '新能源設施', type: 'match',
    prompt: '把設施配對到它的條號範圍。',
    categories: ['第 847–861 條', '第 862–892 條', '第 893–902 條'],
    items: [
      { text: '電動車充電系統', answer: 0 },
      { text: '太陽光電系統', answer: 1 },
      { text: '儲能系統', answer: 2 },
    ],
    hint: '順序是：電動車充電 → 太陽光電 → 儲能。',
    unlock: 'ev_charger', reward: '變電所旁出現充電樁',
  },
];

export const QUEST_BY_ID = Object.fromEntries(QUESTS.map((q) => [q.id, q]));

/** 每區第一則任務：法規通與三域巡禮的判定依據 */
export const INTRO_QUESTS = ['F1', 'B1', 'T1', 'A1', 'W1', 'E1'];

export const ACHIEVEMENTS = [
  {
    id: 'tour3', title: '三域巡禮', rule: '完成任 3 區的第一則任務',
    test: (done) => INTRO_QUESTS.filter((q) => done[q]).length >= 3,
    unlock: 'park_lamps', reward: '園區路燈',
  },
  {
    id: 'firePair', title: '防火雙視角', rule: '完成 F2 與 B3',
    test: (done) => Boolean(done.F2 && done.B3),
    unlock: 'plaza_flags', reward: '廣場旗幟',
  },
  {
    id: 'nightShift', title: '夜間值班', rule: '累積 4 天回訪',
    test: (_done, state) => state.visitDays.length >= 4,
    unlock: 'night_mode', reward: '夜景模式',
  },
  {
    id: 'lawPass', title: '法規通', rule: '六區第一則任務全部完成',
    test: (done) => INTRO_QUESTS.every((q) => done[q]),
    unlock: 'law_pass', reward: '廣場 Logo 標識亮起＋證書卡',
  },
];
