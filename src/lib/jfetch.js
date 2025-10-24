import fetch from 'node-fetch';

/**
 * 간단한 JSON fetch 유틸
 * @param {string} url 요청 URL
 * @param {object} [opt] fetch 옵션
 * @returns {Promise<any|null>}
 */
export async function jfetch(url, opt = {}) {
  try {
    const res = await fetch(url, opt);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    console.error('[jfetch]', e.message);
    return null;
  }
}
