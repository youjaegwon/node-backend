import { Router } from 'express';
import { enrichImages } from '../lib/og.js';
import { translateToKorean } from '../lib/translate.js';

const r = Router();

/**
 * @openapi
 * /news:
 *   get:
 *     summary: 코인 뉴스 (최대 N개)
 *     tags: [News]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, example: 10 }
 *     responses:
 *       200:
 *         description: 뉴스 목록
 */
r.get('/', async (req, res, next) => {
  try {
    const resp = await fetch('https://min-api.cryptocompare.com/data/v2/news/?lang=EN');
    const j = await resp.json();

    let items = (j.Data || []).slice(0, 20).map((n) => ({
      title: n.title,
      link: n.url,
      source: n.source,
      publishedAt: n.published_on
        ? new Date(n.published_on * 1000).toISOString()
        : new Date().toISOString(),
      image: n.imageurl || null,
    }));

    // 이미지 보완
    await enrichImages(items, 8);

    // 번역 (제목만)
    for (const it of items) {
      it.title_ko = await translateToKorean(it.title);
    }

    res.json({ ok: true, data: items });
  } catch (e) {
    next(e);
  }
});

export default r;
