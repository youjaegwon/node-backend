import { XMLParser } from 'fast-xml-parser';

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });

const FEEDS = [
  { id: 'coindesk', name: 'CoinDesk', url: 'https://www.coindesk.com/arc/outboundfeeds/rss/' },
  { id: 'cointelegraph', name: 'Cointelegraph', url: 'https://cointelegraph.com/rss' },
  { id: 'coindeskkorea', name: '코인데스크 코리아', url: 'https://www.coindeskkorea.com/rss/allArticleFeed.xml' },
];

let cache = { ts: 0, data: [] };
const TTL_MS = 5 * 60 * 1000;

async function fetchText(url, signal) {
  const res = await fetch(url, { signal, headers: { 'User-Agent': 'NewsFetcher/1.1' } });
  if (!res.ok) throw new Error(`Fetch failed ${res.status}`);
  return await res.text();
}

function mapRssItem(feedName, item) {
  const title = item.title?.toString?.() || '';
  const link = (item.link?.href || item.link || '').toString?.() || '';
  const dateStr = item.pubDate || item.published || item.updated || new Date().toISOString();
  const date = new Date(dateStr);

  return {
    title: title.trim(),
    link: link.trim(),
    source: feedName,
    publishedAt: date.toISOString(),
  };
}

export async function getNewsList() {
  const now = Date.now();
  if (cache.data.length && now - cache.ts < TTL_MS) return cache.data;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);

  try {
    const results = await Promise.allSettled(
      FEEDS.map(async (f) => {
        const xml = await fetchText(f.url, controller.signal);
        const json = parser.parse(xml);
        const items = json?.rss?.channel?.item || json?.feed?.entry || [];
        const normalized = (Array.isArray(items) ? items : [items])
          .slice(0, 15)
          .map((it) => mapRssItem(f.name, it))
          .filter((n) => n.title && n.link);
        return normalized;
      })
    );

    const merged = results.filter((r) => r.status === 'fulfilled').flatMap((r) => r.value);
    merged.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

    cache = { ts: now, data: merged };
    return cache.data;
  } finally {
    clearTimeout(timer);
  }
}
