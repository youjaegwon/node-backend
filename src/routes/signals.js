import { ema, rsi, macd } from '../lib/indicators.js';
import { jfetch } from '../lib/jfetch.js';  // ✅ 수정된 부분 (default → named import)

const UPBIT = 'https://api.upbit.com/v1';

// 간단 캐시 (메모리, 30초)
const cache = new Map();
const getCache = (k, ttlMs=30000) => {
  const v = cache.get(k);
  if (!v) return null;
  if (Date.now() - v.t > ttlMs) { cache.delete(k); return null; }
  return v.d;
};
const setCache = (k, d) => cache.set(k, { d, t: Date.now() });

async function getKrwMarkets() {
  const key = 'krw_markets';
  const hit = getCache(key, 5*60*1000);
  if (hit) return hit;
  const list = await jfetch(`${UPBIT}/market/all?isDetails=true`).catch(()=>[]);
  const krw = (list||[]).filter(m => m.market?.startsWith('KRW-'));
  setCache(key, krw);
  return krw;
}

async function getCandles(market, count=120, unit=5) {
  const key = `c:${unit}:${market}:${count}`;
  const hit = getCache(key);
  if (hit) return hit;
  const url = `${UPBIT}/candles/minutes/${unit}?market=${market}&count=${count}`;
  const rows = await jfetch(url).catch(()=>[]);
  const data = (rows||[]).slice().reverse();
  setCache(key, data);
  return data;
}

function scoreSignal(candles) {
  if (!candles || candles.length < 40) return { score: 0, reason: [] };

  const close = candles.map(x=> x.trade_price);
  const vol   = candles.map(x=> x.candle_acc_trade_volume);

  const ema20 = ema(close, 20);
  const rsi14 = rsi(close, 14);
  const { macd:macdLine, signal:sigLine } = macd(close,12,26,9);

  const lastClose = close.at(-1);
  const prevClose = close.at(-2) ?? lastClose;
  const priceUp   = lastClose > prevClose;

  const lastEma20 = ema20.at(-1) ?? lastClose;
  const aboveEma  = lastClose > lastEma20;

  const lastRsi   = rsi14.at(-1) ?? 50;
  const prevRsi   = rsi14.at(-2) ?? lastRsi;
  const rsiCrossUp30 = prevRsi < 30 && lastRsi >= 30;
  const rsiBull   = lastRsi >= 50 && lastRsi > prevRsi;

  const lastMacd  = macdLine.at(-1) ?? 0;
  const prevMacd  = macdLine.at(-2) ?? lastMacd;
  const lastSig   = sigLine.at(-1) ?? 0;
  const prevSig   = sigLine.at(-2) ?? lastSig;
  const macdCross = prevMacd <= prevSig && lastMacd > lastSig;

  const avgVol20  = vol.slice(-21,-1).reduce((a,b)=>a+b,0)/20 || 0;
  const volSurge  = (vol.at(-1)||0) > avgVol20 * 1.5;

  let score = 0;
  const reason = [];
  if (macdCross) { score += 30; reason.push('MACD 골든크로스'); }
  if (rsiCrossUp30) { score += 20; reason.push('RSI 30 상향돌파'); }
  if (rsiBull) { score += 10; reason.push('RSI 상승세'); }
  if (aboveEma) { score += 20; reason.push('종가 EMA20 상방'); }
  if (volSurge) { score += 20; reason.push('거래량 급증'); }
  if (priceUp) { score += 5; }

  return { score: Math.min(100, Math.round(score)), reason };
}

export default async function signalsRouter(req, res) {
  try {
    const limit   = Math.max(1, Math.min(20, Number(req.query.limit)||5));
    const minPrice= Number(req.query.minPrice ?? 50);
    const minVol  = Number(req.query.minVol ?? 0);

    const markets = await getKrwMarkets();
    const top = markets
      .filter(m => (m.market_warning!=='CAUTION'))
      .sort((a,b)=> (b.acc_trade_price_24h||0) - (a.acc_trade_price_24h||0))
      .slice(0, 60);

    const out = [];
    for (const m of top) {
      const candles = await getCandles(m.market, 120, 5);
      if (!candles?.length) continue;

      const last = candles.at(-1);
      if ((last.trade_price||0) < minPrice) continue;
      if ((last.candle_acc_trade_volume||0) < minVol) continue;

      const s = scoreSignal(candles);
      if (s.score <= 0) continue;

      const prev = candles.at(-2);
      const pct = prev ? (last.trade_price/prev.trade_price - 1) * 100 : 0;

      out.push({
        market: m.market,
        symbol: m.market.replace('KRW-',''),
        nameKo: m.korean_name,
        nameEn: m.english_name,
        price: last.trade_price,
        changeRate: Number(pct.toFixed(2)),
        score: s.score,
        reason: s.reason
      });
    }

    out.sort((a,b)=> b.score - a.score);
    res.json({ ok: true, items: out.slice(0, limit) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok:false, code:'E_SIGNALS', message:'시그널 계산 실패' });
  }
}
