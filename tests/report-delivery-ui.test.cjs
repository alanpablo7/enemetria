const assert = require('node:assert/strict');
const {createSession} = require('./helpers/fake-browser.cjs');
(async()=>{
 let calls=0, body, succeed=false;
 const s=createSession({endpoint:'https://relatorios.enemetria.com.br/reports',email:'aluna@example.com',fetch:async(url,options)=>{
   calls++; body=JSON.parse(options.body); return {ok:succeed,json:async()=>({accepted:succeed})};
 }}),g=s.get;
 g('q-1').click();s.advance(12000);g('alternatives').children[0].click();g('confidence-buttons').children[3].click();g('close-question').click();
 g('finish').click();g('confirm-finish').click();
 assert.equal(g('result-email').value,'aluna@example.com');
 assert.equal(g('send-report').disabled,false);
 await g('send-report').onclick();assert.equal(calls,0);assert.match(g('delivery-status').textContent,/Autorize/);
 g('delivery-consent').checked=true;g('result-email').value='invalid';
 await g('send-report').onclick();assert.equal(calls,0);
 g('result-email').value='aluna@example.com';
 await g('send-report').onclick();assert.equal(calls,1);assert.match(g('delivery-status').textContent,/Não foi possível/);assert.equal(g('send-report').disabled,false);
 succeed=true;await g('send-report').onclick();assert.equal(calls,2);assert.equal(g('send-report').disabled,true);
 assert.equal(body.consent,true);assert.equal(body.email,'aluna@example.com');assert.equal(body.examId,'pcpe-agente-2024-02-25');
 const data=JSON.parse(body.report.split('SESSAO_ESTRUTURADA_JSON_INICIO\n')[1].split('\nSESSAO_ESTRUTURADA_JSON_FIM')[0]);
 assert.equal(data.sessionId,body.sessionId);assert.equal(data.rawTrace.questions[1].answer,'A');
 assert.match(body.report,/CONTATO PARA DEVOLUTIVA: aluna@example.com/);
 assert.ok(body.report.length>30000);
 await g('send-report').onclick();assert.equal(calls,2);
 console.log('OK: envio completo com email, consentimento, resposta/confiança, falha/retry e bloqueio de clique duplicado.');
})();
