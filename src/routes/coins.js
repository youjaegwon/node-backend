import { Router } from 'express';

const r = Router();

// 간단 캐시(15초)
let cache = { at: 0, data: [] };
const TTL = 15 * 1000;

async function jfetch(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/**
 * @openapi
 * /api/coins:
 *   get:
 *     summary: 업비트 KRW 마켓 코인 목록 (정렬/제한 지원)
 *     tags: [Coins]
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [gainers, losers, trending, volume]
 *         description: |
 *           gainers=등락률 내림차순, losers=등락률 오름차순,
 *           trending=24h 거래대금 내림차순, volume=24h 거래량 내림차순.
 *           미지정은 trending.
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 200 }
 *         description: 반환 개수(최대 200). 미지정 시 전체.
 *     responses:
 *       200:
 *         description: OK
 */
r.get('/', async (req, res) => {
  try {
    const type = String(req.query.type || 'trending').toLowerCase();
    const rawLimit = parseInt(String(req.query.limit || ''), 10);
    const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(200, rawLimit)) : null;

    // 캐시 사용
    if (Date.now() - cache.at < TTL && cache.data.length) {
      const items = sortAndSlice(cache.data, type, limit);
      return res.json({ ok: true, items });
    }

    // 1) KRW-* 마켓
    const marketsAll = await jfetch('https://api.upbit.com/v1/market/all?isDetails=false');
    const krwMarkets = marketsAll
      .filter(m => m.market?.startsWith('KRW-'))
      .map(m => ({
        market: m.market,
        nameKo: m.korean_name,
        nameEn: m.english_name,
        symbol: m.market.split('-')[1],
      }));

    // 2) 티커 일괄 조회(50개씩)
    const size = 50;
    const chunks = [];
    for (let i = 0; i < krwMarkets.length; i += size) chunks.push(krwMarkets.slice(i, i + size));

    const tickers = [];
    for (const c of chunks) {
      const q = c.map(x => x.market).join(',');
      const t = await jfetch(`https://api.upbit.com/v1/ticker?markets=${encodeURIComponent(q)}`);
      tickers.push(...t);
    }

    // 3) 병합
    const merged = krwMarkets.map(info => {
      const t = tickers.find(x => x.market === info.market);
      if (!t) return { ...info, price: null, change: null, changeRate: null, volume24h: null, value24h: null };
      return {
        ...info,
        price: t.trade_price ?? null,
        change: t.signed_change_price ?? null,
        changeRate: typeof t.signed_change_rate === 'number'
          ? Number((t.signed_change_rate * 100).toFixed(2))
          : null,
        volume24h: t.acc_trade_volume_24h ?? null,
        value24h: t.acc_trade_price_24h ?? null,
      };
    });

    cache = { at: Date.now(), data: merged };

    const items = sortAndSlice(merged, type, limit);
    res.json({ ok: true, items });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, code: 'E_COINS', message: '코인 목록 조회 실패' });
  }
});

function sortAndSlice(list, type, limit) {
  const arr = [...list];
  switch (type) {
    case 'gainers':
      arr.sort((a, b) => (b.changeRate ?? -999) - (a.changeRate ?? -999));
      break;
    case 'losers':
      arr.sort((a, b) => (a.changeRate ?? 999) - (b.changeRate ?? 999));
      break;
    case 'volume':
      arr.sort((a, b) => (b.volume24h ?? -1) - (a.volume24h ?? -1));
      break;
    case 'trending':
    default:
      arr.sort((a, b) => (b.value24h ?? -1) - (a.value24h ?? -1));
      break;
  }
  return limit ? arr.slice(0, limit) : arr;
}

export default r;
