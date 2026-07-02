// Plugdo 自動Web診断ツールのバックエンド（Cloudflare Pages Function）。v2＝7軸・厳格化。
// 役割：対象サイトのHTMLを取得し、決定的チェック（③④⑤⑥⑦＋①の一部）をコードで判定、
// 軸①②⑥の定性判定と「気づき」文の生成を Claude API に委譲してスコアと結果JSONを返す。
//
// v2の方針（追補仕様書）：
// - 見せる軸を5→7に拡張（⑥信用の証拠・⑦表示の速さを追加）
// - 段階採点（存在チェックをやめ、質・分量まで見る）で平均的SMEサイトを50〜65点に校正
// - Claudeプロンプトを辛口・根拠必須・分布アンカー付きに
// 必要な環境変数：ANTHROPIC_API_KEY。

interface Env {
  ANTHROPIC_API_KEY?: string;
}

type EventContext = {
  request: Request;
  env: Env;
};

// 7軸（追補仕様書 §1）。重み合計 = 100。
const AXES = {
  impression: { label: '第一印象・信頼感', weight: 15 },
  clarity: { label: '伝わりやすさ', weight: 20 },
  contact: { label: '問い合わせのしやすさ', weight: 20 },
  mobile: { label: 'スマホ対応', weight: 12 },
  findability: { label: '見つけてもらえるか', weight: 13 },
  credibility: { label: '信用の証拠', weight: 10 },
  speed: { label: '表示の速さ', weight: 10 },
} as const;

type AxisKey = keyof typeof AXES;

const CLAUDE_MODEL = 'claude-sonnet-4-6';

// ── ユーティリティ ──────────────────────────────────────────

const clamp = (n: number, min = 0, max = 100): number =>
  Math.max(min, Math.min(max, Math.round(n)));

/** スコアを赤/黄/緑に色分け。 */
const colorFor = (score: number): 'red' | 'yellow' | 'green' =>
  score >= 75 ? 'green' : score >= 50 ? 'yellow' : 'red';

/** 点数帯メッセージ（追補仕様書 §4-3。責めず「もったいない＝伸びしろ」で表現）。 */
function bandMessage(total: number): string {
  if (total >= 80) return '土台は優秀。あと数点で“働くサイト”になります。';
  if (total >= 66) return '良い部分と伸びしろが混在。優先順位をつける価値が大きいです。';
  if (total >= 50) return '平均的な状態。直せば問い合わせが増える余地が大きいです。';
  return 'もったいない状態。でも、伸びしろは最大です。';
}

/** 入力URLを正規化（https:// 補完）。失敗時は null。 */
function normalizeUrl(input: string): URL | null {
  let raw = (input || '').trim();
  if (!raw) return null;
  if (!/^https?:\/\//i.test(raw)) raw = 'https://' + raw;
  try {
    const u = new URL(raw);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u;
  } catch {
    return null;
  }
}

const stripTags = (html: string): string =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// ── HTML 抽出 ───────────────────────────────────────────────

interface Extracted {
  title: string;
  metaDescription: string;
  h1s: string[];
  headings: string[];
  bodyExcerpt: string;
  isHttps: boolean;
  hasViewport: boolean;
  hasFavicon: boolean;
  hasMediaQuery: boolean;
  hasJsonLd: boolean;
  hasForm: boolean;
  hasTelLink: boolean;
  hasContactLink: boolean;
  ctaCount: number;
  imgTotal: number;
  imgWithAlt: number;
  // ⑥ 信用の証拠
  hasTestimonial: boolean;
  hasAchievementNumbers: boolean;
  hasCredentials: boolean;
  hasCompanyInfo: boolean;
  hasFreshDate: boolean;
  // ⑦ 表示の速さ
  htmlChars: number;
  hasWebp: boolean;
  hasLazyLoad: boolean;
  renderBlocking: number;
}

const matchText = (html: string, re: RegExp): string => {
  const m = html.match(re);
  return m ? stripTags(m[1] || '').slice(0, 300) : '';
};

const collect = (html: string, re: RegExp, limit = 12): string[] => {
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.length < limit) {
    const t = stripTags(m[1] || '');
    if (t) out.push(t);
  }
  return out;
};

const CTA_WORDS =
  /(問い合わせ|お問合せ|お問い合わせ|相談|見積|資料請求|申し込|申込|予約|contact|inquiry|お申込|無料)/i;

function extract(html: string, isHttps: boolean, htmlChars: number): Extracted {
  const headHtml = (html.match(/<head[\s\S]*?<\/head>/i)?.[0] || html).slice(0, 200000);
  const bodyText = stripTags(html);

  const h1s = collect(html, /<h1[^>]*>([\s\S]*?)<\/h1>/gi, 6);
  const h2s = collect(html, /<h2[^>]*>([\s\S]*?)<\/h2>/gi, 8);
  const h3s = collect(html, /<h3[^>]*>([\s\S]*?)<\/h3>/gi, 8);

  // アンカー走査：問い合わせリンク・tel・CTA数。
  const anchorRe = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let hasTelLink = false;
  let hasContactLink = false;
  let ctaCount = 0;
  let am: RegExpExecArray | null;
  let scanned = 0;
  while ((am = anchorRe.exec(html)) && scanned < 400) {
    scanned++;
    const attrs = am[1] || '';
    const text = stripTags(am[2] || '');
    const href = (attrs.match(/href\s*=\s*["']([^"']*)["']/i)?.[1] || '').toLowerCase();
    if (href.startsWith('tel:')) hasTelLink = true;
    if (/contact|inquiry|toiawase|otoiawase|mail/.test(href) || CTA_WORDS.test(text)) {
      hasContactLink = true;
    }
    if (CTA_WORDS.test(text)) ctaCount++;
  }

  const imgs = html.match(/<img\b[^>]*>/gi) || [];
  let imgWithAlt = 0;
  for (const tag of imgs) {
    const alt = tag.match(/\balt\s*=\s*["']([^"']*)["']/i);
    if (alt && alt[1].trim()) imgWithAlt++;
  }

  // ⑦ 表示の速さ：レンダリング阻害資源（head内の同期script＋stylesheet数）。
  const headStylesheets = (headHtml.match(/<link[^>]+rel\s*=\s*["']stylesheet["']/gi) || []).length;
  const headScripts = headHtml.match(/<script\b[^>]*\bsrc\s*=/gi) || [];
  const headSyncScripts = headScripts.filter((s) => !/\basync\b|\bdefer\b/i.test(s)).length;

  // ⑥ 信用の証拠：本文・見出しから検出。
  const credText = bodyText + ' ' + [...h1s, ...h2s, ...h3s].join(' ');
  const nowYear = new Date().getFullYear();
  const freshRe = new RegExp(`(${nowYear}|${nowYear - 1})\\s*[年./-]|(${nowYear}|${nowYear - 1})[-/.]\\d{1,2}`);

  return {
    title: matchText(headHtml, /<title[^>]*>([\s\S]*?)<\/title>/i),
    metaDescription:
      headHtml.match(
        /<meta[^>]+name\s*=\s*["']description["'][^>]*content\s*=\s*["']([^"']*)["']/i
      )?.[1]?.trim() ||
      headHtml.match(
        /<meta[^>]+content\s*=\s*["']([^"']*)["'][^>]*name\s*=\s*["']description["']/i
      )?.[1]?.trim() ||
      '',
    h1s,
    headings: [...h1s, ...h2s, ...h3s].slice(0, 16),
    bodyExcerpt: bodyText.slice(0, 2500),
    isHttps,
    hasViewport: /<meta[^>]+name\s*=\s*["']viewport["']/i.test(headHtml),
    hasFavicon: /<link[^>]+rel\s*=\s*["'][^"']*icon[^"']*["']/i.test(headHtml),
    hasMediaQuery: /@media\b/i.test(html),
    hasJsonLd: /<script[^>]+type\s*=\s*["']application\/ld\+json["']/i.test(html),
    hasForm: /<form\b/i.test(html),
    hasTelLink,
    hasContactLink,
    ctaCount,
    imgTotal: imgs.length,
    imgWithAlt,
    hasTestimonial:
      /(お客様の声|利用者の声|受講生の声|お客様インタビュー|口コミ|レビュー|事例|ケース|実例|導入企業|導入実績|testimonial|review)/i.test(
        credText
      ),
    hasAchievementNumbers:
      /(創業|設立|実績|導入|累計|会員|利用者|合格率|満足度|シェア)/.test(credText) &&
      /\d[\d,]*\s*(年|件|社|名|人|％|%|回|店舗|校|以上)/.test(credText),
    hasCredentials:
      /(資格|受賞|表彰|認定|認証|グッドデザイン|メディア掲載|テレビ|新聞|雑誌|所属|加盟|会員企業|公式)/.test(
        credText
      ),
    hasCompanyInfo:
      /(会社概要|運営会社|運営者|代表者|代表取締役|所在地|沿革|プライバシーポリシー|特定商取引)/.test(credText),
    hasFreshDate: freshRe.test(html),
    htmlChars,
    hasWebp: /\.webp/i.test(html),
    hasLazyLoad: /loading\s*=\s*["']lazy["']/i.test(html),
    renderBlocking: headStylesheets + headSyncScripts,
  };
}

// ── 決定的スコアリング（段階採点・減点方式） ─────────────────

interface DetResult {
  contact: number;
  mobile: number;
  findability: number;
  speed: number;
  impressionDet: number;
  credibilityDet: number;
  issues: string[];
}

function deterministicScore(x: Extracted): DetResult {
  const issues: string[] = [];

  // ③ 問い合わせのしやすさ（20%）。トップページのみ対象＝ホームページ内で完結できるか。
  let contact = 0;
  if (x.hasForm) contact += 25;
  else issues.push('トップページに問い合わせフォームがなく、一手間かかる状態です');
  if (x.hasContactLink) contact += 20;
  else issues.push('ヘッダーやナビに問い合わせ導線が見当たりません');
  if (x.hasTelLink) contact += 15;
  else issues.push('電話番号がタップで発信できる形になっていません');
  contact += Math.min(x.ctaCount, 4) * 10; // 行動ボタンの反復（最大40）
  if (x.ctaCount === 0) issues.push('「相談する」などの行動ボタンが見当たりません');

  // ④ スマホ対応（12%）：viewport が主信号。外部CSSの媒体クエリは取得不能のため減点しない。
  let mobile = x.hasViewport ? 85 : 25;
  if (x.hasViewport) {
    if (x.hasMediaQuery) mobile += 15;
  } else {
    issues.push('スマホ表示の基本設定（viewport）が無く、崩れている可能性があります');
  }

  // ⑤ 見つけてもらえるか（13%）：品質まで見る段階採点。
  let findability = 0;
  const tlen = x.title.length;
  if (tlen >= 15 && tlen <= 60) findability += 25;
  else if (tlen >= 8) findability += 13;
  else issues.push('検索結果に出るタイトルが短い／未設定です');
  const dlen = x.metaDescription.length;
  if (dlen >= 60) findability += 20;
  else if (dlen > 0) findability += 10;
  else issues.push('検索結果に出る説明文が設定されていません');
  if (x.h1s.length >= 1) findability += 20;
  else issues.push('ページの主役となる見出しが見つかりません');
  if (x.hasJsonLd) findability += 20;
  else issues.push('AI検索に会社情報を正しく伝える設定がありません');
  const altRatio = x.imgTotal === 0 ? 1 : x.imgWithAlt / x.imgTotal;
  findability += Math.round(altRatio * 15);
  if (x.imgTotal > 0 && altRatio < 0.6) issues.push('画像の説明文（代替テキスト）が不足しています');

  // ⑥ 信用の証拠（10%・決定的サブ。Claudeと統合）。
  let credibilityDet = 0;
  if (x.hasTestimonial) credibilityDet += 25;
  else issues.push('お客様の声・事例が見当たらず、初めての人が安心しにくいです');
  if (x.hasAchievementNumbers) credibilityDet += 20;
  else issues.push('実績（年数・件数など）が数字で示されていません');
  if (x.hasCredentials) credibilityDet += 15;
  if (x.hasCompanyInfo) credibilityDet += 20;
  else issues.push('会社概要・運営者情報が見つかりません');
  if (x.hasFreshDate) credibilityDet += 20;
  else issues.push('更新の新しさが伝わる日付が見当たりません');

  // ⑦ 表示の速さ（10%）：HTML手がかりの減点方式（PSI未使用のヒューリスティック）。
  let speed = 100;
  if (x.htmlChars > 350000) speed -= 30;
  else if (x.htmlChars > 150000) speed -= 15;
  if (x.imgTotal > 60) speed -= 20;
  else if (x.imgTotal > 30) speed -= 10;
  if (x.imgTotal > 10 && !x.hasWebp) speed -= 15;
  if (x.imgTotal > 10 && !x.hasLazyLoad) speed -= 10;
  if (x.renderBlocking > 6) speed -= 20;
  else if (x.renderBlocking > 3) speed -= 10;
  speed = clamp(speed);
  if (speed < 60) issues.push('ページの表示が重く、待てずに離れられている可能性があります');

  // ① 第一印象・信頼感（決定的サブ＝Claudeと統合）。
  let impressionDet = 0;
  if (x.isHttps) impressionDet += 45;
  else issues.push('通信が暗号化（HTTPS）されていません');
  if (x.hasFavicon) impressionDet += 20;
  else issues.push('ブラウザのタブに出るアイコン（ファビコン）が未設定です');
  if (x.hasViewport) impressionDet += 35;

  return {
    contact: clamp(contact),
    mobile: clamp(mobile),
    findability: clamp(findability),
    speed,
    impressionDet: clamp(impressionDet),
    credibilityDet: clamp(credibilityDet),
    issues,
  };
}

// ── 根拠（各軸の「なぜこの点数か」＝実チェック結果・実物引用） ──

interface EvidenceItem {
  label: string;
  ok: boolean;
  value?: string;
}

const truncate = (s: string, n = 42): string => (s.length > n ? s.slice(0, n) + '…' : s);

function buildEvidence(x: Extracted, speed: number): Record<AxisKey, EvidenceItem[]> {
  const altPct = x.imgTotal === 0 ? 100 : Math.round((x.imgWithAlt / x.imgTotal) * 100);
  const titleOk = x.title.length >= 15 && x.title.length <= 60;
  return {
    impression: [
      { label: '通信の暗号化（HTTPS）', ok: x.isHttps },
      { label: 'タブに出るアイコン', ok: x.hasFavicon },
      { label: 'スマホ表示の基本設定', ok: x.hasViewport },
    ],
    clarity: [
      { label: 'ページの見出し', ok: !!x.title, value: x.title ? `「${truncate(x.title)}」` : '未設定' },
      { label: '最初の大見出し', ok: x.h1s.length > 0, value: x.h1s[0] ? `「${truncate(x.h1s[0])}」` : '未検出' },
    ],
    contact: [
      { label: '問い合わせフォーム', ok: x.hasForm },
      { label: '問い合わせへのリンク', ok: x.hasContactLink },
      { label: '電話のタップ発信', ok: x.hasTelLink },
      { label: '行動をうながすボタン', ok: x.ctaCount >= 1, value: `${x.ctaCount}件` },
    ],
    mobile: [{ label: 'スマホ表示の基本設定（viewport）', ok: x.hasViewport }],
    findability: [
      { label: '検索結果のタイトル', ok: titleOk, value: x.title ? `「${truncate(x.title)}」` : '未設定' },
      { label: '検索結果に出る説明文', ok: x.metaDescription.length >= 60 },
      { label: '主役の見出し（h1）', ok: x.h1s.length > 0 },
      { label: 'AI検索向けの情報設定', ok: x.hasJsonLd },
      { label: '画像の説明文', ok: altPct >= 60, value: x.imgTotal ? `${altPct}%` : '画像なし' },
    ],
    credibility: [
      { label: 'お客様の声・事例', ok: x.hasTestimonial },
      { label: '実績の数字', ok: x.hasAchievementNumbers },
      { label: '資格・受賞・掲載', ok: x.hasCredentials },
      { label: '会社概要・運営者情報', ok: x.hasCompanyInfo },
      { label: '更新の新しさ', ok: x.hasFreshDate },
    ],
    speed: [
      { label: 'ページの軽さ', ok: x.htmlChars <= 150000 },
      { label: '画像の最適化（WebP）', ok: x.hasWebp || x.imgTotal <= 10 },
      { label: '画像の遅延読み込み', ok: x.hasLazyLoad || x.imgTotal <= 10 },
      { label: '表示を妨げる要素の少なさ', ok: x.renderBlocking <= 3 },
    ],
  };
}

// ── Claude 定性判定（軸①②⑥＋気づき文の生成／辛口・根拠必須） ─────

interface Finding {
  text: string;
  evidence?: string;
}

interface QualResult {
  clarity_score: number;
  impression_score: number;
  credibility_score: number;
  findings: Finding[];
}

const SYSTEM_PROMPT = `あなたは辛口のプロのUI/UXレビュアーです。中小企業のWebサイトを、経営者にも分かる平易な日本語で厳しく評価してください。

【採点の基準】
- 平均的な中小企業サイトが 50〜65 点になる基準で採点する。
- 80点以上は「明確に優れている」場合のみ与える。安易な高得点は禁止。
- 各減点には、そのサイトの具体的な根拠を必ず1つ添える。根拠を示せない減点はしない（＝憶測で下げない）。
- 「存在するか」ではなく「きちんとできているか（質）」で見る。
- 専門用語・カタカナのWeb用語は使わない（「メタディスクリプション」「ファーストビュー」等や括弧併記も禁止）。相手を責めず「もったいない／伸びしろ」と表現する。

【評価軸】
- clarity（伝わりやすさ）：何の会社か・誰向けか・なぜここを選ぶかが伝わるか
- impression（第一印象・信頼感）：3秒で信頼できる会社に見えるか
- credibility（信用の証拠）：実績・お客様の声・資格などで安心させているか。具体的・第三者性があるか（抽象的な自称は評価しない）

【採点例（この分布に合わせる）】
- 平均的なサイト（会社名と事業は分かるが強みが不明確、最初の画面に行動ボタンなし、実績記載なし）→ clarity 55 / impression 58 / credibility 40
- 優れたサイト（最初の画面で対象と強みが明確、行動ボタン複数、顔写真つきお客様の声、実績数値あり）→ clarity 84 / impression 82 / credibility 80

【出力】次のJSONのみ。前置き・マークダウン・コードフェンス禁止。
findings は2〜3点。必ず「問題の指摘」までに留め、「どう直すか」は絶対に書かない（＝無料相談へのゲート）。
各 finding には axis（clarity / impression / credibility のいずれか）と、そのサイトの具体的根拠 evidence を必ず付ける。`;

const QUAL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    clarity_score: { type: 'integer' },
    impression_score: { type: 'integer' },
    credibility_score: { type: 'integer' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          axis: { type: 'string', enum: ['clarity', 'impression', 'credibility'] },
          text: { type: 'string' },
          evidence: { type: 'string' },
        },
        required: ['axis', 'text', 'evidence'],
      },
    },
  },
  required: ['clarity_score', 'impression_score', 'credibility_score', 'findings'],
};

async function qualitativeScore(x: Extracted, apiKey: string): Promise<QualResult | null> {
  const userMessage = `次のサイトを評価してください。

【タイトル】${x.title || '(なし)'}
【検索結果に出る説明文】${x.metaDescription || '(なし)'}
【見出し】
${x.headings.map((h) => '・' + h).join('\n') || '(なし)'}
【本文の抜粋】
${x.bodyExcerpt || '(なし)'}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 22000);
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
        output_config: { format: { type: 'json_schema', schema: QUAL_SCHEMA } },
      }),
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    const textBlock = (data.content || []).find((b: any) => b.type === 'text');
    if (!textBlock?.text) return null;
    const parsed = JSON.parse(textBlock.text);
    const findings: Finding[] = Array.isArray(parsed.findings)
      ? parsed.findings
          .slice(0, 3)
          .map((f: any) => ({ text: String(f.text || ''), evidence: String(f.evidence || '') }))
          .filter((f: Finding) => f.text)
      : [];
    return {
      clarity_score: clamp(parsed.clarity_score),
      impression_score: clamp(parsed.impression_score),
      credibility_score: clamp(parsed.credibility_score),
      findings,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/** Claude不使用時のフォールバック（HTML手がかりのみ・厳しめ）。 */
function fallbackQual(x: Extracted): QualResult {
  const clarity = clamp(
    25 + (x.title ? 15 : 0) + (x.metaDescription ? 10 : 0) + (x.h1s.length ? 15 : 0)
  );
  const impression = clamp((x.isHttps ? 45 : 10) + (x.hasFavicon ? 15 : 0) + (x.title ? 10 : 0));
  const credibility = clamp(
    (x.hasTestimonial ? 30 : 0) +
      (x.hasAchievementNumbers ? 25 : 0) +
      (x.hasCompanyInfo ? 25 : 0) +
      (x.hasCredentials ? 20 : 0)
  );
  const findings: Finding[] = [];
  if (!x.metaDescription)
    findings.push({ text: '検索結果に出る説明文が無く、何の会社か一目で伝わりにくい状態です' });
  if (!x.hasTestimonial)
    findings.push({ text: 'お客様の声や事例が見当たらず、初めての人が安心しにくい状態です' });
  return { clarity_score: clarity, impression_score: impression, credibility_score: credibility, findings };
}

// ── ハンドラ ────────────────────────────────────────────────

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });

export async function onRequestPost(context: EventContext): Promise<Response> {
  let payload: { url?: string };
  try {
    payload = await context.request.json();
  } catch {
    return json({ error: 'リクエストの形式が正しくありません。' }, 400);
  }

  const target = normalizeUrl(payload.url || '');
  if (!target) {
    return json({ error: 'URLの形式が正しくありません。ご確認ください。' }, 400);
  }

  let html: string;
  let htmlChars: number;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(target.href, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; PlugdoCheck/1.0; +https://plugdo.jp/check)',
        accept: 'text/html,application/xhtml+xml',
      },
    });
    clearTimeout(timeout);
    if (!res.ok) {
      return json({ error: 'サイトを読み込めませんでした。URLをご確認ください。' }, 502);
    }
    const ct = res.headers.get('content-type') || '';
    if (ct && !ct.includes('html')) {
      return json({ error: 'ホームページのURLを入力してください。' }, 400);
    }
    const full = await res.text();
    htmlChars = full.length;
    html = full.slice(0, 600000); // トップページのみ対象（巨大サイト対策）
  } catch {
    return json({ error: 'サイトを読み込めませんでした。URLをご確認ください。' }, 502);
  }

  const x = extract(html, target.protocol === 'https:', htmlChars);
  const det = deterministicScore(x);

  const apiKey = context.env.ANTHROPIC_API_KEY;
  const qual = (apiKey && (await qualitativeScore(x, apiKey))) || fallbackQual(x);

  // ①⑥ は決定的サブスコアと Claude を統合。②はClaudeのみ。
  const impression = clamp(det.impressionDet * 0.4 + qual.impression_score * 0.6);
  const clarity = qual.clarity_score;
  const credibility = clamp(det.credibilityDet * 0.5 + qual.credibility_score * 0.5);

  const axisScores: Record<AxisKey, number> = {
    impression,
    clarity,
    contact: det.contact,
    mobile: det.mobile,
    findability: det.findability,
    credibility,
    speed: det.speed,
  };

  const total = clamp(
    (Object.keys(AXES) as AxisKey[]).reduce(
      (sum, k) => sum + axisScores[k] * (AXES[k].weight / 100),
      0
    )
  );

  // 気づきは Claude（根拠つき）＋決定的課題から最大3点。直し方は出さない。
  const claudeFindings: Finding[] = qual.findings.map((f) => ({ text: f.text, evidence: f.evidence || '' }));
  const detFindings: Finding[] = det.issues
    .filter((t) => !claudeFindings.some((f) => f.text === t))
    .map((t) => ({ text: t }));
  const findings = [...claudeFindings, ...detFindings].slice(0, 3);

  const allIssues = new Set([...det.issues, ...qual.findings.map((f) => f.text)]);
  const remainingCount = Math.max(0, allIssues.size - findings.length);

  const evidenceMap = buildEvidence(x, det.speed);

  return json({
    url: target.href,
    title: x.title,
    total,
    bandMessage: bandMessage(total),
    axes: (Object.keys(AXES) as AxisKey[]).map((k) => ({
      key: k,
      label: AXES[k].label,
      score: axisScores[k],
      color: colorFor(axisScores[k]),
      evidence: evidenceMap[k],
    })),
    findings,
    remainingCount,
  });
}
