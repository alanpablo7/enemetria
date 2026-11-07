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
  function observed(exam, number, records) {
    const r = records[number], answered = !!r?.answer;
    return {visitada:!!r,respondida:answered,resposta:r?.answer || null,gabarito:exam.answerKey[number],statusGabarito:exam.answerKeyInfo.status,resultado:!answered?'em_branco':r.answer===exam.answerKey[number]?'acerto':'erro',confianca:r?.confidence ?? null,tempoTotalSegundos:r ? Math.round(r.time * 1000) / 1000 : null,tempoPrimeiraPassagemSegundos:r?.firstPassTimeSeconds == null ? null : Math.round(r.firstPassTimeSeconds * 1000) / 1000,tempoAtePrimeiraEscolhaSegundos:r?.firstChoice == null ? null : Math.round(r.firstChoice * 1000) / 1000,tempoAposSelecaoAcumuladoSegundos:r ? Math.round(r.afterSelection * 1000) / 1000 : null,visitas:r?.visits || 0,reaberturas:Math.max(0,(r?.visits || 0)-1),revisitasRespondida:r?.answeredRevisits || 0,tempoRevisaoSegundos:r ? Math.round(r.reviewTime * 1000) / 1000 : null,mudancasDeResposta:r?.changes || 0,selecaoSemConfiancaAoExpirar:!!r?.pendingAtTimeout};
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
      lines.push('DESEMPENHO_OBSERVADO_JSON: ' + JSON.stringify(observed(exam, n, run.records || {})));
    }
    lines.push('', 'FONTES E PROVENIÊNCIA');
    for (const source of a.sources) lines.push(source.id + ': ' + source.title + (source.scope ? ' — ' + source.scope : '') + (source.url ? ' — ' + source.url : ''));
    lines.push('', 'FIM DA ANÁLISE PEDAGÓGICA DA PROVA ' + exam.id + '.', '');
    return lines.join('\n');
  }
  function fileName(exam, date = new Date()) { return exam.id + '-relatorio-' + date.toISOString().replace(/[:.]/g,'-') + '.txt'; }
  window.EnemetriaReports = Object.freeze({validate, observed, buildAppendix, fileName});
})();
