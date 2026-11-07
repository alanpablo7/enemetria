(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const letters = ['A', 'B', 'C', 'D', 'E'];
  let state = null, interval = null, pdfUrl = null, report = '';
  function clock(seconds) {
    seconds = Math.max(0, Math.ceil(seconds));
    return [Math.floor(seconds / 3600), Math.floor(seconds % 3600 / 60), seconds % 60].map(n => String(n).padStart(2, '0')).join(':');
  }
  function remaining() {
    return state.paused ? state.remaining : Math.max(0, (state.deadline - Date.now()) / 1000);
  }
  function renderTimer() {
    const left = remaining();
    $('timer').textContent = clock(left);
    if (left <= 0 && !state.paused) finish(true);
  }
  function updateProgress() {
    const count = (start, end) => state.answers.slice(start, end).filter(Boolean).length;
    $('progress-p1').textContent = count(0, 20) + ' de 20 respondidas';
    $('progress-p2').textContent = count(20, 60) + ' de 40 respondidas';
  }
  function createGrid(id, start, end) {
    const target = $(id);
    target.textContent = '';
    for (let n = start; n <= end; n++) {
      const box = document.createElement('div');
      box.className = 'question';
      const title = document.createElement('strong');
      title.textContent = 'Questão ' + n;
      box.appendChild(title);
      const options = document.createElement('div');
      options.className = 'choices';
      for (const letter of letters) {
        const label = document.createElement('label');
        const input = document.createElement('input');
        input.type = 'radio'; input.name = 'q' + n; input.value = letter;
        input.setAttribute('aria-label', 'Questão ' + n + ', alternativa ' + letter);
        input.addEventListener('change', () => { state.answers[n - 1] = letter; updateProgress(); });
        label.append(input, document.createTextNode(letter));
        options.appendChild(label);
      }
      box.appendChild(options); target.appendChild(box);
    }
  }
  function pause() {
    if (!state.paused) { state.remaining = remaining(); state.paused = true; }
    else { state.paused = false; state.deadline = Date.now() + state.remaining * 1000; }
    $('pause').textContent = state.paused ? 'Retomar' : 'Pausar';
    $('exam-body').classList.toggle('hidden', state.paused);
    $('pause-notice').classList.toggle('hidden', !state.paused);
    renderTimer();
  }
  function finish(expired) {
    if (!state || state.finished) return;
    if (!expired && !confirm('Finalizar a simulação e seguir para os resultados?')) return;
    const left = remaining();
    state.finished = true;
    state.used = Math.min(state.duration, Math.max(0, state.duration - left));
    state.essay = $('essay').value.trim();
    clearInterval(interval);
    $('exam').classList.add('hidden'); $('results').classList.remove('hidden');
    $('time-used').textContent = (expired ? 'Tempo encerrado. ' : '') + 'Tempo utilizado: ' + clock(state.used) + ' de ' + clock(state.duration) + '.';
    const p1 = state.answers.slice(0, 20).filter(Boolean).length;
    const p2 = state.answers.slice(20).filter(Boolean).length;
    $('completion').innerHTML = '<div class="result-box"><strong>' + (p1 + p2) + '/60</strong>questões respondidas</div><div class="result-box"><strong>' + p1 + '/20</strong>respondidas em P1</div><div class="result-box"><strong>' + p2 + '/40</strong>respondidas em P2</div>';
    $('essay-result').textContent = state.essay || 'Nenhuma redação registrada.';
    updateReport(); window.scrollTo(0, 0);
  }
  function updateReport() {
    if (!state || !state.finished) return;
    report = 'ENEMetria — Simulado PC PE / Agente de Polícia\n' + $('time-used').textContent + '\n\n';
    report += 'Respostas: ' + state.answers.map((a, i) => (i + 1) + ':' + (a || '—')).join(' ') + '\n\n';
    if (state.feedbackText) report += state.feedbackText + '\n\n';
    else report += 'Desempenho por acertos: informe o gabarito no site para calcular.\n\n';
    report += 'Tema: ' + (state.theme || 'Não informado') + '\nRedação (sem correção automática):\n' + (state.essay || 'Não registrada.') + '\n';
  }
  $('start').addEventListener('click', () => {
    const duration = Number($('duration').value) * 60;
    state = { duration, deadline: Date.now() + duration * 1000, remaining: duration, paused: false, finished: false, answers: Array(60).fill(''), theme: $('theme').value.trim(), essay: '' };
    createGrid('p1', 1, 20); createGrid('p2', 21, 60); updateProgress();
    $('theme-display').textContent = state.theme ? 'Tema: ' + state.theme : 'Tema: utilize o tema da prova escolhida.';
    const file = $('pdf').files[0];
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    if (file) { pdfUrl = URL.createObjectURL(file); $('pdf-view').src = pdfUrl; $('pdf-section').classList.remove('hidden'); }
    else $('pdf-section').classList.add('hidden');
    $('setup').classList.add('hidden'); $('exam').classList.remove('hidden');
    $('exam-body').classList.remove('hidden'); $('pause-notice').classList.add('hidden'); $('pause').textContent = 'Pausar';
    renderTimer(); interval = setInterval(renderTimer, 1000); window.scrollTo(0, 0);
  });
  $('pause').addEventListener('click', pause);
  $('finish').addEventListener('click', () => finish(false));
  $('essay').addEventListener('input', () => {
    const text = $('essay').value.trim();
    $('essay-count').textContent = (text ? text.split(/\s+/).length : 0) + ' palavras · confira o limite de linhas no formato final';
  });
  $('correct').addEventListener('click', () => {
    const raw = $('key').value.toUpperCase().trim();
    if (!/^[A-E\s,;|.-]+$/.test(raw)) { $('key-error').textContent = 'Use apenas as alternativas A, B, C, D ou E e separadores.'; return; }
    const key = raw.replace(/[\s,;|.-]/g, '').split('');
    if (key.length !== 60) { $('key-error').textContent = 'São necessárias exatamente 60 alternativas; você informou ' + key.length + '.'; return; }
    $('key-error').textContent = '';
    const block = (start, end) => {
      let correct = 0, wrong = 0, blank = 0;
      for (let i = start; i < end; i++) {
        if (!state.answers[i]) blank++;
        else if (state.answers[i] === key[i]) correct++;
        else wrong++;
      }
      return { correct, wrong, blank, total: end - start };
    };
    const p1 = block(0, 20), p2 = block(20, 60), all = block(0, 60);
    const row = (label, result) => '<div class="result-box"><span>' + label + '</span><strong>' + result.correct + '/' + result.total + '</strong>' + Math.round(result.correct / result.total * 100) + '% de acertos<div class="meter"><span style="width:' + (result.correct / result.total * 100) + '%"></span></div><small>' + result.wrong + ' erradas · ' + result.blank + ' em branco</small></div>';
    const review = state.answers.map((answer, i) => (i + 1) + ': ' + (answer || 'em branco') + (answer === key[i] ? ' ✓' : ' → ' + key[i]));
    const p1rate = p1.correct / p1.total, p2rate = p2.correct / p2.total;
    let guidance = p1rate === p2rate ? 'Os dois blocos tiveram o mesmo percentual de acertos. Revise as questões erradas e não respondidas de ambos.' : 'Priorize a revisão de ' + (p1rate < p2rate ? 'P1 — Noções de Direito' : 'P2 — Conhecimentos Específicos') + ', que teve menor percentual de acertos nesta simulação.';
    const section = $('feedback');
    section.innerHTML = '<h2>Seu desempenho</h2><p class="muted">Percentuais sobre o total de questões de cada bloco. Este resultado é um diagnóstico de treino, não uma previsão de aprovação.</p><div class="results-grid">' + row('Total', all) + row('P1 · Noções de Direito', p1) + row('P2 · Conhecimentos Específicos', p2) + '</div><h3>Próximo passo</h3><p>' + guidance + '</p><h3>Revisão por questão</h3><p class="muted">Sua resposta → gabarito; ✓ indica acerto.</p><div class="review">' + review.join('<br>') + '</div>';
    section.classList.remove('hidden');
    state.feedbackText = 'Resultado: ' + all.correct + '/60 (' + Math.round(all.correct / 60 * 100) + '%)\nP1: ' + p1.correct + '/20 · P2: ' + p2.correct + '/40\n' + guidance + '\n\nRevisão: ' + review.join(' | ');
    updateReport(); section.scrollIntoView({behavior:'smooth'});
  });
  $('download').addEventListener('click', () => {
    updateReport(); const url = URL.createObjectURL(new Blob([report], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = 'enemetria-pcpe-relatorio.txt'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  $('restart').addEventListener('click', () => { if (confirm('Iniciar outra simulação? As respostas atuais serão apagadas.')) location.reload(); });
  window.addEventListener('beforeunload', event => {
    if (state && !state.finished) {
      event.preventDefault();
      event.returnValue = '';
    }
  });
})();
