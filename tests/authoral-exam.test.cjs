const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {createHash} = require('node:crypto');
const {createSession} = require('./helpers/fake-browser.cjs');
const id = 'pcpe-agente-autoral-01';
const context = vm.createContext({window:{}});
for (const file of ['exams/catalog.js','exams/pcpe-agente-2024/definition.js','exams/pcpe-agente-2024/analysis.js','exams/pcpe-agente-autoral-01/definition.js','exams/pcpe-agente-autoral-01/analysis.js','exam-report.js'])
  vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'..',file),'utf8'),context);
const exam=context.window.ENEMETRIA_EXAMS[id], engine=context.window.EnemetriaReports;
assert.equal(engine.validate(exam).length,0);
assert.equal(exam.contentSha256,createHash('sha256').update(JSON.stringify({questions:exam.questions,answerKey:exam.answerKey})).digest('hex'));
assert.equal(context.window.ENEMETRIA_EXAM_CATALOG.length,2);
assert.equal(Object.values(exam.questions).filter(q=>q.block==='P1').length,20);
assert.equal(Object.values(exam.questions).filter(q=>q.block==='P2').length,40);
assert.equal(new Set(Object.values(exam.analysis.questions).map(q=>q.construction.originalTopic)).size,60);
for (const item of Object.values(exam.analysis.questions)) {
  assert.equal(item.solution.answer,exam.answerKey[item.number]);
  assert.equal(item.solution.alternatives.length,5);
  assert(item.sourceIds.every(id=>exam.analysis.sources.some(s=>s.id===id)));
}
assert(!exam.discursive);
for(const q of Object.values(exam.questions)) assert(q.prompt.trim().length>20, 'Enunciado ausente na Q'+q.number);
for (const n of [11,12,13,14]) assert.match(exam.questions[n].context,/O laboratório recebeu/);
assert(!exam.questions[11].prompt.includes('Texto para'));
(async()=>{
  let sent;
  const s=createSession({examId:id,email:'aluno@example.test',endpoint:'https://example.test/reports',fetch:async(url,options)=>{sent=JSON.parse(options.body);return {ok:true,json:async()=>({accepted:true})};}});
  const g=s.get;
  for (const n of [1,27,31,49,58,60]) {
    g('q-'+n).click();
    assert.equal(g('prompt').children.length>0,true);
    if(n===58) assert.match(g('figure').innerHTML,/<table>/);
    if(n===49) assert.equal(g('figure').innerHTML,'');
    s.advance(3000);
    g('alternatives').children[exam.answerKey[n].charCodeAt()-65].click();
    g('confidence-buttons').children[3].click();g('close-question').click();
  }
  g('finish').click();g('confirm-finish').click();
  assert.match(g('score-cards').innerHTML,/6<small> \/ 60/);
  const report=await s.report();
  assert.equal((report.match(/--- QUESTÃO /g)||[]).length,60);
  assert.equal((report.match(/GABARITO_AUTORAL:/g)||[]).length,60);
  assert.equal((report.match(/CONSTRUÇÃO_AUTORAL:/g)||[]).length,60);
  assert.equal((report.match(/COMENTÁRIO [ABCDE]:/g)||[]).length,300);
  assert(!report.includes('Gabarito preliminar'));
  assert(!report.includes('DISCURSIVA —'));
  const data=JSON.parse(report.split('SESSAO_ESTRUTURADA_JSON_INICIO\n')[1].split('\nSESSAO_ESTRUTURADA_JSON_FIM')[0]);
  assert.equal(data.examId,id);assert.equal(data.answerKeyStatus,'autoral');
  assert.match(report,/ENeMeTria · elaboração autoral/);
  g('delivery-consent').checked=true;await g('send-report').onclick();
  assert.equal(sent.examId,id);assert.equal(sent.report,report);
  const official=context.window.ENEMETRIA_EXAMS['pcpe-agente-2024-02-25'];
  const original=engine.buildAppendix(official);
  assert.equal(engine.validate(official).length,0);
  assert(!original.includes('GABARITO_AUTORAL:'));
  console.log('OK: autoral isolado, 60 questões/60 análises/300 comentários, tabelas, blocos, correção, TXT e envio pelo ID correto.');
})();

