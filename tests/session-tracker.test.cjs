const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname,'..');
const context = vm.createContext({window:{}});
for (const file of ['exams/pcpe-agente-2024/definition.js','session-tracker.js','exam-report.js']) vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context);
const api=context.window.EnemetriaSessionTracker, exam=context.window.ENEMETRIA_EXAMS['pcpe-agente-2024-02-25'];
const tracker=api.create(exam.id);let time=0,current;
const right=n=>exam.answerKey[n], wrong=n=>right(n)==='A'?'B':'A';
const open=n=>current=tracker.openQuestion(n,time);
const wait=s=>time+=s;
const save=(answer,confidence=3)=>{tracker.selectAnswer(current,answer,time);tracker.saveAnswer(current,answer,confidence,time)};
const close=(reason='fechamento_usuario')=>tracker.closeQuestion(current,time,reason);
// Repeated decisions on the same still-unanswered question.
open(1);wait(10);close();const early=tracker.snapshot();
open(1);wait(20);close();open(1);wait(15);save(wrong(1));wait(25);close();
open(1);wait(10);save(right(1),4);wait(20);close();
open(1);wait(5);save(wrong(1));wait(5);save(right(1),5);wait(10);close();
// A loop during a review has zero net gain and counts as one reviewed question.
open(2);save(right(2));close();open(2);wait(3);save(wrong(2));wait(3);save(right(2));wait(4);close();
// A harmful review; a wrong-to-wrong review; confidence-only reconfirmation.
open(3);save(right(3));close();open(3);wait(8);save(wrong(3));close();
open(4);save(wrong(4));close();open(4);wait(7);save('B');close();
open(5);save(right(5),5);close();open(5);wait(6);save(right(5),2);close();
// Forced closures are not voluntary skip decisions; a pending click is not a saved answer.
open(6);wait(12);tracker.selectAnswer(current,right(6),time);close('tempo_esgotado');
open(7);wait(9);close('fim_prova');
open(8);tracker.selectAnswer(current,right(8),time);assert.throws(()=>close(),/Confiança pendente/);assert.throws(()=>tracker.saveAnswer(current,right(8),0,time));tracker.saveAnswer(current,right(8),4,time);close();
// Changes before the first answered revisit must not be attributed to revision.
open(9);save(wrong(9));save(right(9));close();open(9);wait(4);close();
const trace=tracker.snapshot(), s=api.summarize(exam,trace);
assert.equal(early.questions[1].attempts.length,1);assert.equal(early.questions[1].answer,null);
assert.equal(s.skips.decisions,2);assert.equal(s.skips.uniqueQuestions,1);assert.equal(s.skips.totalSeconds,30);assert.equal(s.skips.meanSeconds,15);assert.equal(s.skips.maxSeconds,20);
assert.equal(s.skipEvents[0].secondsBeforeSkip,10);assert.equal(s.skipEvents[1].secondsBeforeSkip,20);assert.equal(s.skipEvents[1].cumulativeQuestionSecondsAtSkip,30);
assert.equal(s.netReview.reviewedQuestions,6);assert.equal(s.netReview.wrongToCorrect,1);assert.equal(s.netReview.correctToWrong,1);assert.equal(s.netReview.correctToCorrect,3);assert.equal(s.netReview.wrongToWrong,1);assert.equal(s.netReview.netPoints,0);
assert.equal(s.netReview.correctAtReviewStart,4);assert.equal(s.netReview.correctAtEnd,4);assert.equal(s.netReview.returnedToBaseline,1);assert.equal(s.netReview.unchangedWithoutSavedChanges,2);
assert.equal(s.eventReview.wrongToCorrect,3);assert.equal(s.eventReview.correctToWrong,3);assert.equal(s.eventReview.netPoints,0);
assert.equal(s.questionReviews.find(q=>q.number===1).reviewSeconds,50);
assert.equal(s.questionReviews.find(q=>q.number===9).category,'certa_para_certa');
assert.equal(s.recoveredAfterSkip.length,1);assert.equal(s.recoveredAfterSkip[0].correct,true);
assert.equal(trace.questions[6].answerHistory.length,0);assert.equal(trace.questions[6].attempts[0].pendingAnswer,right(6));
assert.equal(trace.questions[6].attempts[0].outcome,'encerrada_sem_resposta');assert.equal(trace.questions[7].attempts[0].outcome,'encerrada_sem_resposta');
assert.equal(s.changeEvents.filter(e=>e.number===5).length,0);assert.equal(s.attempts.length,18);
assert.throws(()=>api.summarize({...exam,id:'outra-prova'},trace),/incompatível/);
assert.throws(()=>tracker.openQuestion(1,-1));
const interrupted=api.create(exam.id,'pending-review-test');let a=interrupted.openQuestion(1,0);interrupted.selectAnswer(a,right(1),1);interrupted.saveAnswer(a,right(1),4,2);interrupted.closeQuestion(a,5);a=interrupted.openQuestion(1,10);interrupted.selectAnswer(a,wrong(1),12);interrupted.closeQuestion(a,20,'tempo_esgotado');const interruptedTrace=interrupted.snapshot(),interruptedSummary=api.summarize(exam,interruptedTrace);assert.equal(interruptedSummary.netReview.netPoints,0);assert.equal(interruptedSummary.netReview.correctAtEnd,1);assert.equal(interruptedSummary.changeEvents.length,0);assert.equal(interruptedSummary.skips.decisions,0);assert.equal(interruptedTrace.questions[1].attempts[1].pendingAnswer,wrong(1));assert.equal(interruptedTrace.questions[1].answer,right(1));assert.notEqual(api.create(exam.id).sessionId,api.create(exam.id).sessionId);

const report=context.window.EnemetriaReports.buildTraceSection(exam,{sessionTrace:trace,elapsedSeconds:time,pauseSeconds:0,idleSeconds:0});
assert.match(report,/Saldo líquido de acertos após revisões: 0/);assert.match(report,/Decisões de pular: 2/);
const payload=JSON.parse(report.split('SESSAO_ESTRUTURADA_JSON_INICIO\n')[1].split('\nSESSAO_ESTRUTURADA_JSON_FIM')[0]);assert.equal(payload.rawTrace.questions[1].attempts.length,5);assert.equal(payload.summary.netReview.correctAtEnd,4);
console.log('OK: trocas iniciais separadas de revisões, loops sem ganho duplicado, confiança sem troca, pulos repetidos, retornos resolvidos, fechamento forçado e JSON.');
