const CTRL = { TIMEOUT_MS: 3000, MAX_CONCURRENCY: 4 };

function pickImageLike(obj) {
  return (
    obj?.urlToImage ||
    obj?.image_url ||
    obj?.imageUrl ||
    obj?.image ||
    obj?.thumbnail ||
    obj?.media ||
    obj?.meta?.image ||
    obj?.source?.icon ||
    null
  );
}

async function fetchOgImage(link) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), CTRL.TIMEOUT_MS);
  try {
    const res = await fetch(link, { signal: ctrl.signal });
    const html = await res.text();
    // 간단한 정규식으로 og:image 추출
    const m =
      html.match(/property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
      html.match(/name=["']og:image["'][^>]*content=["']([^"']+)["']/i);
    return m ? m[1] : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function enrichImages(items, limit = 8) {
  // 1) 알려진 키에서 먼저 선택
  items.forEach((it) => {
    it.image = pickImageLike(it) || null;
  });

  // 2) 여전히 없는 것만 선별해서 og:image 병렬 추출 (최대 limit개)
  const targets = items
    .filter((it) => !it.image && it.link)
    .slice(0, limit);

  // 간단한 동시성 제어
  let i = 0;
  async function worker() {
    while (i < targets.length) {
      const t = targets[i++];
      t.image = (await fetchOgImage(t.link)) || null;
    }
  }
  const workers = Array.from({ length: Math.min(CTRL.MAX_CONCURRENCY, targets.length) }, worker);
  await Promise.all(workers);

  return items;
}
