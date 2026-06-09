// /blog/rss.xml — ブログのRSSフィード。購読・コンテンツ配信・AIクローラー向け。
import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { SITE_NAME, SITE_DESCRIPTION } from '../../lib/site';
import { getBlogs } from '../../lib/microcms';
import { sampleBlogs } from '../../lib/sampleData';

export async function GET(context: APIContext) {
  const res = await getBlogs({ limit: 100 });
  const blogs = res.contents.length ? res.contents : sampleBlogs;

  return rss({
    title: `${SITE_NAME} ブログ`,
    description: SITE_DESCRIPTION,
    site: context.site ?? 'https://plugdo.jp',
    items: blogs.map((post) => ({
      title: post.title,
      description: post.description,
      pubDate: new Date(post.publishedAt),
      link: `/blog/${post.slug}`,
      categories: post.category ? [post.category.name] : undefined,
    })),
    customData: '<language>ja-jp</language>',
  });
}
