# 法規微縮世界｜六島新模型 v1.0

- 負責人：CD · 創意總監；實作接入：CTO。
- 案名：法規園區／六島重規劃（新模型）。
- 截止日：2026-11-11；完成日：2026-11-07（UTC+8）。
- 依已確認六島設計 v1.2 製作，**本次僅新增兩件離線模型**。未修改 GitHub、線上站、PR、既有 GLB、既有色盤或舊方案。

## 交付與最終統計

以下 bbox 為最終 Draco GLB 以 DracoPy 與 Google draco3dgltf 分別解碼後所得；XYZ、公尺，顯示至小數 6 位。精確數值見 `six-island-validation-google.json`，兩套 decoder 的 bbox 差異為 0。

| 檔案 | 三角面 | bytes | bbox min XYZ → max XYZ |
|---|---:|---:|---|
| `deco_island_12m.glb` | 3,000 | 18,904 | `(-11.993889, -5.700000, -12.173583) → (12.224319, 0.012005, 13.800000)` |
| `deco_logo_platform.glb` | 400 | 8,952 | `(-4.000000, 0.000000, -3.464102) → (4.000000, 0.243046, 3.464105)` |

### 節點明細

| 根節點 | 子節點／mesh | 三角面 | 說明 |
|---|---|---:|---|
| deco_island_12m | island_grass | 456 | 完整草地頂面，Y=0，中央不挖洞 |
| deco_island_12m | island_cliff | 2,016 | 土層、分層岩壁與封底 |
| deco_island_12m | island_dock | 528 | +Z 石質碼頭，寬 3 m |
| deco_logo_platform | logo_platform | 52 | 六角石臺、側面、倒角與石邊 |
| deco_logo_platform | logo_inlay | 348 | 藍底、六片淺色扇葉、正紅小六角；全為同平面圖形 |

所有節點均不含 matrix／translation／rotation／scale，沒有隱藏變換；根節點純分組。無相機、燈光、動畫、蒙皮或 morph。

## 1. 單島模板 deco_island_12m

- 右手座標：+Y 上、+Z 前、+X 右，1 單位＝1 m。原點是島面中心，草地頂面 **Y=0**；不是 bbox 中心，碼頭會向 +Z 拉長 bbox，請不要載入後重新置中。
- 草地名義半徑約 12 m（主輪廓約 11.9 m 並作柔和微擾），包含完整草地、窄土褐收邊與一圈岸緣。外岸緣名義約 12 m，最大半徑限制在 12.29 m 附近；不是舊半徑 32 m 島緣的縮小副本。
- 草地為完整連通頂面，沒有洞；幾何驗證確認原點與中央 8×8 m 建築區域全部被可行走頂面覆蓋。頂面面積及 holeCount 記錄於 contract JSON。
- 分層岸緣：土褐 #C9A27A、岩灰 #9CA3AF、少量深色 #4B5563 裂層；向下至約 Y=−5.7 m，底部也已封住。
- 碼頭在 **本地 +Z**，X=−1.5 至 +1.5 m，Z=10.8 至 13.8 m。碼頭石材以 #D1D5DB／#F5F1E8 為主；有低矮支撐，不是聯外道路。
- 碼頭頂面有 0.012 m（1.2 cm）收口高度，避免與 Y=0 草地發生共面閃爍；這是烘焙的幾何尺寸，不是節點 transform。草地 Y=0 不變。
- **不含石徑、建築、大石裙、樹叢或水面。** CTO 用既有 deco_path_stone／deco_path_stone_4m 在 +Z 碼頭與建築間鋪直線石徑；不要把碼頭誤認為已含整條路。
- **舊 deco_island_cliff 不適用、不要拿來縮放。** 舊檔是半徑約 32 m 的開心環；本件才是約 12 m 的完整島面＋岸緣模板。

### 六島擺放公式與朝向

在網站端用外部 parent 擺放（不回寫模型）：

```js
parent.position.set(x, 0, z);
parent.rotation.y = Math.atan2(-x, -z);
parent.scale.set(1, 1, 1);
```

Three.js 的 +Z 經上述 Y 旋轉後指向世界原點；碼頭即朝群島內側。**同一模板複製六次**，不要分別再烘焙六個地形檔。

順時針由總覽正上方起：

| 島 | X (m) | Z (m) | rotationY（度） | rotationY（rad） |
|---|---:|---:|---:|---|
| 消防 | 0 | −34 | 0° | 0 |
| 建築技術 | 29.444864 | −17 | −60° | −π/3 |
| 電信 | 29.444864 | 17 | −120° | −2π/3 |
| 無障礙 | 0 | 34 | 180° | π（−π 等價） |
| 給排水 | −29.444864 | 17 | 120° | 2π/3 |
| 電氣 | −29.444864 | −17 | 60° | π/3 |

六棟既有建築以 8×8 m、1:1 放各島本地原點；若沿用父群組旋轉，既有建築 +Z 入口也朝向世界中心。地景不含建築，因此可獨立核對入口方向。

## 2. 中央平台 deco_logo_platform

- 原點在中央 (0,0,0)。Y=0 為底／靜水面基準；頂面設計 Y=0.243 m，略高於水面。
- 六角頂點半徑 4 m，頂點對頂點直徑 8 m。模型六角形 X 寬 8 m、Z 寬約 6.9282 m；**不要把平邊對平邊 bbox 誤當頂點半徑變小**。
- 臺體／側面／倒角／石邊為 logo_platform，石材 #D1D5DB 與 #F5F1E8，沒有把整座塗藍。
- logo_inlay 是寬 7.1 m 的平面品牌圖形，外頂點半徑 3.55 m，石邊約 0.34–0.45 m。所有頂點的 Y 都相同（解碼後 0.2430000007 m），**厚度為 0，沒有直立 Logo、支柱、底座或向上擠出**。
- 以乾淨幾何重建六角深藍底 #1F4E79、六片淺色花瓣／扇葉 #F5F1E8、中心正紅小六角 #FF0000，並加入簡潔的外框分片線。未把描圖 SVG 的碎 path 擠出。
- 臺面石邊與 logo_inlay 直接作互不重疊的共面分區；圖形下方沒有第二張同平面頂面，因此不靠抬高圖形避免 z-fighting。Draco 16-bit 量化後石邊最高值約 0.243046 m，與設計值的差距小於 0.00005 m，非刻意增加高度。
- 獨立具名節點 logo_inlay 及材質 park_palette_logo_inlay，預設 emissiveFactor=[0,0,0]。法規通完成時，可只對這一材質啟用柔和 emissive（已使用同一色盤作 emissiveTexture）；不帶動臺體、不浮、不旋、不變成立體。
- 平台不是第七座可訪目的地，不含道路、橋或可點進入口。中央至約 12 m 島緣保留約 34−12−4＝18 m 水面；碼頭向內伸出後，其最前端至中央平台約 16.2 m，仍完全不相接。
- 不使用、不修改、不縮放舊 deco_plaza_ring。

## 3. 格式、材質與壓縮

- glTF 2.0 GLB，KHR_draco_mesh_compression 同時列於 extensionsUsed 與 extensionsRequired。
- 沿用既有 palette.png（1024×1024、4×4）。只讀原始 PNG，兩件 GLB 各內嵌同一份完整位元組；沒有重繪色盤。
- UV 在格子中心，NEAREST／CLAMP_TO_EDGE，metallic=0、roughness=0.88。
- Draco：POSITION 16-bit、NORMAL 10-bit、UV 14-bit、level 9。
- 純紅只在 logo_inlay 的中心小六角；單島及其他新幾何無紅色。PNG 色盤中保留原有紅格不等於其他 mesh 使用紅色。
- 程序生成時會預檢量化後面積、清除坍縮的冗餘三角形，最後兩套解碼器皆再檢查無退化面。

## 4. 驗證結果

- Khronos glTF Validator：兩件均 **0 errors／0 warnings**。Draco 擴充未由 Validator 內部解碼等 info 已保留於完整報告，不冒稱它驗證了壓縮幾何。
- 解碼器一：DracoPy 2.2.0；解碼器二：glTF-Transform＋Google draco3dgltf。兩者 bbox 差異 0，三角面一致，UV 格心、內嵌 palette 位元一致，皆無退化面。
- 專案契約驗證：完整連通草地、0 個洞、中央 8×8 m 覆蓋、碼頭 +Z、寬 3 m、logo_inlay 零厚度、具名節點、無隱藏變換／相機／燈光／動畫全部通過。
- `sha256sum --check source/six-island-original-assets.sha256`：126 個既有檔案全部通過。

| 新驗證檔 | 內容 |
|---|---|
| six-island-validation-dracopy.json | 第一套 decoder 的 bbox／tris／各子節點／最小面積 |
| six-island-validation-google.json | 第二套 decoder、與第一套差值、色盤位元、Khronos 摘要 |
| six-island-validation-khronos.json | 完整 Khronos 報告 |
| six-island-validation-contract.json | 島面無洞、零厚度、命名、變換與全部舊檔雜湊 |
| six-island-hash-check.txt | sha256sum 實際核對輸出 |

### 指定不可變資產 SHA-256（全部未變）

| 檔案 | SHA-256 |
|---|---|
| `fire.glb` | `69cfc02200c059b9acda98ca6555c4ebb77eaf9967fe46460dd6eb68dda9cb75` |
| `building.glb` | `ab39d2357fa8b6524fc3a909eee3799581c4704da449868a184e489e978c10a2` |
| `telecom.glb` | `946664043d7d1cd8f24001a3b19f580215cdab794b43899a47b149c5a32b05f9` |
| `accessibility.glb` | `58a29d7622618ca9597c8d8eb31e9dafd0309cc8c368ea16ca4fdbbf5897850a` |
| `water.glb` | `2ad6a9b7499f783cf108d6c671824e0eab3ce89e5ca85c45591f84523f05832a` |
| `electrical.glb` | `c73216c738f5c86a3e4a98be3b1314f7e10bccba6f826fd32d96e849c6181e87` |
| `palette.png` | `b89cc84d2e06027c45ba5822480b35634d49f21b2adac9dacb0a4f0184594cbc` |
| `deco_path_stone.glb` | `6b148c47751d5bec6e49b88ef965ce59e0382352ce92b902bd6b6cddbfb7b0ad` |
| `deco_path_stone_4m.glb` | `7bd1042b060bba0a08a3d60e332b8a5383c60b536968af150a38bd2a3311bcb1` |
| `deco_tree_cluster_a.glb` | `970738e1864408954f82c2a69a01c6c93bb32b48da4ad4089648e084c20b61b8` |
| `deco_tree_cluster_b.glb` | `d895c0f9b3ad35694e1942e8dedabf4f8d45fd58231a64d0f6eba8d03267a168` |
| `deco_tree_cluster_c.glb` | `bc1b845185210f1608a26d0ee9acb6c5a2e1fb6091e8245fe2edd1bc8d80bcab` |

其餘既有 deco_island_cliff、deco_plaza_ring、車道等 GLB，以及舊 PDF／HTML／key-screens 同樣未變；完整清單見 contract JSON 與原始 sha256 基準。

## 5. 預覽（都是最終 Draco GLB 解碼渲染）

- previews/deco_island_12m.png：完整草地、分層岸緣、+Z 小碼頭。
- previews/deco_logo_platform.png：石質臺面、六片扇葉、正紅中心；圖形平貼無凸起。
- previews/six-island-assets-sheet.png：兩件並排。
- previews/six-island-assets-assembly.png：額外原寸對位。消防島中心 (0,0,−34)，中央平台 (0,0,0)；既有 fire.glb 1:1 放島原點，石徑與樹叢均讀既有檔外部擺放，未烘焙進新模型。

這些不是概念生圖；所有幾何都從最終 Draco GLB 解碼。相機、光源、背景與文字僅存在離線渲染器，沒有寫進 GLB。已目視確認島面非空心環、碼頭位於 +Z、中央平台無直立 Logo。

![兩件模型解碼預覽](previews/six-island-assets-sheet.png)

## 6. 離線重建（只輸出這批新檔）

Python 環境 `/workspace/law-miniverse/build/model-venv` 已就緒；套件版本另存 source/six-island-requirements.txt。為無視窗 EGL 渲染使用 pyglet 2 headless，不依賴 GUI 登入。

```bash
/workspace/law-miniverse/build/model-venv/bin/python models/deco/source/create_six_island_assets.py
NODE_PATH=/workspace/law-miniverse/build/glb-validation/node_modules node models/deco/source/validate_six_island_assets.cjs
/workspace/law-miniverse/build/model-venv/bin/python models/deco/source/check_six_island_contract.py
/workspace/law-miniverse/build/model-venv/bin/python models/deco/source/render_six_island_assembly.py
sha256sum --check models/deco/source/six-island-original-assets.sha256
```

工作目錄為 /workspace/law-miniverse。生成器只讀既有 create_deco.py 的 Model／渲染工具，不 import 會重繪色盤的 create_models.py，也不覆寫任何舊模型或舊驗證報告。

## 7. ZIP 與交接邊界

ZIP：法規微縮世界_六島新模型_20261107_v1.0.zip。內含 models/deco 下兩件 GLB、本文、預覽、四份 validation JSON、雜湊紀錄與程序來源；另附原 palette.png 的唯讀位元副本。ZIP 內只有兩個 GLB，不含六棟建築副本。

完成後由主代理交 COO 轉 CTO；本次沒有寄送、SendToAgent、修改 GitHub／線上站／PR，也沒有變更 routine、memory 或 profile。
