# Provas e relatórios

Cada prova tem um ID estável com concurso, cargo e data de aplicação. A única prova cadastrada é `pcpe-agente-2024-02-25`.

## Organização

- `catalog.js`: índice de provas e caminhos dos seus arquivos.
- `pcpe-agente-2024/definition.js`: identificação, versão, cadernos, questões, gabarito e discursiva.
- `pcpe-agente-2024/analysis.js`: perfil pedagógico próprio de cada questão, critérios, grupos de leitura e fontes.
- `../exam-report.js`: valida o vínculo entre prova e análise e gera o anexo final do TXT.
- `../pcpe.js`: coleta a sessão e envia os dados observados ao gerador do relatório.

## Adicionar outra prova

1. Criar outra pasta e outro ID; não reaproveitar o ID do caderno atual.
2. Cadastrar uma definição em `window.ENEMETRIA_EXAMS[id]` e sua análise em `.analysis`.
3. Inserir no catálogo. Na página que carrega a prova, usar o ID em `body[data-exam-id]` e carregar definição/análise antes de `exam-report.js` e do simulador.
4. Informar as versões de conteúdo, gabarito e análise. Gerar `contentSha256` com SHA-256 do JSON.stringify({questions, answerKey}) em UTF-8 e repetir esse vínculo na análise. Incrementar as versões ao revisar material.
5. Criar uma análise para cada número de questão; o ID de cada análise é `prova-id:Q01`, `prova-id:Q02` etc. Manter bloco e disciplina iguais à definição.
6. Validar com `EnemetriaReports.validate(exam)` e testar o TXT. Se ID, hash, quantidade ou vínculo das questões divergir, o anexo recusa a análise incompatível.

O simulador PC PE atual usa o formato de 60 itens e dois blocos. Uma prova com outro formato também precisa da adequação dos contadores e telas do simulador; a organização de relatórios já aceita outra quantidade.

## Semântica das classificações

Dificuldade e faixas de tempo são estimativas editoriais para candidato preparado, não parâmetros estatísticos calibrados. Nível de conhecimento é separado de dificuldade. Foco de estudo não é frequência histórica nem ordem obrigatória de resolução.

A faixa de tempo considera primeira resolução e exclui leitura inicial compartilhada. O tempo total observado inclui reaberturas. `firstPassTimeSeconds` mede apenas a primeira abertura, inclusive se o candidato a encerrou sem resposta; não garante que tenha lido ou resolvido o item nesse período. Os dados não medem atenção.

Itens com problemas de material ou solução preliminar ficam identificados em `alerts`, com `diagnosticUse: restrito`. Eles permanecem no gabarito de correção fornecido: o anexo não altera a nota.

`DESEMPENHO_OBSERVADO_JSON` usa segundos numéricos e null para tempos inexistentes. A confiança é autorrelatada. O anexo identifica o status preliminar do gabarito e a época da prova. O nome do TXT contém o ID da prova e o instante da exportação.

As classificações são anexadas somente depois de finalizar a simulação; não são renderizadas durante a resolução.

Verificação automatizada: execute node tests/exam-report.test.cjs na raiz do projeto.
