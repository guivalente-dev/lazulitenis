/**
 * Formulário "Envio de resultados Ranking Lazuli" + envio automático para o site.
 *
 * COMO USAR (uma vez só):
 * 1. Acesse https://script.google.com e crie um projeto novo. Cole este arquivo inteiro em Codigo.gs.
 * 2. Em "Configurações do projeto" (engrenagem) > "Propriedades do script", crie:
 *      SITE_URL    = https://lazulitenis.vercel.app
 *      FORM_SECRET = (o mesmo valor definido na variável FORM_SECRET da Vercel)
 *    O segredo fica só nas Propriedades do script; NUNCA escreva no código.
 * 3. Selecione a função criarFormulario e clique em Executar. Autorize quando o Google pedir.
 * 4. Abra "Execuções"/Registros: lá aparecem o link para PREENCHER e o link para EDITAR o formulário.
 *
 * Depois, se entrarem jogadores novos no site, rode atualizarJogadores().
 */

const TITULO = 'Envio de resultados Ranking Lazuli';

// Aceita "WO" ou sets no padrão 6x2 3x6 10x8 (de 1 a 5 sets, separados por espaço)
const PADRAO_PLACAR =
  '^\\s*([Ww][Oo]|\\d{1,2}\\s*[xX]\\s*\\d{1,2}(\\s+\\d{1,2}\\s*[xX]\\s*\\d{1,2}){0,4})\\s*$';

function config_() {
  const p = PropertiesService.getScriptProperties();
  const url = p.getProperty('SITE_URL');
  const secret = p.getProperty('FORM_SECRET');
  if (!url || !secret) {
    throw new Error('Defina SITE_URL e FORM_SECRET em Configurações do projeto > Propriedades do script.');
  }
  return { url: url.replace(/\/+$/, ''), secret: secret };
}

/** Nomes dos jogadores cadastrados no site, em ordem alfabética. */
function nomesJogadores_() {
  const res = UrlFetchApp.fetch(config_().url + '/api/data', { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('Não consegui ler os jogadores do site (' + res.getResponseCode() + ').');
  return JSON.parse(res.getContentText())
    .players.map(function (p) { return p.name; })
    .sort(function (a, b) { return a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }); });
}

function criarFormulario() {
  config_(); // falha cedo se faltar configuração
  const nomes = nomesJogadores_();

  const form = FormApp.create(TITULO);
  form.setDescription(
    'Informe o resultado de um jogo já realizado. O site atualiza o ranking automaticamente.\n\n' +
    '• Cada confronto só pode ser lançado uma vez: se o jogo já estiver no site, o envio é ignorado.\n' +
    '• Seu e-mail Google é registrado junto com a resposta.\n' +
    '• Em caso de erro no lançamento, fale com o organizador.'
  );
  form.setCollectEmail(true);       // exige conta Google e registra o e-mail de quem enviou
  form.setLimitOneResponsePerUser(false); // respostas ilimitadas por pessoa
  form.setAllowResponseEdits(false);
  form.setConfirmationMessage('Resultado recebido! Em instantes ele aparece no ranking.');

  form.addDateItem()
    .setTitle('Data do jogo')
    .setHelpText('Opcional. Sem data, usa o dia do envio.')
    .setRequired(false);

  form.addListItem()
    .setTitle('Vencedor')
    .setChoiceValues(nomes)
    .setRequired(true);

  form.addListItem()
    .setTitle('Perdedor')
    .setChoiceValues(nomes)
    .setRequired(true);

  const placar = form.addTextItem()
    .setTitle('Placar do jogo')
    .setHelpText(
      'Escreva os sets no padrão 6x2 3x6 10x8, SEMPRE com os games do VENCEDOR primeiro, ' +
      'um espaço entre os sets (use "x" entre os games). Exemplos: 6x2 6x4  |  6x4 3x6 10x8.\n' +
      'Se o perdedor não compareceu, escreva apenas: WO'
    )
    .setRequired(true);
  placar.setValidation(
    FormApp.createTextValidation()
      .setHelpText('Use o padrão 6x2 3x6 10x8 (vencedor primeiro, sets separados por espaço) ou apenas WO.')
      .requireTextMatchesPattern(PADRAO_PLACAR)
      .build()
  );

  // Planilha de respostas + aba de log com o resultado da importação no site
  const ss = SpreadsheetApp.create(TITULO + ' (respostas)');
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
  const log = ss.insertSheet('Importação no site');
  log.appendRow(['Quando', 'Enviado por', 'Data do jogo', 'Vencedor', 'Perdedor', 'Placar', 'Resultado']);
  log.setFrozenRows(1);

  const props = PropertiesService.getScriptProperties();
  props.setProperty('FORM_ID', form.getId());
  props.setProperty('SHEET_ID', ss.getId());

  ScriptApp.newTrigger('aoEnviar').forForm(form).onFormSubmit().create();

  Logger.log('PREENCHER (compartilhe este): ' + form.getPublishedUrl());
  Logger.log('EDITAR (só você): ' + form.getEditUrl());
  Logger.log('PLANILHA: ' + ss.getUrl());
  Logger.log('Confira em Configurações > Respostas: "Coletar endereços de e-mail" = Verificado.');
}

/** Gatilho: roda a cada envio do formulário e repassa o resultado ao site. */
function aoEnviar(e) {
  const cfg = config_();
  const campos = {};
  e.response.getItemResponses().forEach(function (r) {
    campos[r.getItem().getTitle()] = r.getResponse();
  });
  const email = e.response.getRespondentEmail();

  const corpo = {
    date: campos['Data do jogo'] || '', // o Forms devolve "aaaa-mm-dd"
    winner: campos['Vencedor'],
    loser: campos['Perdedor'],
    score: campos['Placar do jogo'],
  };

  let resultado;
  try {
    const res = UrlFetchApp.fetch(cfg.url + '/api/submissions', {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-form-secret': cfg.secret },
      payload: JSON.stringify(corpo),
      muteHttpExceptions: true,
    });
    const code = res.getResponseCode();
    let msg = '';
    try { msg = JSON.parse(res.getContentText()).error || ''; } catch (_) {}
    if (code === 200) resultado = 'Importado';
    else if (code === 409) resultado = 'Ignorado (jogo já existia)';
    else resultado = 'Erro ' + code + ': ' + msg;
  } catch (err) {
    resultado = 'Erro de conexão: ' + err;
  }

  const ssId = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  SpreadsheetApp.openById(ssId).getSheetByName('Importação no site').appendRow([
    new Date(), email, corpo.date, corpo.winner, corpo.loser, corpo.score, resultado,
  ]);
}

/** Rode depois de cadastrar jogadores novos no site: atualiza as listas do formulário. */
function atualizarJogadores() {
  const nomes = nomesJogadores_();
  const form = FormApp.openById(PropertiesService.getScriptProperties().getProperty('FORM_ID'));
  form.getItems(FormApp.ItemType.LIST).forEach(function (item) {
    const t = item.getTitle();
    if (t === 'Vencedor' || t === 'Perdedor') item.asListItem().setChoiceValues(nomes);
  });
}
