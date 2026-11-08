const assert = require('node:assert/strict');
const {createSession} = require('./helpers/fake-browser.cjs');
(async () => {
 const s = createSession(), g = s.get;
 s.c.window.ENEMETRIA_REPORT_DELIVERY = {endpoint: 'https://example.test/reports'};
 g('q-1').click(); g('close-question').click(); g('finish').click(); g('confirm-finish').click();
 assert.equal((await s.report()).includes('CONTATO PARA DEVOLUTIVA: Não informado'), true);
 // Endpoint absent at initialization: never sends or claims success.
 let calls = 0; s.c.fetch = async () => { calls++; throw Error('unexpected'); };
 await g('send-report').onclick(); assert.equal(calls, 0);
 const worker = (await import('../server/report-delivery/worker.mjs')).default;
 const originalFetch = global.fetch;
 const env = {SITE_ORIGIN:'https://enemetria.com.br',RESEND_API_KEY:'test',REPORT_TO:'owner@example.test',MAIL_FROM:'site@example.test', RATE_LIMITER:{limit:async()=>({success:true})}};
 const payload = {email:'student@example.test',consent:true,sessionId:'session-1',examId:'pcpe-agente-2024-02-25',report:'SESSAO_ESTRUTURADA_JSON_INICIO session-1'};
 const req = (data=payload, origin=env.SITE_ORIGIN) => new Request('https://example.test/', {method:'POST',headers:{Origin:origin},body:JSON.stringify(data)});
 try {
  let mail;
  global.fetch = async (url, options) => {mail=JSON.parse(options.body); return Response.json({id:'receipt'});};
  assert.equal((await worker.fetch(req(),env)).status,200);
  assert.deepEqual(mail.to,[env.REPORT_TO]); assert.equal(mail.reply_to,payload.email); assert.equal(mail.text.includes(payload.report),true);
  assert.equal((await worker.fetch(req({...payload,consent:false}),env)).status,400);
  assert.equal((await worker.fetch(req(payload,'https://other.test'),env)).status,403);
  assert.equal((await worker.fetch(req(),{})).status,503);
  global.fetch=async()=>Response.json({error:'failure'},{status:500});
  assert.equal((await worker.fetch(req(),env)).status,502);
 } finally {global.fetch=originalFetch;}
 console.log('OK: relatório preservado, envio inativo sem endpoint, destinatário privado fixo, consentimento, origem e falha sem falso sucesso.');
})();
