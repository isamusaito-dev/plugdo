import { createClient } from 'microcms-js-sdk';
import type { MicroCMSImage, MicroCMSListResponse } from 'microcms-js-sdk';

const serviceDomain = import.meta.env.MICROCMS_SERVICE_DOMAIN;
const apiKey = import.meta.env.MICROCMS_API_KEY;

/**
 * microCMS の認証情報が設定されているか。
 * 未設定時はダミーデータでビルドできるよう、クライアント呼び出しをスキップする。
 */
export const hasMicroCMS = Boolean(serviceDomain && apiKey);

export const client = hasMicroCMS
  ? createClient({ serviceDomain, apiKey })
  : null;

// ---- 型定義（スキーマ定義書 §6 準拠） ----

export type BlogCategory = {
  id: string;
  name: string;
  slug: string;
};

export type Blog = {
  id: string;
  title: string;
  slug: string;
  eyecatch?: MicroCMSImage;
  category?: BlogCategory;
  body: string;
  description: string;
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
  revisedAt: string;
};

export type CaseMetric = {
  label: string;   // 指標名（例：月間問い合わせ数）
  before: string;  // 施策前の値（例：1〜2件）
  after: string;   // 施策後の値（例：9件）
};

export type Case = {
  id: string;
  title: string;
  slug: string;
  clientName: string;
  industry?: string;
  plan?: string;          // 利用プラン名（例：Growth）
  thumbnail?: MicroCMSImage;
  metrics?: CaseMetric[]; // 成果の数値ハイライト（最大3つ）
  challenge: string;
  solution: string;
  result: string;
  voice?: string;
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
  revisedAt: string;
};

// ---- 取得ヘルパー ----

type ListQueries = {
  limit?: number;
  offset?: number;
  filters?: string;
  orders?: string;
};

export async function getBlogs(
  queries: ListQueries = {}
): Promise<MicroCMSListResponse<Blog>> {
  if (!client) return emptyList<Blog>();
  try {
    const res = await client.getList<Blog>({
      endpoint: 'blogs',
      queries: { orders: '-publishedAt', limit: 100, ...queries },
    });
    const contents = res.contents.filter((p) => p.slug);
    return { ...res, contents, totalCount: contents.length };
  } catch {
    return emptyList<Blog>();
  }
}

export async function getBlogBySlug(slug: string): Promise<Blog | null> {
  if (!client) return null;
  try {
    const res = await client.getList<Blog>({
      endpoint: 'blogs',
      queries: { filters: `slug[equals]${slug}`, limit: 1 },
    });
    return res.contents[0] ?? null;
  } catch {
    return null;
  }
}

export async function getBlogCategories(): Promise<BlogCategory[]> {
  if (!client) return [];
  try {
    const res = await client.getList<BlogCategory>({
      endpoint: 'categories',
      queries: { limit: 100 },
    });
    return res.contents;
  } catch {
    return [];
  }
}

export async function getCases(
  queries: ListQueries = {}
): Promise<MicroCMSListResponse<Case>> {
  if (!client) return emptyList<Case>();
  try {
    const res = await client.getList<Case>({
      endpoint: 'case',
      queries: { orders: '-publishedAt', limit: 100, ...queries },
    });
    const contents = res.contents.filter((c) => c.slug);
    return { ...res, contents, totalCount: contents.length };
  } catch {
    return emptyList<Case>();
  }
}

export async function getCaseBySlug(slug: string): Promise<Case | null> {
  if (!client) return null;
  try {
    const res = await client.getList<Case>({
      endpoint: 'case',
      queries: { filters: `slug[equals]${slug}`, limit: 1 },
    });
    return res.contents[0] ?? null;
  } catch {
    return null;
  }
}

function emptyList<T>(): MicroCMSListResponse<T> {
  return { contents: [], totalCount: 0, offset: 0, limit: 0 };
}
