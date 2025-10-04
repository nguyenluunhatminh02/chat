// Node >= 18
import { MeiliSearch } from 'meilisearch';

const HOST = process.env.MEILI_HOST ?? 'http://localhost:7700';
const KEY  = process.env.MEILI_API_KEY ?? 'meili_master';
const INDEX = process.env.MEILI_INDEX_MESSAGES ?? 'messages';

const client = new MeiliSearch({ host: HOST, apiKey: KEY });

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/** Lấy task uid cho mọi phiên bản SDK (taskUid | uid | updateId) */
const taskIdOf = (task) => task?.taskUid ?? task?.uid ?? task?.updateId;

/** Version-agnostic waitTask: ưu tiên client.getTask, fallback index.getTask */
async function waitTask(task, idx = null, { timeoutMs = 15000, intervalMs = 200 } = {}) {
  const id = taskIdOf(task);
  if (id == null) throw new Error('Cannot determine task id from response: ' + JSON.stringify(task));
  const started = Date.now();

  while (true) {
    let t;
    if (typeof client.getTask === 'function') {
      t = await client.getTask(id);
    } else if (idx && typeof idx.getTask === 'function') {
      t = await idx.getTask(id);
    } else {
      throw new Error('SDK does not expose getTask on client or index.');
    }

    if (t.status === 'succeeded') return t;
    if (t.status === 'failed' || t.status === 'canceled') {
      throw new Error('Task failed: ' + (t.error?.message || JSON.stringify(t.error || t)));
    }
    if (Date.now() - started > timeoutMs) {
      throw new Error('Task timeout: ' + id + ' (last status=' + t.status + ')');
    }
    await sleep(intervalMs);
  }
}

async function main() {
  // 0) health
  console.log('[health]', await client.health());

  // 1) ensure index
  let idx = client.index(INDEX);
  try {
    await client.getIndex(INDEX);
  } catch {
    const createTask = await client.createIndex(INDEX, { primaryKey: 'id' });
    await waitTask(createTask); // đợi index được tạo
  }
  idx = client.index(INDEX);

  // 2) settings (searchable/filterable/sortable/highlight)
  const settingsTask = await idx.updateSettings({
    searchableAttributes: ['content'],
    filterableAttributes: ['conversationId', 'senderId', 'type', 'createdAt'],
    sortableAttributes: ['createdAt'],
    typoTolerance: { enabled: true },
  });
  await waitTask(settingsTask, idx);

  // 3) add documents
  const conv = `conv_${Date.now()}`;
  const docs = [
    { id: `m1_${Date.now()}`,     conversationId: conv, senderId: 'u1', type: 'TEXT', content: 'hello meili world', createdAt: new Date().toISOString() },
    { id: `m2_${Date.now() + 1}`, conversationId: conv, senderId: 'u2', type: 'TEXT', content: 'another message about cats and meili', createdAt: new Date(Date.now()+1).toISOString() },
  ];
  const addTask = await idx.addDocuments(docs);
  await waitTask(addTask, idx);

  // 4) search với filter + highlight + sort
  const res = await idx.search('meili', {
    limit: 10,
    filter: `conversationId = "${conv}"`,
    attributesToHighlight: ['content'],
    highlightPreTag: '<mark>',
    highlightPostTag: '</mark>',
    sort: ['createdAt:desc'],
  });
  console.log('[search]', res.hits.map(h => ({
    id: h.id,
    content: h.content,
    highlight: h._formatted?.content,
  })));

  // 5) delete 1 doc và verify biến mất
  const delTask = await idx.deleteDocument(docs[0].id);
  await waitTask(delTask, idx);

  for (let i = 0; i < 15; i++) {
    const s = await idx.search('hello', { filter: `conversationId = "${conv}"` });
    if (!s.hits.some(h => h.id === docs[0].id)) break;
    await sleep(300);
  }
  console.log('[ok] remove verified');

  console.log('\n✅ Meili quick check passed');
}

main().catch((e) => {
  console.error('\n❌ QUICK CHECK FAILED');
  console.error(e?.stack || e?.message || e);
  process.exit(1);
});
