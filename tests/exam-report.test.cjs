const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {createHash} = require('node:crypto');
const root = path.join(__dirname, '..');
const context = vm.createContext({window:{}});
for (const file of ['exams/catalog.js','exams/pcpe-agente-2024/definition.js','exams/pcpe-agente-2024/analysis.js','exam-report.js']) {
  vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
}
const exam = context.window.ENEMETRIA_EXAMS['pcpe-agente-2024-02-25'];
const engine = context.window.EnemetriaReports;
assert.equal(engine.validate(exam).length,0);
assert.equal(Object.keys(exam.questions).length,60);
assert.equal(Object.keys(exam.analysis.questions).length,60);
const hash = createHash('sha256').update(JSON.stringify({questions:exam.questions,answerKey:exam.answerKey})).digest('hex');
assert.equal(exam.contentSha256,hash);
assert.equal(exam.analysis.contentSha256,hash);
for (const item of Object.values(exam.analysis.questions)) {
  assert(item.timeEstimate.minSeconds>0);
  assert(item.timeEstimate.maxSeconds>=item.timeEstimate.minSeconds);
  assert(item.knowledgeRequired.length>0);
  assert(item.sourceIds.every(id=>exam.analysis.sources.some(source=>source.id===id)));
}
const run = {records:{1:{answer:'A',confidence:4,time:120,firstPassTimeSeconds:30,firstChoice:12,afterSelection:15,visits:2,answeredRevisits:1,reviewTime:90,changes:0}},order:[{activity:'Questão 23',event:'abertura',time:0}]};
const appendix = engine.buildAppendix(exam,run);
assert.equal((appendix.match(/--- QUESTÃO /g)||[]).length,60);
const observations = [...appendix.matchAll(/DESEMPENHO_OBSERVADO_JSON: (.*)/g)].map(m=>JSON.parse(m[1]));
assert.equal(observations[0].tempoTotalSegundos,120);
assert.equal(observations[0].tempoPrimeiraPassagemSegundos,30);
assert.equal(observations[0].revisitasRespondida,1);
assert.equal(observations[59].visitada,false);
assert.equal(observations[59].tempoTotalSegundos,null);
assert.match(appendix,/primeiro acesso observado: Questão 23/);
assert.match(appendix,/sem calibração empírica/);
for (const mutation of [e=>e.id='outra-prova',e=>e.contentSha256='alterado',e=>delete e.analysis.questions[1],e=>e.questions[1].subject='Disciplina alterada']) {
  const invalid = structuredClone(exam); mutation(invalid);
  assert(engine.validate(invalid).length>0);
  assert(!engine.buildAppendix(invalid).includes('--- QUESTÃO'));
}
const date = new Date('2026-11-07T12:00:00.000Z');
assert.notEqual(engine.fileName(exam,date),engine.fileName({...exam,id:'outra-prova'},date));
console.log('OK: cobertura de 60 análises, integridade do conteúdo, leitura compartilhada, tempos distintos e isolamento entre provas.');
