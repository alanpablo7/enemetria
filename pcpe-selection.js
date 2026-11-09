(() => {
  'use strict';
  const select = document.getElementById('exam-select');
  const catalog = window.ENEMETRIA_EXAM_CATALOG;
  const requested = new URLSearchParams(location.search).get('prova');
  const entry = catalog.find(item => item.id === requested) || catalog[0];
  const exam = window.ENEMETRIA_EXAMS[entry.id];
  document.body.dataset.examId = exam.id;
  for (const item of catalog) {
    const option = document.createElement('option');
    option.value = item.id;
    option.textContent = item.title;
    select.append(option);
  }
  select.value = exam.id;
  select.onchange = () => {
    const next = catalog.find(item => item.id === select.value);
    if (next && next.id !== exam.id) location.assign(next.page);
  };
  document.getElementById('exam-description').textContent = exam.description || 'Caderno oficial aplicado em 25/02/2024, com os gabaritos preliminares fornecidos.';
  if (exam.kind !== 'autoral') return;
  document.title = 'Simulado autoral 01 · PC PE | ENeMeTria';
  const text = (id, value) => { document.getElementById(id).textContent = value; };
  text('setup-board', 'ENeMeTria · Autoral 01');
  text('setup-edition', 'Referência · PC PE 2024');
  text('exam-edition', 'SIMULADO AUTORAL 01');
  text('paper-board', 'ENeMeTria · SIMULADO AUTORAL');
  text('paper-edition', 'AGENTE DE POLÍCIA · EDIÇÃO 01');
  text('key-note', 'Correção pelo gabarito autoral comentado · edição revisada 01.');
  text('key-review', 'Compare sua resposta com o gabarito autoral e observe seu tempo e confiança.');
  text('key-summary', 'Consultar gabarito autoral utilizado');
  text('finish-key-note', 'Ao finalizar, suas respostas serão comparadas com o gabarito autoral.');
  for (const id of ['essay-fact', 'essay-outline', 'essay-card']) document.getElementById(id).hidden = true;
  document.querySelector('#delivery-card .delivery-consent').lastChild.textContent = ' Autorizo o envio do meu relatório, incluindo respostas e métricas, à equipe para análise com apoio de IA e retorno no meu e-mail.';
  document.querySelector('#p1').previousElementSibling.querySelector('p').textContent = 'Questões 01–10 e 31–40 · numeração do PDF autoral';
  document.querySelector('#p2').previousElementSibling.querySelector('p').textContent = 'Questões 11–30 e 41–60 · numeração do PDF autoral';
})();
