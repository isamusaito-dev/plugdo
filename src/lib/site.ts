// サイト全体で共有する定数・運営会社情報・構造化データのソース。
// Seo.astro / llms.txt / rss.xml / 各ページの JSON-LD から参照する。

export const SITE_URL =
  import.meta.env.PUBLIC_SITE_URL || 'https://plugdo.jp';

export const SITE_NAME = 'Plugdo';
export const SITE_SHORT_NAME = 'plugdo';

/** トップで使う一文の説明（meta description 等のベース） */
export const SITE_TAGLINE = 'ホームページを、働かせる。';
export const SITE_DESCRIPTION =
  '作ったきりのホームページを、毎月の更新・改善とAI検索（AIO）対応で、問い合わせと採用につなげる月額制Web運用サービス。Web担当者がいない中小企業・小規模事業者のためのWebパートナー。';

/** 運営会社情報（about ページと一致させること） */
export const COMPANY = {
  legalName: '株式会社ハンチス',
  alternateName: 'HUNCHES',
  foundingDate: '2024-01-16',
  founder: '齋藤 勇',
  email: 'info@hunches.co.jp',
  areaServed: 'JP',
  /** 事業として詳しい領域（knowsAbout） */
  knowsAbout: [
    'ホームページ運用',
    'Webサイト改善',
    'SEO（検索エンジン最適化）',
    'AIO（AI検索最適化・生成AI検索対策）',
    'コンテンツマーケティング',
    '中小企業のWeb活用',
  ],
} as const;

/** OGP のデフォルト画像（public/ogp-default.png は 1200x630） */
export const OG_IMAGE_DEFAULT = '/ogp-default.png';
export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;

/** ブランドカラー（theme-color 用） */
export const THEME_COLOR = '#103366';

/** 絶対URLを組み立てる */
export const absUrl = (path: string): string =>
  path.startsWith('http') ? path : new URL(path, SITE_URL).href;

/** 全ページ共通：運営会社（ProfessionalService = Organization のサブタイプ） */
export const organizationLd = {
  '@context': 'https://schema.org',
  '@type': 'ProfessionalService',
  '@id': `${SITE_URL}/#organization`,
  name: COMPANY.legalName,
  alternateName: COMPANY.alternateName,
  url: SITE_URL,
  email: COMPANY.email,
  foundingDate: COMPANY.foundingDate,
  founder: { '@type': 'Person', name: COMPANY.founder },
  description:
    'webサイトの企画・制作・運営、webサイト/マーケティング/ブランドのコンサルティングを行う企業。Web運用サービス plugdo を運営。',
  sameAs: [
    'https://www.instagram.com/hunches_0116/',
    'https://www.tiktok.com/@hunches_',
    'https://toukibo.ai-con.lawyer/search-service/result/5030001158268',
  ],
  brand: { '@type': 'Brand', name: 'Plugdo' },
  logo: {
    '@type': 'ImageObject',
    url: absUrl('/ogp-default.png'),
  },
  image: absUrl(OG_IMAGE_DEFAULT),
  areaServed: { '@type': 'Country', name: 'Japan' },
  knowsAbout: COMPANY.knowsAbout,
  slogan: SITE_TAGLINE,
  priceRange: '¥9,800/月〜¥298,000',
  hasOfferCatalog: {
    '@type': 'OfferCatalog',
    name: 'plugdo サービス',
    itemListElement: [
      { '@type': 'Offer', name: 'ホームページリニューアル ライト', price: '198000', priceCurrency: 'JPY', description: '5ページ構成・スマホ対応・基本SEO・お問い合わせフォーム・公開作業（税込）' },
      { '@type': 'Offer', name: 'ホームページリニューアル スタンダード', price: '298000', priceCurrency: 'JPY', description: '10ページ構成・オリジナルデザイン・CMS導入・構造化データ/AI検索対応・公開作業（税込）' },
      { '@type': 'Offer', name: 'Web運用 ライト', price: '9800', priceCurrency: 'JPY', description: 'サーバー・ドメイン・SSL管理、セキュリティ更新、修正月2回まで（月額・税込）' },
      { '@type': 'Offer', name: 'Web運用 スタンダード', price: '19800', priceCurrency: 'JPY', description: '修正回数無制限、月次アクセスレポート、改善提案月1件、入稿代行（月額・税込）' },
    ],
  },
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'customer support',
    email: COMPANY.email,
    availableLanguage: ['Japanese'],
  },
};

/** 全ページ共通：サービス提供者（Person） */
export const personLd = {
  '@context': 'https://schema.org',
  '@type': 'Person',
  '@id': `${SITE_URL}/#founder`,
  name: '齋藤 勇',
  jobTitle: '代表取締役 / UI・UXデザイナー',
  worksFor: { '@id': `${SITE_URL}/#organization` },
  knowsAbout: [
    'UI/UXデザイン',
    'ユーザーリサーチ',
    'デザインシステム構築',
    'フロントエンド実装',
    'Web運用・改善',
    'SEO/AIO対策',
  ],
};

/** 全ページ共通：WebSite（サイト識別） */
export const websiteLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': `${SITE_URL}/#website`,
  name: SITE_NAME,
  alternateName: SITE_SHORT_NAME,
  url: SITE_URL,
  inLanguage: 'ja-JP',
  publisher: { '@id': `${SITE_URL}/#organization` },
  description: SITE_DESCRIPTION,
};
