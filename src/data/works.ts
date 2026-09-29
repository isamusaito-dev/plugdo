/**
 * 制作実績。TOPの抜粋（/#works）と一覧ページ（/works/）の両方がここを読む。
 *
 * 増やすときは配列の先頭に足すだけでよい。TOPには featured: true のものが
 * 上から3件だけ出る。画像は public/works/ に置き、パスは / から書くこと。
 *
 * 画像の縦横比は揃っていなくてよい。カード側で4:3の枠に収めて全体を表示する
 * （チラシやバナーは切り取ると意味が変わるため、トリミングはしない）。
 */
export type Work = {
  /** 案件名。カードの見出しになる */
  name: string;
  /** 種別。カードの上に小さく出る */
  category: string;
  /** 2〜3文。何をどう作ったかを具体的に */
  desc: string;
  /** public/works/ 配下の画像 */
  image: string;
  /** 画像のalt。読み上げと検索のために案件が分かる文にする */
  alt: string;
  /** 公開サイトがある場合のみ。無い場合は「サイトを見る」が出ない */
  url?: string;
  /** TOPの抜粋に出すか */
  featured?: boolean;
};

export const works: Work[] = [
  {
    name: 'HUNCHES メンタリング',
    category: 'サービスサイト',
    desc: 'Webデザイナー向け伴走型サポートのサービスサイト。LINE導線と実績数値を軸にした構成で設計・制作。',
    image: '/works/exa_01.png',
    alt: 'HUNCHES メンタリングのサイト画面',
    url: 'https://hunches-mentoring.com/',
    featured: true,
  },
  {
    name: 'HIROHISA SATO DESIGN GALLERY',
    category: 'ポートフォリオサイト',
    desc: '建築デザイナー佐藤博久氏の作品ギャラリー。写真を主役にした静かなダークトーンで制作。',
    image: '/works/exa_02.png',
    alt: 'HIROHISA SATO DESIGN GALLERY のサイト画面',
    url: 'https://www.baku-ado.com/',
    featured: true,
  },
  {
    name: '東京人間ドッククリニック',
    category: '医療機関LP',
    desc: '人間ドックの集患LP。Web予約・LINE相談への導線を整え、不安を和らげる説明を重視した構成で制作。',
    image: '/works/exa_03.png',
    alt: '東京人間ドッククリニックのサイト画面',
    url: 'https://www.e-dock.jp/lp',
    featured: true,
  },
  {
    name: '株式会社Dessun様',
    category: '新規事業デザイン支援',
    desc: '新規事業の立ち上げを支援。リーンキャンバスで前提を整理し、ペルソナ、カスタマージャーニーマップ、クリエイティブブリーフまで作成。',
    image: '/works/dessun-newbiz.jpg',
    alt: '株式会社Dessun様の新規事業デザイン支援の制作物',
  },
  {
    name: '株式会社オルツ様',
    category: 'EC運用支援',
    desc: '楽天市場の店舗運用を支援。LP制作から、セールやクーポンのバナーまで幅広く担当。',
    image: '/works/alt-ec.jpg',
    alt: '株式会社オルツ様のEC運用支援の制作物',
  },
  {
    name: 'nenokoku.様',
    category: 'ブランディング',
    desc: '真夜中のチーズケーキ専門店。奥沢本店のグランドオープンのチラシをはじめ、店の世界観づくりを総合的に支援。',
    image: '/works/nenokoku-branding.jpg',
    alt: 'nenokoku.様のブランディングの制作物',
  },
];

/** TOPの抜粋用。上から3件。 */
export const featuredWorks = works.filter((w) => w.featured).slice(0, 3);
