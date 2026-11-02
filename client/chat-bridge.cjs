const http = require('node:http');
const {randomBytes, timingSafeEqual} = require('node:crypto');

// A private loopback bridge lets the pet host call the exact same AI instance
// as the control console. The real provider key never leaves Electron.
async function startChatBridge({ai}) {
  const token = randomBytes(32).toString('hex');
  const server = http.createServer(async (req, res) => {
    const reply = (status, body) => {
      res.writeHead(status, {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store'});
      res.end(JSON.stringify(body));
    };
    const supplied = req.headers['x-pet-bridge-token'];
    const suppliedBytes = typeof supplied === 'string' ? Buffer.from(supplied) : Buffer.alloc(0);
    if (suppliedBytes.length !== Buffer.byteLength(token) ||
        !timingSafeEqual(suppliedBytes, Buffer.from(token))) {
      reply(403, {ok: false, message: '无效的桌宠内部连接'}); return;
    }
    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname !== '/chat' && url.pathname !== '/vision') {reply(404, {ok: false}); return;}
    const id = url.searchParams.get('pet') || '';
    try {
      if (req.method === 'GET') {
        if (url.pathname !== '/chat') {reply(405, {ok: false}); return;}
        const history = await ai.history(id), rounds = ai.settings().rounds;
        const messages = (rounds ? history.messages.slice(-rounds * 2) : []).map(m => ({...m, ts: typeof m.ts === 'string' ? Date.parse(m.ts) : m.ts}));
        reply(200, {ok: true, messages, rounds, source: 'client-ai'}); return;
      }
      if (req.method !== 'POST') {reply(405, {ok: false}); return;}
      const chunks = []; let size = 0;
      const limit = url.pathname === '/vision' ? 2_800_000 : 32000;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > limit) {reply(413, {ok: false, message: '消息过长'}); return;}
        chunks.push(chunk);
      }
      const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (url.pathname === '/vision') {
        const result = await ai.look(id, parsed?.prompt || parsed?.text || '看看屏幕上在做什么，用一句话告诉我。', parsed?.image || '');
        reply(200, {ok: true, source: 'client-ai', answer: result.answer, bubbleDelivered: result.bubbleDelivered});
        return;
      }
      await ai.send(id, parsed?.text);
      reply(200, {ok: true, source: 'client-ai'});
    } catch (e) {
      reply(200, {ok: false, reason: 'generate-error', message: e.message});
    }
  });
  server.requestTimeout = 75000;
  await new Promise((resolve, reject) => {server.once('error', reject); server.listen(0, '127.0.0.1', resolve);});
  return {env: {DSH_PET_CHAT_BRIDGE_PORT: String(server.address().port), DSH_PET_CHAT_BRIDGE_TOKEN: token},
    close: () => {server.close(); server.closeAllConnections();}};
}
module.exports = {startChatBridge};
