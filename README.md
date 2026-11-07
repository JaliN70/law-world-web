# 法規園區（law-world-web）

互動式等角微縮世界總入口：Three.js + Vite 靜態站，部署於 GitHub Pages 時使用 base 路徑 `/law-world-web/`。

## 開發

```bash
npm install
npm run dev
```

本機預覽預設為 `http://localhost:5173/law-world-web/`（依 Vite `base` 設定）。

## 建置

```bash
npm run build
```

產出目錄為 `dist/`，可再以 `npm run preview` 驗證。

## GitHub Pages

- `vite.config.js` 已設定 `base: '/law-world-web/'`。
- **Settings → Pages → Build and deployment → Source：** 選 **GitHub Actions**（勿使用 main 分支根目錄，否則會載入 `/src/main.js` 原始碼）。
- `main` 推送會觸發 `.github/workflows/deploy-pages.yml`（`npm ci` → `npm run build` → 發佈 `dist/`）。
- 公開網址：`https://jalin70.github.io/law-world-web/`

## 模型資產（CD v1.0）

- Draco 壓縮 GLB 位於 `public/models/`（`fire` … `electrical`），色盤 `palette.png`
- Draco 解碼器自架於 `public/draco/`（GitHub Pages 可載入）
- 執行時以 GLB 解碼外框對照 `model-stats.json`（±5%）；通過則在 placement parent 上 **1:1** 替換 MVP 色塊，不做非等比縮放
- MVP 色塊外框量測報告：`public/models/envelope-report.json`、`scripts/measure-mvp-bbox.mjs`

## 功能摘要

- 等角正交相機、六棟建築（主 mesh 名稱：`fire`、`building`、`telecom`、`accessibility`、`water`、`electrical`）
- 手機 2×3／桌機環狀布局、確認卡、本站教學與小測驗、列表檢視後備
- 進度存於 `localStorage`（無後端）

設計依據：法規微縮世界設計方案 v1.0（2026-11-07）。
