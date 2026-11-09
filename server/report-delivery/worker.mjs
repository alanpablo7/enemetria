// Deploy separately from GitHub Pages. All mail credentials stay in Worker secrets.
export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const allowed = env.SITE_ORIGIN || 'https://enemetria.com.br';
    const headers = {'Access-Control-Allow-Origin': allowed, 'Vary': 'Origin', 'Content-Type': 'application/json', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS'};
    const reply = (status, data) => new Response(JSON.stringify(data), {status, headers});
    if (origin !== allowed) return reply(403, {accepted: false});
    if (request.method === 'OPTIONS') return new Response(null, {status: 204, headers});
    if (request.method !== 'POST') return reply(405, {accepted: false});
    if (!env.RESEND_API_KEY || !env.REPORT_TO || !env.MAIL_FROM || !env.RATE_LIMITER) return reply(503, {accepted: false});
    // Cloudflare rate-limit binding; Origin alone does not authenticate clients.
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (!(await env.RATE_LIMITER.limit({key: ip})).success) return reply(429, {accepted: false});
    try {
      const reader = request.body?.getReader();
      if (!reader) return reply(400, {accepted: false});
      const chunks = []; let size = 0;
      while (true) {
        const {done, value} = await reader.read(); if (done) break;
        size += value.byteLength;
        if (size > 1500000) { await reader.cancel(); return reply(413, {accepted: false}); }
        chunks.push(value);
      }
      const bytes = new Uint8Array(size); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      const data = JSON.parse(new TextDecoder().decode(bytes));
      if (data.consent !== true || typeof data.email !== 'string' || data.email.length > 254 || !/^[^\s@\r\n]+@[^\s@\r\n]+\.[^\s@\r\n]+$/.test(data.email) ||
          typeof data.sessionId !== 'string' || !/^[a-zA-Z0-9:_-]{1,160}$/.test(data.sessionId) ||
          !['pcpe-agente-2024-02-25', 'pcpe-agente-autoral-01'].includes(data.examId) || typeof data.report !== 'string' ||
          !data.report.includes('SESSAO_ESTRUTURADA_JSON_INICIO') || !data.report.includes(data.sessionId)) return reply(400, {accepted: false});
      // Keep an identical payload for retries. Resend deduplicates by session (24h).
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST', headers: {'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': `report-${data.sessionId}`},
        body: JSON.stringify({from: env.MAIL_FROM, to: [env.REPORT_TO], reply_to: data.email,
          subject: `Enemetria · PC PE · ${data.sessionId}`,
          text: `Contato para devolutiva: ${data.email}\nConsentimento para análise: concedido\n\n${data.report}`})
      });
      if (!response.ok) return reply(502, {accepted: false});
      const receipt = await response.json();
      if (!receipt.id) return reply(502, {accepted: false});
      return reply(200, {accepted: true});
    } catch { return reply(502, {accepted: false}); }
  }
};
