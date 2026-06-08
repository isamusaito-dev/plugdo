# plugdo.jp

「ホームページを、働かせる。」— 作ったきりのサイトを問い合わせと採用につなげる伴走型サービスのコーポレートサイト。

Astro 5（SSG）+ Tailwind CSS + microCMS + Formspree。SEO/AIO 流入の獲得を最優先に、全ページを静的HTMLとして出力する。

## セットアップ

```bash
npm install
cp .env.example .env   # 値を埋める
npm run dev            # http://localhost:4321
```

microCMS / Formspree / GA4 のキーが未設定でも、ダミーデータでビルド・プレビューできる（`src/lib/sampleData.ts`）。

## コマンド

| コマンド | 内容 |
|---|---|
| `npm run dev` | 開発サーバー |
| `npm run build` | `dist/` に静的ビルド |
| `npm run preview` | ビルド結果のローカルプレビュー |
| `npx astro check` | 型・診断チェック |

## 環境変数（`.env` / Cloudflare Pages 両方に設定）

| 変数 | 用途 |
|---|---|
| `MICROCMS_SERVICE_DOMAIN` | microCMS サービスドメイン |
| `MICROCMS_API_KEY` | microCMS APIキー |
| `PUBLIC_FORMSPREE_ENDPOINT` | お問い合わせ送信先 |
| `PUBLIC_GA_ID` | GA4 測定ID（未設定ならGAタグを出力しない） |
| `PUBLIC_SITE_URL` | canonical / OGP / sitemap の基準URL |

## microCMS スキーマ

- `blog`（リスト）: title / slug / eyecatch / category(参照) / body / description / publishedAt
- `blog-category`（リスト）: name / slug
- `case`（リスト）: title / slug / clientName / industry / thumbnail / challenge / solution / result / voice / publishedAt

詳細は `src/lib/microcms.ts` の型定義を参照。CMS が空のあいだはサンプルデータが表示される。

## ページ構成

`/` `/service` `/price` `/cases` `/cases/[slug]` `/blog` `/blog/[slug]` `/about` `/contact` + `/404`

## デプロイ（Cloudflare Pages）

- ビルドコマンド: `npm run build`
- 出力ディレクトリ: `dist`
- 環境変数を Pages 側にも設定
- 旧URLのリダイレクトは `public/_redirects` に追記

## SEO / AIO

- 全ページ: 固有 title/description、OGP、Twitter Card、canonical、`<html lang="ja">`
- 構造化データ: Organization（全ページ）、Service、Article、BreadcrumbList、FAQPage
- `@astrojs/sitemap` で `sitemap-index.xml` を自動生成
- `public/robots.txt` で主要AIクローラー（GPTBot / ClaudeBot / PerplexityBot / Google-Extended ほか）を明示許可
- 重要情報はビルド時に静的HTML出力（JS無効でも本文が読める）
