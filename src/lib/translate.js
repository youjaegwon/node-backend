import fetch from 'node-fetch';

/**
 * Google 번역 (비공식 API)
 * - 입력: text (영어)
 * - 출력: 한국어 번역 문자열
 */
export async function translateToKorean(text) {
  if (!text) return '';
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=ko&dt=t&q=${encodeURIComponent(
      text
    )}`;
    const res = await fetch(url);
    const json = await res.json();
    const translated = json?.[0]?.[0]?.[0] || text;
    return translated;
  } catch (err) {
    console.error('translate error:', err.message);
    return text;
  }
}
