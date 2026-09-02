import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';

const SITE_URL = process.env.PUBLIC_SITE_URL || 'https://plugdo.jp';

// https://astro.build/config
export default defineConfig({
  site: SITE_URL,
  output: 'static',
  trailingSlash: 'always',
  integrations: [
    tailwind(),
    sitemap({
      // noindex のページはサイトマップにも載せない
      // （/thanks/ は広告のコンバージョン計測用で、検索から来られると困る）
      filter: (page) => !page.includes('/cases/') && !page.includes('/thanks/'),
    }),
  ],
});
