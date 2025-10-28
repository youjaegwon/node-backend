// 업비트 심볼 → 아이콘 URL 리졸버
// 1) overrides(절대 URL) > 2) aliases(심볼 치환) > 3) coinicons 기본 규칙

// 1) 특정 코인 확정 URL (필요시 늘리면 됨)
const overrides = {
  // 예: 업비트 전용/희소 심볼 혹은 coinicons 미지원 심볼에 직접 CDN 경로 지정
  // 'WEMIX': 'https://assets.coingecko.com/coins/images/14820/large/wemix-token.png?1696515018',
  // 'BTG':   'https://assets.coingecko.com/coins/images/1042/large/bitcoin-gold-logo.png?1696502270',
};

// 2) 별칭: 업비트 심볼 → coinicons에서 더 잘 맞는 심볼
const aliases = {
  MATIC: 'pol',     // 폴리곤(POL) 리브랜딩
  XEC:   'xec',     // eCash
  BSV:   'bsv',
  BTG:   'btg',
  BTT:   'btt',
  NEO:   'neo',
  QTUM:  'qtum',
  IOTA:  'iota',
  NANO:  'xno',     // 코인아이콘은 xno로 제공
  KAS:   'kas',
  SUI:   'sui',
  APT:   'apt',
  ARB:   'arb',
  OP:    'op',
  STX:   'stx',
  SEI:   'sei',
  INJ:   'inj',
  RUNE:  'rune',
  PEPE:  'pepe',
  WIF:   'wif',
  TON:   'ton',
  // 필요에 따라 계속 추가
};

// 3) 가장 흔한 심볼(명시적으로 상단에 두면 디버깅 편함)
const WELL_KNOWN = new Set([
  'BTC','ETH','XRP','ADA','SOL','DOGE','TRX','DOT','AVAX','LINK','BCH','LTC','ETC',
  'ATOM','NEAR','ICP','XLM','FIL','MKR','AAVE','UNI','SAND','MANA','AXS','GRT'
]);

/** 심볼 기준 아이콘 URL 반환 (없으면 null), 대소문자 무시 */
export function resolveIconUrl(symbol = '') {
  if (!symbol) return null;

  const S = String(symbol).toUpperCase();
  // 1) override 우선
  if (overrides[S]) return overrides[S];

  // 2) 별칭 치환
  const alias = aliases[S] || S.toLowerCase();

  // 3) 기본 규칙 (coinicons)
  return `https://coinicons-api.vercel.app/api/icon/${alias}`;
}
