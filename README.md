# UniBoard SPICE

ブラウザだけで動く電子工作 CAD です。元の **UniBoard CAD**（回路図 → ユニバーサル基板パターン図）の機能はそのまま残し、見た目を一新して次の機能を追加しました。

`index.html` を開くだけで使えます（1 ファイル・インストール不要）。

## 機能

| 画面 | できること |
|---|---|
| 回路図 | 部品配置・配線（元の機能）＋ 5,655 点の部品ライブラリ検索、プローブ |
| シミュレーション | SPICE 互換エンジン：動作点 / 過渡解析 / AC 解析（ボード線図）/ DC スイープ、FFT、波形の計測（最大・最小・実効値・周波数・−3dB）、回路図上の電圧表示と LED 点灯アニメーション、ネットリストの直接編集（.cir 読み込み） |
| 蛇の目基板 | 元の機能（自動配置・2 層配線・ストリップボード・配線指示） |
| PCB | 回路図から読み込み、自動配置、手動配線（45°・ビア）、2 層自動配線、ベタ GND、DRC、ガーバー一式 ZIP・ドリル・BOM・実装座標 CSV の出力 |
| 計算ツール | オームの法則、LED 抵抗、カラーコード、分圧、555、RC/LC、LM317、オペアンプ、配線幅、コンデンサ表示、E 系列、dB、電池、AWG |

ショートカット: `Ctrl+K` コマンド検索、`F5` シミュレーション実行、`1/2/3` 画面切替、`?` 一覧。

## 開発

```
src/base.html        元の UniBoard CAD（フックを追加）
src/js/spice.js      SPICE エンジン（MNA + ニュートン法 + 台形積分）
src/js/spice-models.js  ロジック IC などの動作モデル
src/js/parts-*.js    追加記号と部品カタログ
src/js/sim-netlist.js  回路図 → ネットリスト
src/js/simui.js      シミュレーション画面
src/js/pcbx.js       PCB 設計・ガーバー出力
src/js/calc.js / shell.js / ui-pre.js  計算ツール・検索・自動保存など
src/css/app.css      新しい見た目
```

`node build.mjs` で `index.html` を生成します。テスト: `node tests/spice.test.js`、`node tests/netlist.test.js`（Playwright の画面テストは `tests/*.mjs`）。
