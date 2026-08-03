#!/usr/bin/env python3
"""
診断レポートの「印刷したときだけ出る崩れ」を検出する。

    ./scripts/check-report.py <report.html> [--pdf]

なぜ必要か：
    レポートは画面で見ると正常でも、PDFにすると崩れることがある。
    原因は主に2つ。
      1) @media print で見た目が変わる（背景色・改ページ・余白）
      2) A4の高さ(1122.52px)を0.5px超えただけで空白ページが増える
    どちらも目視では気づけないため、印刷時のCSSを常時適用したコピーを作り、
    実際のレイアウトを測って判定する。

検出する崩れ：
    - ページがA4の高さを超えている（空白ページが増える）
    - 画像が読み込めていない
    - スコアの数字がゲージの中心からズレている
    - 「直すとこうなります」の数値の高さが揃っていない
    - 注釈の番号が画像の外にはみ出している
    - 本文がフッターに重なっている
    - 横方向にはみ出している

--pdf を付けると、実際にPDFを生成してページ数が想定と一致するかも確認する。
追加インストールは不要（macOS標準のChromeを使う）。
"""

import base64
import json
import os
import re
import subprocess
import sys
import tempfile

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

CHECKER_JS = r"""
<script>
window.__check = function () {
  var A4 = 297 / 25.4 * 96;          // 1122.5196... A4の高さ(px)
  var problems = [];
  var pages = Array.prototype.slice.call(document.querySelectorAll('.page'));

  if (!pages.length) problems.push({ page: 0, msg: '.page 要素が見つかりません' });

  // ページがA4を超えていないか（0.5pxでも超えると空白ページが増える）
  pages.forEach(function (p, i) {
    var h = p.getBoundingClientRect().height;
    if (h > A4) problems.push({ page: i + 1, msg: 'A4の高さを ' + (h - A4).toFixed(2) + 'px 超過（空白ページが増えます）' });
  });

  // 画像が読めているか
  Array.prototype.slice.call(document.images).forEach(function (im) {
    if (!(im.complete && im.naturalWidth > 0))
      problems.push({ page: 0, msg: '画像が読み込めません: ' + im.getAttribute('src') });
  });

  // スコアの数字がゲージの中心にあるか
  Array.prototype.slice.call(document.querySelectorAll('.gauge')).forEach(function (g) {
    var n = g.querySelector('.gauge-num');
    if (!n) return;
    var gr = g.getBoundingClientRect(), nr = n.getBoundingClientRect();
    var dx = Math.abs((gr.left + gr.width / 2) - (nr.left + nr.width / 2));
    var dy = Math.abs((gr.top + gr.height / 2) - (nr.top + nr.height / 2));
    if (dx > 1 || dy > 1)
      problems.push({ page: 0, msg: 'スコアの数字がゲージの中心からズレています（x ' + dx.toFixed(1) + 'px / y ' + dy.toFixed(1) + 'px）' });
  });

  // 「直すとこうなります」の数値の高さが揃っているか
  var vs = Array.prototype.slice.call(document.querySelectorAll('.proj-c .vv'))
    .map(function (v) { return Math.round(v.getBoundingClientRect().top); });
  if (vs.length > 1) {
    var uniq = vs.filter(function (v, i) { return vs.indexOf(v) === i; });
    if (uniq.length > 1)
      problems.push({ page: 0, msg: '「直すとこうなります」の数値の高さが揃っていません（上端 ' + vs.join(' / ') + '）' });
  }

  // 注釈の番号が画像からはみ出していないか
  Array.prototype.slice.call(document.querySelectorAll('.annot')).forEach(function (a) {
    var ar = a.getBoundingClientRect();
    Array.prototype.slice.call(a.querySelectorAll('.pin')).forEach(function (p) {
      var pr = p.getBoundingClientRect();
      if (pr.left < ar.left - 0.5 || pr.right > ar.right + 0.5 ||
          pr.top < ar.top - 0.5 || pr.bottom > ar.bottom + 0.5)
        problems.push({ page: 0, msg: '注釈の番号「' + p.textContent.trim() + '」が画像の外にはみ出しています' });
    });
  });

  // 本文がフッターに重なっていないか
  pages.forEach(function (p, i) {
    var foot = p.querySelector('.foot');
    if (!foot) return;
    var fr = foot.getBoundingClientRect();
    Array.prototype.slice.call(p.children).forEach(function (c) {
      if (c === foot) return;
      var cr = c.getBoundingClientRect();
      if (cr.bottom > fr.top + 0.5)
        problems.push({ page: i + 1, msg: '本文がフッターに ' + Math.round(cr.bottom - fr.top) + 'px 重なっています' });
    });
  });

  // 横方向のはみ出し
  pages.forEach(function (p, i) {
    if (p.scrollWidth > p.clientWidth + 1)
      problems.push({ page: i + 1, msg: '横方向に ' + (p.scrollWidth - p.clientWidth) + 'px はみ出しています' });
  });

  return { pages: pages.length, problems: problems };
};

window.addEventListener('load', function () {
  setTimeout(function () {
    var el = document.createElement('div');
    el.id = '__checkresult';
    // --dump-dom で安全に取り出せるよう base64 にする
    el.textContent = btoa(unescape(encodeURIComponent(JSON.stringify(window.__check()))));
    document.body.appendChild(el);
  }, 400);
});
</script>
</body>"""


def expand_print_css(html: str) -> str:
    """@media print { ... } の中身を展開して常時適用にする（PDF生成時と同じ描画条件にする）。"""
    key = "@media print"
    out = html
    while True:
        i = out.find(key)
        if i == -1:
            break
        j = out.index("{", i)
        depth, k = 0, j
        while True:
            if out[k] == "{":
                depth += 1
            elif out[k] == "}":
                depth -= 1
                if depth == 0:
                    break
            k += 1
        out = out[:i] + out[j + 1:k] + out[k + 1:]
    return out


def run_chrome(args):
    return subprocess.run([CHROME] + args, capture_output=True, text=True, timeout=180)


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    src = os.path.abspath(sys.argv[1])
    want_pdf = "--pdf" in sys.argv

    if not os.path.exists(src):
        print(f"ファイルが見つかりません: {src}", file=sys.stderr)
        sys.exit(1)
    if not os.path.exists(CHROME):
        print(f"Google Chrome が見つかりません: {CHROME}", file=sys.stderr)
        sys.exit(1)

    html = open(src, encoding="utf-8").read()
    checked = expand_print_css(html)
    if "</body>" in checked:
        checked = checked.replace("</body>", CHECKER_JS, 1)
    else:
        checked += CHECKER_JS

    # 画像の相対パスを保つため、元ファイルと同じディレクトリに一時ファイルを置く
    d = os.path.dirname(src)
    fd, tmp = tempfile.mkstemp(suffix=".html", prefix="_checkreport_", dir=d)
    os.close(fd)
    try:
        open(tmp, "w", encoding="utf-8").write(checked)
        res = run_chrome([
            "--headless=new", "--disable-gpu", "--hide-scrollbars",
            "--virtual-time-budget=15000", "--window-size=794,1123",
            "--dump-dom", "file://" + tmp,
        ])
        m = re.search(r'id="__checkresult">([A-Za-z0-9+/=]*)<', res.stdout)
        if not m:
            print("判定結果を取得できませんでした（ページの読み込みに失敗した可能性があります）", file=sys.stderr)
            sys.exit(2)
        data = json.loads(base64.b64decode(m.group(1)).decode("utf-8"))
    finally:
        os.remove(tmp)

    print(f"対象: {os.path.basename(src)}")
    print(f"ページ数: {data['pages']}")
    print()

    problems = data["problems"]
    if problems:
        print(f"崩れ {len(problems)} 件")
        for p in problems:
            where = f"P{p['page']}" if p.get("page") else "全体"
            print(f"  [{where}] {p['msg']}")
    else:
        print("崩れは見つかりませんでした。")

    exit_code = 1 if problems else 0

    if want_pdf:
        print()
        out_pdf = os.path.splitext(src)[0] + ".pdf"
        run_chrome([
            "--headless=new", "--disable-gpu", "--no-pdf-header-footer",
            "--virtual-time-budget=15000",
            "--print-to-pdf=" + out_pdf, "file://" + src,
        ])
        if os.path.exists(out_pdf):
            blob = open(out_pdf, "rb").read()
            n = len(re.findall(rb"/Type\s*/Page[^s]", blob))
            size = len(blob) / 1024 / 1024
            print(f"PDF: {os.path.basename(out_pdf)}  {n}ページ / {size:.2f}MB")
            if n != data["pages"]:
                print(f"  ★ 想定は {data['pages']}ページですが {n}ページになっています")
                exit_code = 1
        else:
            print("PDFの生成に失敗しました")
            exit_code = 1

    sys.exit(exit_code)


if __name__ == "__main__":
    main()
