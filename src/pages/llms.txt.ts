// /llms.txt — AI（LLM）に向けたサイト要約（https://llmstxt.org/ 準拠）。
// 生成AI検索が plugdo を正確に理解・引用できるよう、要点とリンクを提供する。
import type { APIRoute } from 'astro';
import { SITE_URL, SITE_NAME, SITE_TAGLINE, COMPANY } from '../lib/site';
import { plans } from '../lib/plans';
import { getBlogs, getCases } from '../lib/microcms';
import { sampleBlogs, sampleCases } from '../lib/sampleData';

export const GET: APIRoute = async () => {
  const blogsRes = await getBlogs({ limit: 100 });
  const blogs = blogsRes.contents.length ? blogsRes.contents : sampleBlogs;

  const casesRes = await getCases({ limit: 100 });
  const cases = casesRes.contents.length ? casesRes.contents : sampleCases;

  const planLines = plans
    .map(
      (p) =>
        `- **${p.name}**（${p.price}${p.priceNote}）: ${p.tagline}。コミット：${p.commit}（${p.commitNote}）`
    )
    .join('\n');

  const blogLines = blogs
    .map(
      (b) => `- [${b.title}](${SITE_URL}/blog/${b.slug}): ${b.description}`
    )
    .join('\n');

  const caseLines = cases
    .map(
      (c) =>
        `- [${c.title}](${SITE_URL}/cases/${c.slug}): ${c.clientName}${
          c.industry ? `（${c.industry}）` : ''
        }の課題・施策・成果。`
    )
    .join('\n');

  const body = `# ${SITE_NAME}

> ${SITE_TAGLINE} ${COMPANY.legalName}（${COMPANY.alternateName}）が運営する、中小企業・小規模事業者向けのホームページ運用・改善サービス。社内にWeb担当がいない企業向けに、放置されたホームページを毎月改善し、問い合わせにつなげます。

## plugdoとは

- 社内にWeb担当者がいなくても使える「社外のWeb担当」サービス。
- 毎月「診断→提案→実装→計測」の4ステップでホームページを継続改善する。
- ホームページを集客の起点（ハブ）として整え、LINE・SNS・広告からの流入を成果につなげる。
- 対象: Web担当者がいない、サイトを作ったまま更新が止まっている中小企業・小規模事業者。
- 提供エリア: 日本全国（オンライン対応）。
- 運営: ${COMPANY.legalName}（${COMPANY.alternateName}、${COMPANY.foundingDate.slice(0, 4)}年設立、代表 ${COMPANY.founder}）。

## 提供内容（6項目）

1. サイト更新・修正 — テキスト変更、画像差し替え、情報更新、軽微な修正
2. 導線改善 — 問い合わせ・予約・採用応募につながるCTAやページ構成の見直し
3. コンテンツ改善 — サービス紹介、実績、FAQ、ブログなど伝わる情報への整備
4. デザイン改善 — 見づらい箇所や古く見える箇所の部分的な改善
5. SEO・AIO対応 — 検索やAI検索に読まれやすい構造・文章・FAQの整備
6. 月次レポート — アクセス数・問い合わせ状況の確認と次の改善提案

## 対応範囲

対応すること: ホームページの更新、テキスト修正、画像差し替え、CTA改善、問い合わせ導線改善、採用ページ改善、ブログ/FAQ追加、SEO基本対応、AIO基本対応、月次レポート、改善提案、Slack相談。
必要に応じて対応: LINE公式への導線設計、SNSからサイトへの導線設計、広告LPの改善相談、フォーム改善、GA4/Search Consoleの確認。
基本対応しないこと: SNSの毎日投稿代行、広告運用代行、LINE配信代行、大規模システム開発、完全新規サイト制作。

## よくある質問

Q: 社内にWeb担当がいなくても使えますか？
A: はい、むしろそういった企業のためのサービスです。サイトを拝見して課題を洗い出し、毎月何を直すかこちらから提案します。

Q: 毎月どんな流れで進みますか？
A: 「診断→提案→実装→計測」の4ステップを毎月まわします。アクセス状況や問い合わせ数を確認しながら優先度の高い箇所から改善します。

Q: 成果が出るまでどのくらいかかりますか？
A: CTAや導線改善は1〜2ヶ月、SEO・AIO対応は3〜6ヶ月程度が目安です。

Q: 料金はいくらですか？
A: Keepプラン¥30,000/月〜、Growプラン¥80,000/月〜、Partnerプラン¥150,000/月〜（税別）。初期費用なし、最低利用期間3ヶ月。

Q: 対応エリアはどこですか？
A: 日本全国に対応。Slackでのやり取りとオンラインMTGで完結するオンライン完結型のため、所在地を問わず利用可能。

Q: 申し込みから改善開始までどのくらいかかりますか？
A: 申し込みから5営業日以内に診断レポートを提出し、翌月から改善を開始。

## 主要ページ

- [トップページ](${SITE_URL}/): サービス全体の概要。
- [サービス](${SITE_URL}/service): 提供内容・改善の流れ・対応範囲・料金サマリー。
- [料金プラン](${SITE_URL}/price): 3プランの比較とよくある質問。
- [導入事例](${SITE_URL}/cases): 課題・施策・成果（数値）つきの実績。
- [ブログ](${SITE_URL}/blog): Web運用・改善、AIO対応の解説記事。
- [運営会社](${SITE_URL}/about): 株式会社ハンチスの会社情報。
- [お問い合わせ・無料診断](${SITE_URL}/contact): 無料サイト診断の申し込み。

## 料金プラン

${planLines}

※ 表示は税別の最低月額。サイト規模・対応範囲により変動。正確な金額は無料診断時に提示。最低利用期間は3ヶ月。

## AI検索（AIO）対応について

plugdoはAI検索（ChatGPT・Perplexity・Google AI Overviews等）で会社情報が正しく引用されることを重視しています。具体的には、意味のあるHTML構造、構造化データ（JSON-LD）の整備、FAQ・Q&Aの整備、静的HTML出力、AIクローラーの明示的許可などを行います。

## ブログ記事

${blogLines}

## 導入事例

${caseLines}

## 連絡先

- メール: ${COMPANY.email}
- 無料サイト診断: ${SITE_URL}/contact
- 対応エリア: 日本全国（オンライン完結）
- お問い合わせへの返信: 通常2営業日以内
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
};
