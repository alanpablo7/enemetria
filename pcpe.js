(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const exam = window.ENEMETRIA_EXAMS[document.body.dataset.examId];
  const questions = exam.questions;
  const answerKey = exam.answerKey;
  const records = {}, areaTimes = {}, order = [];
  const sessionTracker = window.EnemetriaSessionTracker.create(exam.id);
  let running = false, paused = false, finished = false, finishing = false;
  let elapsed = 0, limit = 16200, lastTick = 0, active = null, idle = 0, pauseTime = 0, timer;
  let draft = '', finalText = '', startedAt = null, finishedAt = null;
  const fmt = seconds => {
    seconds = Math.max(0, Math.floor(seconds));
    return [Math.floor(seconds / 3600), Math.floor(seconds % 3600 / 60), seconds % 60].map(v => String(v).padStart(2, '0')).join(':');
  };
  const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const questionNumbers = block => Object.values(questions).filter(q => !block || q.block === block).map(q => q.number);
  const subjects = [...new Set(Object.values(questions).map(q => q.subject))];

  function renderText(target, text) {
    target.replaceChildren();
    for (const paragraph of text.split(/\n\n+/).filter(Boolean)) {
      const item = paragraph.match(/^(I{1,3}|IV|V)\s+([\s\S]+)/);
      const p = document.createElement(item ? 'div' : 'p');
      if (item) {
        p.className = 'roman-item';
        const numeral = document.createElement('strong'), content = document.createElement('span');
        numeral.textContent = item[1]; content.textContent = item[2]; p.append(numeral, content);
      } else p.textContent = paragraph.replace(/\n/g, ' ');
      target.append(p);
    }
  }

  function tick() {
    if (!running || finished) return;
    const now = Date.now(), delta = Math.max(0, (now - lastTick) / 1000);
    lastTick = now;
    if (paused) { pauseTime += delta; return; }
    const dt = Math.min(delta, limit - elapsed);
    elapsed += dt;
    if (active) areaTimes[active.area] = (areaTimes[active.area] || 0) + dt;
    else idle += dt;
    $('elapsed').textContent = fmt(elapsed);
    $('remaining').textContent = fmt(limit - elapsed);
    if (active?.kind === 'question') $('question-time').textContent = fmt(elapsed - active.start);
    renderStats();
    if (elapsed >= limit && !finishing) finish(true);
  }

  function renderStats() {
    const values = Object.values(records);
    const answered = values.filter(r => r.answer).length;
    const skipped = values.filter(r => r.skipped && !r.answer).length;
    const time = values.reduce((sum, r) => sum + r.time, 0) + (active?.kind === 'question' ? elapsed - active.start : 0);
    const items = [[answered + '/60', 'respondidas'], [skipped, 'puladas'], [60 - answered, 'restantes'], [fmt(values.length ? time / values.length : 0), 'média por questão visitada']];
    $('stats').innerHTML = items.map(([value, label]) => '<div class="stat"><strong>' + value + '</strong><span>' + label + '</span></div>').join('');
    for (const block of ['P1', 'P2']) $('' + block.toLowerCase() + '-progress').textContent = questionNumbers(block).filter(n => records[n]?.answer).length + ' de ' + questionNumbers(block).length;
    $('area-times').textContent = Object.entries(areaTimes).map(([name, time]) => name + ': ' + fmt(time)).join('  ·  ');
  }

  function paint(number) {
    const button = $('q-' + number), record = records[number];
    button.classList.toggle('answered', !!record?.answer);
    button.classList.toggle('skipped', !!record?.skipped && !record?.answer);
    button.classList.toggle('active', active?.kind === 'question' && active.n === number);
    const status = record?.answer ? 'respondida' : record?.skipped ? 'pulada' : 'não visitada';
    button.setAttribute('aria-label', 'Questão ' + number + ', ' + status);
  }

  function requireConfidence() {
    if (active?.kind !== 'question' || active.pending === null) return false;
    $('confidence').hidden = false;
    $('confidence-warning').textContent = 'Selecione seu nível de confiança, de 1 a 5, para salvar a alternativa e fechar a questão.';
    $('confidence-warning').hidden = false;
    $('confidence-buttons').querySelector('button').focus({preventScroll: true});
    return true;
  }

  function closeActive({force = false, reason = 'fechamento_usuario'} = {}) {
    if (!force && requireConfidence()) return false;
    tick();
    if (!active) return true;
    const session = active;
    if (session.kind === 'question') {
      const r = records[session.n];
      r.time += elapsed - session.start;
      if (r.visits === 1) r.firstPassTimeSeconds = elapsed - session.start;
      if (session.review) r.reviewTime += elapsed - session.start;
      if (session.selection !== null) r.afterSelection += elapsed - session.selection;
      if (session.pending !== null) r.pendingAtTimeout = true;
      sessionTracker.closeQuestion(session.attemptId, elapsed, reason);
      r.skipped = !r.answer;
      $('question-dialog').close();
    } else {
      if (session.kind === 'draft') draft = $('essay').value;
      else finalText = $('essay').value;
      $('essay-dialog').close();
    }
    order.push({activity: session.kind === 'question' ? 'Questão ' + session.n : session.area, event: 'encerramento', time: elapsed});
    active = null;
    if (session.kind === 'question') { paint(session.n); $('q-' + session.n).focus({preventScroll: true}); }
    renderStats();
    return true;
  }

  function table(headers,rows){return '<div class="table-scroll"><table><thead><tr>'+headers.map(x=>'<th>'+esc(x)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(x=>'<td>'+esc(x)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>'}
function figure(n){
  if (questions[n].table) return table(questions[n].table[0], questions[n].table.slice(1));
  if (exam.kind === 'autoral') return '';
  if(n===37){const names=['José','João','Antônio','Francisca','Antônia','Adriana','Juliana'],v=[54529,84113,76348,725642,592815,567968,564706];return '<h3>Planilha 1</h3>'+table(['','A','B'],names.map((x,i)=>[i+1,x,v[i]]))+'<h3>Planilha 2</h3>'+table(names,[v])}if(n===54)return table(['Ocorrências observadas'],[['5 · 7 · 3 · 0 · 2 · 1 · 7 · 8 · 3']]);if(n===59)return table(['Estrato','Tamanho populacional','Desvio padrão'],[['I','50.000',5],['II','80.000',4],['III','120.000',3],['IV','160.000',2],['V','190.000',1],['Total','600.000','—']]);if(n===55){const points='30,68 60,58 90,46 120,52 150,57 180,96 210,126 240,127 270,143 300,156 330,143 360,122 390,94 420,36 450,106 480,147 510,137 540,158';return '<svg class="chart" viewBox="0 0 580 200" role="img" aria-label="Recriação visual do gráfico da taxa de crime em Pernambuco, 2004 a 2021; pico de 57 em 2017 e mínimo de 34 em 2021"><path d="M25 20V165H555" fill="none" stroke="#6c7e96"/><polyline points="'+points+'" fill="none" stroke="#245eb0" stroke-width="2"/>'+Array.from({length:18},(_,i)=>'<text x="'+(30+i*30)+'" y="185" text-anchor="middle" font-size="8">'+(2004+i)+'</text>').join('')+'<text x="412" y="25" font-size="11">57</text><text x="537" y="151" font-size="11">34</text></svg><p class="muted">Recriação visual da figura da prova. Fonte indicada no original: www.sds.pe.gov.br.</p>'}return ''}


  function openQuestion(number) {
    if (!running || paused || finished || active) return;
    tick();
    if (finished) return;
    const q = questions[number];
    const r = records[number] ||= {time: 0, visits: 0, reviewTime: 0, changes: 0, afterSelection: 0, answer: null, confidence: null, firstChoice: null, firstPassTimeSeconds: null, answeredRevisits: 0};
    r.visits++;
    if (r.answer) r.answeredRevisits++;
    active = {kind: 'question', n: number, start: elapsed, area: q.subject, review: !!r.answer, selection: null, pending: null, attemptId: sessionTracker.openQuestion(number, elapsed)};
    order.push({activity: 'Questão ' + number, event: 'abertura', time: elapsed});
    paint(number);
    $('question-title').textContent = 'Questão ' + String(number).padStart(2, '0');
    $('question-subject').textContent = q.subject;
    $('question-block').textContent = q.block + ' · ' + (q.block === 'P1' ? 'NOÇÕES DE DIREITO' : 'CONHECIMENTOS ESPECÍFICOS');
    $('question-time').textContent = '00:00:00';
    $('context').replaceChildren();
    if (q.context) {
      const heading = document.createElement('h3'), content = document.createElement('div');
      const title = q.context.split(/\n\n/)[0];
      heading.className = 'context-title'; heading.textContent = title;
      content.className = 'reading';
      renderText(content, q.context.slice(title.length).trim());
      $('context').append(heading, content);
    }
    renderText($('prompt'), q.prompt);
    $('figure').innerHTML = figure(number);
    $('alternatives').replaceChildren();
    q.choices.forEach((choice, index) => {
      const letter = String.fromCharCode(65 + index);
      const button = document.createElement('button'), badge = document.createElement('span'), text = document.createElement('span');
      button.className = 'alternative' + (r.answer === letter ? ' selected' : '');
      button.setAttribute('aria-pressed', String(r.answer === letter));
      badge.className = 'choice-letter'; badge.textContent = letter;
      text.className = 'choice-text'; text.textContent = choice;
      button.append(badge, text);
      button.onclick = () => {
        tick(); if (!active || finished) return;
        if (active.pending === letter) {
          sessionTracker.cancelSelection(active.attemptId, elapsed);
          active.pending = null; active.selection = null;
          $('confidence').hidden = true; $('confidence-warning').hidden = true;
          [...$('alternatives').children].forEach((b, i) => { const selected = r.answer === String.fromCharCode(65+i); b.classList.toggle('selected', selected); b.setAttribute('aria-pressed', String(selected)); });
          $('saved').className = 'saved-status';
          $('saved').textContent = r.answer ? 'Seleção desfeita. Resposta anteriormente salva: ' + r.answer + ' · confiança ' + r.confidence + '/5.' : 'Alternativa desmarcada. Você pode fechar a questão para pulá-la.';
          return;
        }
        sessionTracker.selectAnswer(active.attemptId, letter, elapsed);
        active.pending = letter;
        if (r.firstChoice === null) r.firstChoice = r.time + elapsed - active.start;
        active.selection = elapsed;
        $('confidence').hidden = false;
        $('confidence-warning').hidden = true;
        $('saved').className = 'saved-status';
        $('saved').textContent = 'Alternativa ' + letter + ' selecionada. Informe a confiança para salvar.';
        [...$('alternatives').children].forEach(b => { b.classList.toggle('selected', b === button); b.setAttribute('aria-pressed', String(b === button)); });
      };
      $('alternatives').append(button);
    });
    $('confidence').hidden = true; $('confidence-warning').hidden = true;
    $('saved').className = 'saved-status' + (r.answer ? ' success' : '');
    $('saved').textContent = r.answer ? 'Resposta ' + r.answer + ' salva · confiança ' + r.confidence + '/5.' : 'Selecione uma alternativa ou feche a questão para pulá-la.';
    $('question-dialog').showModal();
    $('question-scroll').scrollTop = 0;
    $('question-title').focus({preventScroll: true});
  }

  for (const block of ['P1', 'P2']) {
    for (const subject of subjects.filter(s => Object.values(questions).some(q => q.block === block && q.subject === s))) {
      const row = document.createElement('div'), heading = document.createElement('h3'), panel = document.createElement('div');
      row.className = 'subject-group'; heading.textContent = subject; panel.className = 'question-panel';
      Object.values(questions).filter(q => q.block === block && q.subject === subject).forEach(q => {
        const button = document.createElement('button'); button.id = 'q-' + q.number; button.className = 'q-button';
        button.textContent = String(q.number).padStart(2, '0'); button.setAttribute('aria-label', 'Questão ' + q.number + ', não visitada');
        button.onclick = () => openQuestion(q.number); panel.append(button);
      });
      row.append(heading, panel); $(block.toLowerCase()).append(row);
    }
  }

  for (let confidence = 1; confidence <= 5; confidence++) {
    const button = document.createElement('button'); button.textContent = confidence;
    button.setAttribute('aria-label', 'Confiança ' + confidence + ' de 5');
    button.onclick = () => {
      tick(); if (active?.kind !== 'question' || active.pending === null || finished) return;
      const r = records[active.n];
      sessionTracker.saveAnswer(active.attemptId, active.pending, confidence, elapsed);
      if (r.answer && r.answer !== active.pending) r.changes++;
      r.answer = active.pending; r.confidence = confidence; r.skipped = false;
      active.pending = null;
      paint(active.n); $('confidence').hidden = true; $('confidence-warning').hidden = true;
      $('saved').className = 'saved-status success';
      $('saved').textContent = 'Resposta ' + r.answer + ' salva · confiança ' + confidence + '/5. Use o × para voltar ao caderno.';
      renderStats();
    };
    $('confidence-buttons').append(button);
  }
  $('close-question').onclick = () => closeActive();
  $('question-dialog').addEventListener('cancel', event => { event.preventDefault(); closeActive(); });
  $('question-dialog').addEventListener('click', event => {
    if (event.target !== $('question-dialog')) return;
    const box = $('question-dialog').getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) closeActive();
  });

  function openEssay(kind) {
    if (!exam.discursive || !running || paused || finished || active) return;
    tick(); if (finished) return;
    const name = kind === 'draft' ? 'Discursiva — rascunho' : 'Discursiva — versão final';
    active = {kind, start: elapsed, area: name}; order.push({activity: name, event: 'abertura', time: elapsed});
    $('essay-title').textContent = name;
    renderText($('discursive-text'), exam.discursive.replace(/\r/g, '').split(/\n\s*\n/).map(p => p.replace(/\n/g, ' ')).join('\n\n'));
    $('essay').value = kind === 'draft' ? draft : finalText;
    updateEssayCount(); $('essay-dialog').showModal();
  }
  function updateEssayCount() { $('essay-count').textContent = ($('essay').value.trim().match(/\S+/g) || []).length + ' palavras · ' + ($('essay').value ? $('essay').value.split(/\n/).length : 0) + ' linhas explícitas'; }
  $('draft').onclick = () => openEssay('draft'); $('final-text').onclick = () => openEssay('final');
  $('close-essay').onclick = () => closeActive(); $('essay').oninput = updateEssayCount;
  $('essay-dialog').addEventListener('cancel', e => { e.preventDefault(); closeActive(); });
  function togglePause() {
    tick(); if (!running || finished) return;
    paused = !paused;
    $('pause').textContent = paused ? 'Retomar' : 'Pausar'; $('paused').hidden = !paused; $('workspace').hidden = paused;
    if (active) {
      const dialog = active.kind === 'question' ? $('question-dialog') : $('essay-dialog');
      if (paused) dialog.close(); else dialog.showModal();
    }
  }
  $('pause').onclick = togglePause; $('pause-question').onclick = togglePause; $('pause-essay').onclick = togglePause;
  let participantEmail = '';
  $('start').onclick = () => {
    if (($('participant-email').value || '').trim() && !$('participant-email').reportValidity()) return;
    participantEmail = ($('participant-email').value || '').trim();
    limit = Number($('duration').value) * 60; running = true; lastTick = Date.now(); startedAt = new Date().toISOString();
    $('setup').hidden = true; $('exam').hidden = false; renderStats();
    $('remaining').textContent = fmt(limit); timer = setInterval(tick, 500); window.scrollTo(0, 0);
  };

  function score(numbers) {
    const result = {correct: 0, wrong: 0, blank: 0, total: numbers.length};
    for (const n of numbers) {
      if (!records[n]?.answer) result.blank++;
      else if (records[n].answer === answerKey[n]) result.correct++;
      else result.wrong++;
    }
    result.percent = result.total ? Math.round(result.correct / result.total * 100) : 0;
    return result;
  }
  function renderResults(auto) {
    $('summary').textContent = (auto ? 'Tempo encerrado. ' : '') + 'Você respondeu ' + Object.values(records).filter(r => r.answer).length + ' de 60 questões em ' + fmt(elapsed) + '.';
    $('score-cards').innerHTML = [['Total da prova', questionNumbers()], ['P1 · Noções de Direito', questionNumbers('P1')], ['P2 · Conhecimentos Específicos', questionNumbers('P2')]].map(([name, numbers], i) => {
      const s = score(numbers);
      return '<div class="score-card' + (!i ? ' featured' : '') + '"><span>' + name + '</span><strong>' + s.correct + '<small> / ' + s.total + '</small></strong><div class="score-bar"><span style="width:' + s.percent + '%"></span></div><p>' + s.percent + '% de acertos · ' + s.wrong + ' erradas · ' + s.blank + ' em branco</p></div>';
    }).join('');
    $('subject-results').innerHTML = '<table><thead><tr><th>Disciplina</th><th>Acertos</th><th>Aproveitamento</th><th>Tempo</th></tr></thead><tbody>' + subjects.map(name => {
      const nums = Object.values(questions).filter(q => q.subject === name).map(q => q.number), s = score(nums);
      return '<tr><td>' + esc(name) + '</td><td>' + s.correct + '/' + s.total + '</td><td>' + s.percent + '%</td><td>' + fmt(areaTimes[name] || 0) + '</td></tr>';
    }).join('') + '</tbody></table>';
    const values = Object.values(records), reviewed = values.filter(r => r.visits > 1).length, changes = values.reduce((sum, r) => sum + r.changes, 0);
    $('strategy').innerHTML = '<div class="strategy-grid">' + [[fmt(elapsed), 'tempo de prova'], [fmt(idle), 'sem atividade aberta'], [reviewed, 'questões reabertas'], [changes, 'mudanças de resposta']].map(([value, label]) => '<div><strong>' + value + '</strong><span>' + label + '</span></div>').join('') + '</div><p class="session-note">O relatório TXT inclui a ordem de resolução, os tempos de cada questão' + (exam.discursive ? ' e os textos da discursiva.' : ', o padrão de construção e o gabarito comentado.') + '</p>';
    renderTraceSummary();
    $('question-results').innerHTML = '<table><thead><tr><th>Questão</th><th>Sua resposta</th><th>Gabarito</th><th>Resultado</th><th>Confiança</th><th>Tempo</th></tr></thead><tbody>' + questionNumbers().map(n => {
      const r = records[n], blank = !r?.answer, correct = r?.answer === answerKey[n];
      return '<tr><td>' + String(n).padStart(2, '0') + '</td><td>' + (r?.answer || '—') + '</td><td>' + answerKey[n] + '</td><td><span class="badge ' + (blank ? 'blank' : correct ? '' : 'wrong') + '">' + (blank ? 'Em branco' : correct ? 'Acerto' : 'Erro') + '</span></td><td>' + (r?.confidence ? r.confidence + '/5' : '—') + '</td><td>' + fmt(r?.time || 0) + '</td></tr>';
    }).join('') + '</tbody></table>';
    $('answer-key').textContent = questionNumbers().map(n => n + ': ' + answerKey[n]).join('  ·  ');
  }

  function renderTraceSummary() {
    const summary = window.EnemetriaSessionTracker.summarize(exam, sessionTracker.snapshot());
    const net = summary.netReview;
    const signed = net.netPoints > 0 ? '+' + net.netPoints : String(net.netPoints);
    $('trace-summary').innerHTML = '<div class="strategy-grid">' + [[net.reviewedQuestions, 'questões respondidas revisadas'], [net.reviewedQuestions ? net.correctAtEnd + '/' + (net.reviewedQuestions - net.withoutKey) : '—', 'acertos finais nas revisadas'], [signed, 'saldo líquido em acertos'], [summary.skips.decisions, 'decisões de pular']].map(([value, label]) => '<div><strong>' + value + '</strong><span>' + label + '</span></div>').join('') + '</div><p class="session-note">Tempo acumulado antes das decisões de pular: ' + fmt(summary.skips.totalSeconds) + '. O TXT detalha cada tentativa e cada resposta confirmada. Saldo calculado pelo ' + (exam.kind === 'autoral' ? 'gabarito autoral.' : 'gabarito preliminar.') + '</p>';
  }

  function report() {
    const overall = score(questionNumbers());
    let text = 'ENEMetria — ' + exam.title + '\nPROVA_ID: ' + exam.id + '\n' + (exam.kind === 'autoral' ? 'ELABORAÇÃO: ' + exam.board + '\nEDIÇÃO: ' + exam.applicationDate + '\nREFERÊNCIA: PC PE · Cebraspe · aplicação ' + exam.referenceApplicationDate : 'BANCA: ' + exam.board + ' — Edital ' + exam.noticeYear + ' — Aplicação: ' + exam.applicationDate) + '\nSESSÃO_ID: ' + sessionTracker.sessionId + '\nVERSÃO_DADOS_SESSÃO: ' + window.EnemetriaSessionTracker.schemaVersion + '\nVERSÃO_CONTEÚDO: ' + exam.contentVersion + '\nVERSÃO_ANÁLISE: ' + exam.analysis.analysisVersion + '\nCorreção: ' + exam.answerKeyInfo.label + ' | versão ' + exam.answerKeyInfo.version + '\nCadernos: ' + exam.answerKeyInfo.p1 + ' (P1) / ' + exam.answerKeyInfo.p2 + ' (P2)\nInício UTC: ' + startedAt + '\nConclusão UTC: ' + finishedAt + '\n\n';
    text += 'CONTATO PARA DEVOLUTIVA: ' + (participantEmail || 'Não informado') + '\n\n';
    text += 'Acertos: ' + overall.correct + '/60 (' + overall.percent + '%)\nErros: ' + overall.wrong + '\nEm branco: ' + overall.blank + '\nTempo de prova: ' + fmt(elapsed) + '\nPausas: ' + fmt(pauseTime) + '\nSem atividade aberta: ' + fmt(idle) + '\n\nDESEMPENHO POR BLOCO E DISCIPLINA\n';
    for (const [label, nums] of [['P1', questionNumbers('P1')], ['P2', questionNumbers('P2')], ...subjects.map(s => [s, Object.values(questions).filter(q => q.subject === s).map(q => q.number)])]) {
      const s = score(nums); text += label + ': ' + s.correct + '/' + s.total + ' acertos (' + s.percent + '%), ' + s.wrong + ' erros, ' + s.blank + ' em branco.\n';
    }
    text += '\nTEMPO POR ÁREA\n' + Object.entries(areaTimes).map(([name, time]) => name + ': ' + fmt(time)).join('\n');
    text += '\n\nQUESTÕES\nNº | Resposta | ' + (exam.kind === 'autoral' ? 'Gabarito autoral' : 'Gabarito preliminar') + ' | Resultado | Confiança | Tempo total | Até primeira escolha | Após seleção (acumulado) | Reaberturas | Tempo de revisão | Trocas\n';
    for (const n of questionNumbers()) {
      const r = records[n];
      text += [n, r?.answer || 'em branco', answerKey[n], !r?.answer ? 'em branco' : r.answer === answerKey[n] ? 'acerto' : 'erro', r?.confidence || '—', fmt(r?.time || 0), r?.firstChoice == null ? '—' : fmt(r.firstChoice), fmt(r?.afterSelection || 0), Math.max(0, (r?.visits || 0) - 1), fmt(r?.reviewTime || 0), r?.changes || 0].join(' | ') + '\n';
      if (r?.pendingAtTimeout) text += '  Tempo encerrado com nova seleção sem confiança: preservada apenas a resposta previamente salva, se existente.\n';
    }
    const sessionTrace = sessionTracker.snapshot();
    text += window.EnemetriaReports.buildTraceSection(exam, {sessionTrace, startedAt, finishedAt, elapsedSeconds: elapsed, pauseSeconds: pauseTime, idleSeconds: idle});
    text += '\nORDEM DE RESOLUÇÃO\n' + order.map(o => fmt(o.time) + ' | ' + o.activity + ' | ' + o.event).join('\n');
    const essayReport = exam.discursive ? '\n\nDISCURSIVA — RASCUNHO\n' + (draft || 'Não registrado.') + '\n\nDISCURSIVA — VERSÃO FINAL\n' + (finalText || 'Não registrada.') + '\n\nDiscursiva sem nota automática.' : '\n\nSimulado autoral com 60 questões objetivas.';
    const performanceReport = text + essayReport + ' Percentuais sobre todas as questões de cada bloco ou disciplina.\n';
    return performanceReport + window.EnemetriaReports.buildAppendix(exam, {records, order, sessionTrace});
  }

  function finish(auto = false, confirmed = false) {
    if (finished || finishing) return;
    if (!auto && active?.kind === 'question' && active.pending !== null) {
      if (paused) togglePause();
      requireConfidence(); return;
    }
    if (!auto && !confirmed) {
      const answered = Object.values(records).filter(r => r.answer).length;
      $('finish-overview').textContent = answered + ' questões respondidas · ' + (60 - answered) + ' em branco.';
      $('finish-dialog').showModal(); return;
    }
    if ($('finish-dialog').open) $('finish-dialog').close();
    finishing = true; tick(); closeActive({force: true, reason: auto ? 'tempo_esgotado' : 'fim_prova'}); running = false; finished = true; finishing = false; finishedAt = new Date().toISOString();
    clearInterval(timer); $('exam').hidden = true; $('results').hidden = false; renderResults(auto); $('result-email').value = participantEmail; window.scrollTo(0, 0);
    if (deliveryEndpoint && participantEmail && $('delivery-consent').checked) sendReport();
  }
  $('finish').onclick = () => finish();
  $('cancel-finish').onclick = () => $('finish-dialog').close();
  $('confirm-finish').onclick = () => finish(false, true);
  $('download').onclick = () => {
    const url = URL.createObjectURL(new Blob([report()], {type: 'text/plain;charset=utf-8'}));
    const a = document.createElement('a'); a.href = url; a.download = window.EnemetriaReports.fileName(exam); a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const deliveryEndpoint = window.ENEMETRIA_REPORT_DELIVERY?.endpoint || '';
  if (deliveryEndpoint) {
    $('send-report').disabled = false;
    $('method-delivery').textContent = 'Ao finalizar, autorize o envio do relatório para análise com apoio de IA e revisão da equipe. Você receberá o feedback no seu e-mail em até 48 horas após a confirmação do envio.';
    $('delivery-description').textContent = 'Envie seu relatório para análise com apoio de IA e revisão da equipe. A devolutiva chega em até 48 horas após a confirmação do envio.';
  }
  let sendingReport = false, reportSent = false;
  async function sendReport() {
    if (!finished || !deliveryEndpoint || sendingReport || reportSent) return;
    const emailInput = $('result-email');
    if (!(emailInput.value || '').trim() || !emailInput.reportValidity()) {
      $('delivery-status').textContent = 'Informe um e-mail válido para receber sua avaliação.'; emailInput.focus(); return;
    }
    if (!$('delivery-consent').checked) {
      $('delivery-status').textContent = 'Autorize o envio do relatório para solicitar sua avaliação.'; return;
    }
    participantEmail = emailInput.value.trim(); sendingReport = true; $('send-report').disabled = true;
    $('delivery-status').textContent = 'Enviando relatório… Aguarde a confirmação antes de sair.';
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(deliveryEndpoint, {method: 'POST', headers: {'Content-Type': 'application/json'}, signal: controller.signal,
        body: JSON.stringify({sessionId: sessionTracker.sessionId, examId: exam.id, email: participantEmail, consent: true, report: report()})});
      const receipt = await response.json();
      if (!response.ok || receipt.accepted !== true) throw new Error('not accepted');
      reportSent = true; $('send-report').textContent = 'Relatório enviado';
      $('delivery-status').textContent = 'Relatório enviado para análise. Você receberá a avaliação em até 48 horas no e-mail informado.';
    } catch {
      $('delivery-status').textContent = 'Não foi possível confirmar o envio. Tente novamente ou baixe o relatório para não perder seus dados.';
    } finally { clearTimeout(timeout); sendingReport = false; $('send-report').disabled = reportSent; }
  }
  $('send-report').onclick = sendReport;
  $('again').onclick = () => location.reload();
  window.addEventListener('beforeunload', event => { if (running && !finished) { event.preventDefault(); event.returnValue = ''; } });
})();
