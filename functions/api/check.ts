// Plugdo 自動Web診断ツールのバックエンド（Cloudflare Pages Function）。
// 役割：対象サイトのHTMLを取得し、決定的チェック（軸③④⑤＋①の一部）をコードで判定、
// 軸①②の定性判定と「気づき」文の生成を Claude API に委譲してスコアと結果JSONを返す。
//
// CORS回避のためサーバー側で対象サイトを fetch する（仕様書 §7）。
// 必要な環境変数：ANTHROPIC_API_KEY（Cloudflare Pages の Settings → Environment variables に設定）。

interface Env {
  ANTHROPIC_API_KEY?: string;
}

type EventContext = {
  request: Request;
  env: Env;
};

// 5軸の定義（仕様書 §3）。重み合計 = 100。
const AXES = {
  impression: { label: '第一印象・信頼感', weight: 20 },
  clarity: { label: '伝わりやすさ', weight: 25 },
  contact: { label: '問い合わせのしやすさ', weight: 25 },
  mobile: { label: 'スマホ対応', weight: 15 },
  findability: { label: '見つけてもらえるか', weight: 15 },
} as const;

type AxisKey = keyof typeof AXES;

const CLAUDE_MODEL = 'claude-sonnet-4-6';

// ── ユーティリティ ──────────────────────────────────────────

const clamp = (n: number, min = 0, max = 100): number =>
  Math.max(min, Math.min(max, Math.round(n)));

/** スコアを赤/黄/緑に色分け（仕様書 §2 画面③）。 */
const colorFor = (score: number): 'red' | 'yellow' | 'green' =>
  score >= 75 ? 'green' : score >= 50 ? 'yellow' : 'red';

/** 点数帯メッセージ（仕様書 §4。責めず「もったいない＝伸びしろ」で表現）。 */
function bandMessage(total: number): string {
  if (total >= 80) return '土台は良好。あと一歩で“働くサイト”になります。';
  if (total >= 60) return '惜しい状態。直せば問い合わせが増える余地が大きいです。';
  if (total >= 40) return 'もったいない状態。優先順位をつけて直す価値があります。';
  return '今は機会を逃しています。でも、伸びしろは最大です。';
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
  headings: string[]; // h1〜h3 のテキスト（Claudeへ渡す見出し構造）
  bodyExcerpt: string;
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
  isHttps: boolean;
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

// CTAらしいアンカーテキスト（問い合わせ導線の有無・反復の判定に使う）。
const CTA_WORDS =
  /(問い合わせ|お問合せ|お問い合わせ|相談|見積|資料請求|申し込|申込|予約|contact|inquiry|お申込|無料)/i;

function extract(html: string, isHttps: boolean): Extracted {
  const headHtml = (html.match(/<head[\s\S]*?<\/head>/i)?.[0] || html).slice(0, 200000);

  const h1s = collect(html, /<h1[^>]*>([\s\S]*?)<\/h1>/gi, 6);
  const h2s = collect(html, /<h2[^>]*>([\s\S]*?)<\/h2>/gi, 8);
  const h3s = collect(html, /<h3[^>]*>([\s\S]*?)<\/h3>/gi, 8);

  // アンカーを走査して問い合わせリンク・tel・CTA数をカウント。
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

  // 画像のalt網羅率。
  const imgs = html.match(/<img\b[^>]*>/gi) || [];
  let imgWithAlt = 0;
  for (const tag of imgs) {
    const alt = tag.match(/\balt\s*=\s*["']([^"']*)["']/i);
    if (alt && alt[1].trim()) imgWithAlt++;
  }

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
    bodyExcerpt: stripTags(html).slice(0, 2500),
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
    isHttps,
  };
}

// ── 決定的スコアリング（軸③④⑤＋①の一部） ──────────────────

interface DetResult {
  contact: number;
  mobile: number;
  findability: number;
  impressionDet: number; // ①の決定的サブスコア（Claudeと統合）
  issues: string[]; // 検出した課題（ゲートの「あと◯個」算出用）
}

function deterministicScore(x: Extracted): DetResult {
  const issues: string[] = [];

  // ③ 問い合わせのしやすさ（25%）
  let contact = 0;
  if (x.hasContactLink) contact += 30;
  else issues.push('ヘッダーやナビに問い合わせ導線が見当たりません');
  if (x.hasForm) contact += 25;
  else issues.push('問い合わせフォームが見つかりません');
  if (x.hasTelLink) contact += 20;
  else issues.push('電話番号がタップで発信できる形になっていません');
  if (x.ctaCount >= 1) contact += 15;
  else issues.push('「相談する」などの行動ボタンが弱いです');
  if (x.ctaCount >= 2) contact += 10;

  // ④ スマホ対応（15%）
  let mobile = 0;
  if (x.hasViewport) mobile += 60;
  else issues.push('スマホ表示の基本設定（viewport）が無く、崩れている可能性があります');
  if (x.hasMediaQuery) mobile += 40;
  else {
    mobile += 15; // 外部CSSで対応している可能性があるため0にはしない
    issues.push('スマホ向けのレイアウト切り替えが確認できません');
  }

  // ⑤ 見つけてもらえるか（15%）
  let findability = 0;
  if (x.title && x.title.length >= 10) findability += 25;
  else issues.push('検索結果に出るタイトルが弱い／短いです');
  if (x.metaDescription) findability += 20;
  else issues.push('検索結果に出る説明文（説明テキスト）が設定されていません');
  if (x.h1s.length >= 1) findability += 20;
  else issues.push('ページの主役となる見出しが見つかりません');
  if (x.hasJsonLd) findability += 20;
  else issues.push('AI検索に会社情報を正しく伝える設定がありません');
  const altRatio = x.imgTotal === 0 ? 1 : x.imgWithAlt / x.imgTotal;
  findability += Math.round(altRatio * 15);
  if (x.imgTotal > 0 && altRatio < 0.6) {
    issues.push('画像の説明文（代替テキスト）が不足しています');
  }

  // ① 第一印象・信頼感（決定的サブ＝Claudeと50:50で統合）
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
    impressionDet: clamp(impressionDet),
    issues,
  };
}

// ── Claude 定性判定（軸①②＋気づき文の生成） ─────────────────

interface QualResult {
  clarity_score: number;
  impression_score: number;
  findings: { axis: string; text: string }[];
}

const SYSTEM_PROMPT = `あなたは中小企業のWebサイトを診断するプロのUI/UXデザイナーです。
与えられたサイト情報をもとに、以下を中小企業の経営者にも分かる平易な日本語で評価してください。
専門用語は禁止。相手を責めず「もったいない／伸びしろ」という前向きな表現で。

評価軸：
- clarity（伝わりやすさ）: 何の会社か・誰向けか・なぜここを選ぶかが伝わるか
- impression（第一印象・信頼感）: 3秒で信頼できる会社に見えるか

findings は2〜3点。必ず「問題の指摘」までに留め、「どう直すか」は絶対に書かないこと。
良いサイトには高いスコア（80〜90）を正直に付けてください。すべてを低得点にしないこと。
各 finding の axis は clarity または impression のいずれかにすること。

専門用語・カタカナのWeb用語は一切使わないこと（括弧書きでの併記も禁止）。
例：「メタディスクリプション」→「検索結果に出る説明文」、「ファーストビュー」→「最初に見える画面」、
「CTA」「コンバージョン」「SEO」「ファビコン」なども使わず、経営者に通じる平易な言葉に言い換えること。`;

const QUAL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    clarity_score: { type: 'integer' },
    impression_score: { type: 'integer' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          axis: { type: 'string', enum: ['clarity', 'impression'] },
          text: { type: 'string' },
        },
        required: ['axis', 'text'],
      },
    },
  },
  required: ['clarity_score', 'impression_score', 'findings'],
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
  const timeout = setTimeout(() => controller.abort(), 20000);
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
        max_tokens: 1024,
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
    return {
      clarity_score: clamp(parsed.clarity_score),
      impression_score: clamp(parsed.impression_score),
      findings: Array.isArray(parsed.findings) ? parsed.findings.slice(0, 3) : [],
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/** Claudeが使えない場合のフォールバック（HTML手がかりだけで簡易判定）。 */
function fallbackQual(x: Extracted): QualResult {
  const clarity = clamp(
    (x.title ? 30 : 0) + (x.metaDescription ? 30 : 0) + (x.h1s.length ? 40 : 10)
  );
  const impression = clamp((x.isHttps ? 50 : 0) + (x.hasFavicon ? 25 : 0) + (x.hasViewport ? 25 : 0));
  const findings: { axis: string; text: string }[] = [];
  if (!x.metaDescription)
    findings.push({ axis: 'clarity', text: '検索結果に出る説明文が無く、何の会社か一目で伝わりにくい状態です' });
  if (!x.h1s.length)
    findings.push({ axis: 'clarity', text: 'ページの主役となる見出しがなく、伝えたいことがぼやけています' });
  return { clarity_score: clarity, impression_score: impression, findings };
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

  // 対象サイトのHTMLを取得。
  let html: string;
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
    html = (await res.text()).slice(0, 600000); // トップページのみ対象（巨大サイト対策）
  } catch {
    return json({ error: 'サイトを読み込めませんでした。URLをご確認ください。' }, 502);
  }

  const x = extract(html, target.protocol === 'https:');
  const det = deterministicScore(x);

  const apiKey = context.env.ANTHROPIC_API_KEY;
  const qual = (apiKey && (await qualitativeScore(x, apiKey))) || fallbackQual(x);

  // ① は決定的サブスコアと Claude の impression を 50:50 で統合。
  const impression = clamp(det.impressionDet * 0.5 + qual.impression_score * 0.5);
  const clarity = qual.clarity_score;

  const axisScores: Record<AxisKey, number> = {
    impression,
    clarity,
    contact: det.contact,
    mobile: det.mobile,
    findability: det.findability,
  };

  const total = clamp(
    (Object.keys(AXES) as AxisKey[]).reduce(
      (sum, k) => sum + axisScores[k] * (AXES[k].weight / 100),
      0
    )
  );

  // 気づきは Claude（定性）＋決定的課題から最大3点。直し方は出さない（ゲートの生命線）。
  const findingTexts = qual.findings.map((f) => f.text);
  const detFindings = det.issues.filter((i) => !findingTexts.includes(i));
  const findings = [...findingTexts, ...detFindings].slice(0, 3);

  // 「あと◯個」＝検出した全課題のうち、結果画面で見せていない残り。
  const allIssues = new Set([...det.issues, ...qual.findings.map((f) => f.text)]);
  const remainingCount = Math.max(0, allIssues.size - findings.length);

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
    })),
    findings,
    remainingCount,
  });
}
