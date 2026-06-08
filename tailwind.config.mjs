/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: '#103366', // メインカラー（見出し・ヘッダー帯・バッジ）
        pink: '#E43172', // CTAボタン・アクセント（主）
        pinkAlt: '#F00A5F', // ピンク明（強調・ホバー等）
        slate: '#3A4048', // ダークスレート（補助見出し・帯）
        gold: '#C8A951', // リボン装飾（実績バッジ）
        ink: '#333333', // 本文テキスト
        gray: '#797979', // サブテキスト
        paper: '#FFFFFF', // 背景
        mist: '#EBEEF2', // セクション背景（薄い青グレー）
        sky: '#EAF3FB', // ヒーロー背景グラデ上端
      },
      fontFamily: {
        sans: ['"Noto Sans JP"', 'system-ui', 'sans-serif'],
        display: ['"Paytone One"', '"Noto Sans JP"', 'sans-serif'],
        grotesk: ['"Space Grotesk"', '"Noto Sans JP"', 'sans-serif'],
      },
      maxWidth: {
        content: '1150px',
      },
      lineHeight: {
        relaxed: '1.8',
      },
    },
  },
  plugins: [],
};
