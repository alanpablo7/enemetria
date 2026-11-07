(() => {
  'use strict';
  const schemaVersion = '2.0.0';
  const copy = value => JSON.parse(JSON.stringify(value));
  const seconds = value => {
    if (!Number.isFinite(value) || value < 0) throw new Error('Instante de sessão inválido.');
    return value;
  };
  function create(examId, sessionId = null) {
    sessionId ||= typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,12);
    const sessionPrefix = examId + ':S' + sessionId;
    const questions = {};
    let sequence = 0, activeAttempt = null, lastAt = 0;
    const stamp = at => { seconds(at); if (at < lastAt) throw new Error('Eventos fora de ordem temporal.'); lastAt = at; return ++sequence; };
    const current = attemptId => {
      if (!activeAttempt || activeAttempt.id !== attemptId) throw new Error('Tentativa inativa.');
      return activeAttempt;
    };
    function openQuestion(number, at) {
      if (activeAttempt) throw new Error('Já existe uma tentativa aberta.');
      if (!Number.isInteger(number) || number < 1) throw new Error('Questão inválida.');
      const eventSequence = stamp(at);
      const q = questions[number] ||= {number, answer: null, confidence: null, attempts: [], answerHistory: []};
      const attempt = {id: sessionPrefix + ':Q' + String(number).padStart(2,'0') + ':A' + String(q.attempts.length + 1).padStart(3,'0'),number,ordinal:q.attempts.length + 1,kind:q.answer?'revisao_respondida':q.attempts.length?'retorno_sem_resposta':'primeira_abertura',openSequence:eventSequence,openedAtSeconds:at,closedAtSeconds:null,durationSeconds:null,answerAtOpen:q.answer,confidenceAtOpen:q.confidence,answerAtClose:null,confidenceAtClose:null,closeSequence:null,closeReason:null,outcome:null,pendingAnswer:null,selections:[],savedEventIds:[]};
      q.attempts.push(attempt); activeAttempt = attempt;
      return attempt.id;
    }
    function selectAnswer(attemptId, answer, at) {
      const attempt = current(attemptId);
      if (!/^[A-E]$/.test(answer)) throw new Error('Alternativa inválida.');
      const seq = stamp(at);
      attempt.selections.push({sequence:seq,atSeconds:at,answer}); attempt.pendingAnswer = answer;
    }
    function saveAnswer(attemptId, answer, confidence, at) {
      const attempt = current(attemptId), q = questions[attempt.number];
      if (attempt.pendingAnswer !== answer || !Number.isInteger(confidence) || confidence < 1 || confidence > 5) throw new Error('Resposta sem seleção ou confiança válida.');
      const seq = stamp(at);
      const event = {id:sessionPrefix+':E'+String(seq).padStart(5,'0'),sequence:seq,number:attempt.number,attemptId,atSeconds:at,previousAnswer:q.answer,answer,previousConfidence:q.confidence,confidence,kind:!q.answer?'primeira_resposta':q.answer===answer?'reconfirmacao':'troca',attemptKind:attempt.kind};
      q.answerHistory.push(event); attempt.savedEventIds.push(event.id);
      q.answer = answer; q.confidence = confidence; attempt.pendingAnswer = null;
      return event.id;
    }
    function closeQuestion(attemptId, at, reason = 'fechamento_usuario') {
      const attempt = current(attemptId), q = questions[attempt.number];
      if (!['fechamento_usuario','fim_prova','tempo_esgotado'].includes(reason)) throw new Error('Motivo de fechamento inválido.');
      if (reason === 'fechamento_usuario' && attempt.pendingAnswer !== null) throw new Error('Confiança pendente.');
      const seq = stamp(at);
      attempt.closedAtSeconds = at; attempt.durationSeconds = at-attempt.openedAtSeconds;
      attempt.answerAtClose = q.answer; attempt.confidenceAtClose = q.confidence;
      attempt.closeSequence = seq; attempt.closeReason = reason;
      attempt.outcome = !q.answer ? reason === 'fechamento_usuario' ? 'pulada' : 'encerrada_sem_resposta' : !attempt.answerAtOpen ? 'respondida_primeira_vez' : q.answer === attempt.answerAtOpen ? 'resposta_mantida' : 'resposta_alterada';
      activeAttempt = null;
    }
    function snapshot() { return copy({schemaVersion,examId,sessionId,timeBasis:'segundos_decorridos_de_prova_sem_pausas',lastEventSequence:sequence,questions}); }
    return Object.freeze({sessionId,openQuestion,selectAnswer,saveAnswer,closeQuestion,snapshot});
  }
  function transition(before, after, key) {
    if (!key) return {category:'sem_gabarito',delta:null};
    if (!before) return {category:'primeira_resposta',delta:null};
    if (before === after) return {category:'reconfirmacao',delta:0};
    const wasCorrect = before === key, isCorrect = after === key;
    return {category:wasCorrect ? isCorrect?'certa_para_certa':'certa_para_errada' : isCorrect?'errada_para_certa':'errada_para_errada',delta:Number(isCorrect)-Number(wasCorrect)};
  }
  function summarize(exam, trace) {
    if (!trace || trace.schemaVersion !== schemaVersion || trace.examId !== exam.id) throw new Error('Rastreamento incompatível com a prova.');
    const summary = {schemaVersion,examId:exam.id,sessionId:trace.sessionId,keyStatus:exam.answerKeyInfo.status,keyVersion:exam.answerKeyInfo.version,questionReviews:[],answerEvents:[],changeEvents:[],reviewChangeEvents:[],skipEvents:[],attempts:[],recoveredAfterSkip:[],netReview:{reviewedQuestions:0,correctAtReviewStart:0,correctAtEnd:0,wrongToCorrect:0,correctToWrong:0,correctToCorrect:0,wrongToWrong:0,withoutKey:0,netPoints:0,unchangedWithoutSavedChanges:0,returnedToBaseline:0},eventReview:{wrongToCorrect:0,correctToWrong:0,wrongToWrong:0,withoutKey:0,netPoints:0},skips:{decisions:0,uniqueQuestions:0,totalSeconds:0,meanSeconds:null,maxSeconds:null}};
    for (const q of Object.values(trace.questions)) {
      if (!exam.questions[q.number]) throw new Error('Questão de outra prova no rastreamento.');
      const key = exam.answerKey[q.number];
      const attempts = q.attempts.filter(a=>a.closedAtSeconds !== null);
      summary.attempts.push(...attempts);
      const events = q.answerHistory.map(e=>({...e,transition:transition(e.previousAnswer,e.answer,key)}));
      summary.answerEvents.push(...events);
      const changes = events.filter(e=>e.kind === 'troca');
      const reviewChanges = changes.filter(e=>e.attemptKind === 'revisao_respondida');
      summary.changeEvents.push(...changes); summary.reviewChangeEvents.push(...reviewChanges);
      const reviews = attempts.filter(a=>a.kind === 'revisao_respondida');
      if (reviews.length) {
        const first = reviews[0], before = first.answerAtOpen, after = q.answer;
        const beforeCorrect = key ? before === key : null, finalCorrect = key ? after === key : null;
        const category = !key?'sem_gabarito':beforeCorrect?finalCorrect?'certa_para_certa':'certa_para_errada':finalCorrect?'errada_para_certa':'errada_para_errada';
        const delta = key ? Number(finalCorrect)-Number(beforeCorrect) : null;
        summary.questionReviews.push({number:q.number,answerBeforeFirstReview:before,finalAnswer:after,confidenceBeforeFirstReview:first.confidenceAtOpen,finalConfidence:q.confidence,reviewCount:reviews.length,reviewSeconds:reviews.reduce((sum,a)=>sum+a.durationSeconds,0),savedChanges:reviewChanges.length,initialSavedAnswer:q.answerHistory[0]?.answer || null,category,delta,correctAtReviewStart:beforeCorrect,correctAtEnd:finalCorrect});
        const net = summary.netReview; net.reviewedQuestions++;
        if (!key) net.withoutKey++;
        else {net.correctAtReviewStart+=Number(beforeCorrect);net.correctAtEnd+=Number(finalCorrect);net.netPoints+=delta;net[{'errada_para_certa':'wrongToCorrect','certa_para_errada':'correctToWrong','certa_para_certa':'correctToCorrect','errada_para_errada':'wrongToWrong'}[category]]++;}
        if (!reviewChanges.length) net.unchangedWithoutSavedChanges++;
        else if (before === after) net.returnedToBaseline++;
      }
      let cumulative = 0;
      for (const attempt of attempts) {
        cumulative += attempt.durationSeconds;
        if (attempt.outcome === 'pulada') summary.skipEvents.push({number:q.number,attemptId:attempt.id,attemptOrdinal:attempt.ordinal,attemptKind:attempt.kind,openedAtSeconds:attempt.openedAtSeconds,decisionAtSeconds:attempt.closedAtSeconds,decisionSequence:attempt.closeSequence,secondsBeforeSkip:attempt.durationSeconds,cumulativeQuestionSecondsAtSkip:cumulative,answerAtDecision:attempt.answerAtClose,finalAnswer:q.answer,finalCorrect:key&&q.answer?q.answer===key:null});
      }
      const firstSave = q.answerHistory[0];
      if (firstSave && attempts.some(a=>a.outcome==='pulada' && a.closeSequence < firstSave.sequence)) summary.recoveredAfterSkip.push({number:q.number,answer:q.answer,correct:key?q.answer===key:null,firstSavedAtSeconds:firstSave.atSeconds});
    }
    for (const event of summary.reviewChangeEvents) {
      const category = event.transition.category;
      if (category==='sem_gabarito') summary.eventReview.withoutKey++;
      else {summary.eventReview[{'errada_para_certa':'wrongToCorrect','certa_para_errada':'correctToWrong','errada_para_errada':'wrongToWrong'}[category]]++;summary.eventReview.netPoints+=event.transition.delta;}
    }
    summary.answerEvents.sort((a,b)=>a.sequence-b.sequence); summary.changeEvents.sort((a,b)=>a.sequence-b.sequence); summary.reviewChangeEvents.sort((a,b)=>a.sequence-b.sequence);
    summary.attempts.sort((a,b)=>a.openSequence-b.openSequence);summary.skipEvents.sort((a,b)=>a.decisionSequence-b.decisionSequence);summary.questionReviews.sort((a,b)=>a.number-b.number);
    const skips=summary.skips;skips.decisions=summary.skipEvents.length;skips.uniqueQuestions=new Set(summary.skipEvents.map(e=>e.number)).size;skips.totalSeconds=summary.skipEvents.reduce((sum,e)=>sum+e.secondsBeforeSkip,0);skips.meanSeconds=skips.decisions?skips.totalSeconds/skips.decisions:null;skips.maxSeconds=skips.decisions?Math.max(...summary.skipEvents.map(e=>e.secondsBeforeSkip)):null;
    return summary;
  }
  window.EnemetriaSessionTracker=Object.freeze({schemaVersion,create,summarize,transition});
})();
