# 法規園區（law-world-web）v2

互動式等角低多邊形微縮世界，是六個法規站的總入口。依《法規微縮世界設計方案 v1.0（2026-11-07）》從零重做：模型、程式、內容全部重寫。

- 一座浮島、中央六角廣場（#1F4E79 基座＋Logo 紅小六角），六棟建築以道路相連
- 桌機橫式：六角環狀；手機直式：2×3。兩種布局共用同一份場景，只切換座標（`src/world/layout.js`）
- 點建築 → 鏡頭推近 → 確認卡片 → 本站教學／任務；需要全文再進入法規站或全國法規資料庫
- 18 則任務＋4 項跨區成就，只解鎖裝飾，從不鎖住內容；進度只存在本機
- 3D 不可用、載入逾 8 秒或使用者偏好時，可切換列表檢視

## 開發

```bash
npm install
npm run dev        # http://localhost:5173/law-world-web/
npm run build      # 產出 dist/
npm run models     # 重新產生 public/models/park.glb
```

網址加 `?debug` 會在 `window.__park` 暴露 world／director／progress，方便量測。

## 3D 模型

`scripts/models/` 以程式建模（three.js 幾何拼裝），輸出單一 `public/models/park.glb`：

- 六棟建築（`fire`、`building`、`telecom`、`accessibility`、`water`、`electrical`）：底面 8×8 m、原點在底面中心、入口 +Z；可動或可點亮的零件為具名節點，解鎖才出現的放 `unlock_*`
- 道具：`plaza`、`tree_round`、`tree_cone`、`bush`、`lamp`、`flag`、`access_sign`
- glTF 2.0、Y 軸向上、公尺、不含相機燈光；全場共用一張 4×4 色盤（藍圖 §2.1 的 16 色）
- 量化＋`EXT_meshopt_compression`；每次產生都跑 Khronos glTF Validator，有錯即中止
- 浮島、道路、樹與路燈位置依布局在網站端即時產生（`src/world/terrain.js`）

## 內容

`src/data/areas.js`、`src/data/quests.js`。法規名稱、條號、標題、修正日取自六個法規站的站內資料（2026-11-12 檢視）；導讀為自撰白話摘要，每張最多一句原文摘錄，底部固定出處列，並提醒「以全國法規資料庫最新公布為準」。

## 部署

推到 `main` 會由 `.github/workflows/deploy-pages.yml` 建置並發佈到 GitHub Pages（Settings → Pages → Source 選 GitHub Actions）。
