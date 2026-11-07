(() => {
  'use strict';
  const sortedNumbers = exam => Object.keys(exam.questions).map(Number).sort((a, b) => a - b);
  const labels = {facil:'fácil',media:'média',dificil:'difícil',basico:'básico',intermediario:'intermediário',avancado:'avançado',rapida:'rápida',demorada:'demorada',consolidacao:'consolidação',alta:'alto',restrito:'restrito',contextual:'contextual'};
  function validate(exam) {
    const errors = [], analysis = exam?.analysis;
    if (!exam?.id || !exam.questions || !exam.answerKey) return ['Definição de prova incompleta.'];
    if (!analysis) return ['Análise pedagógica não cadastrada para esta prova.'];
    if (!analysis.questions || !Array.isArray(analysis.sharedReadingGroups) || !Array.isArray(analysis.aiGuidelines) || !Array.isArray(analysis.sources)) return ['Estrutura de análise incompleta.'];
    if (analysis.schemaVersion !== '1.0.0') errors.push('Versão de esquema de análise incompatível.');
    if (analysis.examId !== exam.id || analysis.contentSha256 !== exam.contentSha256) errors.push('A análise não pertence à versão deste caderno.');
    const numbers = sortedNumbers(exam);
    if (numbers.length !== exam.questionCount || Object.keys(analysis.questions).length !== numbers.length) errors.push('Quantidade de análises diferente da quantidade de questões.');
    for (const n of numbers) {
      const q = exam.questions[n], item = analysis.questions[n];
      if (!item || item.number !== n || item.questionId !== exam.id + ':Q' + String(n).padStart(2, '0') || item.block !== q.block || item.subject !== q.subject) { errors.push('Análise incompatível na questão ' + n + '.'); continue; }
      if (!['facil','media','dificil'].includes(item.difficulty) || !['basico','intermediario','avancado'].includes(item.knowledgeLevel)) errors.push('Classificação inválida na questão ' + n + '.');
      if (!['suficiente','predominante','insuficiente'].includes(item.interpretation) || (!Array.isArray(item.knowledgeRequired) || !item.knowledgeRequired.length) || !item.studyRecommendation) errors.push('Análise incompleta na questão ' + n + '.');
      if (!(item.timeEstimate.minSeconds > 0 && item.timeEstimate.maxSeconds >= item.timeEstimate.minSeconds)) errors.push('Faixa de tempo inválida na questão ' + n + '.');
    }
    for (const group of analysis.sharedReadingGroups) if (group.questions.some(n => !exam.questions[n] || analysis.questions[n]?.sharedReadingGroup !== group.id)) errors.push('Grupo de leitura incompatível: ' + group.id + '.');
    return errors;
  }
  function observed(exam, number, records, sessionTrace = null) {
    if (sessionTrace && (sessionTrace.examId !== exam.id || sessionTrace.schemaVersion !== '2.0.0')) sessionTrace = null;
    const r = records[number], answered = !!r?.answer;
    return {visitada:!!r,respondida:answered,resposta:r?.answer || null,gabarito:exam.answerKey[number],statusGabarito:exam.answerKeyInfo.status,resultado:!answered?'em_branco':r.answer===exam.answerKey[number]?'acerto':'erro',confianca:r?.confidence ?? null,tempoTotalSegundos:r ? Math.round(r.time * 1000) / 1000 : null,tempoPrimeiraPassagemSegundos:r?.firstPassTimeSeconds == null ? null : Math.round(r.firstPassTimeSeconds * 1000) / 1000,tempoAtePrimeiraEscolhaSegundos:r?.firstChoice == null ? null : Math.round(r.firstChoice * 1000) / 1000,tempoAposSelecaoAcumuladoSegundos:r ? Math.round(r.afterSelection * 1000) / 1000 : null,visitas:r?.visits || 0,reaberturas:Math.max(0,(r?.visits || 0)-1),revisitasRespondida:r?.answeredRevisits || 0,tempoRevisaoSegundos:r ? Math.round(r.reviewTime * 1000) / 1000 : null,mudancasDeResposta:r?.changes || 0,selecaoSemConfiancaAoExpirar:!!r?.pendingAtTimeout,tentativasIds:sessionTrace ? (sessionTrace.questions[number]?.attempts || []).map(a=>a.id) : null,historicoRespostasIds:sessionTrace ? (sessionTrace.questions[number]?.answerHistory || []).map(e=>e.id) : null,decisoesDePular:sessionTrace ? (sessionTrace.questions[number]?.attempts || []).filter(a=>a.outcome==='pulada').length : null};
  }
  function buildTraceSection(exam, run = {}) {
    const trace = run.sessionTrace;
    if (!trace || trace.examId !== exam.id || !window.EnemetriaSessionTracker) return '\n\n=== RASTREAMENTO DETALHADO INDISPONÍVEL ===\nEsta sessão não contém eventos compatíveis; históricos não são reconstruídos a partir de contadores.\n';
    const summary = window.EnemetriaSessionTracker.summarize(exam, trace);
    const net = summary.netReview, events = summary.eventReview, skip = summary.skips;
    const n = value => value == null ? '—' : String(Math.round(value * 1000) / 1000);
    const answer = value => value || '—';
    const signed = value => value > 0 ? '+' + value : String(value);
    const category = value => ({primeira_resposta:'primeira resposta',reconfirmacao:'mesma alternativa reconfirmada',errada_para_certa:'errada → certa',certa_para_errada:'certa → errada',errada_para_errada:'errada → errada',certa_para_certa:'certa → certa',sem_gabarito:'sem gabarito'}[value] || value);
    const lines = ['', '', '=== REVISÕES, TROCAS E DECISÕES DE PULAR — DADOS DE SESSÃO ===',
      'VERSÃO_DADOS_SESSÃO: ' + trace.schemaVersion, 'PROVA_ID: ' + exam.id, 'SESSÃO_ID: ' + trace.sessionId,
      'GABARITO_DE_COMPARAÇÃO: ' + exam.answerKeyInfo.label + ' | versão ' + exam.answerKeyInfo.version,
      'BASE_TEMPORAL: segundos desde o início da prova, excluídas as pausas. Cada abertura é uma tentativa distinta.',
      'TROCA: mudança de alternativa confirmada com confiança. Cliques sem confirmação ficam nas seleções brutas e não alteram a resposta salva.',
      'REVISÃO: tentativa aberta quando já havia resposta salva. Retorno a uma questão ainda sem resposta é contado separadamente.',
      'PULAR: fechar voluntariamente uma tentativa sem resposta salva. Fim de prova e tempo esgotado não são decisões voluntárias de pular.',
      'SALDO: variação em quantidade de acertos, sem pesos ou conversão para nota oficial. Comparação com o gabarito informado, não explicação causal de desempenho.',
      '', 'SALDO LÍQUIDO DAS REVISÕES — CONTAGEM POR QUESTÃO',
      'Base: resposta ao abrir a primeira revisão de uma questão já respondida, comparada à resposta final dessa mesma questão.',
      'Questões respondidas que foram revisadas: ' + net.reviewedQuestions,
      'Acertos na entrada da primeira revisão: ' + net.correctAtReviewStart,
      'Acertos finais nas questões revisadas: ' + net.correctAtEnd,
      'Errada → certa: ' + net.wrongToCorrect,
      'Certa → errada: ' + net.correctToWrong,
      'Certa → certa: ' + net.correctToCorrect,
      'Errada → errada: ' + net.wrongToWrong,
      'Sem gabarito para comparação: ' + net.withoutKey,
      'Saldo líquido de acertos após revisões: ' + signed(net.netPoints),
      'Revisadas sem nenhuma troca salva: ' + net.unchangedWithoutSavedChanges,
      'Revisadas com trocas, mas retorno à alternativa de entrada: ' + net.returnedToBaseline,
      'Sequências intermediárias não multiplicam o ganho: certa → errada → certa tem saldo líquido zero.',
      '', 'DETALHE DAS QUESTÕES REVISADAS',
      'Questão | Resposta antes da primeira revisão | Final | Confiança antes | Final | Visitas de revisão | Tempo de revisão (s) | Trocas salvas em revisão | Resultado líquido | Saldo'];
    for (const r of summary.questionReviews) lines.push([r.number,answer(r.answerBeforeFirstReview),answer(r.finalAnswer),n(r.confidenceBeforeFirstReview),n(r.finalConfidence),r.reviewCount,n(r.reviewSeconds),r.savedChanges,category(r.category),r.delta == null ? '—' : signed(r.delta)].join(' | '));
    if (!summary.questionReviews.length) lines.push('Nenhuma questão previamente respondida foi revisada.');
    lines.push('', 'TROCAS INTERMEDIÁRIAS DURANTE REVISÕES — CONTAGEM POR EVENTO',
      'Errada → certa: ' + events.wrongToCorrect + ' | certa → errada: ' + events.correctToWrong + ' | errada → errada: ' + events.wrongToWrong + ' | sem gabarito: ' + events.withoutKey,
      'Saldo dos eventos de troca em revisão: ' + signed(events.netPoints) + ' acertos.',
      'Trocas salvas em todas as fases: ' + summary.changeEvents.length + '; dessas, em revisões de questões já respondidas: ' + summary.reviewChangeEvents.length + '.',
      '', 'HISTÓRICO CRONOLÓGICO DE RESPOSTAS CONFIRMADAS',
      'Sequência | Questão | Tentativa | Instante (s) | Anterior → nova | Confiança anterior → nova | Tipo de confirmação | Fase da tentativa | Comparação com gabarito | Saldo do evento');
    for (const e of summary.answerEvents) lines.push([e.sequence,e.number,e.attemptId,n(e.atSeconds),answer(e.previousAnswer)+' → '+e.answer,n(e.previousConfidence)+' → '+e.confidence,e.kind,e.attemptKind,category(e.transition.category),e.transition.delta == null ? '—' : signed(e.transition.delta)].join(' | '));
    if (!summary.answerEvents.length) lines.push('Nenhuma resposta foi confirmada.');
    lines.push('', 'DECISÕES VOLUNTÁRIAS DE PULAR — CADA TENTATIVA SEPARADAMENTE',
      'Decisões de pular: ' + skip.decisions + ' | questões distintas: ' + skip.uniqueQuestions,
      'Tempo acumulado antes dessas decisões (s): ' + n(skip.totalSeconds),
      'Tempo médio até decidir pular (s): ' + n(skip.meanSeconds) + ' | maior tempo (s): ' + n(skip.maxSeconds),
      'Questão | Nº da tentativa | ID da tentativa | Início na prova (s) | Decisão na prova (s) | Tempo nesta tentativa até pular (s) | Tempo acumulado da questão ao pular (s) | Resposta final | Acerto final');
    for (const e of summary.skipEvents) lines.push([e.number,e.attemptOrdinal,e.attemptId,n(e.openedAtSeconds),n(e.decisionAtSeconds),n(e.secondsBeforeSkip),n(e.cumulativeQuestionSecondsAtSkip),answer(e.finalAnswer),e.finalCorrect == null ? '—' : e.finalCorrect?'sim':'não'].join(' | '));
    if (!summary.skipEvents.length) lines.push('Nenhuma decisão voluntária de pular foi registrada.');
    lines.push('', 'RETORNOS A QUESTÕES PULADAS, RESPONDIDAS POSTERIORMENTE',
      'Quantidade: ' + summary.recoveredAfterSkip.length,
      'Questão | Instante da primeira resposta salva (s) | Resposta final | Acerto final');
    for (const r of summary.recoveredAfterSkip) lines.push([r.number,n(r.firstSavedAtSeconds),answer(r.answer),r.correct == null ? '—' : r.correct?'sim':'não'].join(' | '));
    lines.push('', 'REGISTRO DE TODAS AS TENTATIVAS',
      'ID | Questão | Nº da tentativa | Fase | Início (s) | Fim (s) | Duração ativa (s) | Resposta na entrada | Resposta na saída | Confiança na entrada | Confiança na saída | Motivo de encerramento | Resultado da tentativa | Seleção não confirmada na saída');
    for (const a of summary.attempts) lines.push([a.id,a.number,a.ordinal,a.kind,n(a.openedAtSeconds),n(a.closedAtSeconds),n(a.durationSeconds),answer(a.answerAtOpen),answer(a.answerAtClose),n(a.confidenceAtOpen),n(a.confidenceAtClose),a.closeReason,a.outcome,answer(a.pendingAnswer)].join(' | '));
    const structuredSummary = {netReview:summary.netReview,eventReview:summary.eventReview,skips:summary.skips,questionReviews:summary.questionReviews,skipEvents:summary.skipEvents,recoveredAfterSkip:summary.recoveredAfterSkip,answerEventIds:summary.answerEvents.map(e=>e.id),changeEventIds:summary.changeEvents.map(e=>e.id),reviewChangeEventIds:summary.reviewChangeEvents.map(e=>e.id)};
    const structured = {reportDataSchemaVersion:trace.schemaVersion,sessionId:trace.sessionId,examId:exam.id,contentVersion:exam.contentVersion,contentSha256:exam.contentSha256,answerKeyStatus:exam.answerKeyInfo.status,answerKeyVersion:exam.answerKeyInfo.version,startedAt:run.startedAt || null,finishedAt:run.finishedAt || null,totals:{elapsedSeconds:run.elapsedSeconds ?? null,pauseSeconds:run.pauseSeconds ?? null,idleSeconds:run.idleSeconds ?? null},rawTrace:trace,summary:structuredSummary};
    lines.push('', 'SESSAO_ESTRUTURADA_JSON_INICIO', JSON.stringify(structured, null, 2), 'SESSAO_ESTRUTURADA_JSON_FIM', '');
    return lines.join('\n');
  }

  function buildAppendix(exam, run = {}) {
    const errors = validate(exam);
    if (errors.length) return '\n\n=== ANÁLISE PEDAGÓGICA INDISPONÍVEL ===\n' + errors.join('\n') + '\nNenhuma análise de outra prova foi anexada.\n';
    const a = exam.analysis, numbers = sortedNumbers(exam);
    const lines = ['','', '=== ANÁLISE PEDAGÓGICA DA PROVA — CONTEXTO PARA IA ===',
      'PROVA_ID: ' + exam.id, 'TÍTULO: ' + exam.title, 'BANCA: ' + exam.board,
      'APLICAÇÃO: ' + exam.applicationDate, 'VERSÃO_CONTEÚDO: ' + exam.contentVersion,
      'SHA256_CONTEÚDO: ' + exam.contentSha256, 'VERSÃO_ANÁLISE: ' + a.analysisVersion,
      'VERSÃO_ESQUEMA: ' + a.schemaVersion, 'DATA_ANÁLISE: ' + a.preparedAt,
      'GABARITO: ' + exam.answerKeyInfo.label + ' | versão ' + exam.answerKeyInfo.version,
      'REFERÊNCIA: ' + a.methodology.referenceCandidate,
      'NATUREZA: Estimativa pedagógica por conteúdo; sem calibração empírica.',
      'TEMPOS: ' + a.methodology.timeScope, 'FOCO: ' + a.methodology.focusScope, '',
      'ESCALAS E CRITÉRIOS'];
    for (const [name, scale] of [['Dificuldade',a.methodology.difficultyScale],['Nível de conhecimento',a.methodology.knowledgeScale],['Ritmo',a.methodology.paceScale],['Interpretação',a.methodology.interpretationScale]]) {
      lines.push(name + ':'); for (const [value, description] of Object.entries(scale)) lines.push('  ' + value + ': ' + description);
    }
    lines.push('', 'ORIENTAÇÕES PARA INTERPRETAR O DESEMPENHO');
    a.aiGuidelines.forEach((text, index) => lines.push((index + 1) + '. ' + text));
    lines.push('', 'TEXTOS E SITUAÇÕES COMPARTILHADOS — NÃO DUPLICAR CUSTO DE LEITURA');
    for (const group of a.sharedReadingGroups) {
      const first = (run.order || []).find(entry => entry.event === 'abertura' && group.questions.some(n => entry.activity === 'Questão ' + n));
      lines.push(group.id + ' | questões: ' + group.questions.join(',') + ' | leitura inicial estimada: ' + group.initialReadingEstimateSeconds.join('–') + ' s | primeiro acesso observado: ' + (first?.activity || 'não registrado') + '. ' + group.note);
    }
    const byDifficulty = {}, byPace = {}, byFocus = {};
    for (const n of numbers) { const item = a.questions[n]; (byDifficulty[item.difficulty] ||= []).push(n); (byPace[item.timeEstimate.pace] ||= []).push(n); (byFocus[item.studyFocus] ||= []).push(n); }
    lines.push('', 'MAPA DA PROVA (CLASSIFICAÇÃO EDITORIAL)');
    for (const [name, map] of [['Dificuldade',byDifficulty],['Ritmo',byPace],['Foco de estudo',byFocus]]) for (const [value, nums] of Object.entries(map)) lines.push(name + ' ' + (name === 'Foco de estudo' && value === 'media' ? 'médio' : labels[value] || value) + ': ' + nums.join(', ') + '.');
    lines.push('Interpretação suficiente: ' + numbers.filter(n => a.questions[n].interpretation === 'suficiente').join(', ') + '.', 'Uso diagnóstico restrito: ' + numbers.filter(n => a.questions[n].diagnosticUse === 'restrito').join(', ') + '.');
    for (const n of numbers) {
      const item = a.questions[n];
      lines.push('', '--- QUESTÃO ' + String(n).padStart(2, '0') + ' | ' + item.questionId + ' ---',
        'BLOCO/DISCIPLINA: ' + item.block + ' / ' + item.subject,
        'TEMA: ' + item.topic,
        'DIFICULDADE_ESTIMADA: ' + (labels[item.difficulty] || item.difficulty) + '. Motivo: ' + item.difficultyReason,
        'CONHECIMENTO: ' + (labels[item.knowledgeLevel] || item.knowledgeLevel) + ' | ' + item.knowledgeRequired.join('; ') + '.',
        'DEMANDA_COGNITIVA: ' + item.cognitiveDemand,
        'TEMPO_ESTIMADO_PRIMEIRA_RESOLUÇÃO: ' + item.timeEstimate.minSeconds + '–' + item.timeEstimate.maxSeconds + ' segundos | ritmo ' + (labels[item.timeEstimate.pace] || item.timeEstimate.pace) + ' | grupo de leitura: ' + (item.sharedReadingGroup || 'nenhum') + '.',
        'INTERPRETAÇÃO: ' + item.interpretation + ' — ' + a.methodology.interpretationScale[item.interpretation],
        'FOCO_DE_ESTUDO: ' + (item.studyFocus === 'media' ? 'médio' : labels[item.studyFocus] || item.studyFocus) + ' | ' + item.focusReason + ' Ação: ' + item.studyRecommendation,
        'ESTRATÉGIA_DE_PROVA: ' + item.examStrategy + '.',
        'RISCO_DE_ERRO_A_INVESTIGAR: ' + item.pitfall,
        'USO_DIAGNÓSTICO: ' + item.diagnosticUse + '.',
        'FONTES: ' + item.sourceIds.join(', ') + '.');
      for (const alert of item.alerts) lines.push('ALERTA_MATERIAL [' + alert.severity + ' / ' + alert.type + ']: ' + alert.message);
      lines.push('DESEMPENHO_OBSERVADO_JSON: ' + JSON.stringify(observed(exam, n, run.records || {}, run.sessionTrace || null)));
    }
    lines.push('', 'FONTES E PROVENIÊNCIA');
    for (const source of a.sources) lines.push(source.id + ': ' + source.title + (source.scope ? ' — ' + source.scope : '') + (source.url ? ' — ' + source.url : ''));
    lines.push('', 'FIM DA ANÁLISE PEDAGÓGICA DA PROVA ' + exam.id + '.', '');
    return lines.join('\n');
  }
  function fileName(exam, date = new Date()) { return exam.id + '-relatorio-' + date.toISOString().replace(/[:.]/g,'-') + '.txt'; }
  window.EnemetriaReports = Object.freeze({validate, observed, buildTraceSection, buildAppendix, fileName});
})();
