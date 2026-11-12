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

## 模型資產

- 原始模型（CD 交付的 Draco GLB、`palette.png`、規格文件）放在 `assets-src/models/`，**不直接部署**。
- 網站只載入一個 `public/models/park.glb`，由下列指令產生並提交進 repo：

  ```bash
  npm run build:models
  ```

  - 每個來源 GLB 成為一個以檔名命名的 scene（`fire`…`electrical`、`deco_island_12m`、`deco_logo_platform`、石徑、樹叢）。
  - 全場共用一張 4×4 色盤（原 1024² 色盤每格純色、UV 全在格心，顏色完全相同）。
  - 純平面著色的 mesh 去掉 NORMAL 後焊接頂點；量化＋`EXT_meshopt_compression`（解碼器隨 three.js 打包，約 20 KB，不需 Draco wasm）。
  - 打包後自動跑 Khronos glTF Validator，有 error 即中止。
- 換模型：把新 GLB 放進 `assets-src/models/`（同檔名），跑 `npm run build:models`，提交 `park.glb`。

## 場景結構（執行時）

- `src/scene/layouts.js`：布局預設組。桌機 `ring`（六角環半徑 34 m）、手機直式 `grid`（2×3，中央 Logo 平台在中段）。
- `src/scene/parkAssets.js`：六島地形＋石徑＋樹叢＋平台石臺合併成一個 mesh，岸壁一個、`logo_inlay` 一個；每棟建築一個 mesh（各自材質，用來做「其他建築降飽和 40%」）。
- 水面波浪在 vertex shader 計算；法規通完成時 `logo_inlay` 以自身色盤顏色柔和發光、岸壁微光。
- 網址加 `?debug` 會在 `window.__lw` 暴露 renderer／scene，方便量 draw calls。

## 功能摘要

- 等角正交相機、六棟建築（主 mesh 名稱：`fire`、`building`、`telecom`、`accessibility`、`water`、`electrical`）
- 手機 2×3／桌機環狀布局、確認卡、本站教學與小測驗、列表檢視後備
- 進度存於 `localStorage`（無後端）

設計依據：法規微縮世界設計方案 v1.0（2026-11-07）。
