#!/usr/bin/env python3
"""
改善文辞書（report-snippets.json）が診断ロジックと一致しているか照合する。

    ./scripts/verify-snippets.py

functions/api/check.ts の issues.push() の文字列と、辞書のキーを突き合わせる。
指摘文を変更すると辞書が引けなくなり、レポートから該当項目が欠落するため、
check.ts を触ったら必ず実行すること。
"""

import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHECK_TS = os.path.join(ROOT, "functions/api/check.ts")
SNIPPETS = os.path.join(ROOT, "scripts/report-snippets.json")


def main():
    ts = open(CHECK_TS, encoding="utf-8").read()
    issues = set(re.findall(r"issues\.push\('([^']+)'\)", ts))

    data = json.load(open(SNIPPETS, encoding="utf-8"))
    keys = set(data["snippets"].keys())

    missing = sorted(issues - keys)   # 診断は出すが辞書に無い＝レポートから抜け落ちる
    extra = sorted(keys - issues)     # 辞書にあるが診断は出さない＝使われない

    print(f"診断ロジックの指摘: {len(issues)}件")
    print(f"辞書の項目        : {len(keys)}件")
    print()

    if missing:
        print(f"★ 辞書に無い指摘 {len(missing)}件（レポートから抜け落ちます）")
        for m in missing:
            print(f"   {m}")
        print()
    if extra:
        print(f"△ 診断が出さない項目 {len(extra)}件（古い可能性があります）")
        for e in extra:
            print(f"   {e}")
        print()

    # 各項目に必要なフィールドが揃っているか
    required = ("axis", "title", "why", "how", "difficulty", "effect")
    weights = data["axisWeights"]
    broken = []
    for k, v in data["snippets"].items():
        lack = [f for f in required if not v.get(f)]
        if lack:
            broken.append((k, "項目不足: " + ", ".join(lack)))
        elif v["axis"] not in weights:
            broken.append((k, f"軸が不正: {v['axis']}"))
    if broken:
        print(f"★ 内容に不備のある項目 {len(broken)}件")
        for k, msg in broken:
            print(f"   {msg} — {k}")
        print()

    if not missing and not extra and not broken:
        print("一致しています。")
        sys.exit(0)
    sys.exit(1)


if __name__ == "__main__":
    main()
