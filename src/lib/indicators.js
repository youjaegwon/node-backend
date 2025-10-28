// 단순/지수이동평균, RSI, MACD 유틸 (ESM)
export function ema(arr, period) {
  if (!Array.isArray(arr) || arr.length < period) return [];
  const k = 2 / (period + 1);
  const out = [];
  let prev = arr.slice(0, period).reduce((a,b)=>a+b,0) / period; // SMA로 초기화
  out.push(prev);
  for (let i = period; i < arr.length; i++) {
    const v = arr[i]*k + prev*(1-k);
    out.push(v); prev = v;
  }
  return out;
}

export function rsi(arr, period=14) {
  if (!Array.isArray(arr) || arr.length < period+1) return [];
  let gains=0, losses=0;
  for (let i=1; i<=period; i++){
    const ch = arr[i]-arr[i-1];
    if (ch>=0) gains+=ch; else losses-=ch;
  }
  gains/=period; losses/=period||1e-9;
  const out = [];
  let rs = gains/ (losses||1e-9);
  out.push(100 - (100/(1+rs)));
  for (let i=period+1; i<arr.length; i++){
    const ch = arr[i]-arr[i-1];
    const gain = Math.max(ch,0);
    const loss = Math.max(-ch,0);
    gains = (gains*(period-1)+gain)/period;
    losses = (losses*(period-1)+loss)/period||1e-9;
    rs = gains/(losses||1e-9);
    out.push(100 - (100/(1+rs)));
  }
  return out;
}

export function macd(arr, fast=12, slow=26, signal=9) {
  if (!Array.isArray(arr) || arr.length < slow+signal) return {macd:[], signal:[], hist:[]};
  const emaFast = ema(arr, fast);
  const emaSlow = ema(arr, slow);
  // align
  const offset = emaSlow.length - emaFast.length;
  const line = emaFast.slice(-emaSlow.length).map((v,i)=> v - emaSlow[i]);
  const sig = ema(line, signal);
  const hist = line.slice(-sig.length).map((v,i)=> v - sig[i]);
  // pad 앞쪽은 생략
  return { macd: line.slice(-sig.length), signal: sig, hist };
}
