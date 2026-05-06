# HabatanPay Nearby Map MVP Agent Brief

## 目的

はばタンPay＋の利用可能店舗を、iPhoneのWebブラウザ上で地図表示し、現在地周辺から探しやすくするミニWebアプリを作成する。

公式サイトの店舗検索は、15,000件超の店舗情報がある一方で、現在地周辺の店舗を直感的に探しにくい。  
そこで、対象地域・対象業種を限定し、まずは実用最小限のMVPを構築する。

---

## MVPの対象範囲

### 対象地域

兵庫県神戸市のうち、以下の2区に限定する。

- 神戸市中央区
- 神戸市兵庫区

### 対象業種

はばタンPay＋利用可能店舗のうち、日常的に使いやすい以下に限定する。

- カフェ
- レストラン
- 食堂
- 居酒屋
- ファストフード
- ベーカリー
- スイーツ・菓子
- スーパー
- 食品販売店
- その他、実質的に飲食・食品購入に該当する店舗

対象外とする例：

- 衣料品店
- 書店
- 家電量販店
- 美容室
- クリーニング
- 医療・薬局
- 宿泊施設
- サービス業全般
- 業種判定が曖昧で飲食・食品購入と判断しにくい店舗

---

## 作りたいWebアプリの概要

iPhoneのSafariで利用できるWebアプリとする。  
App Storeに出すネイティブアプリではなく、Webページとして公開する。

### 主な機能

1. 現在地を取得する
2. 現在地周辺の対象店舗を地図上にピン表示する
3. 店舗一覧を現在地から近い順に表示する
4. 店舗名・カテゴリ・住所・距離を表示する
5. 店舗をタップすると詳細を表示する
6. 「Googleマップで開く」ボタンを表示する
7. カテゴリで絞り込みできる
8. 店名検索ができる

---

## 技術方針

### フロントエンド

以下の構成を第一候補とする。

- HTML
- CSS
- JavaScript
- Leaflet.js
- OpenStreetMap

Google Maps JavaScript APIは初期段階では使わない。  
理由は、APIキー管理や課金・制限を避け、軽量に実装するため。

ただし、店舗詳細からGoogleマップを開くリンクは設置する。

例：

```text
https://www.google.com/maps/search/?api=1&query=<lat>,<lng>
```

または、住所ベースで開く。

```text
https://www.google.com/maps/search/?api=1&query=<URLエンコードした住所または店舗名>
```

---

## データ方針

### 店舗データ形式

まずは静的JSONファイルとして管理する。

例：

```json
[
  {
    "id": "kobe_chuo_0001",
    "name": "店舗名",
    "category": "カフェ",
    "address": "兵庫県神戸市中央区...",
    "ward": "中央区",
    "lat": 34.000000,
    "lng": 135.000000,
    "official_source": "はばタンPay＋公式店舗検索",
    "last_checked": "2026-05-05"
  }
]
```

### 必須項目

- id
- name
- category
- address
- ward
- lat
- lng
- official_source
- last_checked

### 任意項目

- phone
- business_hours
- note
- official_store_url
- google_maps_url
- source_memo

---

## データ取得に関する重要な注意

このプロジェクトでは、はばタンPay＋公式サイトの店舗情報を参照する可能性がある。  
ただし、以下を必ず確認すること。

### 必ず守ること

- 公式サイトの利用規約を確認する
- 過度なアクセスを行わない
- 大量スクレイピングを前提にしない
- 公開アプリにする場合、店舗データの再配布可否に注意する
- 非公式アプリであることを明示する
- 店舗情報の正確性は公式サイトで確認する旨を表示する

### MVP段階の推奨

最初から15,000件全件を扱わない。  
神戸市中央区・兵庫区の対象業種だけに絞る。

データ取得方法は、以下の順で検討する。

1. 公式サイトにCSV・API・一覧ダウンロードが存在するか確認する
2. 公式検索画面で中央区・兵庫区・対象業種に絞り込めるか確認する
3. 結果を手動で整理できる件数か確認する
4. 必要に応じて、少量のデータを手作業でJSON化する
5. 自動取得が必要な場合は、規約・アクセス負荷・再利用可否を確認してから実施する

---

## 画面構成案

### 1. ヘッダー

- アプリ名：はばタンPay 周辺店舗マップ
- 対象地域：神戸市中央区・兵庫区
- 対象業種：飲食店・スーパー等

### 2. 操作エリア

- 現在地を取得ボタン
- 半径選択
  - 500m
  - 1km
  - 2km
  - 5km
- カテゴリ絞り込み
- 店名検索

### 3. 地図エリア

Leafletで地図を表示する。

- 現在地を青いマーカーで表示
- 対象店舗をピンで表示
- ピンをタップすると店舗名・カテゴリ・住所を表示

### 4. 店舗一覧エリア

現在地から近い順に表示する。

表示項目：

- 店舗名
- カテゴリ
- 住所
- 距離
- Googleマップで開くボタン
- 公式情報確認メモ

---

## 距離計算

現在地と店舗座標の距離は、Haversine formulaを使って算出する。

JavaScript実装例：

```javascript
function getDistanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (deg) => deg * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
    Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
```

---

## ディレクトリ構成案

```text
habatanpay-nearby-map/
  README.md
  index.html
  css/
    style.css
  js/
    app.js
  data/
    stores_kobe_chuo_hyogo.json
  docs/
    data_policy.md
    source_notes.md
```

---

## 実装ステップ

### Step 1: プロジェクト雛形作成

- index.html
- css/style.css
- js/app.js
- data/stores_kobe_chuo_hyogo.json

を作成する。

### Step 2: サンプル店舗データで地図表示

最初は架空ではなく、確認済みの少数店舗データを使う。  
ただし、未確認情報を本番データとして扱わないこと。

### Step 3: 現在地取得

ブラウザのGeolocation APIを使う。

```javascript
navigator.geolocation.getCurrentPosition(successCallback, errorCallback);
```

注意：

- HTTPS環境が必要
- iPhone Safariでは位置情報許可が必要
- GitHub Pages / Cloudflare Pages / Netlify ならHTTPSで利用可能

### Step 4: 店舗ピン表示

Leafletで地図に店舗マーカーを表示する。

### Step 5: 距離順一覧表示

現在地取得後、各店舗との距離を計算して近い順に並べる。

### Step 6: 絞り込み機能

以下を実装する。

- 半径フィルタ
- カテゴリフィルタ
- 店名検索

### Step 7: iPhoneで動作確認

確認項目：

- Safariで開ける
- 現在地許可が出る
- 地図が表示される
- ピンが表示される
- 店舗一覧が距離順になる
- Googleマップリンクが開く
- 画面幅がiPhoneで崩れない

---

## 非公式表示・免責表示

画面下部またはREADMEに以下の趣旨を表示する。

```text
このWebアプリは非公式の補助ツールです。
店舗情報は変更される可能性があります。
利用前に、はばタンPay＋公式サイトまたは店頭で最新情報を確認してください。
```

---

## 成果物

最低限、以下を作成する。

- iPhone Safariで表示できるWebアプリ
- 中央区・兵庫区の飲食店・スーパー等のJSONデータ
- README.md
- データ出典・更新方針を記載したdocs/source_notes.md
- 非公式であることを明示した表示

---

## 重要な判断基準

このMVPでは、網羅性よりも実用性を優先する。

優先順位：

1. iPhoneで現在地周辺を見られること
2. 中央区・兵庫区に絞ること
3. 飲食店・スーパー等に絞ること
4. データの出典と確認日を明記すること
5. 店舗情報の正確性を公式確認に委ねること
6. 将来、対象地域・業種を拡張しやすい構造にすること

---

## エージェントへの最初の指示

以下の順で作業すること。

1. 公式サイトで、神戸市中央区・兵庫区の対象店舗を確認する方法を調査する
2. データ利用上の注意点を整理する
3. 最小構成のWebアプリを作成する
4. まずは少数の確認済み店舗データで動作確認する
5. その後、店舗データを拡充する
6. コードとデータを分離し、JSON差し替えで更新できる構造にする

最初から全件取得・完全自動化を目指さない。  
まずは小さく、iPhoneで実際に使えるものを作る。
