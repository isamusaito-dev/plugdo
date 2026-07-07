# Phase 0: リポジトリ調査結果（サイト全体改修）

調査日: 2026-07-07

## 1. ページ一覧とルーティング

Astro 5 SSG（`trailingSlash: 'always'`）。`src/pages/` 配下:

| ルート | ファイル | 備考 |
|---|---|---|
| `/` | `index.astro` (747行) | TOP |
| `/about` | `about.astro` | 運営会社 |
| `/blog`, `/blog/[slug]` | `blog/index.astro`, `blog/[slug].astro` | microCMS |
| `/blog/rss.xml` | `blog/rss.xml.ts` | |
| `/cases`, `/cases/[slug]` | `cases/index.astro`, `cases/[slug].astro` | noindex・sitemap除外済み |
| `/check` | `check.astro` (482行) | 無料AI診断UI |
| `/contact` | `contact.astro` | Formspree送信 |
| `/price` | `price.astro` | 旧料金（Keep/Grow/Partner） |
| `/service` | `service.astro` | |
| `/service/aio-geo` | `service/aio-geo.astro` | |
| `/service/web-staff-outsourcing` | `service/web-staff-outsourcing.astro` | 「社外Web担当」LP |
| `/llms.txt` | `llms.txt.ts` | AI向けサマリ |
| 404 | `404.astro` | |

API: `functions/api/check.ts`（Cloudflare Pages Function、600行、採点ロジック）

## 2. 料金関連（Keep/Grow/Partner の出現箇所）

- **データソース**: `src/lib/plans.ts` — `plans`（3プラン、target/monthlyItems 含む）と `compareRows`（比較表）
- **表示コンポーネント**: `src/components/PriceTable.astro` — `variant="summary"`（TOP用）/ `variant="full"`（price用、比較表つき）
- **使用箇所**:
  - `index.astro` 料金プランセクション（`<PriceTable variant="summary" />`）+ FAQ内の料金回答 + serviceLd offers
  - `price.astro` 全体（セルフ診断ブロック含む）
  - `src/lib/site.ts` `organizationLd.hasOfferCatalog`（Keep/Grow/Partner Offer）+ `priceRange: '¥30,000〜¥150,000/月'`
  - `llms.txt.ts` planLines・料金FAQ
  - `check.astro` には料金記載なし

## 3. TimeCompressSection.astro / FlowBackground.astro

**どちらも存在しない。**

- 流線背景は `Hero.astro` 内にインライン実装（`#flow-bg` canvas + `is:inline` script）。独立コンポーネントではない
- 「PDCA 30日→7日」のセクションはリポジトリ内に存在しない（grep で该当なし）
- → 指示書の「TimeCompressSection.astro を /care に移設」は **新規作成扱い + TODO** とする

## 4. /check の仕組み

- **UI**: `check.astro` — 画面①入力 → 画面②診断中アニメ → 画面③結果（同一ページ内で hidden 切替）
- **採点API**: `POST /api/check`（`functions/api/check.ts`）→ `{ url, total, bandMessage, axes[7], findings, remainingCount }` を返す
- **出口CTA（改修対象）**: 画面③の `#gate-headline` + `#cta-primary`（→ `/contact/?url=&score=`）。スコアは `renderResult(data)` 内で `data.total` として参照可能
- **メール**: 自動送信テンプレートは存在しない。副CTA「結果をメールで受け取る」は Formspree にリード送信 → 担当者が手動返信する運用。→ Phase 4 の「結果メール末尾にアンケート枠」は手動テンプレ運用のため **サイト外・TODO扱い**

## 5. 「社外Web担当」出現ファイル（grep 結果）

- `src/components/Hero.astro`（バッジ・説明文）
- `src/pages/index.astro`（title/description/JSON-LD/本文複数）
- `src/pages/price.astro`（title/リード文）
- `src/pages/service.astro`（JSON-LD/本文）
- `src/pages/service/web-staff-outsourcing.astro`（ページ全体がこのテーマ）
- `src/pages/llms.txt.ts`（サマリ本文）

## 6. SEO・メタ・構造化データの管理方法

- 各ページ → `BaseLayout` props（title/description/ogImage/jsonLd/noindex）→ `Seo.astro` が出力
- 全ページ共通 JSON-LD: `src/lib/site.ts` の `organizationLd`（ProfessionalService）・`websiteLd`・`personLd`
- ページ固有 JSON-LD: 各ページの frontmatter で定義し `jsonLd` prop で渡す（FAQPage・BreadcrumbList・Service 等）
- OGP デフォルト: `/ogp-default.png`、check 専用: `/og-check.png`
- sitemap: `@astrojs/sitemap`（cases/ 除外フィルタあり）

## 7. リダイレクト設定方法

**`public/_redirects`**（Cloudflare Pages 標準）。現在はコメントのみ。ここに `/price/ /renewal/ 301` 形式で追記する。

## 8. デザイントークン

`docs/kaishu-design-tokens.md` に出力（別ファイル）。
