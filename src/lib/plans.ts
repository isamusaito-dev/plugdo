// 料金プランの元データ。price / PriceTable で共有する。
export type Feature = { label: string; note?: string };
export type FeatureGroup = { category: string; items: Feature[] };

export type Plan = {
  id: 'keep' | 'grow' | 'partner';
  name: string;
  tagline: string;
  commit: string;      // 何にコミットするか（メイン）
  commitNote: string;  // コミットの補足
  price: string;
  priceNote: string;
  hours: string;       // 想定工数
  aio: boolean;
  highlight?: boolean;
  groups: FeatureGroup[];
};

export const plans: Plan[] = [
  {
    id: 'keep',
    name: 'Keep',
    tagline: '放置状態から抜け出す',
    commit: 'サイトを健康に保つ',
    commitNote: 'まず更新を止めないことが目標',
    price: '¥30,000',
    priceNote: '〜 / 月（税別）',
    hours: '3〜4h / 月',
    aio: false,
    groups: [
      {
        category: '提供内容',
        items: [
          { label: '月1回 更新代行', note: 'テキスト・画像の差し替えなど' },
          { label: '表示・動作チェック' },
          { label: '簡易アクセスレポート' },
          { label: 'Slack 相談・質問 無制限' },
        ],
      },
    ],
  },
  {
    id: 'grow',
    name: 'Grow',
    tagline: '改善して、増やす',
    commit: '問い合わせを増やす',
    commitNote: '先行指標に責任',
    price: '¥80,000',
    priceNote: '〜 / 月（税別）',
    hours: '6〜8h / 月',
    aio: true,
    highlight: true,
    groups: [
      {
        category: '提供内容',
        items: [
          { label: '毎月の改善実装', note: 'デザイン・導線・コンテンツ' },
          { label: '改善提案レポート', note: '優先度つきで何を直すか明示' },
          { label: 'AIO対応', note: 'JSON-LD・構造最適化' },
          { label: '月1回 オンラインMTG' },
          { label: 'Slack 相談・質問 無制限' },
        ],
      },
    ],
  },
  {
    id: 'partner',
    name: 'Partner',
    tagline: '成果まで、一緒に',
    commit: '事業の成果を一緒に追う',
    commitNote: '共同目標＋説明責任',
    price: '¥150,000',
    priceNote: '〜 / 月（税別）',
    hours: '12〜15h / 月',
    aio: true,
    groups: [
      {
        category: '提供内容',
        items: [
          { label: 'サイト全体のデザイン主導' },
          { label: '採用・AIO 本格対応' },
          { label: '戦略づくり', note: '問い合わせ・採用の数値目標を一緒に設定' },
          { label: '優先対応' },
          { label: '隔週 オンラインMTG' },
          { label: 'Slack 相談・質問 無制限' },
        ],
      },
    ],
  },
];

// 比較テーブル用
export type CompareRow = {
  category: string;
  label: string;
  keep: string | boolean;
  grow: string | boolean;
  partner: string | boolean;
};

export const compareRows: CompareRow[] = [
  { category: '更新・運用', label: '更新代行',           keep: '月1回',     grow: '毎月（柔軟）',    partner: '優先対応' },
  { category: '更新・運用', label: 'アクセスレポート',   keep: '簡易',      grow: '改善提案つき',    partner: '改善提案つき' },
  { category: '更新・運用', label: '表示・動作チェック', keep: true,        grow: true,              partner: true },
  { category: '改善',       label: '改善実装',           keep: false,       grow: true,              partner: true },
  { category: '改善',       label: '改善提案レポート',   keep: false,       grow: true,              partner: true },
  { category: '戦略',       label: '数値目標の共同設定', keep: false,       grow: false,             partner: true },
  { category: '戦略',       label: '戦略づくり',         keep: false,       grow: false,             partner: true },
  { category: 'AIO対応',    label: 'AIO対応',            keep: false,       grow: '標準対応',         partner: '本格対応' },
  { category: 'MTG・サポート', label: 'オンラインMTG',   keep: false,       grow: '月1回',           partner: '隔週' },
  { category: 'MTG・サポート', label: 'Slack相談・質問', keep: '無制限',    grow: '無制限',          partner: '無制限' },
];
