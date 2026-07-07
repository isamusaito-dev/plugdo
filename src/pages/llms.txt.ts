// /llms.txt — AI（LLM）に向けたサイト要約（https://llmstxt.org/ 準拠）。
// 生成AI検索が plugdo を正確に理解・引用できるよう、要点とリンクを提供する。
import type { APIRoute } from 'astro';
import { SITE_URL, SITE_NAME, SITE_TAGLINE, COMPANY } from '../lib/site';
import { getBlogs, getCases } from '../lib/microcms';
import { sampleBlogs, sampleCases } from '../lib/sampleData';

export const GET: APIRoute = async () => {
  const blogsRes = await getBlogs({ limit: 100 });
  const blogs = blogsRes.contents.length ? blogsRes.contents : sampleBlogs;

  const casesRes = await getCases({ limit: 100 });
  const cases = casesRes.contents.length ? casesRes.contents : sampleCases;

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

> ${SITE_TAGLINE} ${COMPANY.legalName}（${COMPANY.alternateName}）が運営する、中小企業・小規模事業者向けのホームページリニューアル＋Web運用サービス。無料のAI診断で現状を採点し、必要ならリニューアル（¥198,000〜）、その後は月¥9,800からの運用で更新が止まらないサイトを維持する。

## plugdoとは

- サービスは2つだけ。「リニューアル（スポット）」と「Web運用（月額）」。
- 入口は無料のAI診断。URLを入れるだけで30秒でサイトを採点し、診断結果からリニューアルか運用かを判断できる。
- 実装の大部分をAIで自動化し、外注も営業部隊も持たない少数運営のため、低価格で提供できる。
- 対象: サイトを作ったまま更新が止まっている、Web担当者がいない中小企業・小規模事業者。
- 提供エリア: 日本全国（オンライン完結）。
- 運営: ${COMPANY.legalName}（${COMPANY.alternateName}、${COMPANY.foundingDate.slice(0, 4)}年設立、代表 ${COMPANY.founder}）。

## サービスと料金（税込）

### ホームページリニューアル（スポット）

- ライト ¥198,000: 5ページ構成 / スマホ対応 / 基本SEO / お問い合わせフォーム / 公開作業。納期目安2〜3週間。
- スタンダード ¥398,000: 10ページ構成 / オリジナルデザイン / CMS導入（自社更新可） / 構造化データ・AI検索対応 / 公開作業。納期目安4〜6週間。
- オプション: ページ追加 ¥15,000/ページ。大規模システム開発・ECサイト構築・広告運用は対象外。
- 小規模事業者持続化補助金の対象になる場合、実質負担は約1/3（申請可否は公募要領による）。
- リニューアル契約者は運用ライトが3ヶ月無料。

### Web運用（月額）

- 運用ライト ¥9,800/月: サーバー・ドメイン・SSL管理、セキュリティ更新、テキスト・画像修正（月2回まで）、障害時一次対応。
- 運用スタンダード ¥19,800/月: 上記に加え、修正回数無制限（1回30分目安）、月次アクセスレポート、改善提案（月1件）、お知らせ・ブログ入稿代行。
- 最低契約期間なし、いつでも解約可。解約時はサイト一式を引き渡し。
- 修正依頼は原則48時間以内に反映。

## よくある質問

Q: まず何から始めればいいですか？
A: 無料のAI診断から。URLを入れるだけで30秒でサイトを採点し、リニューアルが必要か運用で伸ばせるかが分かります。

Q: 対応エリアはどこですか？
A: 日本全国に対応。Slackやメールでのやり取りとオンラインMTGで完結するオンライン完結型のため、所在地を問わず利用可能。

Q: なぜ安いのですか？
A: 実装の大部分をAIで自動化し、外注も営業部隊も持たない少数運営のため。手を抜くのではなく、作り方が新しいことで浮いたコストを価格に反映している。

Q: 今の制作会社との契約はどうなりますか？
A: サーバー・ドメインの契約状況を確認した上で、移管や引き継ぎの段取りをplugdoが整理する。

Q: 補助金は使えますか？
A: リニューアルが小規模事業者持続化補助金の対象となる場合、実質負担を約1/3に抑えられる可能性がある。申請可否は公募要領による。

Q: 解約したらサイトはどうなりますか？
A: 運用に最低契約期間はなく、いつでも解約可能。解約時はサイト一式（データ・アカウント情報）を引き渡すため、他社への引き継ぎも自由。

## 主要ページ

- [トップページ](${SITE_URL}/): サービス全体の概要。
- [無料AI診断](${SITE_URL}/check): URLを入れるだけ、30秒でサイトを採点。
- [リニューアル](${SITE_URL}/renewal): 料金・含まれるもの・制作の流れ・補助金の案内。
- [Web運用](${SITE_URL}/care): 毎月やること比較表・運用の型・解約条件。
- [サービス](${SITE_URL}/service): 提供内容・改善の流れ・対応範囲。
- [導入事例](${SITE_URL}/cases): 課題・施策・成果つきの実績。
- [ブログ](${SITE_URL}/blog): Web運用・改善、AIO対応の解説記事。
- [運営会社](${SITE_URL}/about): 株式会社ハンチスの会社情報。
- [お問い合わせ](${SITE_URL}/contact): 無料相談の申し込み。

## AI検索（AIO）対応について

plugdoはAI検索（ChatGPT・Perplexity・Google AI Overviews等）で会社情報が正しく引用されることを重視しています。具体的には、意味のあるHTML構造、構造化データ（JSON-LD）の整備、FAQ・Q&Aの整備、静的HTML出力、AIクローラーの明示的許可などを行います。リニューアル スタンダードプランには構造化データ・AI検索対応が含まれます。

## ブログ記事

${blogLines}

## 導入事例

${caseLines}

## 連絡先

- メール: ${COMPANY.email}
- 無料AI診断: ${SITE_URL}/check
- 無料相談: ${SITE_URL}/contact
- 対応エリア: 日本全国（オンライン完結）
- お問い合わせへの返信: 通常2営業日以内
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
};
