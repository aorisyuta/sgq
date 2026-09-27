// 手書きの蛇の目配線図 (イライラ棒: STICK / COURSE) を UniBoard SPICE の回路図 JSON にする
//   node examples/make-iraira.js  →  examples/iraira-stick.json
// 座標: 配線図の穴 (列 c, 行 r) → (40c, 40r)。線は図のとおり (斜めも含む) に引く
const g = require('../tests/load.js');
const CD = g.CADDoc, fs = require('fs'), path = require('path');
const d = CD.newDoc();
const P = (c, r) => [c * 40, r * 40];
const add = (t, x, y, rot, ref, val, props) => CD.addComponent(d, t, x, y, rot || 0, { ref, val, props });
const w = (...pts) => { for (let i = 0; i + 1 < pts.length; i++) CD.addWire(d, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]); };

/* ---- 外部配線用の端子 (左端) ---- */
add('J1', 10, 120, 180, 'J1', 'STICK');
add('J1', 10, 200, 180, 'J2', 'VCC');
add('J1', 10, 280, 180, 'J3', 'GND');
add('J1', 10, 360, 180, 'J4', 'COURSE');
add('VCC', 80, 200, 0, null, null, { net: 'VCC' });
add('GND', 360, 360);

/* ---- 部品 ---- */
add('PNP', 200, 40, 180, 'Q1', '2SA1015', { pkg: 'TO-92', pinout: 'ECB' }); // E=(180,20) 上 / C=(180,60) 下 / B=(220,40) 右
add('R', 160, 120, 0, 'R1', '1k', { span: 3 });
add('SW_DPDT', 180, 200, 0, 'SW1', 'スライド DPDT', { state: 'a' });          // 左列 A1(120,180) COM1(120,200) B1(120,220)
add('R', 180, 280, 0, 'R2', '75', { span: 3 });
add('LED', 200, 340, 90, 'D1', '青', { span: 1 });
add('RLY2', 340, 150, 0, 'K1', 'G5V-2', {});                                  // 左 x=280 / 右 x=400
add('CP', 320, 340, 90, 'C1', '100u', { span: 1, dia: 1.8 });
add('R', 440, 140, 90, 'R3', '75', { span: 3 });
add('LED', 440, 340, 90, 'D2', '赤', { span: 1 });
add('BUZ', 520, 240, 90, 'BZ1', '5V', { span: 2 });

/* ---- 配線 (図の線そのまま) ---- */
w(P(1, 3), [140, 120]);                         // STICK → R1
w([180, 120], [220, 120], [220, 40]);           // R1 → Q1 ベース
w([180, 20], [180, 0]);                         // Q1 エミッタ → 上の線
w(P(4, 0), P(7, 0));                            // エミッタ → K1 NO1
w(P(4, 0), P(3, 1), [120, 180]);                // エミッタ → SW1 A1
w(P(7, 0), [320, 40], P(8, 4), P(10, 4));       // エミッタ → K1 COM2 (トランジスタの右を通す)
w(P(8, 4), P(8, 8));                            // → C1 +
w([180, 60], P(7, 4), P(7, 7));                 // コレクタ → K1 COM1 / コイル
w(P(7, 0), [280, 120]);                         // NO1 パッド → ピン
w(P(1, 5), [120, 200]);                         // VCC → SW1 COM1
w([120, 220], P(3, 7), [160, 280]);             // SW1 B1 → R2
w([200, 280], P(6, 7), P(5, 8));                // R2 → 青 LED
w(P(1, 7), P(1, 9));                            // GND ─ COURSE
w(P(1, 8), P(4, 8), P(5, 9));                   // GND → 下の共通線
w(P(5, 9), P(11, 9));                           // 共通線 (C1 − / K1 コイル / 赤 LED / ブザー)
w([400, 180], P(10, 9));                        // K1 コイル (右) → GND
w(P(10, 0), [400, 120]);                        // NO2 パッド → ピン
w(P(10, 0), P(11, 1), [440, 120]);              // NO2 → R3
w(P(11, 1), P(13, 3), [520, 220]);              // NO2 → ブザー +
w([440, 160], P(11, 8));                        // R3 → 赤 LED
w([520, 260], P(13, 7), P(11, 9));              // ブザー − → GND

/* ---- 蛇の目基板: 配線図の穴位置と配線そのまま (列 A.., 行 1..) ---- */
const H = (c, r) => { let s = '', n = c + 1; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = ((n - m) / 26) | 0; } return s + (r + 1); };
const pins = o => Object.fromEntries(Object.entries(o).map(([k, [c, r]]) => [k, H(c, r)]));
const solder = (...pts) => ({ layer: 'solder', pts: pts.map(([c, r]) => H(c, r)) });
d.perfboard = {
  cols: 15, rows: 10,
  parts: {
    J1: pins({ 1: [1, 3] }), J2: pins({ 1: [1, 5] }), J3: pins({ 1: [1, 7] }), J4: pins({ 1: [1, 9] }),
    Q1: pins({ E: [4, 0], C: [4, 1], B: [4, 2] }),
    R1: pins({ 1: [2, 3], 2: [5, 3] }),
    SW1: pins({ A1: [3, 4], COM1: [3, 5], B1: [3, 6], A2: [5, 4], COM2: [5, 5], B2: [5, 6] }),
    R2: pins({ 1: [3, 7], 2: [6, 7] }),
    D1: pins({ A: [5, 8], K: [5, 9] }),
    K1: pins({ NO1: [7, 0], NC1: [7, 2], COM1: [7, 4], C1: [7, 7], NO2: [10, 0], NC2: [10, 2], COM2: [10, 4], C2: [10, 7] }),
    C1: pins({ 1: [8, 8], 2: [8, 9] }),
    R3: pins({ 1: [11, 2], 2: [11, 5] }),
    D2: pins({ A: [11, 8], K: [11, 9] }),
    BZ1: pins({ '+': [13, 5], '-': [13, 7] })
  },
  wires: [
    solder([1, 3], [2, 3]), solder([5, 3], [4, 2]), solder([4, 0], [7, 0]), solder([4, 0], [3, 1], [3, 4]),
    solder([4, 0], [8, 4], [10, 4]), solder([8, 4], [8, 8]), solder([4, 1], [7, 4], [7, 7]), solder([1, 5], [3, 5]),
    solder([3, 6], [3, 7]), solder([6, 7], [5, 8]), solder([1, 7], [1, 9]), solder([1, 8], [4, 8], [5, 9]),
    solder([5, 9], [11, 9]), solder([10, 7], [10, 9]), solder([10, 0], [11, 1], [11, 2]), solder([11, 1], [13, 3], [13, 5]),
    solder([11, 5], [11, 8]), solder([13, 7], [11, 9])
  ]
};

d.nextId = Math.max(d.nextId, 1000);
const out = path.join(__dirname, 'iraira-stick.json');
fs.writeFileSync(out, CD.serialize(d));
console.log('wrote', out, d.components.length, 'components', d.wires.length, 'wires');
