# 法規微縮世界｜低多邊形模型 v1.0

- 負責人：CD · 創意總監（素材設計與製作）
- 案名：法規網站互動式微縮世界 MVP
- 截止日：2026-11-18；本次素材完成日：2026-11-07（UTC+8）
- 供 CTO 後續替換 MVP 色塊；本次沒有製作網站、部署或修改既有六個法規站。
- 依據：`法規微縮世界_設計方案_20261107_v1.0.html` 第 1–2 節，以及指定的 01、02、03、06 關鍵畫面。

## 交付內容

六份 glTF 2.0 binary（`.glb`）、一份共用 1024×1024 園區色盤、六張 1000×1000 等角預覽、`previews/six-lineup.png`（六棟橫向並列）、`previews/contact-sheet.png`（2×3 檢視表）、統計與驗證 JSON、可重建的程序建模原始碼。

## 面數、檔案大小、包圍盒

所有數值含基座、植栽、建築辨識物；面數是**三角形數**，不是多邊形面數。大小含 Draco 幾何與內嵌色盤，KiB = 1024 bytes。尺寸欄使用「寬 X × 深 Z × 高 Y」公尺。

| 檔案 | 主 mesh／節點名 | 三角面 | bytes | KiB | min XYZ（m） | max XYZ（m，四捨五入） | 寬×深×高（m） |
|---|---|---:|---:|---:|---|---|---|
| `fire.glb` | `fire` | 1,828 | 11,616 | 11.34 | `(-4, 0, -4)` | `(4, 9.55, 4)` | `8 × 8 × 9.55` |
| `building.glb` | `building` | 2,004 | 12,308 | 12.02 | `(-4, 0, -4)` | `(4, 6.18, 4)` | `8 × 8 × 6.18` |
| `telecom.glb` | `telecom` | 3,168 | 16,036 | 15.66 | `(-4, 0, -4)` | `(4, 10.45, 4)` | `8 × 8 × 10.45` |
| `accessibility.glb` | `accessibility` | 2,132 | 12,012 | 11.73 | `(-4, 0, -4)` | `(4, 4.97, 4)` | `8 × 8 × 4.97` |
| `water.glb` | `water` | 3,176 | 16,088 | 15.71 | `(-4, 0, -4)` | `(4, 8.37, 4)` | `8 × 8 × 8.37` |
| `electrical.glb` | `electrical` | 4,812 | 17,624 | 17.21 | `(-4, 0, -4)` | `(4, 4.55, 4)` | `8 × 8 × 4.55` |

原始建模座標列在 `model-stats.json`；**最終壓縮檔解碼後的精確 min/max XYZ 與 sizeXYZ** 列在 `validation-decoded.json`。Draco POSITION 量化為 16 bits，外框差異約 0.00005 m 等級。

消防為 1,828 三角面，略低於約 2,000 的參考值；其餘皆在 2,000–5,000 內，沒有一棟超過 5,000。

## 座標、原點、命名

- 右手座標，**+Y 向上、+Z 為正面、+X 為右側**；1 單位 = 1 公尺。
- 每棟原點 `(0,0,0)` 為 **8×8 m 基座底部中心**。基座位於 Y=0–0.25 m，所有幾何都在 X/Z -4 至 +4 m 內。
- 節點沒有隱藏的旋轉、縮放或平移；**不用再旋轉 -90°**。
- 每檔只有一個主 mesh／一個 primitive／一個材質；全部辨識物已合併。mesh 與節點皆精確使用 `fire / building / telecom / accessibility / water / electrical`。
- GLB 裡**沒有相機、燈光、動畫**。預覽的鏡頭與照明僅存在於離線渲染場景。
- 本次是靜態替換素材，沒有另附解鎖狀態、脈動動畫或眨眼動畫。任務狀態與可動裝飾需由 CTO 的場景層另作，不應改名主 mesh。

## 造型與畫面對應

| mesh | 對應設計方案的辨識元素 |
|---|---|
| fire | 陶土磚紅主體、小 L 形後翼、雙車庫、監看塔、四坡塔頂；前場小消火栓是唯一純紅建築細節 |
| building | 混凝土灰方盒、格柵立面、入口雨庇、前場圓規雕塑 |
| telecom | 藍色矮機房、漸細格構塔、兩個藍色信號環；塔上不放紅色訊號點 |
| accessibility | 鼠尾草綠寬扁建築、寬雙門、連續長斜坡與扶手、黃色導盲條 |
| water | 水青綠矮泵房、四柱高架水塔、外露管線、前側藍色水渠 |
| electrical | 三個圓角倒角紫色變壓器、絕緣子、低矮通透圍籬、很小的親和表情；無陰沉工業風 |

已逐張目視檢查最終 GLB 解碼後的等角預覽：六棟輪廓及主色對應方案，沒有明顯破面、倒面或截斷。這是清爽低多邊形資產，不追求示意生圖裡的寫實貼圖／碎石裝飾，也不是像素模型。

### 關於「直接替換、外框誤差 ±5%」的重要交接

**設計方案提供約 8×8 m 的尺寸範圍與示意圖，沒有附 CTO 實際 MVP 幾何的數值包圍盒或檔案。** 本批以共用 8×8 m 地塊及上表高度作明確交付 envelope，造型剪影已依方案對齊；但不能僅憑示意圖宣稱已與尚未提供的 MVP 實檔完成數值 ±5% 驗收。

請 CTO 在替換前以實際 MVP 尺寸對照本表；相符即可使用原 placement 直接換，無須更動標籤。如果 MVP 外框不同，先回填實際 envelope，再調整程序模型量體或 placement parent，不要默默用非等比縮放壓扁塔架。這是剩餘的**接線驗收事項**，不是六份 GLB 的格式／破面問題。

## 色盤與材質

`palette.png`：1024×1024，4×4 格，每格 256px。以下按圖檔由上至下、由左至右排列：

```
#1F4E79  #FF0000  #B5533C  #9CA3AF
#3B6FB6  #7FA77F  #3E8E8A  #8B6FC9
#D1D5DB  #86B86B  #5E9E4F  #C9A27A
#F5F1E8  #4B5563  #F2C94C  #5DADE2
```

所有面 UV 均指向對應格子的中心，沒有個別寫實貼圖。glTF UV 原點是圖像左上；不要在 Three.js 再手動翻轉。金屬度 0、粗糙度 0.88，主材質 `park_palette`。純紅格子只被消防消火栓的面使用，其餘五棟沒有使用。GLB 未加入 Logo。

六個 GLB 內嵌**完全相同位元內容**的此張 atlas，讓每檔可獨立載入而不依賴相對路徑。CTO 可在載入後共用同一張 Texture／Material，避免六份 GPU 紋理；如保留內嵌版本，壓縮 PNG 每份僅 4,658 bytes。共用圖集不是六張不同的貼圖。

## Draco 與 CTO 替換步驟（說明，不是網站實作）

1. GLB 使用 `KHR_draco_mesh_compression`（required）；GLTFLoader 須搭配 DRACOLoader，且 decoder 路徑可由部署站存取。
2. POSITION 16-bit、NORMAL 10-bit、UV 14-bit 量化，Draco compression level 9。因為幾何簡潔、色盤 PNG 很小，每棟僅約 11–18 KiB，**低於 150–300 KB 參考預算，沒有為湊大小而填充檔案**。
3. 保留 MVP 的世界 placement／方位 parent；此模型局部座標與 node transform 保持原樣。對照上表含基座的 bbox，通過 ±5% 比對後再移除對應色塊。
4. 在 GLB 場景中用精確名稱取得主 mesh；若將 material 複製／替換，不要丟失共用 atlas。
5. 命中測試仍使用主 mesh 名；標籤、確認卡片、任務及教學維持網站自己的配置。因基座也合併在 mesh 內，點地塊亦會命中該建築。
6. 照明、相機、微環繞與陰影由 CTO 的場景負責；不要從預覽圖推回 GLB 內有相機或燈光。

## 驗證紀錄

- 使用 Python 重新讀每份 GLB binary，解出 `KHR_draco_mesh_compression`，確認：三角面上限、有限座標、無退化三角形、面積非零、原點與底面、mesh 名稱、無相機燈光、無節點變換、POSITION/NORMAL/UV accessor 數量正確。
- UV 審核確認純紅只在消火栓所處空間使用。
- 以 **glTF-Transform + Google draco3dgltf** 另一套讀檔器獨立解碼：六份均成功；實際 min/max、頂點與面數寫在 `validation-decoded.json`。
- 以 **Khronos glTF Validator** 檢查：六份皆 **0 errors / 0 warnings**，報告為 `validation-khronos.json`。此驗證器不檢查 Draco payload，會列出 unsupported-extension 與 compressed bufferView unused 的兩項 info；Draco 幾何由上述兩套 decoder 與離線渲染另行驗證，不能將 info 說成已驗證壓縮內部。
- 預覽使用 **最終壓縮 GLB 解碼幾何 + 內嵌 atlas** 渲染，不是另外生成的示意圖。離線 pyrender 採 OpenGL 下左原點，所以僅在預覽 renderer 轉換 UV，GLB 保持 glTF 標準上左原點。
- GLB 三角面包含交疊組合實體，不是供列印的單一封閉流形；適合即時渲染／點選，不宣稱可直接 3D 列印。

## 重建來源

`source/create_models.py` 是程序建模與 GLB 打包／預覽完整來源；`source/validate.cjs` 是獨立 JS 驗證來源。原始工作環境位於 `/workspace/law-miniverse/build/model-venv` 與 `build/glb-validation`，不包入巨大 venv／node_modules。腳本中的 ROOT 路徑可改為自己的素材工作目錄。

Python：`source/requirements.txt`。本環境為 Python 3.13；pyrender 0.1.45 原始固定依賴 PyOpenGL 3.1.0，與新 Python 不相容，建模環境使用 3.1.10 並已完成渲染；NumPy 2 的 `np.infty` 相容別名也只在工具腳本內處理，不影響資產。

重建渲染環境時先安裝 requirements，再以 `pip install --no-deps pyrender==0.1.45` 安裝 renderer，另補 `scipy networkx freetype-py imageio pyglet`，避免舊版 pyrender 對 PyOpenGL 3.1.0 的硬鎖；或沿用上述已可用的 venv。

JS：安裝 `@gltf-transform/core @gltf-transform/extensions draco3dgltf gltf-validator` 後執行驗證腳本。
