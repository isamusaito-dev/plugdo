#!/bin/bash
# 診断レポート用のサイトキャプチャ。
#
#   ./scripts/capture-site.sh <URL> <出力先ディレクトリ>
#
# ヘッドレスChromeでPC幅とスマホ幅の2枚を撮る。追加インストールは不要。
#
# スマホ幅について：
#   viewport 未設定のサイトは、実機では「980px相当で描画されてから画面幅に縮小」される。
#   ＝文字が極小になる。これを再現するため、スマホ用は 980px 幅で撮っておき、
#   レポート側でスマホ枠に縮めて表示する。撮った画像をそのまま縮小表示すれば実機と同じ見え方になる。
#   viewport 設定済みのサイトを撮る場合は MOBILE_W=390 を指定すること。

set -euo pipefail

CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
URL="${1:-}"
OUTDIR="${2:-./captures}"
MOBILE_W="${MOBILE_W:-980}"
MOBILE_H="${MOBILE_H:-1500}"
DESKTOP_W="${DESKTOP_W:-1280}"
DESKTOP_H="${DESKTOP_H:-900}"

if [ -z "$URL" ]; then
  echo "usage: $0 <URL> [outdir]" >&2
  exit 1
fi
if [ ! -x "$CHROME" ]; then
  echo "Google Chrome が見つかりません: $CHROME" >&2
  exit 1
fi

mkdir -p "$OUTDIR"

shot() { # shot <出力パス> <幅> <高さ>
  "$CHROME" \
    --headless=new \
    --disable-gpu \
    --hide-scrollbars \
    --force-device-scale-factor=2 \
    --virtual-time-budget=8000 \
    --window-size="$2,$3" \
    --screenshot="$1" \
    "$URL" >/dev/null 2>&1
}

echo "撮影中: $URL"
shot "$OUTDIR/desktop.png" "$DESKTOP_W" "$DESKTOP_H"
echo "  PC幅   (${DESKTOP_W}x${DESKTOP_H}) -> $OUTDIR/desktop.png"
shot "$OUTDIR/mobile.png" "$MOBILE_W" "$MOBILE_H"
echo "  スマホ幅 (${MOBILE_W}x${MOBILE_H}) -> $OUTDIR/mobile.png"

echo
echo "レポートに埋め込む場合（自己完結HTML用のbase64）:"
echo "  base64 -i $OUTDIR/desktop.png | pbcopy"
