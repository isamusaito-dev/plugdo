#!/usr/bin/env python3
"""
診断レポートの下書きを1コマンドで生成する。

    ./scripts/make-report.py <URL> --company "株式会社○○" --name "山田 太郎"

やること：
    1. 本番の /api/check を叩いて診断する
    2. PC幅・スマホ幅のスクリーンショットを撮る
    3. 改善インパクト順に優先順位を出し、改善文を差し込む
    4. レポートHTMLを組み立てる
    5. 崩れチェック（check-report.py）とPDF化まで通す

出力先： work/<ドメイン名>/

★ これは「下書き」です。そのまま送らないこと。
   自動診断には誤検知があり、また改善文は汎用の型なので、
   実際のサイトを見て固有の内容に書き換える必要があります。
   生成されたHTMLの ★要確認 コメントの箇所を必ず手で埋めてください。
   詳しくは docs/plugdo-診断レポート作成キット.md §6 を参照。
"""

import argparse
import json
import os
import re
import subprocess
import sys
from datetime import datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEMPLATE_PATH = os.path.join(ROOT, "scripts/report-template.html")
# アクションのページはPython側で組み立てるため、ロゴはテンプレートから取り出して共有する
def _logo_html():
    t = open(TEMPLATE_PATH, encoding="utf-8").read()
    m = re.search(r'<span class="brand".*?</span>', t, re.S)
    return m.group(0) if m else ""

SNIPPETS_PATH = os.path.join(ROOT, "scripts/report-snippets.json")
API = "https://plugdo.jp/api/check"

# 無料相談の予約先。TimeRex等に変えるときはここだけ書き換える。
BOOKING_URL = "https://plugdo.jp/contact/"

# スマホ撮影の幅。
#   viewport あり … 実機と同じ iPhone 17 相当の幅で撮る（980pxだとタブレット表示になってしまう）
#   viewport なし … 実機は980px相当で描画してから縮小するため、その挙動を再現する
MOBILE_W_PHONE = 402      # iPhone 17 の論理幅
MOBILE_W_NO_VIEWPORT = 980

ACTIONS_PER_PAGE = 3      # 1ページに載せる改善アクションの数

COLORS = {"red": "#E43172", "yellow": "#C8A951", "green": "#1F9D6B"}
# 改善後の見込み値（診断ロジック上おおむね到達しうる水準。あくまで目安）
TARGETS = {"mobile": 100, "contact": 100, "findability": 90, "credibility": 85,
           "speed": 90, "clarity": 75, "impression": 85}

# 軸ごとのアイコン（線画・currentColorで着色。外部ファイルに依存しない）
_S = ('viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" '
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"')
AXIS_ICONS = {
    # 第一印象：人
    "impression": f'<svg {_S}><circle cx="12" cy="8" r="3.4"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/></svg>',
    # 伝わりやすさ：文書
    "clarity": f'<svg {_S}><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/><path d="M9 12h6M9 16h4"/></svg>',
    # 問い合わせ：封筒
    "contact": f'<svg {_S}><rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M3.5 7l8.5 6 8.5-6"/></svg>',
    # スマホ対応：スマートフォン
    "mobile": f'<svg {_S}><rect x="7" y="2.5" width="10" height="19" rx="2.2"/><path d="M11 18.5h2"/></svg>',
    # 見つけてもらえるか：虫眼鏡
    "findability": f'<svg {_S}><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/></svg>',
    # 信用の証拠：盾
    "credibility": f'<svg {_S}><path d="M12 2.5l7.5 3v6c0 4.6-3.1 8.6-7.5 10-4.4-1.4-7.5-5.4-7.5-10v-6z"/><path d="M9 12l2.2 2.2L15.5 10"/></svg>',
    # 表示の速さ：メーター
    "speed": f'<svg {_S}><path d="M3.8 17a9 9 0 1 1 16.4 0"/><path d="M12 17l4-5"/><circle cx="12" cy="17" r="1.3"/></svg>',
}


def band_text(total):
    """点数帯コメント（check.ts の bandMessage と同じ区切り）。"""
    if total >= 80:
        return ("全体としてよくできているサイトです。",
                "土台が整っているぶん、残った数点を詰めるだけで問い合わせの入り口として十分に機能します。大きな作り直しは必要ありません。")
    if total >= 66:
        return ("よくできている部分と、もったいない部分が分かれています。",
                "全部に手をつける必要はありません。下の3点に絞れば、費用をかけずに改善できます。")
    if total >= 50:
        return ("平均的な状態です。直したぶんだけ、結果が出やすい。",
                "裏を返せば、直したぶんだけ結果が出やすい状態でもあります。特に下の3点は、いま問い合わせを取りこぼしている可能性が高い箇所です。")
    return ("もったいない状態です。ただし、伸びしろは最大です。",
            "現状ではサイトが営業の役割を果たせていない可能性があります。ただし原因は細かい点ではなく土台にあるため、そこを直せば一気に改善します。")


def esc(s):
    return (str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            .replace('"', "&quot;"))


def run(cmd, **kw):
    return subprocess.run(cmd, capture_output=True, text=True, **kw)


def diagnose(url):
    # python.org 版Pythonは証明書が未設定のことがあるため、システムのcurlを使う
    r = run(["curl", "-s", "--max-time", "120", "-X", "POST", API,
             "-H", "content-type: application/json",
             "-d", json.dumps({"url": url})])
    if r.returncode != 0 or not r.stdout.strip():
        raise RuntimeError(f"診断APIの呼び出しに失敗しました: {r.stderr[:200]}")
    try:
        data = json.loads(r.stdout)
    except json.JSONDecodeError:
        raise RuntimeError(f"診断APIの応答を解釈できません: {r.stdout[:200]}")
    if "total" not in data:
        raise RuntimeError(f"診断に失敗しました: {data.get('error', r.stdout[:200])}")
    return data


def pick_priorities(data, snips):
    """改善インパクト（軸の重み × 改善余地）順に、上位3件の改善項目を選ぶ。"""
    weights = snips["axisWeights"]
    scores = {a["key"]: a["score"] for a in data["axes"]}
    impact = {k: weights[k] * (100 - v) / 100 for k, v in scores.items()}

    # 指摘文 → 辞書。診断が出した順を保ちつつ、所属軸のインパクトで並べ替える
    found = []
    for f in data.get("findings", []):
        text = f if isinstance(f, str) else f.get("text", "")
        s = snips["snippets"].get(text)
        if s:
            found.append({**s, "finding": text, "impact": impact.get(s["axis"], 0)})

    # 上位の軸で、対応する指摘が無いものは軸単位の汎用文で補う
    for axis in sorted(impact, key=impact.get, reverse=True):
        if any(x["axis"] == axis for x in found):
            continue
        fb = snips["axisFallback"].get(axis)
        if fb:
            found.append({**fb, "axis": axis, "finding": "", "impact": impact[axis],
                          "generic": True})

    found.sort(key=lambda x: (-x["impact"], x["difficulty"] != "自力可"))

    # 同じ軸が3つ並ぶと単調になるので、上位3件は軸を散らす
    top, used = [], set()
    for x in found:
        if len(top) >= 3:
            break
        if x["axis"] in used:
            continue
        top.append(x)
        used.add(x["axis"])
    for x in found:
        if len(top) >= 3:
            break
        if x not in top:
            top.append(x)

    # 優先順位表用：全7軸を、改善したときの点数の伸び順に並べる
    by_axis = {}
    for x in found:
        by_axis.setdefault(x["axis"], x)
    ranked = []
    for a, w in weights.items():
        gain = round(w * (max(scores[a], TARGETS.get(a, scores[a])) - scores[a]) / 100)
        item = by_axis.get(a)
        ranked.append({
            "axis": a,
            "title": item["title"] if item else f"{snips['axisLabels'][a]}の改善",
            "score": scores[a],
            "impact": impact[a],
            "gain": gain,
            "pri": "高" if impact[a] >= 8 else "中" if impact[a] >= 4 else "低",
        })
    ranked.sort(key=lambda x: -x["impact"])

    # 改善アクションは全項目ぶん用意する（軸ごとに1件、インパクト順）。
    # ただし目標値に達している軸（gain 0）は「直すところがない」ので載せない。
    # axisFallback は7軸すべて用意すること。欠けるとその軸が丸ごと抜け落ちる。
    all_actions = []
    for r in ranked:
        if r["gain"] <= 0:
            continue
        item = by_axis.get(r["axis"])
        if not item:
            fb = snips["axisFallback"].get(r["axis"])
            if not fb:
                sys.stderr.write(
                    f"[警告] 軸「{snips['axisLabels'][r['axis']]}」に改善余地があるのに"
                    f"文例がありません（report-snippets.json の axisFallback に追加してください）\n")
                continue
            item = {**fb, "axis": r["axis"], "finding": "", "generic": True}
        all_actions.append(item)

    return top, impact, scores, ranked, all_actions


def project(scores, top, weights):
    """上位3つを直した場合の再計算値（目安）。"""
    after = dict(scores)
    changed = []
    for t in top:
        a = t["axis"]
        tgt = max(scores[a], TARGETS.get(a, scores[a]))
        if tgt > scores[a]:
            after[a] = tgt
            changed.append(a)
    total_before = round(sum(scores[k] * weights[k] for k in weights) / 100)
    total_after = round(sum(after[k] * weights[k] for k in weights) / 100)
    return after, changed, total_before, total_after


def build_html(data, company, name, top, impact, scores, ranked, all_actions, snips, shots):
    LOGO_HTML = _logo_html()
    weights, labels = snips["axisWeights"], snips["axisLabels"]
    total = data["total"]
    lead, body = band_text(total)
    gcolor = COLORS["green"] if total >= 75 else COLORS["yellow"] if total >= 50 else COLORS["red"]
    dash = 339.3 * (1 - total / 100)
    after, changed, tb, ta = project(scores, top, weights)
    today = datetime.now().strftime("%Y年%-m月%-d日")
    domain = re.sub(r"^https?://", "", data["url"]).rstrip("/")

    # 7軸バー（診断画面と同じ並び順・アイコン付き）
    axis_rows = ""
    top_axis = top[0]["axis"] if top else None
    for a in data["axes"]:
        c = COLORS[a["color"]]
        badge = '<span class="badge">最優先</span>' if a["key"] == top_axis else ""
        cls = "axis-nm top" if a["key"] == top_axis else "axis-nm"
        icon = AXIS_ICONS.get(a["key"], "")
        axis_rows += (
            f'  <div class="axis"><div class="axis-hd">'
            f'<span class="axis-ic">{icon}</span>'
            f'<span class="{cls}">{esc(a["label"])}{badge}</span>'
            f'<span class="axis-sc" style="color:{c}">{a["score"]}</span></div>'
            f'<div class="track"><div class="fill" style="width:{a["score"]}%;background:{c}"></div></div></div>\n')

    # 優先順位の一覧（全7軸）
    prows = ""
    for i, r in enumerate(ranked, 1):
        one = " one" if i == 1 else ""
        pcls = {"高": "h", "中": "m", "低": "l"}[r["pri"]]
        gain = f'+{r["gain"]}' if r["gain"] > 0 else "—"
        prows += (
            f'    <div class="prow"><div class="pno{one}">{i}</div>'
            f'<span class="ptitle">{esc(r["title"])}'
            f'<span class="paxis">{esc(labels[r["axis"]])}（現在 {r["score"]}点）</span></span>'
            f'<span class="pri {pcls}">{r["pri"]}</span>'
            f'<span class="gain">{gain}</span></div>\n')

    # 具体的な改善アクション（全項目）。件数が案件で変わるためページを分けて生成する。
    def action_card(t, rank):
        one = " one" if rank == 1 else ""
        note = ""
        if t.get("generic"):
            note = ('\n    <!-- ★要確認: これは軸単位の汎用文です。実際のサイトを見て、'
                    '固有の見出しや文言を引用した内容に書き換えてください -->')
        icon = AXIS_ICONS.get(t["axis"], "")
        dg = ' class="g"' if t["difficulty"] == "自力可" else ""
        return f"""
  <div class="acard{one}">{note}
    <div class="aic">{icon}</div>
    <div class="abody">
      <p class="attl"><span class="ano">{rank}</span>{esc(t["title"])}</p>
      <p class="lbl">なぜ問題か</p>
      <p class="txt">{esc(t["why"])}</p>
      <p class="lbl">どう直すか</p>
      <p class="txt">{esc(t["how"])}</p>
      <div class="tags"><span class="tag">難易度：<b{dg}>{esc(t["difficulty"])}</b></span><span class="tag">効果：<b class="g">{esc(t["effect"])}</b></span></div>
    </div>
  </div>
"""

    head_html = ('<div class="head">' + LOGO_HTML
                 + '<div class="kicker">WEB CHECK REPORT</div></div>')
    chunks = [all_actions[i:i + ACTIONS_PER_PAGE]
              for i in range(0, len(all_actions), ACTIONS_PER_PAGE)]
    action_pages = ""
    for pi, chunk in enumerate(chunks):
        cont = "（つづき）" if pi else ""
        note = ("上位から順に、なぜ問題かと、どう直すかをまとめました。"
                if pi == 0 else "前ページからの続きです。")
        cards = "".join(action_card(t, pi * ACTIONS_PER_PAGE + j + 1)
                        for j, t in enumerate(chunk))
        action_pages += f"""<!-- ═══ 改善アクション {pi + 1} ═══ -->
<section class="page">
  {head_html}

  <h2 class="sec">具体的な改善アクション{cont}</h2>
  <p class="sec-note">{note}</p>
{cards}
  <div class="foot"><span>Plugdo Web診断レポート｜{esc(company)}様</span><span>{{{{PAGE_NO}}}}</span></div>
</section>

"""

    # そのほかの指摘（上位3つで扱ったもの以外）
    used_findings = {t["finding"] for t in top if t["finding"]}
    rest = []
    for f in data.get("findings", []):
        text = f if isinstance(f, str) else f.get("text", "")
        if text and text not in used_findings:
            rest.append(text)
    rest_html = "".join(f"      <li>{esc(r)}</li>\n" for r in rest) or \
                "      <li>特に大きな指摘はありませんでした。</li>\n"
    remaining = data.get("remainingCount", 0)
    rest_note = (f'<p class="disc" style="margin-top:8px;">※ このほかに{remaining}件の軽微な指摘があります。'
                 f'ご希望があればお伝えします。</p>' if remaining else "")

    # 改善後のスコア推移（棒グラフ）。全項目を直した場合を上限の目安として並べる
    all_after = {k: max(scores[k], TARGETS.get(k, scores[k])) for k in weights}
    t_all = round(sum(all_after[k] * weights[k] for k in weights) / 100)
    bars = [("現在", tb, "#AAB7CC"), ("上位3つを改善", ta, "#103366")]
    # 上位3つでほぼ上限に届く場合、同じ高さの棒が並ぶだけなので3本目は出さない
    if t_all - ta >= 2:
        bars.append(("すべて改善", t_all, "#E43172"))
    else:
        bars[1] = ("改善後", ta, "#E43172")
    chart_bars, chart_labels = "", ""
    for label, val, col in bars:
        h = max(6, round(val / 100 * 86))   # グラフ領域の高さに合わせる
        chart_bars += (f'    <div class="bar-wrap"><div class="bar-v" style="color:{col}">{val}</div>'
                       f'<div class="bar" style="height:{h}px;background:{col}"></div></div>\n')
        chart_labels += f'    <div class="bar-l">{esc(label)}</div>\n'

    # スコア別のご提案
    if total < 65:
        cta_h = "この課題は、更新では直りません。"
        cta_p = ("今回の減点は、文言や画像の差し替えでは届かない部分（構造・スマホ対応・表示速度）に集中しています。"
                 "部分的な修正を重ねるより、土台から作り直したほうが結果的に早く・安くなるケースです。")
        cta_name, cta_sub, cta_price, cta_url = "リニューアル", "5ページ構成・スマホ対応・基本SEOを含みます", "¥198,000", "https://plugdo.jp/renewal/"
    else:
        cta_h = "土台は良好です。運用で伸ばせます。"
        cta_p = ("作り直しは必要ありません。優先度の高いものから直したうえで、"
                 "更新を止めずに続けることがいちばん効果的です。")
        cta_name, cta_sub, cta_price, cta_url = "Web運用", "最低契約期間なし・いつでも解約できます", "月¥9,800", "https://plugdo.jp/care/"

    tpl = open(TEMPLATE_PATH, encoding="utf-8").read()
    html = (tpl
            .replace("{{COMPANY}}", esc(company))
            .replace("{{NAME}}", esc(name))
            .replace("{{DOMAIN}}", esc(domain))
            .replace("{{DESKTOP}}", esc(shots["desktop"]))
            .replace("{{MOBILE}}", esc(shots["mobile"]))
            .replace("{{TOTAL}}", str(total))
            .replace("{{GAUGE_COLOR}}", gcolor)
            .replace("{{GAUGE_DASH}}", f"{dash:.1f}")
            .replace("{{BAND_LEAD}}", esc(lead))
            .replace("{{BAND_BODY}}", esc(body))
            .replace("{{AXIS_ROWS}}", axis_rows)
            .replace("{{PRIORITY_ROWS}}", prows)
            .replace("{{ACTION_PAGES}}", action_pages)
            .replace("{{BOOKING_URL}}", BOOKING_URL)
            .replace("{{BOOKING_URL_TEXT}}", BOOKING_URL)
            .replace("{{REST}}", rest_html)
            .replace("{{REST_NOTE}}", rest_note)
            .replace("{{CHART_BARS}}", chart_bars)
            .replace("{{CHART_LABELS}}", chart_labels)
            .replace("{{CTA_H}}", esc(cta_h))
            .replace("{{CTA_P}}", esc(cta_p))
            .replace("{{CTA_NAME}}", esc(cta_name))
            .replace("{{CTA_SUB}}", esc(cta_sub))
            .replace("{{CTA_PRICE}}", esc(cta_price))
            .replace("{{CTA_URL}}", esc(cta_url))
            .replace("{{DATE}}", today))

    return number_pages(html)


def number_pages(html):
    """{{PAGE_NO}} を「n / 総数」に置き換える。アクションのページ数が案件で変わるため、
    テンプレートに固定値を書かず、組み立て後にまとめて採番する。"""
    total = html.count("{{PAGE_NO}}")
    out, i = html, 0
    while "{{PAGE_NO}}" in out:
        i += 1
        out = out.replace("{{PAGE_NO}}", f"{i} / {total}", 1)
    return out


def main():
    ap = argparse.ArgumentParser(add_help=False)
    ap.add_argument("url")
    ap.add_argument("--company", required=True)
    ap.add_argument("--name", default="ご担当者")
    ap.add_argument("--outdir")
    ap.add_argument("-h", "--help", action="store_true")
    args = ap.parse_args()
    if args.help:
        print(__doc__)
        return

    url = args.url if args.url.startswith("http") else "https://" + args.url
    domain = re.sub(r"^https?://", "", url).rstrip("/").split("/")[0]
    outdir = args.outdir or os.path.join(ROOT, "work", domain.replace("www.", ""))
    os.makedirs(outdir, exist_ok=True)

    print(f"1/5 診断中… {url}")
    data = diagnose(url)
    print(f"    総合 {data['total']}点 ／ 指摘 {len(data.get('findings', []))}件")

    print("2/5 スクリーンショット撮影中…")
    # viewport の有無で撮影幅を変える（上の定数のコメント参照）
    has_viewport = any(
        e.get("ok")
        for a in data.get("axes", [])
        for e in a.get("evidence", [])
        if "viewport" in e.get("label", "")
    )
    mobile_w = MOBILE_W_PHONE if has_viewport else MOBILE_W_NO_VIEWPORT
    print(f"    スマホ撮影幅: {mobile_w}px"
          f"（viewport {'あり→実機と同じ幅' if has_viewport else 'なし→縮小表示を再現'}）")
    env = {**os.environ, "MOBILE_W": str(mobile_w),
           "MOBILE_H": str(round(mobile_w * 1.15))}  # 枠の高さが隣の解説と揃う比率
    r = run([os.path.join(ROOT, "scripts/capture-site.sh"), url, outdir], env=env)
    if r.returncode != 0:
        print("    ★ 撮影に失敗しました:", r.stderr[:200])
    for f in ("desktop.png", "mobile.png"):
        p = os.path.join(outdir, f)
        if os.path.exists(p):
            run(["sips", "-Z", "1500" if "desktop" in f else "900", p, "--out", p])

    print("3/5 優先順位を算出中…")
    snips = json.load(open(SNIPPETS_PATH, encoding="utf-8"))
    top, impact, scores, ranked, all_actions = pick_priorities(data, snips)
    for i, t in enumerate(top, 1):
        mark = "（汎用文・要加筆）" if t.get("generic") else ""
        print(f"    {i}. [{snips['axisLabels'][t['axis']]} {scores[t['axis']]}点 / "
              f"インパクト{t['impact']:.1f}] {t['title']}{mark}")

    print("4/5 レポートを組み立て中…")
    html = build_html(data, args.company, args.name, top, impact, scores, ranked, all_actions, snips,
                      {"desktop": "desktop.png", "mobile": "mobile.png"})
    report = os.path.join(outdir, "report.html")
    open(report, "w", encoding="utf-8").write(html)
    json.dump(data, open(os.path.join(outdir, "diagnosis.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)

    print("5/5 崩れチェックとPDF化…")
    r = run([sys.executable, os.path.join(ROOT, "scripts/check-report.py"), report, "--pdf"])
    print("   " + "\n   ".join(l for l in r.stdout.splitlines() if l.strip()))

    print()
    print(f"出力: {outdir}")
    print()
    print("★ これは下書きです。送る前に必ず：")
    print("   - 実際のサイトを開き、指摘が事実か確認する（自動診断には誤検知があります）")
    print("   - 改善文を、そのサイト固有の内容に書き換える")
    print("   - 2ページ目の注釈（枠と番号）を実際の画面に合わせて配置する")
    print("   - 詳しくは docs/plugdo-診断レポート作成キット.md §6")


if __name__ == "__main__":
    main()
