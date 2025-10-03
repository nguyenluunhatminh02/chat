// Node >= 18
// E2E: presign-put -> PUT lên R2 -> complete (READY) -> thumbnail -> presign-get -> delete(force)

const BASE = process.env.API_BASE ?? 'http://localhost:3000';
const MIME = 'image/png';

// PNG 1x1 (base64) — khỏi cần file ngoài
const PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/1qgNnUAAAAASUVORK5CYII=';

async function main() {
  const filename = `e2e-${Date.now()}.png`;
  const bodyBuf = Buffer.from(PNG_B64, 'base64');

  // 1) Presign PUT
  const preRes = await fetch(`${BASE}/files/presign-put`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename, mime: MIME, sizeMax: 10 * 1024 * 1024 }),
  });
  if (!preRes.ok) throw new Error(`presign-put failed: ${preRes.status} ${await preRes.text()}`);
  const pre = await preRes.json();
  console.log('[presign-put]', { fileId: pre.fileId, key: pre.key, urlHost: new URL(pre.url).host });

  // 2) Upload bằng PUT (đừng set header linh tinh ngoài Content-Type)
  const up = await fetch(pre.url, {
    method: 'PUT',
    headers: { 'Content-Type': MIME },
    body: bodyBuf,
  });
  const upTxt = await up.text();
  console.log('[R2 PUT]', up.status, upTxt || '(no body)');
  if (!up.ok) throw new Error(`PUT failed: ${up.status}`);

  // 3) complete -> READY
  const completeRes = await fetch(`${BASE}/files/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileId: pre.fileId }),
  });
  if (!completeRes.ok) throw new Error(`complete failed: ${completeRes.status} ${await completeRes.text()}`);
  const completed = await completeRes.json();
  console.log('[complete]', { status: completed.status, size: completed.size });

  // 4) thumbnail (tuỳ chọn)
  const thumbRes = await fetch(`${BASE}/files/thumbnail`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileId: pre.fileId, maxSize: 256 }),
  });
  if (!thumbRes.ok) throw new Error(`thumbnail failed: ${thumbRes.status} ${await thumbRes.text()}`);
  const thumb = await thumbRes.json();
  console.log('[thumbnail]', { thumbKey: thumb.thumbKey });

  // 5) presign-get (file gốc) + thử GET 1 phát
  const getUrlRes = await fetch(`${BASE}/files/presign-get?key=${encodeURIComponent(pre.key)}`);
  if (!getUrlRes.ok) throw new Error(`presign-get failed: ${getUrlRes.status} ${await getUrlRes.text()}`);
  const getUrl = await getUrlRes.json();
  console.log('[presign-get]', getUrl.url.slice(0, 80) + '...');

  const fileRes = await fetch(getUrl.url); // thử tải thật
  console.log('[GET file]', fileRes.status, 'len=', fileRes.headers.get('content-length'));

  // 6) cleanup: delete(force)
  const delRes = await fetch(`${BASE}/files/${pre.fileId}?force=1`, { method: 'DELETE' });
  if (!delRes.ok) throw new Error(`delete failed: ${delRes.status} ${await delRes.text()}`);
  const del = await delRes.json();
  console.log('[delete]', del);

  console.log('\n✅ E2E OK');
}

main().catch((e) => {
  console.error('\n❌ TEST FAILED');
  console.error(e?.stack || e?.message || e);
  process.exit(1);
});
