//Inicio do Bloco 01________________________________________________

 // --- CORREÇÃO: importar do CDN, não de "firebase/auth" ---


document.addEventListener('DOMContentLoaded', function() {
    

    // Variáveis globais
    const state = {
        examDay: '',
        examYear: '',
        examBook: '',
        examColor: '',
        examType: '',
        uploadedPdfUrl: null,
        manualAnswerKey: null,
        manualAnswerKeyRaw: '',
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

    const PDF_BASE = './pdfs/';

    let mainTimer;
    let questionTimer;
    let areaTimer;
    let countdownTimer;

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

    const revisions = [];
    const answers = {};

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
        userName: document.getElementById('user-name'),
        pdfUpload: document.getElementById('pdf-upload')
    };

    if (inputs.pdfUpload) {
        inputs.pdfUpload.addEventListener('change', e => {
            const file = e.target.files[0];
            if (file) {
                state.uploadedPdfUrl = URL.createObjectURL(file);
                ['examYear', 'examBook', 'examColor', 'examType', 'accessibilityOption', 'userName']
                    .forEach(key => { if (inputs[key]) inputs[key].disabled = true; });
                setTimeout(showGabaritoManualModal, 300);
            } else {
                state.uploadedPdfUrl = null;
                ['examYear', 'examBook', 'examColor', 'examType', 'accessibilityOption', 'userName']
                    .forEach(key => { if (inputs[key]) inputs[key].disabled = false; });
            }
        });
    }

//Fim do Bloco 01________________________________________________
//Inicio do Bloco 02________________________________________________


    function showGabaritoManualModal() {
        const modal = document.getElementById('gabarito-modal');
        const close = document.getElementById('close-gabarito-modal');
        const saveBtn = document.getElementById('save-gabarito-manual');
        const textarea = document.getElementById('gabarito-manual-input');

        if (!modal || !close || !saveBtn || !textarea) return;

        textarea.value = state.manualAnswerKeyRaw || '';
        modal.classList.remove('hidden-section');

        close.onclick = () => modal.classList.add('hidden-section');
        saveBtn.onclick = () => {
            const raw = textarea.value;
            state.manualAnswerKeyRaw = raw;
            state.manualAnswerKey = {};
            raw.trim().split(/\r?\n/).forEach(line => {
                const [num, alt] = line.trim().split(/\s+/);
                if (num && alt) state.manualAnswerKey[num] = alt.toUpperCase();
            });
            modal.classList.add('hidden-section');
        };
        modal.onclick = function(e) {
            if (e.target === modal) modal.classList.add('hidden-section');
        };
    }

    function init() {
        setupEventListeners();
        loadHistoryFromLocalStorage();
        hideAllSections();

        // Alterado: A tela de login é a inicial, não mais a de setup
        if (loginSection) {
            loginSection.classList.remove('hidden-section');
            loginSection.classList.add('active-section');
        }

        if (controls.timerToggle && controls.timerToggle.parentElement) {
            controls.timerToggle.parentElement.addEventListener('click', toggleMainTimer);
        }
    }

    function setupEventListeners() {
        if (controls.startSetup) controls.startSetup.addEventListener('click', handleStartSetup);
        if (controls.startExam) controls.startExam.addEventListener('click', handleStartExam);
        if (controls.pauseExam) controls.pauseExam.addEventListener('click', handlePauseExam);
        if (controls.finishExam) controls.finishExam.addEventListener('click', handleFinishExam);
        if (controls.downloadReport) controls.downloadReport.addEventListener('click', handleDownloadReport);
        if (controls.toggleStats) controls.toggleStats.addEventListener('click', toggleStatsPanel);
        if (controls.saveAnswer) controls.saveAnswer.addEventListener('click', handleSaveAnswer);
        if (controls.modalClose) controls.modalClose.addEventListener('click', closeQuestionModal);
        if (controls.downloadResults) controls.downloadResults.addEventListener('click', handleDownloadReport);
        if (controls.newSimulation) controls.newSimulation.addEventListener('click', handleNewSimulation);
        if (controls.redacaoRascunho) controls.redacaoRascunho.addEventListener('click', () => handleRedacao('rascunho'));
        if (controls.redacaoFinal) controls.redacaoFinal.addEventListener('click', () => handleRedacao('final'));

        if (controls.areaTabs) {
            controls.areaTabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    const area = tab.dataset.area;
                    switchArea(area);
                });
            });
        }

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && sections.questionModal && !sections.questionModal.classList.contains('hidden-section')) {
                closeQuestionModal();
            }
        });
    }

    function hideAllSections() {
        // Adicionada a seção de login para ser ocultada
        const loginSect = document.getElementById('login-section');
        if (loginSect) {
            loginSect.classList.add('hidden-section');
            loginSect.classList.remove('active-section');
        }
        
        Object.values(sections).forEach(section => {
            if (section) {
                section.classList.add('hidden-section');
                section.classList.remove('active-section');
            }
        });
        if (sections.countdownTimer) sections.countdownTimer.classList.add('hidden-section');
    }

    // O restante do seu código `script.js` continua aqui sem alterações...
    // (Funções como handleStartSetup, handleStartExam, formatTime, etc.)
    // Nenhuma outra alteração é necessária no resto do arquivo para a funcionalidade de login.
    
    //... (COLE O RESTO DO SEU CÓDIGO JS ORIGINAL AQUI, COMEÇANDO DA FUNÇÃO `toggleMainTimer`)
    function toggleMainTimer() {
        if (!displays.mainTimerValueContainer || !controls.timerToggle) return;
        if (displays.mainTimerValueContainer.classList.contains('hidden')) {
            displays.mainTimerValueContainer.classList.remove('hidden');
            controls.timerToggle.classList.add('active');
        } else {
            displays.mainTimerValueContainer.classList.add('hidden');
            controls.timerToggle.classList.remove('active');
        }
    }

    function handleStartSetup() {
        if (!inputs.examDay || !inputs.examDay.value) {
            alert('Selecione o Dia da Prova.');
            return;
        }
        if (!state.uploadedPdfUrl && !validateSetupInputs()) {
            alert('Preencha Ano, Caderno, Cor, Tipo e Nome, ou carregue um PDF.');
            return;
        }
        if (!state.uploadedPdfUrl && inputs.pdfUpload && inputs.pdfUpload.files[0]) {
            state.uploadedPdfUrl = URL.createObjectURL(inputs.pdfUpload.files[0]);
        }
        state.examDay = inputs.examDay.value;
        state.examYear = inputs.examYear.value;
        state.examBook = inputs.examBook.value;
        state.examColor = inputs.examColor.value;
        state.examType = inputs.examType.value;
        state.accessibilityOption = inputs.accessibilityOption.checked;
        state.userName = inputs.userName.value;
        if (!state.uploadedPdfUrl && inputs.pdfUpload && inputs.pdfUpload.files[0]) {
            state.uploadedPdfUrl = URL.createObjectURL(inputs.pdfUpload.files[0]);
        }
        generateQuestionButtons();
        setupExamDay();
        
// --- Início da Correção ---
        // Em vez de esconder tudo, fazemos a transição manualmente.
        sections.initialSetup.classList.add('hidden-section'); // Esconde a tela de configuração
        sections.initialSetup.classList.remove('active-section');

        sections.examControls.classList.remove('hidden-section'); // Mostra os controles do exame
        sections.questionsSection.classList.remove('hidden-section'); // Mostra a área de questões
        sections.examControls.classList.add('active-section');
        sections.questionsSection.classList.add('active-section');
        // --- Fim da Correção ---


        const firstVisibleArea = document.querySelector('.area-questions:not(.hidden-section)');
        if (firstVisibleArea) {
            const areaId = firstVisibleArea.id.split('-')[0];
            updateActiveAreaUI(areaId);
        }
    }

    function handleStartExam() {
        if (state.isExamStarted) return;
        state.isExamStarted = true;
        state.isExamPaused = false;
        state.startTime = new Date();
        startMainTimer();
        startCountdownTimer();
        controls.startExam.disabled = true;
        controls.pauseExam.disabled = false;
        controls.finishExam.disabled = false;
        updateStatusDisplay();
    }

    function handlePauseExam() {
        if (!state.isExamStarted) return;
        if (state.isExamPaused) {
            state.isExamPaused = false;
            controls.pauseExam.innerHTML = '<i class="fas fa-pause"></i> Pausar Prova';
            const resumeTime = new Date();
            state.pauseTime += (resumeTime - state.lastPauseStartTime) / 1000;
            if (state.activeQuestion) {
                state.currentQuestionStartTime = new Date();
            }
            if (state.activeArea) {
                state.currentAreaStartTime = new Date();
            }
            startMainTimer();
            startCountdownTimer();
        } else {
            state.isExamPaused = true;
            controls.pauseExam.innerHTML = '<i class="fas fa-play"></i> Retomar Prova';
            clearInterval(mainTimer);
            clearInterval(questionTimer);
            clearInterval(areaTimer);
            clearInterval(countdownTimer);
            const pauseStartTime = new Date();
            state.lastPauseStartTime = pauseStartTime;
            if (state.activeQuestion && state.currentQuestionStartTime) {
                const questionTimeElapsed = (pauseStartTime - state.currentQuestionStartTime) / 1000;
                state.questionTimes[state.activeQuestion] = (state.questionTimes[state.activeQuestion] || 0) + questionTimeElapsed;
            }
            if (state.activeArea && state.currentAreaStartTime) {
                const areaTimeElapsed = (pauseStartTime - state.currentAreaStartTime) / 1000;
                state.areaTimes[state.activeArea] = (state.areaTimes[state.activeArea] || 0) + areaTimeElapsed;
            }
        }
    }

    function handleFinishExam() {
        if (!state.isExamStarted) return;
        if (state.activeQuestion) {
            alert('Por favor, encerre a questão atual antes de finalizar a prova.');
            return;
        }
        if (state.activeArea && state.currentAreaStartTime) {
            const now = new Date();
            const timeSpent = (now - state.currentAreaStartTime) / 1000;
            state.areaTimes[state.activeArea] =
                (state.areaTimes[state.activeArea] || 0) + timeSpent;
            state.currentAreaStartTime = null;
        }
        clearInterval(mainTimer);
        clearInterval(questionTimer);
        clearInterval(areaTimer);
        clearInterval(countdownTimer);
        sections.countdownTimer.classList.add('hidden-section');
        const endTime = new Date();
        state.totalTime = (endTime - state.startTime) / 1000 - state.pauseTime;
        calculateMetrics();
        displayResults();
        hideAllSections();
        sections.resultsSection.classList.remove('hidden-section');
        sections.resultsSection.classList.add('active-section');
        controls.downloadReport.disabled = false;
    }

//Fim do Bloco 02________________________________________________
//Inicio do Bloco 03________________________________________________


    async function handleDownloadReport() {
        let report = generateReport();
        if (state.uploadedPdfUrl && state.manualAnswerKey && Object.keys(state.manualAnswerKey).length > 0) {
            report += '\n=== Gabarito Oficial vs. Suas Respostas ===\n';
            report += `${'Nº Questão'.padEnd(10)}${'Sua Resposta'.padEnd(14)}${'Gabarito Oficial'.padEnd(18)}${'Acertou?'.padEnd(10)}${'Tempo Gasto'.padEnd(12)}\n`;
            const gabaritoOficial = state.manualAnswerKey;
            Object.keys(gabaritoOficial)
                .sort((a, b) => parseInt(a) - parseInt(b))
                .forEach(numero => {
                    const sua = (state.answers[numero] || '—').toUpperCase();
                    const oficial = gabaritoOficial[numero];
                    const acertou = sua === oficial ? '✅' : '❌';
                    const tempo = state.questionTimes[numero] ?
                        formatTime(state.questionTimes[numero]) :
                        '—';
                    report += `${numero.toString().padEnd(10)}${sua.padEnd(14)}${oficial.padEnd(18)}${acertou.padEnd(10)}${tempo.padEnd(12)}\n`;
                });
            const total = Object.keys(gabaritoOficial).length;
            const acertos = Object.keys(gabaritoOficial)
                .filter(num => (state.answers[num] || '—').toUpperCase() === gabaritoOficial[num])
                .length;
            const erros = total - acertos;
            const tempos = Object.entries(state.questionTimes)
                .filter(([num]) => num in gabaritoOficial)
                .map(([, t]) => t);
            const tempoTotal = tempos.reduce((a, b) => a + b, 0);
            const mediaGeral = tempoTotal / tempos.length;
            const temposAcertos = Object.entries(state.questionTimes)
                .filter(([num]) => (state.answers[num] || '—').toUpperCase() === gabaritoOficial[num])
                .map(([, t]) => t);
            const temposErros = Object.entries(state.questionTimes)
                .filter(([num]) => (state.answers[num] || '—').toUpperCase() !== gabaritoOficial[num] && num in gabaritoOficial)
                .map(([, t]) => t);

            function fmt(segs) {
                if (isNaN(segs) || segs === 0) return '0s';
                const h = Math.floor(segs / 3600);
                const m = Math.floor((segs % 3600) / 60);
                const s = Math.floor(segs % 60);
                return `${h? h+'h ':''}${m? m+'min ':''}${s? s+'s':''}`.trim();
            }
            report += `\n✅ Acertos: ${acertos} de ${total}\n`;
            report += `❌ Erros: ${erros}\n`;
            report += `⏳ Tempo Total Gasto nas ${total}: ${fmt(tempoTotal)} (tempo médio: ${fmt(mediaGeral)})\n`;
            report += `⏱️ Tempo médio nas que ACERTOU: ${fmt(temposAcertos.length > 0 ? temposAcertos.reduce((a, b) => a + b, 0) / temposAcertos.length : 0)}\n`;
            report += `⌛ Tempo médio nas que ERROU: ${fmt(temposErros.length > 0 ? temposErros.reduce((a, b) => a + b, 0) / temposErros.length : 0)}\n`;
            const blob = new Blob([report], {
                type: 'text/plain'
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            const username = (document.getElementById('user-name') ? document.getElementById('user-name').value.trim().toUpperCase() : 'USUARIO') || 'USUARIO';
            a.download = `ENEMetria_${username}_Relatorio_${formatDate(new Date())}.txt`;
            a.href = url;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 100);
            return;
        }
        try {
            const pastaDoPdf = `${PDF_BASE}${state.examYear}/${state.examType}/${state.examDay}/`;
            const caminhoGabarito = `${pastaDoPdf}gabarito.txt`;
            const res = await fetch(caminhoGabarito);
            if (res.ok) {
                const gabaritoText = await res.text();
                report += '\n=== Gabarito Oficial vs. Suas Respostas ===\n';
                report += `${'Nº Questão'.padEnd(10)}${'Sua Resposta'.padEnd(14)}${'Gabarito Oficial'.padEnd(18)}${'Acertou?'.padEnd(10)}${'Tempo Gasto'.padEnd(12)}\n`;
                const gabaritoOficial = {};
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
                        const tempo = state.questionTimes[numero] ?
                            formatTime(state.questionTimes[numero]) :
                            '—';
                        report += `${numero.toString().padEnd(10)}${sua.padEnd(14)}${oficial.padEnd(18)}${acertou.padEnd(10)}${tempo.padEnd(12)}\n`;
                    });
                const total = Object.keys(gabaritoOficial).length;
                const acertos = Object.keys(gabaritoOficial)
                    .filter(num => (state.answers[num] || '—').toUpperCase() === gabaritoOficial[num])
                    .length;
                const erros = total - acertos;
                const tempos = Object.entries(state.questionTimes)
                    .filter(([num]) => num in gabaritoOficial)
                    .map(([, t]) => t);
                const tempoTotal = tempos.reduce((a, b) => a + b, 0);
                const mediaGeral = tempoTotal / tempos.length;
                const temposAcertos = Object.entries(state.questionTimes)
                    .filter(([num]) => (state.answers[num] || '—').toUpperCase() === gabaritoOficial[num])
                    .map(([, t]) => t);
                const temposErros = Object.entries(state.questionTimes)
                    .filter(([num]) => (state.answers[num] || '—').toUpperCase() !== gabaritoOficial[num] && num in gabaritoOficial)
                    .map(([, t]) => t);

                function fmt(segs) {
                    if (isNaN(segs) || segs === 0) return '0s';
                    const h = Math.floor(segs / 3600);
                    const m = Math.floor((segs % 3600) / 60);
                    const s = Math.floor(segs % 60);
                    return `${h? h+'h ':''}${m? m+'min ':''}${s? s+'s':''}`.trim();
                }
                report += `\n✅ Acertos: ${acertos} de ${total}\n`;
                report += `❌ Erros: ${erros}\n`;
                report += `⏳ Tempo Total Gasto nas ${total}: ${fmt(tempoTotal)} (tempo médio: ${fmt(mediaGeral)})\n`;
                report += `⏱️ Tempo médio nas que ACERTOU: ${fmt(temposAcertos.length > 0 ? temposAcertos.reduce((a,b)=>a+b,0)/temposAcertos.length : 0)}\n`;
                report += `⌛ Tempo médio nas que ERROU: ${fmt(temposErros.length > 0 ? temposErros.reduce((a,b)=>a+b,0)/temposErros.length : 0)}\n`;
            } else {
                console.warn('gabarito.txt não encontrado em', caminhoGabarito, res.status);
            }
        } catch (err) {
            console.error('Erro ao carregar gabarito.txt:', err);
        }
        const blob = new Blob([report], {
            type: 'text/plain'
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const username = (document.getElementById('user-name') ? document.getElementById('user-name').value.trim().toUpperCase() : 'USUARIO') || 'USUARIO';
        a.download = `ENEMetria_${username}_Relatorio_${formatDate(new Date())}.txt`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    }

    function handleSaveHistory() {
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
        const history = JSON.parse(localStorage.getItem('enemetria_history') || '[]');
        history.push(historyItem);
        localStorage.setItem('enemetria_history', JSON.stringify(history));
        loadHistoryFromLocalStorage();
        hideAllSections();
        sections.historySection.classList.remove('hidden-section');
        sections.historySection.classList.add('active-section');
        alert('Simulação salva no histórico com sucesso!');
    }

    function handleNewSimulation() {
        resetState();
        revisions.length = 0;
        const revisionCountEl = document.getElementById('revision-count');
        if (revisionCountEl) revisionCountEl.textContent = '0';
        for (const q in answers) delete answers[q];
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
        if (state.activeQuestion && state.activeQuestion !== questionNumber) {
            alert('Por favor, desmarque a questão atual antes de passar para próxima.');
            return;
        }
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
        if (area && area !== state.activeArea) {
            switchArea(area);
        }
        state.activeQuestion = questionNumber;
        state.currentQuestionStartTime = new Date();
        startQuestionTimer();
        if (!questionNumber.startsWith('redacao')) {
            const questionButton = document.querySelector(`.question-button[data-question="${questionNumber}"]`);
            if (questionButton) {
                questionButton.classList.add('active');
                openQuestionModal(questionNumber);
            }
        }
        updateStatusDisplay();
    }

//Fim do Bloco 03________________________________________________
//Inicio do Bloco 04________________________________________________

    function endQuestion() {
        if (!state.activeQuestion) return;
        const now = new Date();
        const timeSpent = (now - state.currentQuestionStartTime) / 1000;
        state.questionTimes[state.activeQuestion] = (state.questionTimes[state.activeQuestion] || 0) + timeSpent;
        if (state.activeArea) {
            state.resolutionOrder[state.activeArea].push({
                q: state.activeQuestion,
                time: Date.now()
            });
        }
        if (!state.activeQuestion.startsWith('redacao') && !state.answers[state.activeQuestion]) {
            state.skippedQuestions[state.activeQuestion] = true;
            const questionButton = document.querySelector(`.question-button[data-question="${state.activeQuestion}"]`);
            if (questionButton) {
                questionButton.classList.add('skipped');
            }
        }
        if (!state.activeQuestion.startsWith('redacao')) {
            const questionButton = document.querySelector(`.question-button[data-question="${state.activeQuestion}"]`);
            if (questionButton) {
                questionButton.classList.remove('active');
            }
        } else {
            controls.redacaoRascunho.classList.remove('active');
            controls.redacaoFinal.classList.remove('active');
            controls.redacaoRascunho.style.backgroundColor = '';
            controls.redacaoFinal.style.backgroundColor = '';
        }
        state.lastQuestionResolved = state.activeQuestion;
        state.activeQuestion = null;
        state.currentQuestionStartTime = null;
        clearInterval(questionTimer);
        displays.questionTimerValue.textContent = formatTime(timeSpent);
        updateStatusDisplay();
        updateStatsDisplay();
    }

    function buildPdfPath(questionNumber) {
        return `${PDF_BASE}${state.examYear}/${state.examType}/${state.examDay}/${state.examColor}.pdf#page=${questionNumber}`;
    }

    function openQuestionModal(questionNumber) {
        displays.modalQuestionNumber.textContent = `Questão ${questionNumber.padStart(2, '0')}`;
        const viewer = document.getElementById('pdf-viewer');
        if (viewer) {
            if (state.uploadedPdfUrl) {
                viewer.src = `${state.uploadedPdfUrl}#page=${questionNumber}`;
            } else {
                viewer.src = buildPdfPath(questionNumber);
            }
        }
        document.querySelectorAll('input[name="question-alternative"]').forEach(radio => {
            radio.checked = false;
        });
        if (state.answers[questionNumber]) {
            const savedAnswer = state.answers[questionNumber];
            const radioToCheck = document.getElementById(`alt-${savedAnswer}`);
            if (radioToCheck) {
                radioToCheck.checked = true;
            }
        }
        sections.questionModal.classList.remove('hidden-section');
    }

    function closeQuestionModal() {
        sections.questionModal.classList.add('hidden-section');
        if (state.activeQuestion && !state.answers[state.activeQuestion]) {
            state.skippedQuestions[state.activeQuestion] = true;
            const questionButton = document.querySelector(`.question-button[data-question="${state.activeQuestion}"]`);
            if (questionButton) {
                questionButton.classList.add('skipped');
            }
        }
        endQuestion();
    }

    function switchArea(area) {
        if (area === state.activeArea) return;
        if (state.isExamStarted && state.activeArea && state.currentAreaStartTime) {
            const now = new Date();
            const timeSpent = (now - state.currentAreaStartTime) / 1000;
            state.areaTimes[state.activeArea] = (state.areaTimes[state.activeArea] || 0) + timeSpent;
        }
        state.lastAreaActive = state.activeArea;
        state.activeArea = area;
        if (state.isExamStarted) {
            state.currentAreaStartTime = new Date();
            startAreaTimer();
        }
        updateActiveAreaUI(area);
        updateStatusDisplay();
    }

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
        let totalHours;
        if (isPrimeirodia) {
            totalHours = state.accessibilityOption ? 6.5 : 5.5;
        } else {
            totalHours = state.accessibilityOption ? 6 : 5;
        }
        const hours = Math.floor(totalHours);
        const minutes = Math.round((totalHours - hours) * 60);
        displays.mainTimerDisplay.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`;
        state.countdownIntervals = [];
        let timeInMinutes = hours * 60 + minutes;
        while (timeInMinutes > 0) {
            state.countdownIntervals.push(timeInMinutes);
            timeInMinutes -= 30;
        }
        document.querySelectorAll('.area-tab').forEach(tab => {
            const area = tab.dataset.area;
            if ((isPrimeirodia && ['linguagens', 'humanas', 'redacao'].includes(area)) || (isSegundoDia && ['natureza', 'matematica'].includes(area))) {
                tab.style.display = 'block';
            } else {
                tab.style.display = 'none';
            }
        });
        document.querySelectorAll('.area-questions').forEach(areaSection => {
            const area = areaSection.id.split('-')[0];
            if ((isPrimeirodia && ['linguagens', 'humanas', 'redacao'].includes(area)) || (isSegundoDia && ['natureza', 'matematica'].includes(area))) {
                areaSection.classList.remove('hidden-section');
            } else {
                areaSection.classList.add('hidden-section');
            }
        });
        document.querySelectorAll('.area-timer').forEach(timer => {
            const area = timer.id.split('-')[0];
            if ((isPrimeirodia && ['linguagens', 'humanas', 'redacao'].includes(area)) || (isSegundoDia && ['natureza', 'matematica'].includes(area))) {
                timer.style.display = 'flex';
            } else {
                timer.style.display = 'none';
            }
        });
    }

    function startMainTimer() {
        clearInterval(mainTimer);
        const updateTimer = () => {
            if (state.isExamPaused) return;
            const now = new Date();
            const elapsedSeconds = Math.floor((now - state.startTime) / 1000) - state.pauseTime;
            displays.mainTimerDisplay.textContent = formatTime(elapsedSeconds);
        };
        mainTimer = setInterval(updateTimer, 1000);
        updateTimer();
    }

//Fim do Bloco 04________________________________________________
//Inicio do Bloco 05________________________________________________

    function startQuestionTimer() {
        clearInterval(questionTimer);
        const updateTimer = () => {
            if (state.isExamPaused || !state.activeQuestion || !state.currentQuestionStartTime) return;
            const now = new Date();
            const elapsedSeconds = Math.floor((now - state.currentQuestionStartTime) / 1000);
            const previousTime = state.questionTimes[state.activeQuestion] || 0;
            const totalTime = previousTime + elapsedSeconds;
            displays.questionTimerValue.textContent = formatTime(totalTime);
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
        sections.countdownTimer.classList.remove('hidden-section');
        createCountdownIntervals();
        const updateCountdown = () => {
            if (state.isExamPaused) return;
            const now = new Date();
            const elapsedSeconds = Math.floor((now - state.startTime) / 1000) - state.pauseTime;
            const remainingSeconds = getTotalExamTimeInSeconds() - elapsedSeconds;
            if (remainingSeconds <= 0) {
                clearInterval(countdownTimer);
                sections.countdownTimer.classList.add('hidden-section');
                if (displays.mainTimerContainer) displays.mainTimerContainer.classList.add('hidden');
                alert('O tempo da prova acabou!');
                return;
            }
            const remainingMinutes = Math.ceil(remainingSeconds / 60);
            if (remainingMinutes === 30 && remainingSeconds % 60 === 0) {
                alert('Atenção! Falta apenas 30 min para o término da prova.');
            } else if (remainingMinutes === 15 && remainingSeconds % 60 === 0) {
                alert('Atenção! Falta apenas 15 min para o término da prova. É importante que você comece a preencher seu gabarito');
                if (displays.mainTimerContainer) displays.mainTimerContainer.classList.add('hidden');
            }
            updateCountdownIntervals(remainingMinutes);
        };
        countdownTimer = setInterval(updateCountdown, 1000);
        updateCountdown();
    }

    function createCountdownIntervals() {
        displays.countdownIntervalsContainer.innerHTML = '';
        state.countdownIntervals.forEach((minutes, index) => {
            const hours = Math.floor(minutes / 60);
            const mins = minutes % 60;
            const timeString = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:00`;
            const intervalElement = document.createElement('div');
            intervalElement.className = 'countdown-interval';
            intervalElement.dataset.minutes = minutes;
            intervalElement.textContent = timeString;
            if (index === 0) {
                intervalElement.classList.add('active');
            }
            displays.countdownIntervalsContainer.appendChild(intervalElement);
        });
    }

    function updateCountdownIntervals(remainingMinutes) {
        const intervalElements = document.querySelectorAll('.countdown-interval');
        intervalElements.forEach(element => {
            const minutes = parseInt(element.dataset.minutes);
            if (minutes > remainingMinutes) {
                element.classList.add('completed');
                element.classList.remove('active');
            } else if (minutes <= remainingMinutes && (!element.previousElementSibling || element.previousElementSibling.classList.contains('completed'))) {
                element.classList.add('active');
                element.classList.remove('completed');
            } else {
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

    function updateStatusDisplay() {
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
        const totalQuestions = getTotalQuestions();
        const answeredQuestions = Object.keys(state.answers).length;
        const skippedQuestions = Object.keys(state.skippedQuestions).length;
        const remainingQuestions = totalQuestions - answeredQuestions;
        let totalQuestionTime = 0;
        let questionCount = 0;
        for (const question in state.questionTimes) {
            if (state.questionTimes.hasOwnProperty(question)) {
                totalQuestionTime += state.questionTimes[question];
                questionCount++;
            }
        }
        const averageTimePerQuestion = questionCount > 0 ? totalQuestionTime / questionCount : 0;
        let statsHTML = `<div class="stats-item"><h4>Progresso</h4><p>Questões respondidas: ${answeredQuestions} de ${totalQuestions} (${Math.round(answeredQuestions / totalQuestions * 100)}%)</p><p>Questões puladas: ${skippedQuestions}</p><p>Questões restantes: ${remainingQuestions}</p></div><div class="stats-item"><h4>Tempo</h4><p>Tempo médio por questão: ${formatTime(averageTimePerQuestion)}</p></div><div class="stats-item"><h4>Tempo por Área</h4>`;
        for (const area in state.areaTimes) {
            if (state.areaTimes.hasOwnProperty(area)) {
                const areaElement = document.getElementById(`${area}-timer`);
                if (areaElement && areaElement.style.display !== 'none') {
                    const areaNames = {
                        linguagens: 'Linguagens',
                        humanas: 'Humanas',
                        redacao: 'Redação',
                        natureza: 'Natureza',
                        matematica: 'Matemática'
                    };
                    let areaTime = state.areaTimes[area];
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

    function handleRedacao(type) {
        if (!state.isExamStarted) {
            alert('Por favor, inicie a prova primeiro.');
            return;
        }
        if (state.isExamPaused) {
            alert('A prova está pausada. Retome a prova para continuar.');
            return;
        }
        if (state.activeQuestion && state.activeQuestion !== `redacao-${type}`) {
            alert('Por favor, desmarque a questão atual antes de passar para próxima.');
            return;
        }
        if (state.activeArea !== 'redacao') {
            switchArea('redacao');
        }
        if (state.activeQuestion === `redacao-${type}`) {
            endQuestion();
            return;
        }
        state.activeQuestion = `redacao-${type}`;
        state.currentQuestionStartTime = new Date();
        startQuestionTimer();
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
        updateStatusDisplay();

    }
//Fim do Bloco 05________________________________________________
//Inicio do Bloco 06________________________________________________

    function handleSaveAnswer() {
        if (!state.activeQuestion || state.activeQuestion.startsWith('redacao')) {
            return;
        }
        const selectedAlternative = document.querySelector('input[name="question-alternative"]:checked');
        if (!selectedAlternative) {
            alert('Por favor, selecione uma alternativa.');
            return;
        }
        state.answers[state.activeQuestion] = selectedAlternative.value;
        const previous = answers[state.activeQuestion];
        const newValue = selectedAlternative.value;
        if (previous && previous !== newValue) {
            revisions.push({
                question: Number(state.activeQuestion),
                from: previous.toUpperCase(),
                to: newValue.toUpperCase()
            });
            const revisionCountEl = document.getElementById('revision-count');
            if (revisionCountEl) revisionCountEl.textContent = revisions.length;
        }
        answers[state.activeQuestion] = newValue;
        const questionButton = document.querySelector(`.question-button[data-question="${state.activeQuestion}"]`);
        if (questionButton) {
            questionButton.classList.remove('skipped');
            questionButton.classList.add('answered');
        }
        closeQuestionModal();
        updateStatsDisplay();
    }

    function generateQuestionButtons() {
        const linguagensGrid = document.querySelector('#linguagens-questions .questions-grid');
        const humanasGrid = document.querySelector('#humanas-questions .questions-grid');
        const naturezaGrid = document.querySelector('#natureza-questions .questions-grid');
        const matematicaGrid = document.querySelector('#matematica-questions .questions-grid');
        if (linguagensGrid) linguagensGrid.innerHTML = '';
        if (humanasGrid) humanasGrid.innerHTML = '';
        if (naturezaGrid) naturezaGrid.innerHTML = '';
        if (matematicaGrid) matematicaGrid.innerHTML = '';
        for (let i = 1; i <= 180; i++) {
            const button = document.createElement('button');
            button.className = 'question-button';
            button.textContent = i.toString().padStart(2, '0');
            button.dataset.question = i;
            button.addEventListener('click', () => handleQuestionClick(i.toString()));
            if (i <= 45 && linguagensGrid) {
                linguagensGrid.appendChild(button);
            } else if (i <= 90 && humanasGrid) {
                humanasGrid.appendChild(button);
            } else if (i <= 135 && naturezaGrid) {
                naturezaGrid.appendChild(button);
            } else if (matematicaGrid) {
                matematicaGrid.appendChild(button);
            }
        }
    }

    function calculateMetrics() {
        const areaTimesFormatted = {};
        for (const area in state.areaTimes) {
            if (state.areaTimes.hasOwnProperty(area)) {
                areaTimesFormatted[area] = formatTime(state.areaTimes[area]);
            }
        }
        let totalQuestionTime = 0;
        let questionCount = 0;
        for (const question in state.questionTimes) {
            if (state.questionTimes.hasOwnProperty(question)) {
                totalQuestionTime += state.questionTimes[question];
                questionCount++;
            }
        }
        const averageTimePerQuestion = questionCount > 0 ? totalQuestionTime / questionCount : 0;
        let skippedCorrectCount = 0;
        for (const question in state.skippedQuestions) {
            if (state.skippedQuestions.hasOwnProperty(question) && state.answers[question]) {
                skippedCorrectCount++;
            }
        }
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
        displays.summaryContent.innerHTML = `<p><strong>Dia da Prova:</strong> ${state.examDay === 'primeiro' ? 'Primeiro Dia' : 'Segundo Dia'}</p><p><strong>Ano:</strong> ${state.examYear}</p><p><strong>Caderno:</strong> ${state.examBook} (${state.examColor})</p><p><strong>Tipo de Aplicação:</strong> ${state.examType}</p><p><strong>Tempo Total:</strong> ${state.metrics.totalTime}</p>`;
        let metricsHTML = `<p><strong>Questões Respondidas:</strong> ${state.metrics.answeredQuestions} de ${getTotalQuestions()}</p><p><strong>Questões Puladas:</strong> ${state.metrics.skippedQuestions}</p><p><strong>Questões Puladas, mas respondidas:</strong> ${state.metrics.skippedCorrectCount}</p><p><strong>Tempo Médio por Questão:</strong> ${state.metrics.averageTimePerQuestion}</p><h4>Tempo por Área:</h4>`;
        for (const area in state.metrics.areaTimesFormatted) {
            if (state.metrics.areaTimesFormatted.hasOwnProperty(area)) {
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
        let report = `=== RELATÓRIO ENEMETRIA, VERSÃO LS 4.2 ===\n\n`;
        report += `Programa criando por: Pablo de Lima - todos os direitos reservado - e-mail: alanpablolima7@gmail.com\n\n\n`;
        report += `=== INFORMAÇÕES DA PROVA ===\n`;
        report += `Dia da Prova: ${state.examDay === 'primeiro' ? 'Primeiro Dia' : 'Segundo Dia'}\n`;
        report += `Ano: ${state.examYear}\n`;
        report += `Caderno: ${state.examBook} (${state.examColor})\n`;
        report += `Tipo de Aplicação: ${state.examType}\n`;
        report += `Data da Simulação: ${formatDate(new Date())}\n\n`;
        report += `=== MÉTRICAS DE DESEMPENHO ===\n`;
        report += `Tempo Total: ${state.metrics.totalTime}\n`;
        report += `Questões Respondidas: ${state.metrics.answeredQuestions} de ${getTotalQuestions()}\n`;
        report += `Questões Puladas: ${state.metrics.skippedQuestions}\n`;
        report += `Questões Puladas, mas respondidas: ${state.metrics.skippedCorrectCount}\n`;
        report += `Questões Revisadas: ${revisions.length}\n\n`;
        report += `Tempo Médio por Questão: ${state.metrics.averageTimePerQuestion}\n\n`;
        report += `=== TEMPO POR ÁREA ===\n`;
        for (const area in state.metrics.areaTimesFormatted) {
            if (state.metrics.areaTimesFormatted.hasOwnProperty(area)) {
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
        report += `=== RESPOSTAS ===\n`;
        const sortedAnswers = Object.keys(state.answers).sort((a, b) => {
            if (a.startsWith('redacao')) return 1;
            if (b.startsWith('redacao')) return -1;
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
        report += `=== TEMPO POR QUESTÃO ===\n`;
        const sortedQuestionTimes = Object.keys(state.questionTimes).sort((a, b) => {
            if (a.startsWith('redacao')) return 1;
            if (b.startsWith('redacao')) return -1;
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
        report += `\n=== QUESTÕES REVISADAS ===\n`;
        if (revisions.length === 0) {
            report += `Nenhuma questão revisada.\n`;
        } else {
            report += revisions.map(r => `Questão ${r.question}: ${r.from} -> ${r.to}`).join('\n') + '\n';
        }
        report += '\n';
        report += `\n=== MÉTRICAS GERAIS ===\n`;
        const tempoTotalProva = state.totalTime;
        report += `Tempo Total da Prova: ${formatTime(tempoTotalProva)}\n`;
        const tempoTotalQuestoes = Object.values(state.questionTimes).reduce((a, b) => a + b, 0);
        report += `Tempo Total em Questões: ${formatTime(tempoTotalQuestoes)}\n`;
        const tempoOcioso = state.idleTime;
        report += `Tempo Ocioso: ${formatTime(tempoOcioso)}\n`;
        const tempoPausa = state.pauseTime;
        report += `Tempo em Pausa: ${formatTime(tempoPausa)}\n`;
        let questaoMaisDemorada = null,
            tempoMaisDemorado = 0;
        let questaoMaisRapida = null,
            tempoMaisRapido = Infinity;
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
        report += `Questão Mais Demorada: ${questaoMaisDemorada} (${formatTime(tempoMaisDemorado)})\n`;
        report += `Questão Mais Rápida: ${questaoMaisRapida} (${formatTime(tempoMaisRapido)})\n`;
        report += `Tempo Mais Frequente: ${formatTime(tempoMaisFrequente)}\n`;
        report += `\n=== TOP 10 QUESTÕES POR ÁREA ===\n`;
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
            temposPorArea[area].push({
                questao,
                tempo
            });
        }
        for (const area in temposPorArea) {
            const lista = temposPorArea[area];
            const maisRapidas = [...lista].sort((a, b) => a.tempo - b.tempo).slice(0, 10);
            const maisDemoradas = [...lista].sort((a, b) => b.tempo - a.tempo).slice(0, 10);
            report += `\nÁrea: ${area}\n`;
            report += `10 Questões Mais Rápidas:\n`;
            maisRapidas.forEach((q, i) => {
                report += `  ${i + 1}. ${q.questao} - ${formatTime(q.tempo)}\n`;
            });
            report += `10 Questões Mais Demoradas:\n`;
            maisDemoradas.forEach((q, i) => {
                report += `  ${i + 1}. ${q.questao} - ${formatTime(q.tempo)}\n`;
            });
        }
        report += `\n=== ORDEM DE RESOLUÇÃO ===\n`;
        const areaLabels = {
            linguagens: 'Linguagens',
            humanas: 'Humanas',
            redacao: 'Redação',
            natureza: 'Natureza',
            matematica: 'Matemática'
        };
        for (const [area, lista] of Object.entries(state.resolutionOrder)) {
            const lastMap = {};
            for (const entry of lista) {
                lastMap[entry.q] = entry;
            }
            const ordered = Object.values(lastMap)
                .sort((a, b) => a.time - b.time);
            const respondidas = ordered.filter(e => state.answers[e.q]);
            const puladas = ordered.filter(e => !state.answers[e.q]);
            const ordemFinal = [...respondidas, ...puladas]
                .map(e => e.q)
                .join('; ') || '—';
            report += `Ordem (${areaLabels[area]}): ${ordemFinal}\n`;
        }
        return report;
    }
//Fim do Bloco 06________________________________________________
//Inicio do Bloco 07________________________________________________

    function loadHistoryFromLocalStorage() {
        const history = JSON.parse(localStorage.getItem('enemetria_history') || '[]');
        if (history.length === 0) {
            displays.historyList.innerHTML = '<p>Nenhuma simulação encontrada no histórico.</p>';
            return;
        }
        let historyHTML = '';
        history.sort((a, b) => new Date(b.date) - new Date(a.date));
        for (const item of history) {
            const date = new Date(item.date);
            const formattedDate = formatDate(date);
            historyHTML += `<div class="history-item"><h4>${item.examDay === 'primeiro' ? 'Primeiro Dia' : 'Segundo Dia'} - ${item.examYear}</h4><p>Data: ${formattedDate}</p><p>Tempo Total: ${formatTime(item.totalTime)}</p><p>Questões Respondidas: ${Object.keys(item.answers).length}</p><button class="view-history-button" data-id="${item.id}">Ver Detalhes</button></div>`;
        }
        displays.historyList.innerHTML = historyHTML;
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
        alert('Funcionalidade de visualização detalhada do histórico em desenvolvimento.');
    }

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
        if (state.uploadedPdfUrl) return true;
        return inputs.examDay.value && inputs.examYear.value && inputs.examBook.value && inputs.examColor.value && inputs.examType.value && inputs.userName.value;
    }

    function getTotalQuestions() {
        return 90;
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
        clearInterval(mainTimer);
        clearInterval(questionTimer);
        clearInterval(areaTimer);
        clearInterval(countdownTimer);
        displays.mainTimerDisplay.textContent = '00:00:00';
        displays.linguagensTimer.textContent = '00:00:00';
        displays.humanasTimer.textContent = '00:00:00';
        displays.redacaoTimer.textContent = '00:00:00';
        displays.naturezaTimer.textContent = '00:00:00';
        displays.matematicaTimer.textContent = '00:00:00';
        displays.questionTimerValue.textContent = '00:00:00';
        controls.startExam.disabled = false;
        controls.pauseExam.disabled = true;
        controls.finishExam.disabled = true;
        controls.downloadReport.disabled = true;
        controls.pauseExam.innerHTML = '<i class="fas fa-pause"></i> Pausar Prova';
        inputs.examDay.value = '';
        inputs.examYear.value = '';
        inputs.examBook.value = '';
        inputs.examColor.value = '';
        inputs.examType.value = '';
        inputs.userName.value = '';
        inputs.pdfUpload.value = '';
        ['examYear', 'examBook', 'examColor', 'examType', 'accessibilityOption', 'userName']
        .forEach(key => inputs[key].disabled = false);
        inputs.accessibilityOption.checked = false;
    }

    init();
});

let redacaoTimerInterval = null;

function startRedacaoTimer() {
    if (redacaoTimerInterval) return;
    redacaoTimerInterval = setInterval(() => {}, 1000);
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

document.addEventListener('DOMContentLoaded', () => {
    const showInstrBtn = document.getElementById('show-instructions');
    const instrModal = document.getElementById('instructions-modal');
    const closeInstr = document.getElementById('close-instructions');
    if (showInstrBtn && instrModal && closeInstr) {
        showInstrBtn.addEventListener('click', () => {
            instrModal.classList.remove('hidden-section');
        });
        closeInstr.addEventListener('click', () => {
            instrModal.classList.add('hidden-section');
        });
        instrModal.addEventListener('click', e => {
            if (e.target === instrModal) {
                instrModal.classList.add('hidden-section');
            }
        });
    }

    const iaModal = document.getElementById('ia-agent-modal');
    const closeIaModal = document.getElementById('close-ia-modal');
    const downloadBtn1 = document.getElementById('download-report');
    const downloadBtn2 = document.getElementById('download-results');

    function openIaModal() {
        if (iaModal) iaModal.classList.remove('hidden-section');
    }
    if (downloadBtn1) {
        downloadBtn1.addEventListener('click', () => {
            setTimeout(openIaModal, 300);
        });
    }
    if (downloadBtn2) {
        downloadBtn2.addEventListener('click', () => {
            setTimeout(openIaModal, 300);
        });
    }
    if (closeIaModal) {
        closeIaModal.addEventListener('click', () => {
            iaModal.classList.add('hidden-section');
        });
    }
    if (iaModal) {
        iaModal.addEventListener('click', (e) => {
            if (e.target === iaModal) {
                iaModal.classList.add('hidden-section');
            }
        });
    }

    const newSimBtn = document.getElementById('new-simulation');
    if (newSimBtn) {
        newSimBtn.addEventListener('click', () => {
            const confirmar = confirm("Tem certeza que deseja iniciar uma nova simulação? Isso apagará todos os dados desta simulação.");
            if (confirmar) {
                location.reload();
            }
        });
    }

//Fim do Bloco 07________________________________________________
//Inicio do Bloco 08________________________________________________

    const finishBtn = document.getElementById('finish-exam');
    if (finishBtn) {
        finishBtn.addEventListener('click', (e) => {
            const downloadReportBtn = document.getElementById('download-report');
            if (confirm("Tem certeza que deseja finalizar a prova? Após isso, não será possível alterar nada.")) {
                if(downloadReportBtn) downloadReportBtn.disabled = false;
            } else {
                 e.preventDefault();
            }
        });
    }
});
