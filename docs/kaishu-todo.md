# サイト全体改修 未確定事項・TODO一覧

作成日: 2026-07-07（改修実装完了時点）

## 要確認（ビジネス判断待ち）

1. **ノエクリ事例の掲載許可**
   - [index.astro](../src/pages/index.astro) の `SHOW_NOEKURI_CASE = false` で非表示実装済み
   - 許可取得後: フラグを `true` にし、課題・施策・成果（数値）・スクリーンショットを確定文言で記載

2. **正式価格の確定**
   - 現在は指示書の仮確定値で実装: リニューアル ¥198,000 / ¥398,000（税込）、運用 ¥9,800 / ¥19,800（税込・月）
   - 変更時の修正箇所: renewal.astro / care.astro / index.astro / Hero.astro / ServiceCards.astro / site.ts（hasOfferCatalog・priceRange）/ llms.txt.ts / web-staff-outsourcing.astro

3. **結果メール末尾のアンケートURL（Van Westendorp 価格調査）**
   - 結果メールは自動送信ではなく Formspree リードへの手動返信運用のため、**返信テンプレート（サイト外）に追記が必要**
   - [check.astro](../src/pages/check.astro) の副CTA箇所に TODO コメントあり。アンケート設置後にURLを確定

4. **OGP画像の新デザイン**
   - TOP: `/ogp-default.png` を旧ポジショニングのまま流用中 → 新コピー（リニューアル＋運用）で差し替え推奨
   - /renewal・/care: 専用OGP画像なし（デフォルト使用）→ 必要なら制作
   - /check: `/og-check.png` は既存のまま使用可

## 実装上の申し送り

5. **TimeCompressSection.astro は新規作成**
   - 指示書は「既存コンポーネントの移設・文言は現行のまま」だったが、当リポジトリに該当コンポーネント・該当文言（PDCA 30日→7日）が存在しなかったため新規作成
   - 文言の正本が別にある場合は [TimeCompressSection.astro](../src/components/TimeCompressSection.astro) を差し替えること

6. **月次レポートの実物サンプル画像**
   - /care「運用の型」セクションはタイポグラフィ構成で実装（AI生成モック不使用の方針に従う）
   - 実物レポートのスクリーンショットが用意でき次第、[care.astro](../src/pages/care.astro) の TODO 箇所に差し込む

7. **特定商取引法ページ**
   - デザイン指針 D-3 で「フッターに特商法ページへのリンク」とあるが、当サイトに特商法ページが存在しないため未対応
   - ページ新設の要否を確認（BtoBサービスのため法的必須ではない可能性が高いが、信頼情報として推奨）

8. **リニューアル契約者の「運用ライト3ヶ月無料」**
   - /renewal に記載済み。契約書・請求フローへの反映は別途

9. **「診断→48時間以内に反映」等の運用SLA**
   - /care に「原則48時間以内に反映」、FAQ・llms.txt に「申し込みから5営業日以内に診断レポート提出・翌月から改善開始」と記載
   - 実運用と乖離がないか要確認（乖離があれば文言修正）

10. **Lighthouse Performance 計測**
    - ローカルビルドは軽量（静的HTML・追加JSなし）だが、本番デプロイ後に Lighthouse で90以上を実測確認すること
    - FV画像 `fv001.png`（1672×941）はwidth/height未指定 → 計測時にCLS指摘が出た場合は属性追加

## 検収チェックリスト結果（実装時点）

- [x] /renewal /care が375px/1280pxで崩れなし（横スクロールゼロ・タップ領域48px確認済み）
- [x] /check の採点ロジック（functions/api/check.ts）に変更なし（git diff で確認）
- [x] スコア59→/renewal、60→/care の分岐動作を実フローで確認済み
- [x] /price → /renewal 301 を public/_redirects に設定（本番デプロイ後に実挙動確認のこと）
- [x] 「社外Web担当」「Keep」「Grow」「Partner」のビルド出力残存ゼロ（ブログ過去記事除く）
- [x] 新規コンポーネントは kaishu-design-tokens.md の値のみ使用
- [x] D-2禁止リスト違反なし（新規追加分にグラデーション・グロー・絵文字アイコン・装飾ナンバリングなし）
- [x] 価格数字に tabular-nums 適用、オプション表は右揃え
- [x] prefers-reduced-motion でアニメーション無効化（global.css に追加）
- [ ] Lighthouse Performance 90以上（本番デプロイ後に実測）
- [ ] 全フォーム送信テスト（Formspree 実送信は本番確認とする。フォームのマークアップ・送信先は未変更）
