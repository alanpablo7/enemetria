// ENEMetria - Script Principal
document.addEventListener('DOMContentLoaded', function() {
    // Variáveis globais
    const state = {
        examDay: '',
        examYear: '',
        examBook: '',
        examColor: '',
        examType: '',
	uploadedPdfUrl: null,
        accessibilityOption: false,
        isExamStarted: false,
        isExamPaused: false,
        activeQuestion: null,
        activeArea: null,
        answers: {},
        skippedQuestions: {},
        questionTimes: {},
        areaTimes: {
            linguagens: 0,
            humanas: 0,
            redacao: 0,
            natureza: 0,
            matematica: 0
        },
        resolutionOrder: {
            linguagens: [],
            humanas: [],
            redacao: [],
            natureza: [],
            matematica: []
        },
        
	totalTime: 0,
        idleTime: 0,
        pauseTime: 0,
        startTime: null,
        currentQuestionStartTime: null,
        currentAreaStartTime: null,
        lastAreaActive: null,
        countdownIntervals: []
    
    };

    // ─── Caminho-base dos arquivos PDF  ──────────────
    const PDF_BASE = './pdfs/';

    // Temporizadores
    let mainTimer;
    let questionTimer;
    let areaTimer;
    let countdownTimer;

    // Elementos DOM
    const sections = {
        initialSetup: document.getElementById('initial-setup'),
        examControls: document.getElementById('exam-controls'),
        statsPanel: document.getElementById('stats-panel'),
        questionsSection: document.getElementById('questions-section'),
        questionModal: document.getElementById('question-modal'),
        resultsSection: document.getElementById('results-section'),
        historySection: document.getElementById('history-section'),
        countdownTimer: document.getElementById('countdown-timer')
    };

	// ---------- Controle de revisões ----------
	const answers = {};                // { 136: 'd', ... }
	const revisions = [];              // [{question:136, from:'D', to:'E'}, ...]
	// -----------------------------------------


    const controls = {
        startSetup: document.getElementById('start-setup'),
        startExam: document.getElementById('start-exam'),
        pauseExam: document.getElementById('pause-exam'),
        finishExam: document.getElementById('finish-exam'),
        downloadReport: document.getElementById('download-report'),
        toggleStats: document.getElementById('toggle-stats'),
        saveAnswer: document.getElementById('save-answer'),
        modalClose: document.getElementById('modal-close'),
        downloadResults: document.getElementById('download-results'),
        saveHistory: document.getElementById('save-history'),
        newSimulation: document.getElementById('new-simulation'),
        areaTabs: document.querySelectorAll('.area-tab'),
        redacaoRascunho: document.getElementById('redacao-rascunho'),
        redacaoFinal: document.getElementById('redacao-final'),
        timerToggle: document.getElementById('timer-toggle')
    };

    const displays = {
        mainTimerDisplay: document.getElementById('main-timer-display'),
        mainTimerContainer: document.getElementById('main-timer-container'),
        mainTimerValueContainer: document.getElementById('main-timer-value-container'),
        linguagensTimer: document.querySelector('#linguagens-timer .timer-value'),
        humanasTimer: document.querySelector('#humanas-timer .timer-value'),
        redacaoTimer: document.querySelector('#redacao-timer .timer-value'),
        naturezaTimer: document.querySelector('#natureza-timer .timer-value'),
        matematicaTimer: document.querySelector('#matematica-timer .timer-value'),
        currentQuestionNumber: document.getElementById('current-question-number'),
        currentAreaName: document.getElementById('current-area-name'),
        questionTimerValue: document.getElementById('question-timer-value'),
        statsContent: document.getElementById('stats-content'),
        summaryContent: document.getElementById('summary-content'),
        metricsContent: document.getElementById('metrics-content'),
        historyList: document.getElementById('history-list'),
        modalQuestionNumber: document.getElementById('modal-question-number'),
        countdownIntervalsContainer: document.getElementById('countdown-intervals-container')
    };

    const inputs = {
        examDay: document.getElementById('exam-day'),
        examYear: document.getElementById('exam-year'),
        examBook: document.getElementById('exam-book'),
        examColor: document.getElementById('exam-color'),
        examType: document.getElementById('exam-type'),
        accessibilityOption: document.getElementById('accessibility-option'),
        userName:      document.getElementById('user-name'),
	pdfUpload:     document.getElementById('pdf-upload')
    };

// ─── INÍCIO: listener para upload de PDF ───────────────────────
inputs.pdfUpload.addEventListener('change', e => {
  const file = e.target.files[0];
  if (file) {
    state.uploadedPdfUrl = URL.createObjectURL(file);
    // desativa tudo exceto dia da prova
    ['examYear','examBook','examColor','examType','accessibilityOption','userName']
      .forEach(key => inputs[key].disabled = true);
  } else {
    state.uploadedPdfUrl = null;
    ['examYear','examBook','examColor','examType','accessibilityOption','userName']
      .forEach(key => inputs[key].disabled = false);
  }
});
// ───── FIM do listener ─────────────────────────────────────────


    // Inicialização
    function init() {
        setupEventListeners();
        loadHistoryFromLocalStorage();
        hideAllSections();
        sections.initialSetup.classList.remove('hidden-section');
        sections.initialSetup.classList.add('active-section');
        
        
        // Adicionar evento para mostrar/ocultar cronômetro principal
        controls.timerToggle.parentElement.addEventListener('click', toggleMainTimer);
    }

    // Configuração de ouvintes de eventos
    function setupEventListeners() {
        // Botões de configuração e controle
        controls.startSetup.addEventListener('click', handleStartSetup);
        controls.startExam.addEventListener('click', handleStartExam);
        controls.pauseExam.addEventListener('click', handlePauseExam);
        controls.finishExam.addEventListener('click', handleFinishExam);
        controls.downloadReport.addEventListener('click', handleDownloadReport);
        controls.toggleStats.addEventListener('click', toggleStatsPanel);
        controls.saveAnswer.addEventListener('click', handleSaveAnswer);
        controls.modalClose.addEventListener('click', closeQuestionModal);
        controls.downloadResults.addEventListener('click', handleDownloadReport);
        controls.saveHistory.addEventListener('click', handleSaveHistory);
        controls.newSimulation.addEventListener('click', handleNewSimulation);
        controls.redacaoRascunho.addEventListener('click', () => handleRedacao('rascunho'));
        controls.redacaoFinal.addEventListener('click', () => handleRedacao('final'));

        // Abas de áreas
        controls.areaTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const area = tab.dataset.area;
                switchArea(area);
            });
        });

        // Tecla ESC para fechar modal
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && !sections.questionModal.classList.contains('hidden-section')) {
                closeQuestionModal();
            }
        });
    }


    
    // Função para mostrar/ocultar cronômetro principal
    function toggleMainTimer() {
        if (displays.mainTimerValueContainer.classList.contains('hidden')) {
            displays.mainTimerValueContainer.classList.remove('hidden');
            controls.timerToggle.classList.add('active');
        } else {
            displays.mainTimerValueContainer.classList.add('hidden');
            controls.timerToggle.classList.remove('active');
        }
    }

    // Manipuladores de eventos
    function handleStartSetup() {
        // Validar entradas
 // exige sempre Dia da Prova
 if (!inputs.examDay.value) {
   alert('Selecione o Dia da Prova.');
   return;
 }
 	// se não houver PDF, valida os campos normais
 	if (!state.uploadedPdfUrl && !validateSetupInputs()) {
	   alert('Preencha Ano, Caderno, Cor, Tipo e Nome, ou carregue um PDF.');
 	   return;
	 }
	 // garante que, se o usuário escolheu arquivo e foi direto no botão
	 if (!state.uploadedPdfUrl && inputs.pdfUpload.files[0]) {
	   state.uploadedPdfUrl = URL.createObjectURL(inputs.pdfUpload.files[0]);
	 }
        // Salvar configurações
        state.examDay = inputs.examDay.value;
        state.examYear = inputs.examYear.value;
        state.examBook = inputs.examBook.value;
        state.examColor = inputs.examColor.value;
        state.examType = inputs.examType.value;
        state.accessibilityOption = inputs.accessibilityOption.checked;

    	// SALVAR NOME e PDF no state
    	state.userName       = inputs.userName.value;
    	// se não veio pelo listener (caso o usuário carregue e clique direto em “Iniciar”)
    	if (!state.uploadedPdfUrl && inputs.pdfUpload.files[0]) {
  	    state.uploadedPdfUrl = URL.createObjectURL(inputs.pdfUpload.files[0]);
    	}


        // Gerar botões de questões
        generateQuestionButtons();

        // Mostrar/ocultar áreas com base no dia selecionado
        setupExamDay();

        // Mudar para a seção de questões
        hideAllSections();
        sections.examControls.classList.remove('hidden-section');
        sections.questionsSection.classList.remove('hidden-section');
        sections.examControls.classList.add('active-section');
        sections.questionsSection.classList.add('active-section');

        // Definir a primeira área visível como ativa na interface, mas não iniciar o cronômetro ainda
        const firstVisibleArea = document.querySelector('.area-questions:not(.hidden-section)');
        if (firstVisibleArea) {
            const areaId = firstVisibleArea.id.split('-')[0];
            
            // Apenas atualizar a interface, sem iniciar o cronômetro
            updateActiveAreaUI(areaId);
        }
    }

    function handleStartExam() {
        if (state.isExamStarted) return;

        state.isExamStarted = true;
        state.isExamPaused = false;
        state.startTime = new Date();

        // Iniciar cronômetros
        startMainTimer();
        
        // Iniciar contagem regressiva
        startCountdownTimer();
        
        // Atualizar controles
        controls.startExam.disabled = true;
        controls.pauseExam.disabled = false;
        controls.finishExam.disabled = false;

        // Atualizar status
        updateStatusDisplay();
    }

    function handlePauseExam() {
        if (!state.isExamStarted) return;

        if (state.isExamPaused) {
            // Retomar prova
            state.isExamPaused = false;
            controls.pauseExam.innerHTML = '<i class="fas fa-pause"></i> Pausar Prova';
	   // desconta o tempo em que a prova ficou pausada
	    const resumeTime = new Date();
	    state.pauseTime += (resumeTime - state.lastPauseStartTime) / 1000;
            
            // Se havia uma questão ativa, retomar seu cronômetro
            if (state.activeQuestion) {
                state.currentQuestionStartTime = new Date();
            }
            
            // Se havia uma área ativa, retomar seu cronômetro
            if (state.activeArea) {
                state.currentAreaStartTime = new Date();
            }
            
            // Retomar cronômetro principal
            startMainTimer();
            
            // Retomar contagem regressiva
            startCountdownTimer();
        } else {
            // Pausar prova
            state.isExamPaused = true;
            controls.pauseExam.innerHTML = '<i class="fas fa-play"></i> Retomar Prova';
            
            // Pausar cronômetros
            clearInterval(mainTimer);
            clearInterval(questionTimer);
            clearInterval(areaTimer);
            clearInterval(countdownTimer);
            
            // Registrar tempo de pausa
            const pauseStartTime = new Date();
            state.lastPauseStartTime = pauseStartTime;
            
            // Se havia uma questão ativa, registrar o tempo decorrido
            if (state.activeQuestion && state.currentQuestionStartTime) {
                const questionTimeElapsed = (pauseStartTime - state.currentQuestionStartTime) / 1000;
                state.questionTimes[state.activeQuestion] = (state.questionTimes[state.activeQuestion] || 0) + questionTimeElapsed;
            }
            
            // Se havia uma área ativa, registrar o tempo decorrido
            if (state.activeArea && state.currentAreaStartTime) {
                const areaTimeElapsed = (pauseStartTime - state.currentAreaStartTime) / 1000;
                state.areaTimes[state.activeArea] = (state.areaTimes[state.activeArea] || 0) + areaTimeElapsed;
            }
        }
    }

    function handleFinishExam() {
        if (!state.isExamStarted) return;
        
        // Verificar se há questão ativa
        if (state.activeQuestion) {
            alert('Por favor, encerre a questão atual antes de finalizar a prova.');
            return;
        }

 	// ► consolidar tempo da área ativa antes de parar tudo
    if (state.activeArea && state.currentAreaStartTime) {
        const now = new Date();
        const timeSpent = (now - state.currentAreaStartTime) / 1000;
        state.areaTimes[state.activeArea] =
            (state.areaTimes[state.activeArea] || 0) + timeSpent;

        // evita contar duas vezes caso algo reabra
        state.currentAreaStartTime = null;
    }
        
        // Parar todos os cronômetros
        clearInterval(mainTimer);
        clearInterval(questionTimer);
        clearInterval(areaTimer);
        clearInterval(countdownTimer);
        
        // Ocultar contagem regressiva
        sections.countdownTimer.classList.add('hidden-section');
        
        // Calcular tempo total
        const endTime = new Date();
        state.totalTime = (endTime - state.startTime) / 1000 - state.pauseTime;
        
        // Calcular métricas
        calculateMetrics();
        
        // Exibir resultados
        displayResults();
        
        // Mudar para a seção de resultados
        hideAllSections();
        sections.resultsSection.classList.remove('hidden-section');
        sections.resultsSection.classList.add('active-section');
        
        // Habilitar botão de download
        controls.downloadReport.disabled = false;
    }

    async function handleDownloadReport() {
        // Gerar relatório
        let report = generateReport();

         // === INÍCIO DA MODIFICAÇÃO: anexar gabarito.txt na mesma pasta do PDF ===
    try {
      // Monta a pasta onde está o PDF (sem o #page)
      const pastaDoPdf = `${PDF_BASE}${state.examYear}/${state.examType}/${state.examDay}/`;
      const caminhoGabarito = `${pastaDoPdf}gabarito.txt`;
 
      const res = await fetch(caminhoGabarito);
      if (res.ok) {
        const gabaritoText = await res.text();
      // === Gabarito Oficial vs. Suas Respostas ===
      report += '\n=== Gabarito Oficial vs. Suas Respostas ===\n';
      report += `${'Nº Questão'.padEnd(10)}${'Sua Resposta'.padEnd(14)}${'Gabarito Oficial'.padEnd(18)}${'Acertou?'.padEnd(10)}${'Tempo Gasto'.padEnd(12)}\n`;
      const gabaritoOficial = {};
      // Cada linha do gabarito deve ter "número" e "alternativa" separados por espaço
      gabaritoText.trim().split(/\r?\n/).forEach(linha => {
        const [num, alt] = linha.trim().split(/\s+/);
        if (num && alt) gabaritoOficial[num] = alt.toUpperCase();
      });
      Object.keys(gabaritoOficial)
        .sort((a, b) => parseInt(a) - parseInt(b))
        .forEach(numero => {
          const sua = (state.answers[numero] || '—').toUpperCase();
          const oficial = gabaritoOficial[numero];
          const acertou = sua === oficial ? '✅' : '❌';
          const tempo = state.questionTimes[numero]
            ? formatTime(state.questionTimes[numero])
            : '—';
          report += `${numero.toString().padEnd(10)}${sua.padEnd(14)}${oficial.padEnd(18)}${acertou.padEnd(10)}${tempo.padEnd(12)}\n`;
        });

       // ─── Estatísticas Finais ──────────────────────────────────────
       const total = Object.keys(gabaritoOficial).length;
       const acertos = Object.keys(gabaritoOficial)
         .filter(num => (state.answers[num]||'—').toUpperCase() === gabaritoOficial[num])
         .length;
       const erros = total - acertos;
       const tempos = Object.entries(state.questionTimes)
         .filter(([num]) => num in gabaritoOficial)
         .map(([, t]) => t);
       const tempoTotal = tempos.reduce((a, b) => a + b, 0);
       const mediaGeral = tempoTotal / tempos.length;
       const temposAcertos = Object.entries(state.questionTimes)
         .filter(([num]) => (state.answers[num]||'—').toUpperCase() === gabaritoOficial[num])
         .map(([, t]) => t);
       const temposErros = Object.entries(state.questionTimes)
         .filter(([num]) => (state.answers[num]||'—').toUpperCase() !== gabaritoOficial[num] && num in gabaritoOficial)
         .map(([, t]) => t);
       function fmt(segs) {
         const h = Math.floor(segs/3600);
         const m = Math.floor((segs%3600)/60);
         const s = Math.floor(segs%60);
         return `${h? h+'h':''}${m? m+'min':''}${s? s+'s':''}`;
       }
       report += `\n✅ Acertos: ${acertos} de ${total}\n`;
       report += `❌ Erros: ${erros}\n`;
       report += `⏳ Tempo Total Gasto nas ${total}: ${fmt(tempoTotal)} (tempo médio: ${fmt(mediaGeral)})\n`;
       report += `⏱️ Tempo médio nas que ACERTOU: ${fmt( temposAcertos.reduce((a,b)=>a+b,0)/temposAcertos.length )}\n`;
       report += `⌛ Tempo médio nas que ERROU: ${fmt( temposErros.reduce((a,b)=>a+b,0)/temposErros.length )}\n`;
       // ────────────────────────────────────────────────────────────────


      } else {
        console.warn('gabarito.txt não encontrado em', caminhoGabarito, res.status);
      }
    } catch (err) {
      console.error('Erro ao carregar gabarito.txt:', err);
    }
    // === FIM DA MODIFICAÇÃO ===
   
        // Criar blob e link para download
        const blob = new Blob([report], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
   // → Captura o nome do usuário e remove espaços
   const username = document.getElementById('user-name')
       .value.trim().toUpperCase() || 'USUARIO';
   // → Define o nome do arquivo incluindo o nome do usuário
   a.download = `ENEMetria_${username}_Relatorio_${formatDate(new Date())}.txt`;

        document.body.appendChild(a);
        a.click();
        
        // Limpar
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    }

    function handleSaveHistory() {
        // Gerar dados para histórico
        const historyItem = {
            id: Date.now(),
            date: new Date().toISOString(),
            examDay: state.examDay,
            examYear: state.examYear,
            examBook: state.examBook,
            examColor: state.examColor,
            examType: state.examType,

            accessibilityOption: state.accessibilityOption,
            totalTime: state.totalTime,
            areaTimes: state.areaTimes,
            questionTimes: state.questionTimes,
            answers: state.answers,
            skippedQuestions: state.skippedQuestions
        };
        
        // Salvar no localStorage
        const history = JSON.parse(localStorage.getItem('enemetria_history') || '[]');
        history.push(historyItem);
        localStorage.setItem('enemetria_history', JSON.stringify(history));
        
        // Atualizar exibição do histórico
        loadHistoryFromLocalStorage();
        
        // Mostrar seção de histórico
        hideAllSections();
        sections.historySection.classList.remove('hidden-section');
        sections.historySection.classList.add('active-section');
        
        alert('Simulação salva no histórico com sucesso!');
    }

    function handleNewSimulation() {
        // Resetar estado
        resetState();
   
 // ─── Limpa revisões ───
    revisions.length = 0;
    document.getElementById('revision-count').textContent = '0';
    for (const q in answers) delete answers[q];
    // ───────────────────────

        
        // Voltar para a tela inicial
        hideAllSections();
        sections.initialSetup.classList.remove('hidden-section');
        sections.initialSetup.classList.add('active-section');
    }

    function handleQuestionClick(questionNumber) {
        if (!state.isExamStarted) {
            alert('Por favor, inicie a prova primeiro.');
            return;
        }
        
        if (state.isExamPaused) {
            alert('A prova está pausada. Retome a prova para continuar.');
            return;
        }
        
        // Se já houver uma questão ativa, encerrar primeiro
        if (state.activeQuestion && state.activeQuestion !== questionNumber) {
            alert('Por favor, desmarque a questão atual antes de passar para próxima.');
            return;
        }
        
        // Determinar a área da questão
        let area;
        const questionNum = parseInt(questionNumber);
        if (questionNum >= 1 && questionNum <= 45) {
            area = 'linguagens';
        } else if (questionNum >= 46 && questionNum <= 90) {
            area = 'humanas';
        } else if (questionNum >= 91 && questionNum <= 135) {
            area = 'natureza';
        } else if (questionNum >= 136 && questionNum <= 180) {
            area = 'matematica';
        }
        
        // Se a área for diferente da área ativa atual, mudar para a nova área
        if (area && area !== state.activeArea) {
            switchArea(area);
        }
        
        // Atualizar estado
        state.activeQuestion = questionNumber;
        state.currentQuestionStartTime = new Date();
        
        // Iniciar cronômetro da questão
        startQuestionTimer();
        
        // Atualizar interface
        if (!questionNumber.startsWith('redacao')) {
            const questionButton = document.querySelector(`.question-button[data-question="${questionNumber}"]`);
            if (questionButton) {
                questionButton.classList.add('active');
                openQuestionModal(questionNumber);
            }
        }
        
        // Atualizar status
        updateStatusDisplay();
    }

    function endQuestion() {
        if (!state.activeQuestion) return;
        
        // Registrar tempo gasto na questão
        const now = new Date();
        const timeSpent = (now - state.currentQuestionStartTime) / 1000;
        state.questionTimes[state.activeQuestion] = (state.questionTimes[state.activeQuestion] || 0) + timeSpent;
        
                // ► Registrar ordem (inclui duplicatas se o aluno reabrir a questão depois)
        if (state.activeArea) {
            state.resolutionOrder[state.activeArea].push({q: state.activeQuestion, time: Date.now()});
        }
        // Verificar se a questão foi respondida
        if (!state.activeQuestion.startsWith('redacao') && !state.answers[state.activeQuestion]) {
            // Marcar como pulada
            state.skippedQuestions[state.activeQuestion] = true;
            
            // Atualizar interface
            const questionButton = document.querySelector(`.question-button[data-question="${state.activeQuestion}"]`);
            if (questionButton) {
                questionButton.classList.add('skipped');
            }
        }
        
        // Atualizar interface
        if (!state.activeQuestion.startsWith('redacao')) {
            const questionButton = document.querySelector(`.question-button[data-question="${state.activeQuestion}"]`);
            if (questionButton) {
                questionButton.classList.remove('active');
            }
        } else {
            controls.redacaoRascunho.classList.remove('active');
            controls.redacaoFinal.classList.remove('active');
            // Resetar cor dos botões de redação
            controls.redacaoRascunho.style.backgroundColor = '';
            controls.redacaoFinal.style.backgroundColor = '';
        }
        
        // Limpar estado
        state.lastQuestionResolved = state.activeQuestion;
        state.activeQuestion = null;
        state.currentQuestionStartTime = null;
        
        // Parar cronômetro da questão
        clearInterval(questionTimer);
        displays.questionTimerValue.textContent = formatTime(timeSpent);
        
        // Atualizar status
        updateStatusDisplay();
        
        // Atualizar estatísticas
        updateStatsDisplay();
    }


  function buildPdfPath(questionNumber) {
      // Ex.: pdfs/2024/regular/primeiro/amarelo.pdf#page=91
      return `${PDF_BASE}${state.examYear}/` +
             `${state.examType}/` +
             `${state.examDay}/` +
             `${state.examColor}.pdf#page=${questionNumber}`;
  }


    function openQuestionModal(questionNumber) {
        // Configurar modal
        displays.modalQuestionNumber.textContent = `Questão ${questionNumber.padStart(2, '0')}`;
	
    if (!questionNumber.startsWith('redacao')) {
         const viewer = document.getElementById('pdf-viewer');
         if (viewer) {
             // usa o PDF do usuário, se houver; senão, o padrão
        if (state.uploadedPdfUrl) {
            // abre o PDF carregado já na página da questão
            viewer.src = `${state.uploadedPdfUrl}#page=${questionNumber}`;
          } else {
            viewer.src = buildPdfPath(questionNumber);
          }
       }
     } else {
         const viewer = document.getElementById('pdf-viewer');
         if (viewer) viewer.src = '';
     }

        
        // Limpar seleção anterior
        document.querySelectorAll('input[name="question-alternative"]').forEach(radio => {
            radio.checked = false;
        });
        
        // Selecionar resposta salva, se existir
        if (state.answers[questionNumber]) {
            const savedAnswer = state.answers[questionNumber];
            const radioToCheck = document.getElementById(`alt-${savedAnswer}`);
            if (radioToCheck) {
                radioToCheck.checked = true;
            }
        }
        
        // Exibir modal
        sections.questionModal.classList.remove('hidden-section');
    }

    function closeQuestionModal() {
        sections.questionModal.classList.add('hidden-section');
        
        // Se a questão não foi respondida, marcar como pulada
        if (state.activeQuestion && !state.answers[state.activeQuestion]) {
            state.skippedQuestions[state.activeQuestion] = true;
            
            // Atualizar interface
            const questionButton = document.querySelector(`.question-button[data-question="${state.activeQuestion}"]`);
            if (questionButton) {
                questionButton.classList.add('skipped');
            }
        }
        
        // Encerrar questão
        endQuestion();
    }

    // Funções de área
    function switchArea(area) {
        // Se a área já estiver ativa, não fazer nada
        if (area === state.activeArea) return;
        
        // Registrar tempo da área anterior se a prova estiver iniciada
        if (state.isExamStarted && state.activeArea && state.currentAreaStartTime) {
            const now = new Date();
            const timeSpent = (now - state.currentAreaStartTime) / 1000;
            state.areaTimes[state.activeArea] = (state.areaTimes[state.activeArea] || 0) + timeSpent;
        }
        
        // Atualizar estado
        state.lastAreaActive = state.activeArea;
        state.activeArea = area;
        
        // Iniciar cronômetro da área apenas se a prova estiver iniciada
        if (state.isExamStarted) {
            state.currentAreaStartTime = new Date();
            startAreaTimer();
        }
        
        // Atualizar interface
        updateActiveAreaUI(area);
        
        // Atualizar status
        updateStatusDisplay();
    }
    
    // Função para atualizar apenas a interface da área ativa, sem iniciar cronômetros
    function updateActiveAreaUI(area) {
        controls.areaTabs.forEach(tab => {
            tab.classList.remove('active');
            if (tab.dataset.area === area) {
                tab.classList.add('active');
            }
        });
        
        document.querySelectorAll('.area-questions').forEach(areaSection => {
            areaSection.classList.remove('active');
        });
        
        const activeAreaSection = document.getElementById(`${area}-questions`);
        if (activeAreaSection) {
            activeAreaSection.classList.add('active');
        }
    }

    function setupExamDay() {
        const isPrimeirodia = state.examDay === 'primeiro';
        const isSegundoDia = state.examDay === 'segundo';
        
        // Configurar tempo total com base no dia e na opção de acessibilidade
        let totalHours;
        if (isPrimeirodia) {
            totalHours = state.accessibilityOption ? 6.5 : 5.5;
        } else {
            totalHours = state.accessibilityOption ? 6 : 5;
        }
        
        const hours = Math.floor(totalHours);
        const minutes = Math.round((totalHours - hours) * 60);
        
        displays.mainTimerDisplay.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`;
        
        // Configurar intervalos de contagem regressiva
        state.countdownIntervals = [];
        let timeInMinutes = hours * 60 + minutes;
        
        
        // Adicionar intervalos de 30 minutos
        while (timeInMinutes > 0) {
            state.countdownIntervals.push(timeInMinutes);
            timeInMinutes -= 30;
        }
        
        // Mostrar/ocultar áreas
        document.querySelectorAll('.area-tab').forEach(tab => {
            const area = tab.dataset.area;
            if (isPrimeirodia && (area === 'linguagens' || area === 'humanas' || area === 'redacao')) {
                tab.style.display = 'block';
            } else if (isSegundoDia && (area === 'natureza' || area === 'matematica')) {
                tab.style.display = 'block';
            } else {
                tab.style.display = 'none';
            }
        });
        
        document.querySelectorAll('.area-questions').forEach(areaSection => {
            const area = areaSection.id.split('-')[0];
            if (isPrimeirodia && (area === 'linguagens' || area === 'humanas' || area === 'redacao')) {
                areaSection.classList.remove('hidden-section');
            } else if (isSegundoDia && (area === 'natureza' || area === 'matematica')) {
                areaSection.classList.remove('hidden-section');
            } else {
                areaSection.classList.add('hidden-section');
            }
        });
        
        // Mostrar/ocultar cronômetros de área
        document.querySelectorAll('.area-timer').forEach(timer => {
            const area = timer.id.split('-')[0];
            if (isPrimeirodia && (area === 'linguagens' || area === 'humanas' || area === 'redacao')) {
                timer.style.display = 'flex';
            } else if (isSegundoDia && (area === 'natureza' || area === 'matematica')) {
                timer.style.display = 'flex';
            } else {
                timer.style.display = 'none';
            }
        });
    }

    // Funções de cronômetro
    function startMainTimer() {
        clearInterval(mainTimer);
        
        const updateTimer = () => {
            if (state.isExamPaused) return;
            
            const now = new Date();
            const elapsedSeconds = Math.floor((now - state.startTime) / 1000) - state.pauseTime;
            const timeString = formatTime(elapsedSeconds);
            displays.mainTimerDisplay.textContent = timeString;
        };
        
        mainTimer = setInterval(updateTimer, 1000);
        updateTimer();
    }

    function startQuestionTimer() {
        clearInterval(questionTimer);
        
        const updateTimer = () => {
            if (state.isExamPaused || !state.activeQuestion || !state.currentQuestionStartTime) return;
            
            const now = new Date();
            const elapsedSeconds = Math.floor((now - state.currentQuestionStartTime) / 1000);
            const previousTime = state.questionTimes[state.activeQuestion] || 0;
            const totalTime = previousTime + elapsedSeconds;
            const timeString = formatTime(totalTime);
            displays.questionTimerValue.textContent = timeString;
        };
        
        questionTimer = setInterval(updateTimer, 1000);
        updateTimer();
    }

    function startAreaTimer() {
        clearInterval(areaTimer);
        
        const updateTimer = () => {
            if (state.isExamPaused || !state.activeArea || !state.currentAreaStartTime) return;
            
            const now = new Date();
            const elapsedSeconds = Math.floor((now - state.currentAreaStartTime) / 1000);
            const previousTime = state.areaTimes[state.activeArea] || 0;
            const totalTime = previousTime + elapsedSeconds;
            
            // Atualizar o cronômetro da área ativa
            const areaTimerDisplay = document.querySelector(`#${state.activeArea}-timer .timer-value`);
            if (areaTimerDisplay) {
                areaTimerDisplay.textContent = formatTime(totalTime);
            }
        };
        
        areaTimer = setInterval(updateTimer, 1000);
        updateTimer();
    }

    function startCountdownTimer() {
        clearInterval(countdownTimer);
        
        // Mostrar contagem regressiva
        sections.countdownTimer.classList.remove('hidden-section');
        
        // Criar elementos para todos os intervalos de tempo
        createCountdownIntervals();
        
        const updateCountdown = () => {
            if (state.isExamPaused) return;
            
            const now = new Date();
            const elapsedSeconds = Math.floor((now - state.startTime) / 1000) - state.pauseTime;
            const remainingSeconds = getTotalExamTimeInSeconds() - elapsedSeconds;
            
            if (remainingSeconds <= 0) {
                // Tempo acabou
                clearInterval(countdownTimer);
                sections.countdownTimer.classList.add('hidden-section');
                displays.mainTimerContainer.classList.add('hidden');
                alert('O tempo da prova acabou!');
                return;
            }
            
            const remainingMinutes = Math.ceil(remainingSeconds / 60);
            
            // Verificar alertas especiais
            if (remainingMinutes === 30 && remainingSeconds % 60 === 0) {
                alert('Atenção! Falta apenas 30 min para o término da prova.');
            } else if (remainingMinutes === 15 && remainingSeconds % 60 === 0) {
                alert('Atenção! Falta apenas 15 min para o término da prova. É importante que você comece a preencher seu gabarito');
                displays.mainTimerContainer.classList.add('hidden');
            }
            
            // Atualizar exibição da contagem regressiva
            updateCountdownIntervals(remainingMinutes);
        };
        
        countdownTimer = setInterval(updateCountdown, 1000);
        updateCountdown();
    }
    
    // Função para criar elementos para todos os intervalos de tempo
    function createCountdownIntervals() {
        // Limpar contêiner
        displays.countdownIntervalsContainer.innerHTML = '';
        
        // Criar elementos para cada intervalo
        state.countdownIntervals.forEach((minutes, index) => {
            const hours = Math.floor(minutes / 60);
            const mins = minutes % 60;
            const timeString = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:00`;
            
            const intervalElement = document.createElement('div');
            intervalElement.className = 'countdown-interval';
            intervalElement.dataset.minutes = minutes;
            intervalElement.textContent = timeString;
            
            // O primeiro intervalo é o ativo
            if (index === 0) {
                intervalElement.classList.add('active');
            }
            
            displays.countdownIntervalsContainer.appendChild(intervalElement);
        });
    }
    
    // Função para atualizar a exibição dos intervalos de contagem regressiva
    function updateCountdownIntervals(remainingMinutes) {
        const intervalElements = document.querySelectorAll('.countdown-interval');
        
        intervalElements.forEach(element => {
            const minutes = parseInt(element.dataset.minutes);
            
            // Marcar como completado se o tempo já passou
            if (minutes > remainingMinutes) {
                element.classList.add('completed');
                element.classList.remove('active');
            }
            // Marcar como ativo se for o próximo intervalo
            else if (minutes <= remainingMinutes && 
                    (!element.previousElementSibling || 
                     element.previousElementSibling.classList.contains('completed'))) {
                element.classList.add('active');
                element.classList.remove('completed');
            }
            // Caso contrário, remover ambas as classes
            else {
                element.classList.remove('active');
                element.classList.remove('completed');
            }
        });
    }

    function getTotalExamTimeInSeconds() {
        const isPrimeirodia = state.examDay === 'primeiro';
        let totalHours;
        
        if (isPrimeirodia) {
            totalHours = state.accessibilityOption ? 6.5 : 5.5;
        } else {
            totalHours = state.accessibilityOption ? 6 : 5;
        }
        
        return totalHours * 3600;
    }

    // Funções de atualização de interface
    function updateStatusDisplay() {
        // Atualizar questão atual
        if (state.activeQuestion) {
            if (state.activeQuestion.startsWith('redacao')) {
                const type = state.activeQuestion.split('-')[1];
                displays.currentQuestionNumber.textContent = `Redação (${type === 'rascunho' ? 'Rascunho' : 'Final'})`;
            } else {
                displays.currentQuestionNumber.textContent = state.activeQuestion;
            }
        } else {
            displays.currentQuestionNumber.textContent = state.lastQuestionResolved || 'Nenhuma';
        }
        
        // Atualizar área atual
        if (state.activeArea) {
            const areaNames = {
                linguagens: 'Linguagens',
                humanas: 'Humanas',
                redacao: 'Redação',
                natureza: 'Natureza',
                matematica: 'Matemática'
            };
            displays.currentAreaName.textContent = areaNames[state.activeArea] || 'Nenhuma';
        } else {
            displays.currentAreaName.textContent = 'Nenhuma';
        }
    }

    function updateStatsDisplay() {
        if (!state.isExamStarted) {
            displays.statsContent.innerHTML = '<p>As estatísticas aparecerão aqui durante a prova.</p>';
            return;
        }
        
        // Calcular estatísticas
        const totalQuestions = getTotalQuestions();
        const answeredQuestions = Object.keys(state.answers).length;
        const skippedQuestions = Object.keys(state.skippedQuestions).length;
        const remainingQuestions = totalQuestions - answeredQuestions;
        
        // Calcular tempo médio por questão
        let totalQuestionTime = 0;
        let questionCount = 0;
        
        for (const question in state.questionTimes) {
            if (state.questionTimes.hasOwnProperty(question)) {
                totalQuestionTime += state.questionTimes[question];
                questionCount++;
            }
        }
        
        const averageTimePerQuestion = questionCount > 0 ? totalQuestionTime / questionCount : 0;
        
        // Gerar HTML
        let statsHTML = `
            <div class="stats-item">
                <h4>Progresso</h4>
                <p>Questões respondidas: ${answeredQuestions} de ${totalQuestions} (${Math.round(answeredQuestions / totalQuestions * 100)}%)</p>
                <p>Questões puladas: ${skippedQuestions}</p>
                <p>Questões restantes: ${remainingQuestions}</p>
            </div>
            <div class="stats-item">
                <h4>Tempo</h4>
                <p>Tempo médio por questão: ${formatTime(averageTimePerQuestion)}</p>
            </div>
            <div class="stats-item">
                <h4>Tempo por Área</h4>
        `;
        
        // Adicionar tempo por área
        for (const area in state.areaTimes) {
            if (state.areaTimes.hasOwnProperty(area)) {
                // Verificar se a área está ativa no dia selecionado
                const areaElement = document.getElementById(`${area}-timer`);
                if (areaElement && areaElement.style.display !== 'none') {
                    const areaNames = {
                        linguagens: 'Linguagens',
                        humanas: 'Humanas',
                        redacao: 'Redação',
                        natureza: 'Natureza',
                        matematica: 'Matemática'
                    };
                    
                    // Calcular tempo atual da área
                    let areaTime = state.areaTimes[area];
                    
                    // Se for a área ativa, adicionar o tempo decorrido desde o início
                    if (area === state.activeArea && state.currentAreaStartTime && !state.isExamPaused) {
                        const now = new Date();
                        const elapsedSeconds = Math.floor((now - state.currentAreaStartTime) / 1000);
                        areaTime += elapsedSeconds;
                    }
                    
                    statsHTML += `<p>${areaNames[area]}: ${formatTime(areaTime)}</p>`;
                }
            }
        }
        
        statsHTML += '</div>';
        
        // Atualizar conteúdo
        displays.statsContent.innerHTML = statsHTML;
    }

    function toggleStatsPanel() {
        if (sections.statsPanel.classList.contains('hidden-section')) {
            sections.statsPanel.classList.remove('hidden-section');
            controls.toggleStats.innerHTML = '<i class="fas fa-chart-bar"></i> Ocultar Estatísticas';
            updateStatsDisplay();
        } else {
            sections.statsPanel.classList.add('hidden-section');
            controls.toggleStats.innerHTML = '<i class="fas fa-chart-bar"></i> Mostrar Estatísticas';
        }
    }

    // Funções de redação
    function handleRedacao(type) {
        if (!state.isExamStarted) {
            alert('Por favor, inicie a prova primeiro.');
            return;
        }
        
        if (state.isExamPaused) {
            alert('A prova está pausada. Retome a prova para continuar.');
            return;
        }
        
        // Se já houver uma questão ativa, encerrar primeiro
        if (state.activeQuestion && state.activeQuestion !== `redacao-${type}`) {
            alert('Por favor, desmarque a questão atual antes de passar para próxima.');
            return;
        }
        
        // Se a área ativa não for redação, mudar para redação
        if (state.activeArea !== 'redacao') {
            switchArea('redacao');
        }
        
        // Se a mesma opção de redação já estiver ativa, desativar
        if (state.activeQuestion === `redacao-${type}`) {
            endQuestion();
            return;
        }
        
        // Atualizar estado
        state.activeQuestion = `redacao-${type}`;
        state.currentQuestionStartTime = new Date();
        
        // Iniciar cronômetro da questão
        startQuestionTimer();
        
        // Atualizar interface
        if (type === 'rascunho') {
            controls.redacaoRascunho.classList.add('active');
            controls.redacaoRascunho.style.backgroundColor = 'red';
            controls.redacaoFinal.classList.remove('active');
            controls.redacaoFinal.style.backgroundColor = '';
        } else {
            controls.redacaoFinal.classList.add('active');
            controls.redacaoFinal.style.backgroundColor = 'red';
            controls.redacaoRascunho.classList.remove('active');
            controls.redacaoRascunho.style.backgroundColor = '';
        }
        
        // Atualizar status
        updateStatusDisplay();
    }

    // Funções de resposta
    function handleSaveAnswer() {
        if (!state.activeQuestion || state.activeQuestion.startsWith('redacao')) {
            return;
        }
        
        // Obter alternativa selecionada
        const selectedAlternative = document.querySelector('input[name="question-alternative"]:checked');
        if (!selectedAlternative) {
            alert('Por favor, selecione uma alternativa.');
            return;
        }
        
        // Salvar resposta
        state.answers[state.activeQuestion] = selectedAlternative.value;

    // ─── Registra revisão ───
    const previous = answers[state.activeQuestion];
    const newValue = selectedAlternative.value;
    if (previous && previous !== newValue) {
        revisions.push({
            question: Number(state.activeQuestion),
            from: previous.toUpperCase(),
            to:   newValue.toUpperCase()
        });
        document.getElementById('revision-count').textContent = revisions.length;
    }
    answers[state.activeQuestion] = newValue;
    // ────────────────────────

        
        // Atualizar interface
        const questionButton = document.querySelector(`.question-button[data-question="${state.activeQuestion}"]`);
        if (questionButton) {
            questionButton.classList.remove('skipped');
            questionButton.classList.add('answered');
        }
        
        // Fechar modal
        closeQuestionModal();
        
        // Atualizar estatísticas
        updateStatsDisplay();
    }

    // Funções de geração de questões
    function generateQuestionButtons() {
        const linguagensGrid = document.querySelector('#linguagens-questions .questions-grid');
        const humanasGrid = document.querySelector('#humanas-questions .questions-grid');
        const naturezaGrid = document.querySelector('#natureza-questions .questions-grid');
        const matematicaGrid = document.querySelector('#matematica-questions .questions-grid');
        
        // Limpar grids
        linguagensGrid.innerHTML = '';
        humanasGrid.innerHTML = '';
        naturezaGrid.innerHTML = '';
        matematicaGrid.innerHTML = '';
        
        // Gerar botões de questões
        for (let i = 1; i <= 180; i++) {
            const button = document.createElement('button');
            button.className = 'question-button';
            button.textContent = i.toString().padStart(2, '0');
            button.dataset.question = i;
            button.addEventListener('click', () => handleQuestionClick(i.toString()));
            
            // Adicionar ao grid correspondente
            if (i <= 45) {
                linguagensGrid.appendChild(button);
            } else if (i <= 90) {
                humanasGrid.appendChild(button);
            } else if (i <= 135) {
                naturezaGrid.appendChild(button);
            } else {
                matematicaGrid.appendChild(button);
            }
        }
    }

    // Funções de resultados
    function calculateMetrics() {
        // Calcular tempo por área
        const areaTimesFormatted = {};
        for (const area in state.areaTimes) {
            if (state.areaTimes.hasOwnProperty(area)) {
                areaTimesFormatted[area] = formatTime(state.areaTimes[area]);
            }
        }
        
        // Calcular tempo médio por questão
        let totalQuestionTime = 0;
        let questionCount = 0;
        
        for (const question in state.questionTimes) {
            if (state.questionTimes.hasOwnProperty(question)) {
                totalQuestionTime += state.questionTimes[question];
                questionCount++;
            }
        }
        
        const averageTimePerQuestion = questionCount > 0 ? totalQuestionTime / questionCount : 0;
        
        // Calcular questões puladas que foram respondidas corretamente
        let skippedCorrectCount = 0;
        for (const question in state.skippedQuestions) {
            if (state.skippedQuestions.hasOwnProperty(question) && state.answers[question]) {
                skippedCorrectCount++;
            }
        }
        
        // Salvar métricas no estado
        state.metrics = {
            totalTime: formatTime(state.totalTime),
            areaTimesFormatted,
            averageTimePerQuestion: formatTime(averageTimePerQuestion),
            answeredQuestions: Object.keys(state.answers).length,
            skippedQuestions: Object.keys(state.skippedQuestions).length,
            skippedCorrectCount
        };
    }

    function displayResults() {
        // Exibir resumo
        displays.summaryContent.innerHTML = `
            <p><strong>Dia da Prova:</strong> ${state.examDay === 'primeiro' ? 'Primeiro Dia' : 'Segundo Dia'}</p>
            <p><strong>Ano:</strong> ${state.examYear}</p>
            <p><strong>Caderno:</strong> ${state.examBook} (${state.examColor})</p>
            <p><strong>Tipo de Aplicação:</strong> ${state.examType}</p>
            <p><strong>Tempo Total:</strong> ${state.metrics.totalTime}</p>
        `;
        
        // Exibir métricas
        let metricsHTML = `
            <p><strong>Questões Respondidas:</strong> ${state.metrics.answeredQuestions} de ${getTotalQuestions()}</p>
            <p><strong>Questões Puladas:</strong> ${state.metrics.skippedQuestions}</p>
            <p><strong>Questões Puladas, mas respondidas:</strong> ${state.metrics.skippedCorrectCount}</p>
            <p><strong>Tempo Médio por Questão:</strong> ${state.metrics.averageTimePerQuestion}</p>
            <h4>Tempo por Área:</h4>
        `;
        
        // Adicionar tempo por área
        for (const area in state.metrics.areaTimesFormatted) {
            if (state.metrics.areaTimesFormatted.hasOwnProperty(area)) {
                // Verificar se a área está ativa no dia selecionado
                const areaElement = document.getElementById(`${area}-timer`);
                if (areaElement && areaElement.style.display !== 'none') {
                    const areaNames = {
                        linguagens: 'Linguagens',
                        humanas: 'Humanas',
                        redacao: 'Redação',
                        natureza: 'Natureza',
                        matematica: 'Matemática'
                    };
                    
                    metricsHTML += `<p>${areaNames[area]}: ${state.metrics.areaTimesFormatted[area]}</p>`;
                }
            }
        }
        
        displays.metricsContent.innerHTML = metricsHTML;
    }

    function generateReport() {
        let report = `=== RELATÓRIO ENEMETRIA, VERSÃO 3.8 ===\n\n`;
        report += `Programa criando por: Pablo de Lima - todos os direitos reservado - e-mail: alanpablolima7@gmail.com\n\n\n`;
        
        // Informações da prova
        report += `=== INFORMAÇÕES DA PROVA ===\n`;
        report += `Dia da Prova: ${state.examDay === 'primeiro' ? 'Primeiro Dia' : 'Segundo Dia'}\n`;
        report += `Ano: ${state.examYear}\n`;
        report += `Caderno: ${state.examBook} (${state.examColor})\n`;
        report += `Tipo de Aplicação: ${state.examType}\n`;
        report += `Data da Simulação: ${formatDate(new Date())}\n\n`;
        
        // Métricas
        report += `=== MÉTRICAS DE DESEMPENHO ===\n`;
        report += `Tempo Total: ${state.metrics.totalTime}\n`;
        report += `Questões Respondidas: ${state.metrics.answeredQuestions} de ${getTotalQuestions()}\n`;
        report += `Questões Puladas: ${state.metrics.skippedQuestions}\n`;
        report += `Questões Puladas, mas respondidas: ${state.metrics.skippedCorrectCount}\n`;
	report += `Questões Revisadas: ${revisions.length}\n\n`;
        report += `Tempo Médio por Questão: ${state.metrics.averageTimePerQuestion}\n\n`;
        
        // Tempo por área
        report += `=== TEMPO POR ÁREA ===\n`;
        for (const area in state.metrics.areaTimesFormatted) {
            if (state.metrics.areaTimesFormatted.hasOwnProperty(area)) {
                // Verificar se a área está ativa no dia selecionado
                const areaElement = document.getElementById(`${area}-timer`);
                if (areaElement && areaElement.style.display !== 'none') {
                    const areaNames = {
                        linguagens: 'Linguagens',
                        humanas: 'Humanas',
                        redacao: 'Redação',
                        natureza: 'Natureza',
                        matematica: 'Matemática'
                    };
                    
                    report += `${areaNames[area]}: ${state.metrics.areaTimesFormatted[area]}\n`;
                }
            }
        }
        report += '\n';
        
        // Respostas
        report += `=== RESPOSTAS ===\n`;
        const sortedAnswers = Object.keys(state.answers).sort((a, b) => {
            // Ordenar numericamente, mas manter "redacao" no final
            if (a.startsWith('redacao') && !b.startsWith('redacao')) return 1;
            if (!a.startsWith('redacao') && b.startsWith('redacao')) return -1;
            if (a.startsWith('redacao') && b.startsWith('redacao')) {
                return a.localeCompare(b);
            }
            return parseInt(a) - parseInt(b);
        });
        
        for (const question of sortedAnswers) {
            if (question.startsWith('redacao')) {
                const type = question.split('-')[1];
                report += `Redação (${type === 'rascunho' ? 'Rascunho' : 'Final'}): Realizada\n`;
            } else {
                report += `Questão ${question}: ${state.answers[question].toUpperCase()}\n`;
            }
        }
        report += '\n';
                
        // Tempo por questão
        report += `=== TEMPO POR QUESTÃO ===\n`;
        const sortedQuestionTimes = Object.keys(state.questionTimes).sort((a, b) => {
            // Ordenar numericamente, mas manter "redacao" no final
            if (a.startsWith('redacao') && !b.startsWith('redacao')) return 1;
            if (!a.startsWith('redacao') && b.startsWith('redacao')) return -1;
            if (a.startsWith('redacao') && b.startsWith('redacao')) {
                return a.localeCompare(b);
            }
            return parseInt(a) - parseInt(b);
        });
        
        for (const question of sortedQuestionTimes) {
            if (question.startsWith('redacao')) {
                const type = question.split('-')[1];
                report += `Redação (${type === 'rascunho' ? 'Rascunho' : 'Final'}): ${formatTime(state.questionTimes[question])}\n`;
            } else {
                report += `Questão ${question}: ${formatTime(state.questionTimes[question])}\n`;
            }
        }

	// === QUESTÕES PULADAS ===
	report += `\n=== QUESTÕES PULADAS ===\n`;
	const puladas = Object.keys(state.skippedQuestions).sort((a, b) => parseInt(a) - parseInt(b));

	if (puladas.length === 0) {
    	  report += `Nenhuma questão foi pulada.\n`;
	  } else {
    	for (const q of puladas) {
        	const tempo = state.questionTimes[q] ? formatTime(state.questionTimes[q]) : '—';
        	const resposta = state.answers[q] ? state.answers[q].toUpperCase() : '—';
        	report += `Questão ${q}: Tempo = ${tempo}, Resposta = ${resposta}\n`;
    		}
	}

 // ─── Bloco de revisões ───
  report += `\n=== QUESTÕES REVISADAS ===\n`;
  if (revisions.length === 0) {
       report += `Nenhuma questão revisada.\n`;
   } else {
       report += revisions
           .map(r => `Questão ${r.question}: ${r.from} -> ${r.to}`)
           .join('\n') + '\n';
   }
   report += '\n';
 // ───────────────────────────

        
        

        // === MÉTRICAS GERAIS ===
        report += `
=== MÉTRICAS GERAIS ===
`;

        // Tempo Total da Prova
        const tempoTotalProva = state.totalTime;
        report += `Tempo Total da Prova: ${formatTime(tempoTotalProva)}
`;

        // Tempo Total em Questões
        const tempoTotalQuestoes = Object.values(state.questionTimes).reduce((a, b) => a + b, 0);
        report += `Tempo Total em Questões: ${formatTime(tempoTotalQuestoes)}
`;

        // Tempo Ocioso
        const tempoOcioso = state.idleTime;
        report += `Tempo Ocioso: ${formatTime(tempoOcioso)}
`;

        // Tempo em Pausa
        const tempoPausa = state.pauseTime;
        report += `Tempo em Pausa: ${formatTime(tempoPausa)}
`;

        // Questão Mais Demorada e Mais Rápida
        let questaoMaisDemorada = null, tempoMaisDemorado = 0;
        let questaoMaisRapida = null, tempoMaisRapido = Infinity;
        const temposPorQuestao = state.questionTimes;
        const freq = {};

        for (const [questao, tempo] of Object.entries(temposPorQuestao)) {
            if (tempo > tempoMaisDemorado) {
                tempoMaisDemorado = tempo;
                questaoMaisDemorada = questao;
            }
            if (tempo < tempoMaisRapido) {
                tempoMaisRapido = tempo;
                questaoMaisRapida = questao;
            }
            const t = Math.round(tempo);
            freq[t] = (freq[t] || 0) + 1;
        }

        const tempoMaisFrequente = Object.entries(freq).reduce((a, b) => a[1] >= b[1] ? a : b, [0, 0])[0];

        report += `Questão Mais Demorada: ${questaoMaisDemorada} (${formatTime(tempoMaisDemorado)})
`;
        report += `Questão Mais Rápida: ${questaoMaisRapida} (${formatTime(tempoMaisRapido)})
`;
        report += `Tempo Mais Frequente: ${formatTime(tempoMaisFrequente)}
`;

        

        // === TOP 10 QUESTÕES POR ÁREA ===
        report += `
=== TOP 10 QUESTÕES POR ÁREA ===
`;

        const areaPorQuestao = (questao) => {
            const numero = parseInt(questao.replace(/[^0-9]/g, ''));
            if (questao.startsWith("redacao")) return "redacao";
            if (numero >= 1 && numero <= 45) return "Linguagens";
            if (numero >= 46 && numero <= 90) return "Humanas";
            if (numero >= 91 && numero <= 135) return "Natureza";
            if (numero >= 136 && numero <= 180) return "Matemática";
            return "Desconhecida";
        };

        const temposPorArea = {};

        for (const [questao, tempo] of Object.entries(state.questionTimes)) {
            const area = areaPorQuestao(questao);
            if (area === "redacao") continue;
            if (!temposPorArea[area]) temposPorArea[area] = [];
            temposPorArea[area].push({ questao, tempo });
        }

        for (const area in temposPorArea) {
            const lista = temposPorArea[area];
            const maisRapidas = [...lista].sort((a, b) => a.tempo - b.tempo).slice(0, 10);
            const maisDemoradas = [...lista].sort((a, b) => b.tempo - a.tempo).slice(0, 10);

            report += `
Área: ${area}
`;
            report += `10 Questões Mais Rápidas:
`;
            maisRapidas.forEach((q, i) => {
                report += `  ${i + 1}. ${q.questao} - ${formatTime(q.tempo)}
`;
            });

            report += `10 Questões Mais Demoradas:
`;
            maisDemoradas.forEach((q, i) => {
                report += `  ${i + 1}. ${q.questao} - ${formatTime(q.tempo)}
`;
            });
        }

        
        
// === ORDEM DE RESOLUÇÃO ===
report += `
=== ORDEM DE RESOLUÇÃO ===
`;
const areaLabels = {
    linguagens: 'Linguagens',
    humanas:    'Humanas',
    redacao:    'Redação',
    natureza:   'Natureza',
    matematica: 'Matemática'
};

for (const [area, lista] of Object.entries(state.resolutionOrder)) {
    const lastMap = {};
    for (const entry of lista) {
        lastMap[entry.q] = entry;               // sobrescreve se já existir
    }
    // 2. transforma em array e ordena cronologicamente
    const ordered = Object.values(lastMap)
                           .sort((a, b) => a.time - b.time);

    // 3. separa respondidas e não‑respondidas
    const respondidas = ordered.filter(e => state.answers[e.q]);
    const puladas     = ordered.filter(e => !state.answers[e.q]);

    // 4. monta a lista final
    const ordemFinal = [...respondidas, ...puladas]     // respondidas → puladas
                       .map(e => e.q)                   // só o número
                       .join('; ') || '—';

    report += `Ordem (${areaLabels[area]}): ${ordemFinal}\n`;
}

 // === TEXTO ADICIONAL SOLICITADO ===
    report += `=== PROMPT PARA O GPT ===`;
    report += `**Sua tarefa é:**\n`;
    report += `**Peça para o usuário enviar o print de cada questão que errou, uma por uma, com gabarito, tempo que gastou e qual a maior dificuldade .**\n\n\n`;


    return report;

    }

    // Funções de histórico
    function loadHistoryFromLocalStorage() {
        const history = JSON.parse(localStorage.getItem('enemetria_history') || '[]');
        
        if (history.length === 0) {
            displays.historyList.innerHTML = '<p>Nenhuma simulação encontrada no histórico.</p>';
            return;
        }
        
        let historyHTML = '';
        
        // Ordenar por data (mais recente primeiro)
        history.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        for (const item of history) {
            const date = new Date(item.date);
            const formattedDate = formatDate(date);
            
            historyHTML += `
                <div class="history-item">
                    <h4>${item.examDay === 'primeiro' ? 'Primeiro Dia' : 'Segundo Dia'} - ${item.examYear}</h4>
                    <p>Data: ${formattedDate}</p>
                    <p>Tempo Total: ${formatTime(item.totalTime)}</p>
                    <p>Questões Respondidas: ${Object.keys(item.answers).length}</p>
                    <button class="view-history-button" data-id="${item.id}">Ver Detalhes</button>
                </div>
            `;
        }
        
        displays.historyList.innerHTML = historyHTML;
        
        // Adicionar eventos aos botões
        document.querySelectorAll('.view-history-button').forEach(button => {
            button.addEventListener('click', () => {
                const id = parseInt(button.dataset.id);
                const item = history.find(h => h.id === id);
                if (item) {
                    displayHistoryItem(item);
                }
            });
        });
    }

    function displayHistoryItem(item) {
        // Implementar exibição detalhada do histórico
        alert('Funcionalidade de visualização detalhada do histórico em desenvolvimento.');
    }

    // Funções utilitárias
    function formatTime(seconds) {
        seconds = Math.floor(seconds);
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    function formatDate(date) {
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        
        return `${day}/${month}/${year} ${hours}:${minutes}`;
    }

    function validateSetupInputs() {
	if (state.uploadedPdfUrl)   return true;
        if (!inputs.examDay.value) return false;
        if (!inputs.examYear.value) return false;
        if (!inputs.examBook.value) return false;
        if (!inputs.examColor.value) return false;
        if (!inputs.examType.value) return false;
	if (!inputs.userName.value)  return false;
        
        return true;
    }


    function getTotalQuestions() {
        if (state.examDay === 'primeiro') {
            return 90; // Linguagens (45) + Humanas (45)
        } else {
            return 90; // Natureza (45) + Matemática (45)
        }
    }

    function hideAllSections() {
        sections.initialSetup.classList.add('hidden-section');
        sections.initialSetup.classList.remove('active-section');
        
        sections.examControls.classList.add('hidden-section');
        sections.examControls.classList.remove('active-section');
        
        sections.statsPanel.classList.add('hidden-section');
        
        sections.questionsSection.classList.add('hidden-section');
        sections.questionsSection.classList.remove('active-section');
        
        sections.questionModal.classList.add('hidden-section');
        
        sections.resultsSection.classList.add('hidden-section');
        sections.resultsSection.classList.remove('active-section');
        
        sections.historySection.classList.add('hidden-section');
        sections.historySection.classList.remove('active-section');
        
        sections.countdownTimer.classList.add('hidden-section');
    }

    function resetState() {
        state.uploadedPdfUrl = null;
	state.examDay = '';
        state.examYear = '';
        state.examBook = '';
        state.examColor = '';
        state.examType = '';
    
        state.accessibilityOption = false;
        state.isExamStarted = false;
        state.isExamPaused = false;
        state.activeQuestion = null;
        state.activeArea = null;
        state.answers = {};
        state.skippedQuestions = {};
        state.questionTimes = {};
        state.areaTimes = {
            linguagens: 0,
            humanas: 0,
            redacao: 0,
            natureza: 0,
            matematica: 0
        };
        state.totalTime = 0;
        state.idleTime = 0;
        state.pauseTime = 0;
        state.startTime = null;
        state.currentQuestionStartTime = null;
        state.currentAreaStartTime = null;
        state.lastAreaActive = null;
        state.countdownIntervals = [];
        
        // Limpar cronômetros
        clearInterval(mainTimer);
        clearInterval(questionTimer);
        clearInterval(areaTimer);
        clearInterval(countdownTimer);
        
        // Resetar displays
        displays.mainTimerDisplay.textContent = '00:00:00';
        displays.linguagensTimer.textContent = '00:00:00';
        displays.humanasTimer.textContent = '00:00:00';
        displays.redacaoTimer.textContent = '00:00:00';
        displays.naturezaTimer.textContent = '00:00:00';
        displays.matematicaTimer.textContent = '00:00:00';
        displays.questionTimerValue.textContent = '00:00:00';
        
        // Resetar controles
        controls.startExam.disabled = false;
        controls.pauseExam.disabled = true;
        controls.finishExam.disabled = true;
        controls.downloadReport.disabled = true;
        controls.pauseExam.innerHTML = '<i class="fas fa-pause"></i> Pausar Prova';
        
        // Resetar formulário
        inputs.examDay.value = '';
        inputs.examYear.value = '';
        inputs.examBook.value = '';
        inputs.examColor.value = '';
        inputs.examType.value = '';
     // limpar nome e input de arquivo
     	inputs.userName.value = '';
     	inputs.pdfUpload.value = '';
     	// reabilitar campos que o upload de PDF havia desativado
     	['examYear','examBook','examColor','examType','accessibilityOption','userName']
       	.forEach(key => inputs[key].disabled = false);
     
        inputs.accessibilityOption.checked = false;
        

    }

    // Inicializar
    init();
});



let redacaoTimerInterval = null;

function startRedacaoTimer() {
    if (redacaoTimerInterval) return;
    redacaoTimerInterval = setInterval(() => {
        // aqui você atualizaria o tempo de redação
        console.log("Contando tempo da redação...");
    }, 1000);
}

function stopRedacaoTimer() {
    clearInterval(redacaoTimerInterval);
    redacaoTimerInterval = null;
}



document.querySelectorAll(".redacao-button").forEach(button => {
    button.addEventListener("click", () => {
        const isActive = button.classList.contains("active");

        if (isActive) {
            button.classList.remove("active");
            stopRedacaoTimer();
        } else {
            document.querySelectorAll(".redacao-button").forEach(btn => btn.classList.remove("active"));
            button.classList.add("active");
            startRedacaoTimer();
        }
    });
});


const redacaoButtons = document.querySelectorAll(".redacao-button");

redacaoButtons.forEach(button => {
    button.addEventListener("click", () => {
        const isActive = button.classList.contains("active");

        if (isActive) {
            button.classList.remove("active");
            stopRedacaoTimer();
        } else {
            redacaoButtons.forEach(btn => btn.classList.remove("active"));
            button.classList.add("active");
            startRedacaoTimer();
        }
    });
});

// --- Modal de Instruções de Uso ---
document.addEventListener('DOMContentLoaded', () => {
  const showInstrBtn = document.getElementById('show-instructions');
  const instrModal   = document.getElementById('instructions-modal');
  const closeInstr   = document.getElementById('close-instructions');

  // Abre o modal
  showInstrBtn.addEventListener('click', () => {
    instrModal.classList.remove('hidden-section');
  });

  // Fecha ao clicar no "×"
  closeInstr.addEventListener('click', () => {
    instrModal.classList.add('hidden-section');
  });

  // Fecha ao clicar fora do conteúdo
  instrModal.addEventListener('click', e => {
    if (e.target === instrModal) {
      instrModal.classList.add('hidden-section');
    }
  });
});



// --- Modal do Agente IA ---
document.addEventListener('DOMContentLoaded', () => {
  const iaModal      = document.getElementById('ia-agent-modal');
  const closeIaModal = document.getElementById('close-ia-modal');

  const downloadBtn1 = document.getElementById('download-report');
  const downloadBtn2 = document.getElementById('download-results'); // opcional

  function openIaModal() {
    iaModal.classList.remove('hidden-section');
  }

  if (downloadBtn1) {
    downloadBtn1.addEventListener('click', () => {
      setTimeout(openIaModal, 300); // pequeno atraso para garantir o download antes de abrir
    });
  }

  if (downloadBtn2) {
    downloadBtn2.addEventListener('click', () => {
      setTimeout(openIaModal, 300);
    });
  }

  closeIaModal.addEventListener('click', () => {
    iaModal.classList.add('hidden-section');
  });

  iaModal.addEventListener('click', (e) => {
    if (e.target === iaModal) {
      iaModal.classList.add('hidden-section');
    }
  });
});

document.addEventListener('DOMContentLoaded', () => {
  const newSimBtn = document.getElementById('new-simulation');

  if (newSimBtn) {
    newSimBtn.addEventListener('click', () => {
      const confirmar = confirm("Tem certeza que deseja iniciar uma nova simulação? Isso apagará todos os dados desta simulação.");
      if (confirmar) {
        location.reload(); // Recarrega a página
      }


    });
  }
});


document.addEventListener('DOMContentLoaded', () => {
  // — Instruções de Uso (já existente) …
  // — Modal do Agente IA (já existente) …
  // — Nova Simulação (já existente) …

  // — Confirmação ao Finalizar Prova ——
  const finishBtn = document.getElementById('finish-exam');
  if (finishBtn) {
    finishBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (confirm("Tem certeza que deseja finalizar a prova? Após isso, não será possível alterar nada.")) {
        document.getElementById('download-report').disabled = false;
      }
    });
  }
});
