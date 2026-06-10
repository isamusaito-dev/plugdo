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

> ${SITE_TAGLINE} ${COMPANY.legalName}（${COMPANY.alternateName}）が運営する、中小企業・小規模事業者向けのホームページ運用・改善サービス。作ったきりで止まったサイトを、毎月の更新・改善とAI検索（AIO）対応で、問い合わせと採用につなげます。

## plugdoとは

- Web担当者を雇わなくても、社外のパートナーが「社内のWeb担当」のように毎月サイトを改善します。
- 提供価値: 継続的なコンテンツ更新・改善提案と実装、AI検索（AIO）対応、アクセス計測レポート。
- 対象: Web担当者がいない、サイトを作ったまま更新が止まっている中小企業・小規模事業者。
- 提供エリア: 日本（オンライン対応）。
- 運営: ${COMPANY.legalName}（${COMPANY.alternateName}、${COMPANY.foundingDate.slice(0, 4)}年設立、代表 ${COMPANY.founder}）。

## 主要ページ

- [トップページ](${SITE_URL}/): サービス全体の概要。
- [サービス](${SITE_URL}/service): 改善の流れ（診断→提案→実装→計測）とAI活用の便益。
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
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
};
