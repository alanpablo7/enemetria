const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createSession}=require('./helpers/fake-browser.cjs');
function payload(text){return JSON.parse(text.split('SESSAO_ESTRUTURADA_JSON_INICIO\n')[1].split('\nSESSAO_ESTRUTURADA_JSON_FIM')[0])}
(async()=>{
 const s=createSession(),g=s.get,open=n=>g('q-'+n).click(),close=()=>g('close-question').click(),save=(letter,confidence)=>{g('alternatives').children[letter.charCodeAt(0)-65].click();g('confidence-buttons').children[confidence-1].click()};
 open(1);s.advance(12000);close();
 open(1);s.advance(8000);save('B',2);s.advance(4000);close();
 open(1);s.advance(10000);save('A',4);s.advance(5000);close();
 open(2);s.advance(5000);save('E',5);close();open(2);s.advance(6000);save('A',4);s.advance(4000);close();
 open(3);s.advance(5000);save('B',3);close();open(3);s.advance(3000);save('A',3);s.advance(2000);save('B',5);s.advance(5000);close();
 open(4);s.advance(20000);close();open(4);s.advance(8000);close();open(4);s.advance(12000);save('D',3);close();
 open(5);s.advance(4000);save('A',4);close();open(5);s.advance(7000);close();
 open(6);s.advance(10000);g('alternatives').children[2].click();close();assert.equal(g('question-dialog').open,true);assert.equal(g('confidence-warning').hidden,false);g('pause-question').click();s.advance(60000);g('pause').click();g('confidence-buttons').children[4].click();s.advance(5000);close();
 open(7);s.advance(9000);g('pause-question').click();g('finish').click();g('confirm-finish').click();
 const report=await s.report(),data=payload(report),summary=data.summary;
 assert.equal(data.totals.elapsedSeconds,144);assert.equal(data.totals.pauseSeconds,60);assert.equal(summary.skips.decisions,3);assert.equal(summary.skips.uniqueQuestions,2);assert.equal(summary.skips.totalSeconds,40);assert.equal(summary.skips.maxSeconds,20);
 assert.equal(summary.netReview.reviewedQuestions,4);assert.equal(summary.netReview.correctAtEnd,3);assert.equal(summary.netReview.wrongToCorrect,1);assert.equal(summary.netReview.correctToWrong,1);assert.equal(summary.netReview.correctToCorrect,2);assert.equal(summary.netReview.netPoints,0);assert.equal(summary.eventReview.wrongToCorrect,2);assert.equal(summary.eventReview.correctToWrong,2);
 assert.equal(data.rawTrace.questions[4].attempts.length,3);assert.equal(data.rawTrace.questions[6].attempts[0].durationSeconds,15);assert.equal(data.rawTrace.questions[7].attempts[0].closeReason,'fim_prova');assert.equal(data.rawTrace.questions[7].attempts[0].outcome,'encerrada_sem_resposta');
 assert.equal(data.rawTrace.questions[1].answerHistory[0].confidence,2);assert.equal(data.rawTrace.questions[1].answerHistory[1].previousAnswer,'B');assert.equal(data.rawTrace.questions[1].answerHistory[1].answer,'A');assert.equal(data.rawTrace.questions[1].answerHistory[1].confidence,4);
 assert.equal((report.match(/--- QUESTÃO /g)||[]).length,60);assert(report.indexOf('REGISTRO DE TODAS AS TENTATIVAS')<report.indexOf('=== ANÁLISE PEDAGÓGICA'));
 const observation=[...report.matchAll(/DESEMPENHO_OBSERVADO_JSON: (.*)/g)].map(m=>JSON.parse(m[1]));assert.equal(observation[0].tentativasIds.length,3);assert.equal(observation[0].decisoesDePular,1);assert.equal(observation[3].decisoesDePular,2);assert.equal(observation[59].decisoesDePular,0);
 fs.mkdirSync(path.join(__dirname,'../../output'),{recursive:true});fs.writeFileSync(path.join(__dirname,'../../output/pcpe-relatorio-revisoes-exemplo.txt'),'EXEMPLO DE TESTE — DADOS FICTÍCIOS, NÃO REPRESENTAM UM ALUNO REAL\n\n'+report);
 // A pending alternative at timeout must be recorded, not counted as saved or voluntary skip.
 const timeout=createSession(),t=timeout.get;t('q-1').click();t('alternatives').children[0].click();timeout.advance(16200000);const end=payload(await timeout.report());assert.equal(end.summary.skips.decisions,0);assert.equal(end.rawTrace.questions[1].answer,null);assert.equal(end.rawTrace.questions[1].attempts[0].closeReason,'tempo_esgotado');assert.equal(end.rawTrace.questions[1].attempts[0].pendingAnswer,'A');
 console.log('OK: UI → eventos → TXT/JSON, 144s ativos + 60s de pausa, saldo por questão, 3 pulos, confiança pendente e expiração.');
})();
