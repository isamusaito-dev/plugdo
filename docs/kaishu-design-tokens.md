# デザイントークン一覧（新規コンポーネントはこの値のみ使用可）

出典: `tailwind.config.mjs` + `src/styles/global.css`

## 色パレット（Tailwind クラス名で使用）

| トークン | 値 | 用途 |
|---|---|---|
| `navy` | `#103366` | メイン。見出し・ヘッダー帯・バッジ |
| `pink` | `#E43172` | CTA・アクセント主 |
| `pinkAlt` | `#F00A5F` | ピンク明（ホバー） |
| `slate` | `#3A4048` | ダークスレート（フッター背景・補助見出し） |
| `gold` | `#C8A951` | 実績バッジ・注意色 |
| `ink` | `#333333` | 本文 |
| `gray` | `#797979` | サブテキスト |
| `paper` | `#FFFFFF` | 背景 |
| `mist` | `#EBEEF2` | セクション背景（薄青グレー）・罫線 |
| `sky` | `#EAF3FB` | ヒーロー背景上端 |

透過バリエーションの既存使用例: `navy/[0.02]` `navy/10` `pink/5` `pink/20` `pink/30` `mist/60` `gray/10` `white/15` `white/60` `white/80`。
補助色（インラインhex、check結果のみ）: 緑 `#1F9D6B`、ティント `#FCE9F0` `#F7F1DE` `#E4F3EC`。

## フォント

| トークン | スタック | 用途 |
|---|---|---|
| `font-sans` | Noto Sans JP, system-ui | 本文（デフォルト） |
| `font-display` | Inter, Noto Sans JP | 数字・英字見出し |
| `font-grotesk` | Inter, Noto Sans JP | セクションラベル |

読み込み: Google Fonts（Noto Sans JP 400/700/900、Inter 400〜900）を BaseLayout で preconnect + stylesheet。

## タイポグラフィスケール（実使用値）

- 本文: `16px` / `line-height: 1.8`（body デフォルト）
- 見出し共通: `letter-spacing: 0.01em` / `line-height: 1.4`（h1〜h4）
- `.section-title`: `text-[1.75rem] md:text-[2.5rem] font-black leading-tight`
- Hero H1: `text-[2.75rem] md:text-[3.5rem] font-black leading-[1.15] tracking-tight`
- ページH1（下層）: `text-3xl md:text-4xl font-black`
- サブ見出し: `text-lg` / `text-xl` `font-bold` / `font-black`
- 小さめ本文: `text-sm leading-relaxed`、注記: `text-xs text-gray`
- ラベル: `text-[10px] font-bold uppercase tracking-widest`（または `tracking-[0.15em]`〜`[0.2em]`）
- 価格数字: `font-display text-[2rem] leading-none text-navy`（PriceTable）

## 余白スケール（実使用値）

- セクション縦: `py-16 md:py-20`（標準）、`py-20 md:py-28`（Hero）、`py-10 md:py-12`（小）
- カード内: `p-4` `p-5` `p-6` `p-7`（+`pb-5` 等の調整）
- グリッド間隔: `gap-3` `gap-6` `gap-10` `gap-12 lg:gap-16`
- 見出し→本文: `mt-4`〜`mt-6`、本文→CTA: `mt-6`〜`mt-8`

## 角丸

`rounded-md`(6px) / `rounded-lg`(8px) / `rounded-xl`(12px, カード標準) / `rounded-2xl`(16px) / `rounded-3xl`(24px, Hero画像) / `rounded-full`(ボタン・バッジ)。**これ以外の角丸値は導入しない。**

## ボーダー・罫線

- hairline: `border border-mist`（標準）、`border-gray/10`（カード）、`border-white/15`（ダーク背景上）
- 強調: `border-2 border-navy/60`（btn-outline）、`border-pink`（主力カード）
- 区切り: `border-t border-mist`

## シャドウ（既存値のみ）

- カード標準: `shadow-[0_2px_16px_rgba(16,51,102,0.06)]`、ホバー `shadow-[0_8px_32px_rgba(16,51,102,0.12)]`
- btn-pink: `shadow-[0_4px_24px_rgba(228,49,114,0.35)]`
- btn-navy: `shadow-[0_4px_16px_rgba(16,51,102,0.25)]`
- Hero画像: `shadow-[0_8px_48px_rgba(16,51,102,0.14)]`

## レイアウト

- `.container-pd` = `mx-auto w-full max-w-content px-5 md:px-8`（max-w 1150px）
- `.hero-gradient` = `linear-gradient(180deg, #EAF3FB 0%, #FFFFFF 100%)`（下層ページヘッダー標準）

## アニメーション（既存の1種のみ・追加禁止）

- `data-animate` + IntersectionObserver（BaseLayout 内 script）: フェードアップ 0.7s、`data-animate="fade-in"` でフェードのみ
- 注意: 既存実装に prefers-reduced-motion 分岐は Hero canvas のみ。新規追加分は D-2 に従い 0.3s 以下 + reduced-motion 対応とする

## 代表コンポーネントのクラス構成サンプル

### ボタン（global.css @layer components）
```html
<a href="/check" class="btn-pink">無料で自社サイトを診断する（30秒）</a>
<a href="#price" class="btn-outline text-sm">料金の内訳を見る</a>
<a href="/contact" class="btn-navy w-full text-sm">相談する</a>
<!-- .btn 基本形: inline-flex items-center justify-center gap-2 rounded-full px-8 py-3.5 text-sm font-bold tracking-wide transition-all duration-200 -->
```

### カード
```html
<div class="card relative flex flex-col overflow-hidden">
  <!-- .card = rounded-xl border border-gray/10 bg-paper shadow-[0_2px_16px_rgba(16,51,102,0.06)]
       hover:shadow-[0_8px_32px_rgba(16,51,102,0.12)] hover:-translate-y-0.5 -->
  <div class="p-7 pb-5">…</div>
</div>
```

### セクション見出し
```html
<div class="text-center" data-animate="fade-in">
  <p class="section-label">- Renewal -</p>
  <h2 class="section-title">見出しテキスト</h2>
  <p class="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-gray">リード文</p>
</div>
```

## 新規追加が必要なユーティリティ（許可済み・最小限）

- 価格数字: `[font-variant-numeric:tabular-nums]`（arbitrary property。D-3 の指定により価格・スコア表示に適用）
