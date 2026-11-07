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
- 請由倉庫擁有者於 **main 合併後** 再啟用 Pages；本專 PR 不變更 Pages 設定。
- 公開網址預期為：`https://<user>.github.io/law-world-web/`

## 功能摘要

- 等角正交相機、六棟色塊建築（mesh 名稱：`fire`、`building`、`telecom`、`accessibility`、`water`、`electrical`）
- 手機 2×3／桌機環狀布局、確認卡、本站教學與小測驗、列表檢視後備
- 進度存於 `localStorage`（無後端）

設計依據：法規微縮世界設計方案 v1.0（2026-11-07）。
