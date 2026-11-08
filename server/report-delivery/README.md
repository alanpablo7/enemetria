# Recebimento de relatórios — ativação pendente

O GitHub Pages serve apenas arquivos estáticos. O serviço desta pasta deve ser publicado separadamente. Nenhum endereço do destinatário ou segredo deve ser incluído no frontend.

Exemplo preparado: Cloudflare Worker + Resend. Antes de publicar, conferir a documentação atual de ambas as plataformas, verificar domínio remetente no Resend e configurar o binding RATE_LIMITER (ex.: 5 solicitações/minuto/IP). Configurar limite de gastos no provedor. O serviço retorna 503 sem esses recursos.

Segredos no Worker:
- RESEND_API_KEY: chave de envio do Resend.
- REPORT_TO: e-mail privado do responsável, informado pelo proprietário fora do repositório.
- MAIL_FROM: remetente verificado.
- SITE_ORIGIN: https://enemetria.com.br (deve corresponder ao endereço usado pelos participantes).

Após publicar: preencher endpoint HTTPS em report-delivery-config.js. Isso habilita o botão e os textos de prazo de 48 horas. O responsável fará a análise assistida por IA manualmente e responderá usando Reply-To. O servidor envia apenas ao destinatário fixo; não aceita um destinatário arbitrário do navegador.

Validar antes de ativar: relatório real completo recebido na caixa do responsável; Reply-To do aluno; caracteres portugueses; recusa de payload inválido e sem consentimento; rejeição por origem e limite; falha no provedor sem falsa confirmação. accepted significa aceitação pelo provedor, não entrega garantida na caixa. Acompanhar devoluções no provedor. Não registrar relatórios no console.

O serviço usa chave de idempotência por sessão (janela do provedor: 24h). Reenvios dentro da janela devem preservar o mesmo conteúdo/e-mail; fora dela podem duplicar. Para uso amplo adicionar fila persistente com consulta de status, antispam e deduplicação durável. O backend fica separado do código de cálculo das métricas. Não colocar relatórios de alunos no GitHub.
