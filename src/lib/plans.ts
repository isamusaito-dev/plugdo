// 料金プランの元データ（仕様書 §5）。price / service / トップで共有する。
export type Feature = { label: string; note?: string };
export type FeatureGroup = { category: string; items: Feature[] };

export type Plan = {
  id: string;
  name: string;
  tagline: string; // 一言キャッチ
  target: string; // 対象（サブテキスト）
  forWho: string; // こんな方に（1文）
  price: string;
  priceNote: string;
  aio: boolean;
  highlight?: boolean;
  groups: FeatureGroup[];
};

export const plans: Plan[] = [
  {
    id: 'basic',
    name: 'Basic',
    tagline: 'まず動かす',
    target: '更新・運用サポート中心',
    forWho: '「とにかくサイトを止めず、最新の状態に保ちたい」方に。',
    price: '¥30,000',
    priceNote: '〜 / 月（税別）',
    aio: false,
    groups: [
      {
        category: '更新・運用',
        items: [
          { label: '月1回のコンテンツ更新代行', note: 'テキスト・画像の差し替えなど' },
          { label: '月次アクセスレポート送付' },
          { label: '軽微な修正・差し替え対応' },
        ],
      },
      {
        category: 'サポート',
        items: [
          { label: 'メール相談（月3件まで）' },
        ],
      },
      {
        category: 'AI検索（AIO）対応',
        items: [
          { label: 'AIO対応なし' },
        ],
      },
    ],
  },
  {
    id: 'growth',
    name: 'Growth',
    tagline: '改善して増やす',
    target: '改善提案 + 実装 + AIO対応',
    forWho: '「問い合わせを増やしたい。何を改善すればいいか教えてほしい」方に。',
    price: '¥60,000',
    priceNote: '〜 / 月（税別）',
    aio: true,
    highlight: true,
    groups: [
      {
        category: '更新・運用',
        items: [
          { label: '月2回のコンテンツ更新代行' },
          { label: '月次アクセスレポート送付' },
          { label: '改善施策の実装', note: 'ページ修正・CTAの最適化など' },
        ],
      },
      {
        category: '改善・コンテンツ',
        items: [
          { label: '月次改善提案レポート', note: '優先度つきで何を直すか明示' },
          { label: 'ブログ記事制作 月1本' },
          { label: 'タイトル・メタディスクリプション最適化' },
        ],
      },
      {
        category: 'AI検索（AIO）対応',
        items: [
          { label: '構造化データ（JSON-LD）整備' },
          { label: 'AIクローラー向けサイト構造の最適化' },
        ],
      },
    ],
  },
  {
    id: 'partner',
    name: 'Partner',
    tagline: '戦略から一緒に',
    target: '戦略立案 + フル対応 + 月次MTG',
    forWho: '「サイトをビジネスの核に育てたい。採用・問い合わせ両方で成果を出したい」方に。',
    price: '¥100,000',
    priceNote: '〜 / 月（税別）',
    aio: true,
    groups: [
      {
        category: '更新・運用',
        items: [
          { label: '更新対応 無制限', note: '緊急対応も含む' },
          { label: '月次アクセスレポート送付' },
          { label: '採用・問い合わせ導線の設計・実装' },
        ],
      },
      {
        category: '戦略・改善',
        items: [
          { label: '月次オンラインMTG（60分）' },
          { label: 'Web戦略の設計・立案' },
          { label: 'ブログ記事制作 月2〜3本' },
          { label: '競合サイト分析レポート' },
        ],
      },
      {
        category: 'AI検索（AIO）対応',
        items: [
          { label: 'AIO本格対応', note: 'Growthの内容 + 継続的な改善' },
          { label: 'ターゲットキーワード戦略の立案' },
          { label: 'AI検索への引用状況モニタリング' },
        ],
      },
    ],
  },
];

// 比較テーブル用フラットフィーチャー（PriceTable の comparison variant で使用）
export type CompareRow = {
  category: string;
  label: string;
  basic: string | boolean;
  growth: string | boolean;
  partner: string | boolean;
};

export const compareRows: CompareRow[] = [
  // 更新・運用
  { category: '更新・運用', label: 'コンテンツ更新代行', basic: '月1回', growth: '月2回', partner: '無制限' },
  { category: '更新・運用', label: '月次アクセスレポート', basic: true, growth: true, partner: true },
  { category: '更新・運用', label: '改善施策の実装', basic: false, growth: true, partner: true },
  { category: '更新・運用', label: '採用・問い合わせ導線の設計', basic: false, growth: false, partner: true },
  // 改善・コンテンツ
  { category: '改善・コンテンツ', label: '月次改善提案レポート', basic: false, growth: true, partner: true },
  { category: '改善・コンテンツ', label: 'ブログ記事制作', basic: false, growth: '月1本', partner: '月2〜3本' },
  { category: '改善・コンテンツ', label: 'タイトル・メタ最適化', basic: false, growth: true, partner: true },
  { category: '改善・コンテンツ', label: '競合サイト分析', basic: false, growth: false, partner: true },
  // AI検索（AIO）
  { category: 'AI検索（AIO）', label: '構造化データ整備', basic: false, growth: true, partner: true },
  { category: 'AI検索（AIO）', label: 'AIクローラー対応', basic: false, growth: true, partner: true },
  { category: 'AI検索（AIO）', label: 'キーワード戦略・引用モニタリング', basic: false, growth: false, partner: true },
  // サポート
  { category: 'サポート・MTG', label: 'メール相談', basic: '月3件', growth: '無制限', partner: '無制限' },
  { category: 'サポート・MTG', label: '月次オンラインMTG', basic: false, growth: false, partner: '月1回（60分）' },
];
