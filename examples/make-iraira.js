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
add('PNP', 160, 60, 270, 'Q1', '2SA1015', { pkg: 'TO-92', pinout: 'ECB' }); // B=(160,80) C=(140,40) E=(180,40)
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
w([180, 120], P(5, 3), P(4, 2));                // R1 → Q1 ベース
w([140, 40], P(4, 1));                          // Q1 コレクタのパッド
w([180, 40], [180, 20]);                        // Q1 エミッタ → 斜めの線へ
w(P(4, 0), P(7, 0));                            // エミッタ → K1 NO1
w(P(4, 0), P(3, 1), [120, 180]);                // エミッタ → SW1 A1
w(P(4, 0), P(8, 4), P(10, 4));                  // エミッタ → K1 COM2
w(P(8, 4), P(8, 8));                            // → C1 +
w(P(4, 1), P(7, 4), P(7, 7));                   // コレクタ → K1 COM1 / コイル
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

d.nextId = Math.max(d.nextId, 1000);
const out = path.join(__dirname, 'iraira-stick.json');
fs.writeFileSync(out, CD.serialize(d));
console.log('wrote', out, d.components.length, 'components', d.wires.length, 'wires');
