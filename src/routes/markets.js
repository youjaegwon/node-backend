import { Router } from "express";
import { jfetch } from "../lib/jfetch.js";

const r = Router();

/* 환율: 다중 폴백 */
async function getUsdKrw() {
  // 1) Yahoo
  try {
    const y = await jfetch("https://query1.finance.yahoo.com/v7/finance/quote?symbols=USDKRW=X");
    const v = Number(y?.quoteResponse?.result?.[0]?.regularMarketPrice);
    if (v > 0) return v;
  } catch {}
  // 2) exchangerate.host
  try {
    const e = await jfetch("https://api.exchangerate.host/latest?base=USD&symbols=KRW");
    const v = Number(e?.rates?.KRW);
    if (v > 0) return v;
  } catch {}
  // 3) frankfurter.app
  try {
    const f = await jfetch("https://api.frankfurter.app/latest?from=USD&to=KRW");
    const v = Number(f?.rates?.KRW);
    if (v > 0) return v;
  } catch {}
  return 0;
}

/* BTCUSDT: 폴백 포함 */
async function getBtcUsdt() {
  try {
    const b = await jfetch("https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT");
    const v = Number(b?.price);
    if (v > 0) return v;
  } catch {}
  // Bybit 폴백
  try {
    const bb = await jfetch("https://api.bybit.com/v5/market/tickers?category=linear&symbol=BTCUSDT");
    const v = Number(bb?.result?.list?.[0]?.lastPrice);
    if (v > 0) return v;
  } catch {}
  return 0;
}

async function getKrwBaseline() {
  const [usdkor, btcusdt] = await Promise.all([getUsdKrw(), getBtcUsdt()]);
  const binanceKRW = usdkor > 0 && btcusdt > 0 ? usdkor * btcusdt : 0;
  return { usdkor, btcusdt, binanceKRW };
}

/* 거래소별 */
async function getUpbit() {
  const j = await jfetch("https://api.upbit.com/v1/ticker?markets=KRW-BTC").catch(() => null);
  const t = j?.[0];
  const price = Number(t?.trade_price || 0);
  const prev = Number(t?.prev_closing_price || 0);
  const diff = prev ? price - prev : null;
  const rate = prev ? (diff / prev) * 100 : null;
  return { exchange: "업비트", price, change: diff, changeRate: rate };
}
async function getBithumb() {
  const j = await jfetch("https://api.bithumb.com/public/ticker/BTC_KRW").catch(() => null);
  const d = j?.data;
  const price = Number(d?.closing_price || 0);
  const prev = Number(d?.prev_closing_price || 0);
  const diff = prev ? price - prev : null;
  const rate = prev ? (diff / prev) * 100 : null;
  return { exchange: "빗썸", price, change: diff, changeRate: rate };
}
async function getCoinone() {
  const j = await jfetch("https://api.coinone.co.kr/ticker_new/?currency=btc").catch(() => null);
  const price = Number(j?.last || 0);
  const prev = Number(j?.yesterday_last || 0);
  const diff = prev ? price - prev : null;
  const rate = prev ? (diff / prev) * 100 : null;
  return { exchange: "코인원", price, change: diff, changeRate: rate };
}

/* 라우트 */
/**
 * @openapi
 * /markets:
 *   get:
 *     summary: 거래소별 BTC 시세 (업비트/빗썸/코인원 + 프리미엄)
 *     tags: [Markets]
 *     responses:
 *       200:
 *         description: 거래소별 현재가와 프리미엄
 */
r.get("/", async (_req, res) => {
  try {
    const base = await getKrwBaseline();

    const [bithumb, upbit, coinone] = await Promise.all([
      getBithumb().catch(() => null),
      getUpbit().catch(() => null),
      getCoinone().catch(() => null),
    ]);

    const items = [bithumb, upbit, coinone]
      .filter(Boolean)
      .map((x) => ({
        ...x,
        premium: base.binanceKRW > 0 ? ((x.price / base.binanceKRW) - 1) * 100 : null,
      }))
      .filter((x) => x.price > 0);

    res.json({ ok: true, base, items });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, code: "E_MARKETS", message: "시세 조회 실패" });
  }
});

export default r;
