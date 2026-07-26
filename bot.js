const {
  Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder,
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ChannelType, PermissionFlagsBits, StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder, ModalBuilder, TextInputBuilder,
  TextInputStyle
} = require("discord.js");
const fs = require('fs');
const path = require('path');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

const TOKEN = process.env.TOKEN;
if (!TOKEN) {
  console.error("❌ TOKEN não encontrado! Defina a variável de ambiente TOKEN.");
  process.exit(1);
}

const GUILD_ID = "1508302017980924064";
const CANAL_SUGESTOES_ID = "1511518813701804062";
const CANAL_LOGS_MOD_ID = "1523437994848157797";
const CANAL_LOGS_TICKET_ID = "1510353328821764289";
const CANAL_AVISO_ID = "1508390560795197500";
const CANAL_TICKET_PAINEL = "1509269400774115489";
const CATEGORIA_TICKETS_ID = "1522720316785295541";
const CARGO_STAFF_ID = "1508405150572871720";
const CARGO_SUPORTE_ID = "1513399309306036355";
const CANAL_AVALIACOES_ID = "1524630141182021682";
const CANAL_AVALIACOES_LOGS_ID = "1526278008929783858";
const CANAL_VERIFICACAO_LOGS_ID = "1523437994848157797";
const CATEGORIA_STAFF_ID = "1508506066051272825";

// ========== CANAIS QUE NOVATOS PODEM VER ==========
// ADICIONEI O ID DO CANAL DE VERIFICAÇÃO AQUI
const CANAIS_PERMITIDOS_PARA_NOVATOS = [
  "1509265302846705727",
  "1509265663175299072",
  "1509269400774115489",
  "1508390560795197500",
  "1530291592609533993" // <-- CANAL DE VERIFICAÇÃO ADICIONADO
];

const CARGOS_MODERACAO = ["1508405150572871720"];
const INACTIVITY_TIMEOUT = 5 * 60 * 1000;

const tickets = {};
const formulariosPendentes = {};
const formulariosEnviados = {};
const avaliacoesPendentes = {};
const verificacoesPendentes = {};
const mensagensRecentes = {};
const monitoramentoAtividade = { contagem: 0, ultimoReset: Date.now() };
const statusChannelId = { channel: null, messageId: null };
const voiceChannels = {};

// =========================== PALAVRAS PROIBIDAS (REGEX) ===========================
const PALAVRAS_PROIBIDAS_BASE = [
  "entra no meu servidor", "meu servidor", "meu discord", "meu server",
  "link da bio", "link na bio", "bio",
  "to vendendo", "vendo", "compro", "troco",
  "parceria", "parceiro", "divulgação", "divulgar",
  "segue", "follow", "inscreva-se", "inscrevam-se"
];

const PALAVRAS_GRAVES_BASE = [
  "hitler", "nazista", "nazismo", "nazi",
  "racista", "racismo", "fascista", "fascismo",
  "terrorista", "pedofil", "pedofilo",
  "macaco", "macaca",
  "vendas", "venda", "vender",
];

function construirRegex(palavras) {
  const escaped = palavras.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const palavrasIndividuais = [];
  for (const p of escaped) {
    if (p.includes(' ')) {
      const partes = p.split(' ');
      for (const part of partes) {
        if (part.length > 2) palavrasIndividuais.push(part);
      }
    } else {
      palavrasIndividuais.push(p);
    }
  }
  const unicas = [...new Set(palavrasIndividuais)];
  return new RegExp('\\b(' + unicas.join('|') + ')\\b', 'gi');
}

const PALAVRAS_PROIBIDAS_REGEX = construirRegex(PALAVRAS_PROIBIDAS_BASE);
const PALAVRAS_GRAVES_REGEX = construirRegex(PALAVRAS_GRAVES_BASE);

// =========================== FUNÇÕES AUXILIARES ===========================
function temCargoMod(member) {
  if (!member) return false;
  return member.permissions.has(PermissionFlagsBits.Administrator) ||
    CARGOS_MODERACAO.some((id) => member.roles.cache.has(id));
}

async function enviarLogMod(guild, embed) {
  try {
    const canal = await guild.channels.fetch(CANAL_LOGS_MOD_ID).catch(() => null);
    if (canal) await canal.send({ embeds: [embed] });
  } catch (err) { console.error("[ERRO LOG MOD]", err.message); }
}

async function enviarLogTicket(guild, embed, files = []) {
  try {
    const canal = await guild.channels.fetch(CANAL_LOGS_TICKET_ID).catch(() => null);
    if (canal) await canal.send({ embeds: [embed], files });
  } catch (err) { console.error("[ERRO LOG TICKET]", err.message); }
}

async function enviarDMPunicao(user, staffTag, acao, motivo) {
  try {
    const embed = new EmbedBuilder()
      .setTitle(`🔨 Você foi ${acao}`)
      .setColor("Red")
      .setDescription(`Verificamos que você descumpriu uma ou mais regras do servidor.\n\n**Nota do staff:** ${motivo || "Não informado"}`)
      .setFooter({ text: `Staff responsável: ${staffTag}` })
      .setTimestamp();
    await user.send({ embeds: [embed] });
  } catch (err) { console.log(`[DM] Não foi possível enviar DM para ${user.tag}: ${err.message}`); }
}

function formatarTempo(ms) {
  if (ms < 0) ms = 0;
  const horas = Math.floor(ms / 3600000);
  const minutos = Math.floor((ms % 3600000) / 60000);
  const segundos = Math.floor((ms % 60000) / 1000);
  let str = '';
  if (horas > 0) str += `${horas}h `;
  if (minutos > 0) str += `${minutos}m `;
  if (segundos > 0 || str === '') str += `${segundos}s`;
  return str.trim();
}

// =========================== CONFIGURAÇÃO PERSISTENTE ===========================
const CONFIG_PATH = path.join(__dirname, 'config.json');
const EXECUTORES_PATH = path.join(__dirname, 'executores.json');

function lerConfig() {
  try {
    const data = fs.readFileSync(CONFIG_PATH, 'utf8');
    const config = JSON.parse(data);
    if (!config.cargoNaoVerificado) config.cargoNaoVerificado = null;
    if (!config.cargoMembroVerificado) config.cargoMembroVerificado = null;
    if (!config.canalVerificacao) config.canalVerificacao = null;
    if (!config.canalStatus) config.canalStatus = null;
    if (!config.categoriaCall) config.categoriaCall = null;
    if (!config.canalLogCall) config.canalLogCall = null;
    if (!config.botMusicaId) config.botMusicaId = null;
    if (!config.canalPainelCall) config.canalPainelCall = null;
    return config;
  } catch {
    return {
      canalFormulario: null,
      categoriaFormulario: null,
      cargoNaoVerificado: null,
      cargoMembroVerificado: null,
      canalVerificacao: null,
      canalStatus: null,
      categoriaCall: null,
      canalLogCall: null,
      botMusicaId: null,
      canalPainelCall: null
    };
  }
}

function salvarConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

// =========================== FUNÇÃO CONFIGURAR PERMISSÕES ===========================
async function configurarPermissoesCanais(guild) {
  const config = lerConfig();
  const cargoNaoVerificado = config.cargoNaoVerificado;
  const cargoMembroVerificado = config.cargoMembroVerificado;

  if (!cargoNaoVerificado || !cargoMembroVerificado) {
    console.warn('[PERMISSÕES] Cargos de verificação não configurados.');
    return 0;
  }

  console.log('[PERMISSÕES] Configurando permissões dos canais...');
  const canais = await guild.channels.fetch();
  let atualizados = 0;

  for (const [, canal] of canais) {
    if (canal.type === ChannelType.GuildCategory) continue;
    const naCategoriaStaff = canal.parentId === CATEGORIA_STAFF_ID;
    const isPermitido = CANAIS_PERMITIDOS_PARA_NOVATOS.includes(canal.id);
    const novatoPodeVer = !naCategoriaStaff && isPermitido;
    const verificadoPodeVer = !naCategoriaStaff;

    try {
      await canal.permissionOverwrites.edit(cargoNaoVerificado, { ViewChannel: novatoPodeVer });
      await canal.permissionOverwrites.edit(cargoMembroVerificado, { ViewChannel: verificadoPodeVer });
      await canal.permissionOverwrites.edit(guild.roles.everyone, { ViewChannel: false });
      atualizados++;
    } catch (err) {
      console.error(`[PERMISSÕES] Erro ao configurar canal ${canal.name}:`, err.message);
    }
  }

  console.log(`[PERMISSÕES] ${atualizados} canais configurados.`);
  return atualizados;
}

// =========================== PAINEL DE TICKET ===========================
async function enviarPainelTicket(guild) {
  try {
    const canal = await guild.channels.fetch(CANAL_TICKET_PAINEL).catch(() => null);
    if (!canal) return;
    const msgs = await canal.messages.fetch({ limit: 20 }).catch(() => []);
    const botMsgs = msgs.filter((m) => m.author.id === client.user.id);
    for (const [, msg] of botMsgs) { try { await msg.delete(); } catch {} }
    const embed = new EmbedBuilder()
      .setTitle("Suporte do Zé")
      .setDescription("Clique abaixo para abrir seu ticket!")
      .setColor("Yellow")
      .setImage("https://i.imgur.com/6sSikdc.png")
      .setFooter({ text: "Suporte Do Zé" });
    const select = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("ticket_categoria")
        .setPlaceholder("Escolha uma opção para sua Dúvida.")
        .addOptions(
          new StringSelectMenuOptionBuilder().setLabel("📜 Dúvida Script").setDescription("Dúvidas sobre scripts").setValue("duvida_script").setEmoji("📜"),
          new StringSelectMenuOptionBuilder().setLabel("⚙️ Dúvida Executor").setDescription("Dúvidas sobre executores").setValue("duvida_executor").setEmoji("⚙️"),
          new StringSelectMenuOptionBuilder().setLabel("💬 Outros").setDescription("Outros assuntos").setValue("outros").setEmoji("💬")
        )
    );
    await canal.send({ embeds: [embed], components: [select] });
    console.log("[TICKET] Painel enviado!");
  } catch (err) { console.error("[ERRO PAINEL TICKET]", err.message); }
}

// =========================== PAINEL DE AVALIAÇÃO ===========================
async function enviarPainelAvaliacao(guild) {
  try {
    const canal = await guild.channels.fetch(CANAL_AVALIACOES_ID).catch(() => null);
    if (!canal) return;
    const msgs = await canal.messages.fetch({ limit: 20 }).catch(() => []);
    const botMsgs = msgs.filter((m) => m.author.id === client.user.id);
    for (const [, msg] of botMsgs) { try { await msg.delete(); } catch {} }
    const embed = new EmbedBuilder()
      .setTitle("Central de Avaliações Staff")
      .setDescription(`Sua opinião é muito importante para nós! Clique no botão abaixo para avaliar um membro da staff.`)
      .setColor("Blue")
      .setImage("https://i.imgur.com/WxAC08v.png")
      .setFooter({ text: "Avalie nossa equipe!" });
    const button = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("abrir_modal_avaliacao")
        .setLabel("💡 Enviar Avaliação")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("💡")
    );
    await canal.send({ embeds: [embed], components: [button] });
    console.log("[AVALIACAO] Painel de avaliação enviado!");
  } catch (err) { console.error("[ERRO PAINEL AVALIACAO]", err.message); }
}

// =========================== PERGUNTAS DO FORMULÁRIO DE STAFF ===========================
const PERGUNTAS = [
  { id: 'nome', label: 'Qual o seu nome completo?', placeholder: 'Ex: João Silva', required: true, minLength: 3, maxLength: 60 },
  { id: 'idade', label: 'Quantos anos você tem?', placeholder: 'Ex: 18', required: true, minLength: 1, maxLength: 3 },
  { id: 'discord', label: 'Qual seu Discord (com tag)?', placeholder: 'Ex: João#1234', required: true, minLength: 5, maxLength: 40 },
  { id: 'experiencia', label: 'Você já foi staff em algum outro servidor? Se sim, onde e por quanto tempo?', placeholder: 'Descreva sua experiência...', required: true, maxLength: 500 },
  { id: 'disponibilidade', label: 'Quantas horas por dia, em média, você consegue ficar online?', placeholder: 'Ex: 4 horas', required: true, maxLength: 30 },
  { id: 'motivacao', label: 'Por que você quer ser staff aqui?', placeholder: 'Explique sua motivação...', required: true, maxLength: 500 },
  { id: 'habilidades', label: 'Você tem conhecimento em moderação (comandos, bots, etc.)? Descreva.', placeholder: 'Ex: Sei usar os comandos...', required: true, maxLength: 500 },
  { id: 'cenario', label: 'Como você reagiria se um membro estivesse desrespeitando as regras repetidamente?', placeholder: 'Descreva sua abordagem...', required: true, maxLength: 500 }
];

// =========================== FUNÇÕES DO FORMULÁRIO DE STAFF ===========================
async function enviarPainelFormulario(guild) {
  const config = lerConfig();
  const canalId = config.canalFormulario;
  if (!canalId) {
    console.warn('[FORM] Canal do formulário não configurado.');
    return;
  }
  const canal = await guild.channels.fetch(canalId).catch(() => null);
  if (!canal) {
    console.warn('[FORM] Canal configurado não encontrado.');
    return;
  }
  const msgs = await canal.messages.fetch({ limit: 20 }).catch(() => []);
  const botMsgs = msgs.filter((m) => m.author.id === client.user.id);
  for (const [, msg] of botMsgs) { try { await msg.delete(); } catch {} }
  const embed = new EmbedBuilder()
    .setTitle('📋 Formulário de Recrutamento – Staff')
    .setDescription(
      'Estamos procurando pessoas comprometidas, ativas e com vontade de ajudar a comunidade a crescer.\n\n' +
      '**Requisitos básicos:**\n' +
      '• Ser maior de 16 anos\n' +
      '• Ter tempo disponível para atuar\n' +
      '• Saber trabalhar em equipe\n' +
      '• Respeitar as regras e os membros\n\n' +
      'Clique no botão abaixo para iniciar o formulário. Você será levado para um canal privado.'
    )
    .setColor('Blue')
    .setImage('https://i.imgur.com/tov858d.png')
    .setFooter({ text: 'Script do Zé • Recrutamento' })
    .setTimestamp();
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('formulario_iniciar')
      .setLabel('📝 Preencher Formulário')
      .setStyle(ButtonStyle.Success)
      .setEmoji('📝')
  );
  await canal.send({ embeds: [embed], components: [row] });
  console.log('[FORM] Painel de formulário enviado.');
}

async function criarCanalFormulario(interaction, userId) {
  const guild = interaction.guild;
  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member) throw new Error('Usuário não encontrado.');
  const config = lerConfig();
  let parentId = config.categoriaFormulario || CATEGORIA_TICKETS_ID;
  const parent = await guild.channels.fetch(parentId).catch(() => null);
  if (!parent) {
    const categories = guild.channels.cache.filter(c => c.type === ChannelType.GuildCategory);
    parentId = categories.first()?.id || null;
  }
  const channelName = `form-${member.user.username.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
  const channel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: parentId,
    permissionOverwrites: [
      { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: userId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
      { id: CARGO_STAFF_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
      { id: CARGO_SUPORTE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
      { id: guild.members.me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] }
    ]
  });
  formulariosPendentes[channel.id] = {
    userId: userId,
    respostas: {},
    etapa: 0,
    canalId: channel.id,
    mensagemId: null,
    timeout: null
  };
  const timeout = setTimeout(async () => {
    const estado = formulariosPendentes[channel.id];
    if (estado) {
      await channel.send(`⏰ ${member.user}, o formulário foi cancelado por inatividade.`);
      delete formulariosPendentes[channel.id];
      setTimeout(() => channel.delete().catch(() => {}), 3000);
    }
  }, INACTIVITY_TIMEOUT);
  formulariosPendentes[channel.id].timeout = timeout;
  const embedBoasVindas = new EmbedBuilder()
    .setTitle('📋 Formulário de Recrutamento')
    .setColor('Green')
    .setDescription(`Olá ${member.user}! 👋\n\nVocê está em um canal privado para preencher o formulário.\nResponda às perguntas abaixo com calma.\n\n**Digite \`cancelar\` a qualquer momento para desistir.**`)
    .setTimestamp();
  await channel.send({ content: `<@${userId}>`, embeds: [embedBoasVindas] });
  await enviarProximaPergunta(channel, userId);
  return channel;
}

async function enviarProximaPergunta(channel, userId) {
  const estado = formulariosPendentes[channel.id];
  if (!estado) return;
  const etapa = estado.etapa;
  if (etapa >= PERGUNTAS.length) {
    await mostrarResumo(channel, userId);
    return;
  }
  const pergunta = PERGUNTAS[etapa];
  let texto = `**📝 Pergunta ${etapa + 1}/${PERGUNTAS.length}**\n\n`;
  texto += `**${pergunta.label}**\n`;
  if (pergunta.placeholder) texto += `\n*${pergunta.placeholder}*`;
  texto += `\n\n✏️ **Digite sua resposta abaixo.**`;
  const embed = new EmbedBuilder()
    .setColor('Blue')
    .setDescription(texto)
    .setFooter({ text: `Você tem 5 minutos para responder. Digite "cancelar" para desistir.` })
    .setTimestamp();
  const msg = await channel.send({ content: `<@${userId}>`, embeds: [embed] });
  estado.mensagemId = msg.id;
  if (estado.timeout) clearTimeout(estado.timeout);
  estado.timeout = setTimeout(async () => {
    const estadoAtual = formulariosPendentes[channel.id];
    if (estadoAtual) {
      await channel.send(`⏰ ${userId}, o formulário foi cancelado por inatividade.`);
      delete formulariosPendentes[channel.id];
      setTimeout(() => channel.delete().catch(() => {}), 3000);
    }
  }, INACTIVITY_TIMEOUT);
}

async function mostrarResumo(channel, userId) {
  const estado = formulariosPendentes[channel.id];
  if (!estado) return;
  const respostas = estado.respostas;
  let descricao = '';
  for (const pergunta of PERGUNTAS) {
    const resposta = respostas[pergunta.id] || '(não respondido)';
    descricao += `**${pergunta.label}**\n${resposta}\n\n`;
  }
  const embed = new EmbedBuilder()
    .setTitle('📋 Revisão do Formulário')
    .setDescription(descricao)
    .setColor('Yellow')
    .setFooter({ text: 'Confirme ou cancele o envio.' })
    .setTimestamp();
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('form_confirmar').setLabel('✅ Confirmar e Enviar').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('form_cancelar').setLabel('❌ Cancelar').setStyle(ButtonStyle.Danger)
  );
  const msg = await channel.send({ content: `<@${userId}>`, embeds: [embed], components: [row] });
  estado.mensagemId = msg.id;
}

async function enviarRespostaStaff(userId, respostas, guild) {
  const canalStaff = await guild.channels.fetch('1529652387361591428').catch(() => null);
  if (!canalStaff) {
    console.error('[FORM] Canal staff não encontrado.');
    return;
  }
  const embed = new EmbedBuilder()
    .setTitle('📝 Nova Candidatura')
    .setColor('Blue')
    .setThumbnail(guild.iconURL())
    .setTimestamp()
    .setFooter({ text: `ID do candidato: ${userId}` });
  for (const pergunta of PERGUNTAS) {
    embed.addFields({ name: pergunta.label, value: respostas[pergunta.id] || 'Não informado', inline: false });
  }
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`form_aceitar_${userId}`).setLabel('✅ Aceitar Staff').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`form_recusar_${userId}`).setLabel('❌ Recusar Staff').setStyle(ButtonStyle.Danger)
  );
  await canalStaff.send({ content: `🔔 Nova candidatura de <@${userId}>!`, embeds: [embed], components: [row] });
  console.log(`[FORM] Candidatura de ${userId} enviada.`);
}

// =========================== SISTEMA DE WEBHOOK (EXECUTORES) ===========================
function carregarExecutores() {
  try {
    const data = fs.readFileSync(EXECUTORES_PATH, 'utf8');
    return JSON.parse(data);
  } catch {
    const padrao = {
      webhookURL: 'https://discord.com/api/webhooks/1519217665498021958/gV-6bHq1nGbnzvB0rPMXEAinzQAjLTaZtJvEm6IbXHCRrAnnx0vWE7jynpZcD6HqUkes',
      avatarURL: 'https://cdn.discordapp.com/icons/1508302017980924064/4e99cb3869df3a62beb943e9d14861e7.png?size=2048',
      canalPainelFixo: '1529916242843144312',
      executores: [
        {
          id: 'ronix', nome: 'Ronix', corAtivo: '#2ecc71', corInativo: '#e74c3c', ativo: true,
          thumbnail: 'https://cdn.discordapp.com/emojis/1509291842288746576.png?size=128',
          campos: [
            { name: 'Key-System', value: 'Sem key 🔑', inline: true },
            { name: 'Crash ao injetar', value: 'Sim ⚠️', inline: true },
            { name: 'Multi instance', value: 'Bugado ⚠️', inline: true },
            { name: 'Download', value: '[📥 Ronix-Installer.exe](https://wrdcdn.net/r/154522/1776624538288/Ronix-Installer.exe)', inline: false }
          ]
        },
        {
          id: 'medium', nome: 'Medium', corAtivo: '#2ecc71', corInativo: '#e74c3c', ativo: true,
          thumbnail: 'https://cdn.discordapp.com/emojis/1509291686730404063.png?size=128',
          campos: [
            { name: 'Key-System', value: 'Sem key 🔑', inline: true },
            { name: 'Crash', value: 'Sim ⚠️', inline: true },
            { name: 'Execução de scripts', value: 'Bugado ⚠️', inline: true },
            { name: 'Download', value: '[📥 Download](https://filerift.com/file/BEN2BKv00w)', inline: false }
          ]
        },
        {
          id: 'vortex', nome: 'Vortex', corAtivo: '#2ecc71', corInativo: '#e74c3c', ativo: true,
          thumbnail: 'https://cdn.discordapp.com/emojis/1515117448351977574.png?size=128',
          campos: [
            { name: 'Key-System', value: 'Possui key 🔑', inline: true },
            { name: 'Crash', value: 'Sim ⚠️', inline: true },
            { name: 'Download', value: '[📥 Download](https://gofile.io/d/4qiSvR)', inline: false }
          ]
        },
        {
          id: 'velocity', nome: 'Velocity', corAtivo: '#2ecc71', corInativo: '#e74c3c', ativo: true,
          thumbnail: 'https://cdn.discordapp.com/emojis/1509293220167815269.png?size=128',
          campos: [
            { name: 'Key-System', value: 'Possui key 🔑', inline: true },
            { name: 'Crash', value: 'Sim ⚠️', inline: true },
            { name: 'Multi instance', value: 'Bugado ⚠️', inline: true },
            { name: 'Execução', value: 'Bug às vezes ⚠️', inline: true },
            { name: 'Download', value: '[📥 Download](https://gofile.io/d/6HAQxH)', inline: false }
          ]
        }
      ]
    };
    fs.writeFileSync(EXECUTORES_PATH, JSON.stringify(padrao, null, 2));
    return padrao;
  }
}

function salvarExecutores(data) {
  fs.writeFileSync(EXECUTORES_PATH, JSON.stringify(data, null, 2));
}

async function enviarWebhookExecutores(guild) {
  const config = carregarExecutores();
  const { webhookURL, avatarURL, executores } = config;
  if (!webhookURL) {
    console.warn('[WEBHOOK] URL do webhook não configurada.');
    return;
  }
  const embeds = executores.map(ex => {
    const cor = ex.ativo ? ex.corAtivo || '#2ecc71' : ex.corInativo || '#e74c3c';
    const corHex = parseInt(cor.replace('#', ''), 16);
    const statusEmoji = ex.ativo ? '🟢' : '🔴';
    return {
      title: `${statusEmoji} ${ex.nome}`,
      thumbnail: { url: ex.thumbnail || '' },
      color: corHex,
      fields: ex.campos || []
    };
  });
  const payload = {
    username: 'Executores PC • Script do Zé',
    avatar_url: avatarURL,
    embeds: embeds
  };
  try {
    const response = await fetch(webhookURL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (response.ok) console.log('[WEBHOOK] Painel enviado com sucesso!');
    else console.error('[WEBHOOK] Erro ao enviar:', response.status);
  } catch (err) { console.error('[WEBHOOK] Erro:', err); }
}

async function enviarPainelFixo(guild) {
  const config = carregarExecutores();
  const canalId = config.canalPainelFixo;
  const canal = await guild.channels.fetch(canalId).catch(() => null);
  if (!canal) {
    console.warn('[PAINEL FIXO] Canal não encontrado.');
    return;
  }
  const msgs = await canal.messages.fetch({ limit: 10 }).catch(() => []);
  const botMsgs = msgs.filter((m) => m.author.id === client.user.id);
  for (const [, msg] of botMsgs) { try { await msg.delete(); } catch {} }
  const { executores } = config;
  const embed = new EmbedBuilder()
    .setTitle('📊 Painel de Executores')
    .setDescription('Gerencie os executores que aparecem no webhook.')
    .setColor('Blue')
    .setTimestamp();
  let desc = '';
  for (const ex of executores) {
    const status = ex.ativo ? '🟢 Ativo' : '🔴 Inativo';
    desc += `**${ex.nome}** — ${status}\n`;
  }
  embed.setDescription(desc);
  const rows = [];
  for (const ex of executores) {
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder().setCustomId(`exec_toggle_${ex.id}`).setLabel(ex.ativo ? '❌ Desativar' : '✅ Ativar').setStyle(ex.ativo ? ButtonStyle.Danger : ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`exec_edit_${ex.id}`).setLabel('✏️ Editar').setStyle(ButtonStyle.Secondary)
      );
    rows.push(row);
  }
  const sendRow = new ActionRowBuilder()
    .addComponents(new ButtonBuilder().setCustomId('exec_enviar_webhook').setLabel('📤 Enviar Webhook').setStyle(ButtonStyle.Primary));
  rows.push(sendRow);
  await canal.send({ content: '📌 **Painel Fixo de Gerenciamento**', embeds: [embed], components: rows });
  console.log('[PAINEL FIXO] Painel enviado.');
}

async function atualizarPainelFixo(guild) {
  const config = carregarExecutores();
  const canalId = config.canalPainelFixo;
  const canal = await guild.channels.fetch(canalId).catch(() => null);
  if (!canal) return;
  const msgs = await canal.messages.fetch({ limit: 5 }).catch(() => []);
  const botMsgs = msgs.filter((m) => m.author.id === client.user.id);
  if (botMsgs.length === 0) {
    await enviarPainelFixo(guild);
    return;
  }
  const msg = botMsgs.first();
  const { executores } = config;
  const embed = new EmbedBuilder()
    .setTitle('📊 Painel de Executores')
    .setDescription('Gerencie os executores que aparecem no webhook.')
    .setColor('Blue')
    .setTimestamp();
  let desc = '';
  for (const ex of executores) {
    const status = ex.ativo ? '🟢 Ativo' : '🔴 Inativo';
    desc += `**${ex.nome}** — ${status}\n`;
  }
  embed.setDescription(desc);
  const rows = [];
  for (const ex of executores) {
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder().setCustomId(`exec_toggle_${ex.id}`).setLabel(ex.ativo ? '❌ Desativar' : '✅ Ativar').setStyle(ex.ativo ? ButtonStyle.Danger : ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`exec_edit_${ex.id}`).setLabel('✏️ Editar').setStyle(ButtonStyle.Secondary)
      );
    rows.push(row);
  }
  const sendRow = new ActionRowBuilder()
    .addComponents(new ButtonBuilder().setCustomId('exec_enviar_webhook').setLabel('📤 Enviar Webhook').setStyle(ButtonStyle.Primary));
  rows.push(sendRow);
  await msg.edit({ content: '📌 **Painel Fixo de Gerenciamento**', embeds: [embed], components: rows });
  console.log('[PAINEL FIXO] Painel atualizado.');
}

// =========================== SISTEMA DE VERIFICAÇÃO ===========================
function gerarCodigoVerificacao() {
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let codigo = '';
  for (let i = 0; i < 4; i++) {
    codigo += letras.charAt(Math.floor(Math.random() * letras.length));
  }
  return codigo;
}

async function processarVerificacaoModal(interaction) {
  const user = interaction.user;
  const pendente = verificacoesPendentes[user.id];
  if (!pendente) {
    await interaction.reply({ content: '❌ Você não tem nenhuma verificação pendente.', ephemeral: true });
    return;
  }
  if (pendente.tentativas >= 3) {
    delete verificacoesPendentes[user.id];
    await interaction.reply({ content: '❌ Você excedeu o número de tentativas.', ephemeral: true });
    return;
  }
  const codigoDigitado = interaction.fields.getTextInputValue('codigo_verificacao').trim().toUpperCase();
  if (codigoDigitado === pendente.codigo) {
    delete verificacoesPendentes[user.id];
    const member = interaction.member || await interaction.guild.members.fetch(user.id).catch(() => null);
    if (member) {
      const config = lerConfig();
      const cargoNaoVerificado = config.cargoNaoVerificado;
      const cargoMembro = config.cargoMembroVerificado;
      if (cargoNaoVerificado) {
        try { await member.roles.remove(cargoNaoVerificado); } catch {}
      }
      if (cargoMembro) {
        try {
          await member.roles.add(cargoMembro);
          await interaction.reply({ content: '✅ **Verificação concluída!**', ephemeral: true });
          const logChannel = await interaction.guild.channels.fetch(CANAL_VERIFICACAO_LOGS_ID).catch(() => null);
          if (logChannel) {
            await logChannel.send({ embeds: [new EmbedBuilder().setTitle('✅ Verificação Bem-Sucedida').setColor('Green').addFields({ name: 'Usuário', value: `${user.tag} (${user.id})` }).setTimestamp()] });
          }
          if (pendente.canalId) {
            const canal = await interaction.guild.channels.fetch(pendente.canalId).catch(() => null);
            if (canal) await canal.delete().catch(() => {});
          }
        } catch (err) {
          console.error('[VERIF] Erro ao conceder cargo:', err);
          await interaction.reply({ content: '❌ Erro ao conceder cargo.', ephemeral: true });
        }
      }
    }
  } else {
    pendente.tentativas++;
    const restantes = 3 - pendente.tentativas;
    if (restantes === 0) {
      delete verificacoesPendentes[user.id];
      await interaction.reply({ content: '❌ Você excedeu o número de tentativas.', ephemeral: true });
    } else {
      await interaction.reply({ content: `❌ Código incorreto. Você tem **${restantes}** tentativa(s) restante(s).`, ephemeral: true });
    }
  }
}

// =========================== SISTEMA DE STATUS ===========================
async function atualizarStatus(guild) {
  try {
    const config = lerConfig();
    const canalId = config.canalStatus;
    if (!canalId) return;
    const canal = await guild.channels.fetch(canalId).catch(() => null);
    if (!canal) return;
    const members = await guild.members.fetch();
    const total = members.size;
    const bots = members.filter(m => m.user.bot).size;
    const humanos = total - bots;
    const online = members.filter(m => m.presence?.status === 'online' || m.presence?.status === 'idle' || m.presence?.status === 'dnd').size;
    const emVoz = guild.channels.cache.filter(c => c.type === ChannelType.GuildVoice).reduce((acc, ch) => acc + ch.members.size, 0);
    const staffOnline = members.filter(m => {
      if (m.user.bot) return false;
      return m.roles.cache.some(r => CARGOS_MODERACAO.includes(r.id)) && (m.presence?.status === 'online' || m.presence?.status === 'idle' || m.presence?.status === 'dnd');
    }).size;
    const embed = new EmbedBuilder()
      .setTitle('📊 Status do Servidor')
      .setColor('Blue')
      .setThumbnail(guild.iconURL())
      .addFields(
        { name: '👥 Total de membros', value: `${total}`, inline: true },
        { name: '🧑 Humanos', value: `${humanos}`, inline: true },
        { name: '🤖 Bots', value: `${bots}`, inline: true },
        { name: '🟢 Online (geral)', value: `${online}`, inline: true },
        { name: '🎤 Em canais de voz', value: `${emVoz}`, inline: true },
        { name: '🛡️ Staff online', value: `${staffOnline}`, inline: true }
      )
      .setTimestamp()
      .setFooter({ text: 'Atualizado a cada 5 minutos' });
    const msgId = statusChannelId.messageId;
    if (msgId) {
      try {
        const msg = await canal.messages.fetch(msgId);
        await msg.edit({ embeds: [embed] });
      } catch {
        const msg = await canal.send({ embeds: [embed] });
        statusChannelId.messageId = msg.id;
      }
    } else {
      const msg = await canal.send({ embeds: [embed] });
      statusChannelId.messageId = msg.id;
    }
  } catch (err) { console.error('[STATUS] Erro:', err); }
}

// =========================== SISTEMA DE TICKET AUTOMATIZADO ===========================
const TICKET_PERGUNTAS = [
  { id: 'problema', label: 'Descreva seu problema em detalhes:', required: true },
  { id: 'urgencia', label: 'Qual a urgência? (baixa/média/alta)', required: true },
  { id: 'tentativa', label: 'O que você já tentou fazer para resolver?', required: false }
];

async function iniciarTicketAutomatizado(channel, userId) {
  const ticket = tickets[channel.id];
  if (!ticket) return;
  const embed = new EmbedBuilder()
    .setTitle('📋 Informações do Ticket')
    .setColor('Blue')
    .setDescription('Por favor, responda às perguntas abaixo para agilizar o atendimento.\n\n**Digite suas respostas neste canal.**');
  for (const pergunta of TICKET_PERGUNTAS) {
    embed.addFields({ name: pergunta.label, value: pergunta.required ? '*(obrigatório)*' : '*(opcional)*', inline: false });
  }
  await channel.send({ content: `<@${userId}>`, embeds: [embed] });
  ticket.respostas = {};
  ticket.etapa = 0;
}

async function processarRespostaTicket(message) {
  const channel = message.channel;
  const ticket = tickets[channel.id];
  if (!ticket) return;
  if (message.author.id !== ticket.userId) return;
  if (message.content.toLowerCase() === 'cancelar') {
    delete tickets[channel.id];
    await channel.send('❌ Ticket cancelado pelo usuário.');
    setTimeout(() => channel.delete().catch(() => {}), 3000);
    return;
  }
  const etapa = ticket.etapa;
  if (etapa >= TICKET_PERGUNTAS.length) return;
  const pergunta = TICKET_PERGUNTAS[etapa];
  const resposta = message.content.trim();
  if (pergunta.required && !resposta) {
    await message.reply('❌ Esta pergunta é obrigatória.');
    return;
  }
  ticket.respostas[pergunta.id] = resposta || '(não respondeu)';
  ticket.etapa++;
  await message.reply(`✅ Resposta registrada!`);
  if (ticket.etapa < TICKET_PERGUNTAS.length) {
    const proxPergunta = TICKET_PERGUNTAS[ticket.etapa];
    await channel.send(`**${proxPergunta.label}** ${proxPergunta.required ? '(obrigatório)' : '(opcional)'}`);
  } else {
    await channel.send('✅ Obrigado! Suas respostas foram registradas.');
    const embedLog = new EmbedBuilder()
      .setTitle('📋 Respostas do Ticket Automatizado')
      .setColor('Green')
      .addFields(
        { name: 'Usuário', value: `<@${ticket.userId}>`, inline: true },
        { name: 'Categoria', value: ticket.categoria, inline: true }
      );
    for (const p of TICKET_PERGUNTAS) {
      embedLog.addFields({ name: p.label, value: ticket.respostas[p.id] || 'Não respondeu', inline: false });
    }
    embedLog.setTimestamp();
    await enviarLogTicket(message.guild, embedLog);
  }
}

// =========================== SISTEMA DE PAINEL FIXO DE CALL (SEM IMAGEM) ===========================
async function enviarPainelCall(guild) {
  const config = lerConfig();
  const canalId = config.canalPainelCall;
  if (!canalId) {
    console.warn('[CALL PAINEL] Canal do painel não configurado. Use /call configurar painel-canal.');
    return;
  }
  const canal = await guild.channels.fetch(canalId).catch(() => null);
  if (!canal) {
    console.warn('[CALL PAINEL] Canal não encontrado.');
    return;
  }
  const msgs = await canal.messages.fetch({ limit: 20 }).catch(() => []);
  const botMsgs = msgs.filter((m) => m.author.id === client.user.id);
  for (const [, msg] of botMsgs) { try { await msg.delete(); } catch {} }

  const embed = new EmbedBuilder()
    .setTitle('🎤 Crie seu canal de voz')
    .setDescription('Clique no botão abaixo para criar um canal de voz temporário.\nVocê poderá definir nome, limite de pessoas e se deseja chamar o bot de música.')
    .setColor('Green')
    .setFooter({ text: 'O canal será deletado automaticamente quando ficar vazio.' })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('abrir_modal_call')
      .setLabel('🎧 Criar Call')
      .setStyle(ButtonStyle.Success)
      .setEmoji('🎧')
  );

  await canal.send({ embeds: [embed], components: [row] });
  console.log('[CALL PAINEL] Painel enviado.');
}

async function criarCallModal(interaction) {
  const nome = interaction.fields.getTextInputValue('call_nome') || `Call de ${interaction.user.username}`;
  const limite = parseInt(interaction.fields.getTextInputValue('call_limite')) || 1;
  const musica = interaction.fields.getTextInputValue('call_musica').toLowerCase() === 'sim' ? true : false;

  for (const [channelId, data] of Object.entries(voiceChannels)) {
    if (data.creatorId === interaction.user.id) {
      return interaction.reply({ content: '❌ Você já tem um canal de voz ativo! Entre nele.', ephemeral: true });
    }
  }

  const config = lerConfig();
  const parentId = config.categoriaCall || null;
  const logChannelId = config.canalLogCall;

  try {
    const canalVoz = await interaction.guild.channels.create({
      name: nome,
      type: ChannelType.GuildVoice,
      parent: parentId,
      userLimit: Math.min(limite, 10),
      permissionOverwrites: [
        { id: interaction.guild.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect] },
        { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.ManageChannels] }
      ]
    });

    voiceChannels[canalVoz.id] = { creatorId: interaction.user.id, botMoved: false, timeout: null };

    if (musica) {
      const botId = config.botMusicaId;
      if (botId) {
        try {
          const botMember = await interaction.guild.members.fetch(botId).catch(() => null);
          if (botMember && botMember.voice?.channelId !== canalVoz.id) {
            await botMember.voice.setChannel(canalVoz.id, 'Chamado para música pelo usuário');
            voiceChannels[canalVoz.id].botMoved = true;
          }
        } catch (err) { console.error('[CALL] Erro ao mover bot:', err); }
      } else {
        await interaction.followUp({ content: '⚠️ Bot de música não configurado. Use `/call configurar bot-id`.', ephemeral: true });
      }
    }

    const checkVazio = () => {
      const channel = client.channels.cache.get(canalVoz.id);
      if (!channel) return;
      if (channel.members.size === 0) {
        if (voiceChannels[canalVoz.id]?.timeout) clearTimeout(voiceChannels[canalVoz.id].timeout);
        voiceChannels[canalVoz.id].timeout = setTimeout(async () => {
          try {
            await channel.delete('Canal de voz vazio.');
            delete voiceChannels[canalVoz.id];
            if (logChannelId) {
              const logCanal = await interaction.guild.channels.fetch(logChannelId).catch(() => null);
              if (logCanal) {
                const embed = new EmbedBuilder()
                  .setTitle('🗑️ Canal de voz deletado')
                  .setColor('Red')
                  .addFields(
                    { name: 'Canal', value: canalVoz.name },
                    { name: 'Criado por', value: `<@${voiceChannels[canalVoz.id]?.creatorId || 'Desconhecido'}>` }
                  )
                  .setTimestamp();
                await logCanal.send({ embeds: [embed] });
              }
            }
          } catch (err) { console.error('[CALL] Erro ao deletar:', err); }
        }, 10000);
      } else {
        if (voiceChannels[canalVoz.id]?.timeout) {
          clearTimeout(voiceChannels[canalVoz.id].timeout);
          voiceChannels[canalVoz.id].timeout = null;
        }
      }
    };

    client.on('voiceStateUpdate', (oldState, newState) => {
      if (newState.channelId === canalVoz.id || oldState.channelId === canalVoz.id) {
        checkVazio();
      }
    });

    if (logChannelId) {
      const logCanal = await interaction.guild.channels.fetch(logChannelId).catch(() => null);
      if (logCanal) {
        const embed = new EmbedBuilder()
          .setTitle('🎤 Canal de voz criado')
          .setColor('Green')
          .addFields(
            { name: 'Canal', value: canalVoz.name },
            { name: 'Criado por', value: interaction.user.tag },
            { name: 'Limite', value: `${limite}` },
            { name: 'Música', value: musica ? '✅ Ativado' : '❌ Desativado' }
          )
          .setTimestamp();
        await logCanal.send({ embeds: [embed] });
      }
    }

    await interaction.reply({ content: `✅ Canal de voz **${canalVoz.name}** criado! ${musica ? '🎵 Bot de música ativado.' : ''}\nEntre nele: ${canalVoz}`, ephemeral: false });
  } catch (err) {
    console.error('[CALL] Erro ao criar canal:', err);
    await interaction.reply({ content: '❌ Erro ao criar o canal de voz. Verifique minhas permissões.', ephemeral: true });
  }
}

// =========================== COMANDO !join (BOT DE MÚSICA) ===========================
async function joinMusica(message) {
  const member = message.member;
  if (!member.voice.channel) {
    return message.reply('❌ Você precisa estar em um canal de voz para usar este comando.');
  }
  const config = lerConfig();
  const botId = config.botMusicaId;
  if (!botId) {
    return message.reply('❌ O ID do bot de música não está configurado. Use `/call configurar bot-id`.');
  }
  try {
    const botMember = await message.guild.members.fetch(botId).catch(() => null);
    if (!botMember) {
      return message.reply('❌ Não encontrei o bot de música com o ID configurado. Verifique se ele está no servidor.');
    }
    if (botMember.voice.channelId === member.voice.channel.id) {
      return message.reply('ℹ️ O bot de música já está neste canal de voz.');
    }
    await botMember.voice.setChannel(member.voice.channel, 'Comando !join');
    await message.reply(`✅ Bot de música entrou no canal **${member.voice.channel.name}**!`);
    for (const [chId, data] of Object.entries(voiceChannels)) {
      if (chId === member.voice.channel.id) {
        voiceChannels[chId].botMoved = true;
        break;
      }
    }
  } catch (err) {
    console.error('[!join] Erro ao mover bot:', err);
    await message.reply('❌ Erro ao mover o bot de música. Verifique minhas permissões.');
  }
}

// =========================== EVENTOS ===========================
client.on("guildMemberAdd", async (member) => {
  const config = lerConfig();
  const cargoNaoVerificado = config.cargoNaoVerificado;
  const canalVerificacao = config.canalVerificacao;

  // Aplica o cargo de novato se configurado
  if (cargoNaoVerificado) {
    try {
      await member.roles.add(cargoNaoVerificado);
      console.log(`[VERIF] Cargo de novato aplicado a ${member.user.tag}`);
    } catch (err) {
      console.error('[VERIF] Erro ao aplicar cargo temporário:', err);
    }
  } else {
    console.warn('[VERIF] Cargo não verificado não configurado. Use /verificacao configurar.');
  }

  // Envia a mensagem de boas-vindas no canal de verificação (se configurado)
  if (canalVerificacao) {
    const canal = await member.guild.channels.fetch(canalVerificacao).catch(() => null);
    if (canal) {
      const embed = new EmbedBuilder()
        .setTitle('👋 Bem-vindo(a)!')
        .setDescription(`Olá ${member.user}, seja bem-vindo ao servidor!\n\nClique no botão abaixo para iniciar a verificação.\nVocê receberá um código no chat (apenas você verá).`)
        .setColor('Green')
        .setImage('https://i.imgur.com/tov858d.png')
        .setTimestamp();
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('verificar_geral').setLabel('🔐 Iniciar Verificação').setStyle(ButtonStyle.Success).setEmoji('🔐')
      );
      await canal.send({ content: `<@${member.id}>`, embeds: [embed], components: [row] });
    }
  }
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;

  // ===== COMANDO !join =====
  if (message.content.trim().toLowerCase() === '!join') {
    await joinMusica(message);
    return;
  }

  const member = message.member;

  // --- Auto mod: palavras proibidas (regex) ---
  const conteudo = message.content;
  if (PALAVRAS_PROIBIDAS_REGEX.test(conteudo) && !temCargoMod(member)) {
    try { await message.delete(); } catch {}
    try {
      await message.member.timeout(10 * 60 * 1000, 'Divulgação/propaganda não autorizada');
      await message.channel.send(`🚫 ${message.author}, divulgação de outros servidores ou venda não é permitida aqui. Você foi mutado por 10 minutos.`);
      await enviarLogMod(message.guild, new EmbedBuilder()
        .setTitle('🚫 Bloqueio de Palavra-Chave')
        .setColor('Red')
        .addFields({ name: 'Usuário', value: message.author.tag }, { name: 'Mensagem', value: message.content.slice(0, 200) })
        .setTimestamp());
    } catch {}
    return;
  }

  // --- Palavras graves ---
  if (PALAVRAS_GRAVES_REGEX.test(conteudo) && !temCargoMod(member)) {
    try { await message.delete(); } catch {}
    try {
      await message.member.timeout(5 * 60 * 1000, "Automod: conteúdo proibido");
      await message.channel.send(`⚠️ ${message.author}, esse tipo de conteúdo não é permitido aqui! Você foi mutado por 5 minutos.`);
      await enviarLogMod(message.guild, new EmbedBuilder()
        .setTitle("🚫 Conteúdo Proibido").setColor("DarkRed")
        .addFields(
          { name: "Usuário", value: `${message.author.tag} (\`${message.author.id}\`)` },
          { name: "Canal", value: `<#${message.channel.id}>` },
          { name: "Mensagem", value: `||${message.content.slice(0, 200)}||` },
          { name: "Duração", value: "5 minutos" }
        )
        .setTimestamp());
    } catch (err) { console.error("[ERRO MUTE GRAVE]", err.message); }
    return;
  }

  // --- Flood (8 mensagens em 5s) ---
  if (!client.floodUsers) client.floodUsers = {};
  const user = client.floodUsers[message.author.id] || { count: 0, timer: null };
  user.count++;
  if (user.timer) clearTimeout(user.timer);
  user.timer = setTimeout(() => { delete client.floodUsers[message.author.id]; }, 5000);
  client.floodUsers[message.author.id] = user;
  if (user.count > 8) {
    try { await message.delete(); } catch {}
    try {
      await message.member.timeout(60 * 1000, "Automod: flood");
      await message.channel.send(`⚠️ ${message.author}, pare de floodar! Você foi mutado por 1 minuto.`);
      await enviarLogMod(message.guild, new EmbedBuilder()
        .setTitle("🌊 Flood Detectado").setColor("Red")
        .addFields(
          { name: "Usuário", value: `${message.author.tag} (\`${message.author.id}\`)` },
          { name: "Canal", value: `<#${message.channel.id}>` },
          { name: "Mensagens", value: `${user.count}` },
          { name: "Duração", value: "1 minuto" }
        )
        .setTimestamp());
    } catch (err) { console.error("[ERRO MUTE FLOOD]", err.message); }
    return;
  }

  // --- Repetição (3 canais diferentes em 1 minuto) ---
  if (!mensagensRecentes[message.author.id]) mensagensRecentes[message.author.id] = [];
  const msgs = mensagensRecentes[message.author.id];
  const canaisDiferentes = new Set();
  const agora = Date.now();
  for (const m of msgs) {
    if (m.content === message.content && (agora - m.timestamp) < 60000) {
      canaisDiferentes.add(m.channelId);
    }
  }
  canaisDiferentes.add(message.channel.id);
  if (canaisDiferentes.size >= 3 && !temCargoMod(member)) {
    try { await message.delete(); } catch {}
    try {
      await message.member.timeout(5 * 60 * 1000, 'Anti-spam: mensagem repetida');
      await message.channel.send(`⚠️ ${message.author}, você está repetindo a mesma mensagem em vários canais. Foi mutado por 5 minutos.`);
      await enviarLogMod(message.guild, new EmbedBuilder()
        .setTitle('🔄 Anti-Spam (Repetição)')
        .setColor('Orange')
        .addFields({ name: 'Usuário', value: message.author.tag }, { name: 'Mensagem', value: message.content.slice(0, 200) })
        .setTimestamp());
    } catch {}
    return;
  }
  msgs.push({ content: message.content, channelId: message.channel.id, timestamp: Date.now() });
  if (msgs.length > 10) msgs.shift();

  // --- @everyone/@here ---
  if (message.content.includes("@everyone") || message.content.includes("@here")) {
    if (!message.member.roles.cache.has(CARGO_SUPORTE_ID)) {
      try { await message.delete(); } catch {}
      const m = await message.channel.send(`❌ ${message.author}, você não pode mencionar @everyone ou @here.`);
      setTimeout(() => m.delete().catch(() => {}), 3000);
      return;
    }
  }

  // --- Mass mention ---
  if (message.mentions.users.size > 5 || message.mentions.roles.size > 3) {
    if (!temCargoMod(message.member)) {
      try { await message.delete(); } catch {}
      const m = await message.channel.send(`❌ ${message.author}, você mencionou muitas pessoas/cargos! Máximo: 5 usuários ou 3 cargos.`);
      setTimeout(() => m.delete().catch(() => {}), 3000);
      return;
    }
  }

  // --- Formulário de staff ---
  const estadoForm = formulariosPendentes[message.channel.id];
  if (estadoForm) {
    if (message.author.id !== estadoForm.userId) return;
    if (message.content.toLowerCase() === 'cancelar') {
      if (estadoForm.timeout) clearTimeout(estadoForm.timeout);
      delete formulariosPendentes[message.channel.id];
      await message.reply('❌ Formulário cancelado.');
      setTimeout(() => message.channel.delete().catch(() => {}), 2000);
      return;
    }
    const etapa = estadoForm.etapa;
    if (etapa >= PERGUNTAS.length) return;
    const pergunta = PERGUNTAS[etapa];
    const resposta = message.content.trim();
    if (pergunta.required && !resposta) {
      await message.reply('❌ Esta pergunta é obrigatória.');
      return;
    }
    if (pergunta.minLength && resposta.length < pergunta.minLength) {
      await message.reply(`❌ A resposta deve ter pelo menos ${pergunta.minLength} caracteres.`);
      return;
    }
    if (pergunta.maxLength && resposta.length > pergunta.maxLength) {
      await message.reply(`❌ A resposta deve ter no máximo ${pergunta.maxLength} caracteres.`);
      return;
    }
    estadoForm.respostas[pergunta.id] = resposta;
    estadoForm.etapa++;
    await message.reply(`✅ Resposta registrada!`);
    await new Promise(resolve => setTimeout(resolve, 500));
    await enviarProximaPergunta(message.channel, estadoForm.userId);
    return;
  }

  // --- Ticket automatizado ---
  const ticket = tickets[message.channel.id];
  if (ticket && ticket.etapa !== undefined && ticket.etapa < TICKET_PERGUNTAS.length) {
    if (message.author.id === ticket.userId) {
      await processarRespostaTicket(message);
      return;
    }
  }

  monitoramentoAtividade.contagem++;
});

// =========================== INTERACTIONS ===========================
client.on("interactionCreate", async (interaction) => {
  if (interaction.isButton()) {
    // Verificação
    if (interaction.customId === 'verificar_geral') {
      const userId = interaction.user.id;
      const config = lerConfig();
      const cargoMembro = config.cargoMembroVerificado;
      if (cargoMembro && interaction.member.roles.cache.has(cargoMembro)) {
        return interaction.reply({ content: '✅ Você já está verificado!', ephemeral: true });
      }
      if (verificacoesPendentes[userId]) {
        return interaction.reply({ content: '⏳ Você já tem um código pendente.', ephemeral: true });
      }
      const codigo = gerarCodigoVerificacao();
      verificacoesPendentes[userId] = { codigo, tentativas: 0, timestamp: Date.now() };
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('abrir_modal_codigo').setLabel('🔑 Digitar Código').setStyle(ButtonStyle.Primary).setEmoji('🔑')
      );
      await interaction.reply({
        content: `🔐 **Seu código de verificação é:** \`${codigo}\`\n\nClique no botão abaixo para abrir o formulário e digitar o código.\n\n*Você tem 3 tentativas.*`,
        components: [row],
        ephemeral: true
      });
      return;
    }

    if (interaction.customId === 'abrir_modal_codigo') {
      const userId = interaction.user.id;
      const pendente = verificacoesPendentes[userId];
      if (!pendente) {
        return interaction.reply({ content: '❌ Você não tem nenhuma verificação pendente.', ephemeral: true });
      }
      if (pendente.tentativas >= 3) {
        delete verificacoesPendentes[userId];
        return interaction.reply({ content: '❌ Você excedeu o número de tentativas.', ephemeral: true });
      }
      const modal = new ModalBuilder()
        .setCustomId('modal_verificacao')
        .setTitle('Verificação de Segurança');
      const codigoInput = new TextInputBuilder()
        .setCustomId('codigo_verificacao')
        .setLabel('Digite o código que você recebeu:')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: AB3C')
        .setRequired(true)
        .setMaxLength(4)
        .setMinLength(4);
      const actionRow = new ActionRowBuilder().addComponents(codigoInput);
      modal.addComponents(actionRow);
      await interaction.showModal(modal);
      return;
    }

    // ---- Avaliação ----
    if (interaction.customId === "abrir_modal_avaliacao") {
      const modal = new ModalBuilder()
        .setCustomId("modal_avaliacao_staff")
        .setTitle("Avaliação de Staff");
      modal.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("staff_name_input").setLabel("Nome do Staff").setStyle(TextInputStyle.Short).setPlaceholder("Ex: Fulano#1234 ou ID").setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("comment_input").setLabel("Seu Comentário").setStyle(TextInputStyle.Paragraph).setPlaceholder("Descreva sua experiência...").setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("rating_input").setLabel("Nota (1 a 5)").setStyle(TextInputStyle.Short).setPlaceholder("Ex: 5").setRequired(true))
      );
      await interaction.showModal(modal);
      return;
    }

    // ---- Avaliação de ticket ----
    if (interaction.customId.startsWith("avaliacao_ticket_")) {
      const nota = parseInt(interaction.customId.split("_")[2]);
      const estrelas = "⭐".repeat(nota);
      const pendente = avaliacoesPendentes?.[interaction.user.id];
      if (!pendente) return interaction.update({ content: "❌ Avaliação expirada ou já respondida.", embeds: [], components: [] });
      const guild = await client.guilds.fetch(pendente.guildId).catch(() => null);
      if (guild) {
        await enviarLogTicket(guild, new EmbedBuilder()
          .setTitle("⭐ Avaliação de Ticket").setColor("Gold")
          .addFields(
            { name: "👤 Usuário", value: `${interaction.user.tag}` },
            { name: "🛠️ Staff", value: pendente.staffTag },
            { name: "📂 Categoria", value: pendente.categoria },
            { name: "⭐ Avaliação", value: `${estrelas} (${nota}/5)` }
          )
          .setTimestamp());
      }
      delete avaliacoesPendentes[interaction.user.id];
      return interaction.update({ content: `✅ Obrigado pela avaliação! Você deu **${estrelas} (${nota}/5)**.`, embeds: [], components: [] });
    }

    // ---- Avaliação de chat ----
    if (interaction.customId.startsWith("avaliacao_chat_")) {
      const partes = interaction.customId.split("_");
      const nota = parseInt(partes[2]);
      const staffId = partes[3];
      const estrelas = "⭐".repeat(nota);
      const guild = interaction.guild || await client.guilds.fetch(interaction.guildId).catch(() => null);
      const canalAv = await guild?.channels.fetch(CANAL_AVALIACOES_ID).catch(() => null);
      const staffUser = await client.users.fetch(staffId).catch(() => null);
      if (canalAv) {
        await canalAv.send({ embeds: [new EmbedBuilder()
          .setTitle("⭐ Avaliação de Staff — Chat Geral").setColor("Gold")
          .addFields(
            { name: "👤 Avaliado por", value: `${interaction.user.tag}` },
            { name: "🛠️ Staff", value: staffUser ? `${staffUser.tag}` : `ID: ${staffId}` },
            { name: "⭐ Nota", value: `${estrelas} (${nota}/5)` }
          )
          .setTimestamp()]
        });
      }
      return interaction.update({ content: `✅ Avaliação enviada! Você deu **${estrelas} (${nota}/5)**.`, embeds: [], components: [] });
    }

    // ---- Reivindicar ticket (corrigido) ----
    if (interaction.customId === "reivindicar_ticket") {
      const channelId = interaction.message.channelId;
      const ticket = tickets[channelId];
      if (!ticket) {
        return interaction.reply({ content: "❌ Ticket não encontrado!", flags: 64 });
      }
      if (ticket.staffId) return interaction.reply({ content: `❌ Este ticket já foi reivindicado por <@${ticket.staffId}>!`, flags: 64 });
      if (!temCargoMod(interaction.member)) return interaction.reply({ content: "❌ Só staff pode reivindicar tickets!", flags: 64 });
      ticket.staffId = interaction.user.id;
      ticket.staffTag = interaction.user.tag;

      let respostasText = '';
      if (ticket.respostas && Object.keys(ticket.respostas).length > 0) {
        respostasText = '\n\n**Respostas do usuário:**\n';
        for (const p of TICKET_PERGUNTAS) {
          respostasText += `**${p.label}** ${ticket.respostas[p.id] || 'Não respondeu'}\n`;
        }
      }

      const embedAtualizado = new EmbedBuilder()
        .setTitle(`🎫 Ticket — ${ticket.categoria}`).setColor("Green")
        .setImage("https://i.imgur.com/6sSikdc.png")
        .setDescription(`Olá <@${ticket.userId}>! 👋\n\nSeu ticket está sendo atendido por **${interaction.user}**!\n\n📌 **Descreva seu problema com detalhes.**\n⏰ Abertura: <t:${Math.floor(ticket.abertura / 1000)}:F>`)
        .addFields(
          { name: "👤 Usuário", value: `<@${ticket.userId}>` },
          { name: "📂 Categoria", value: ticket.categoria },
          { name: "🛠️ Atendente", value: `${interaction.user}` }
        )
        .setFooter({ text: "Scripts SDZ • Suporte" }).setTimestamp();
      if (respostasText) {
        embedAtualizado.addFields({ name: "📋 Informações adicionais", value: respostasText });
      }

      try {
        await interaction.message.edit({ embeds: [embedAtualizado], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("fechar_ticket").setLabel("🔒 Fechar Ticket").setStyle(ButtonStyle.Danger))] });
      } catch {}
      await interaction.reply(`✅ ${interaction.user} reivindicou este ticket e irá te atender, <@${ticket.userId}>!`);
      await enviarLogTicket(interaction.guild, new EmbedBuilder()
        .setTitle("🙋 Ticket Reivindicado").setColor("Green")
        .addFields(
          { name: "Staff", value: interaction.user.tag },
          { name: "Usuário", value: `<@${ticket.userId}>` },
          { name: "Categoria", value: ticket.categoria },
          { name: "Canal", value: `${interaction.channel}` }
        )
        .setTimestamp());
      return;
    }

    // ---- Fechar ticket (corrigido) ----
    if (interaction.customId === "fechar_ticket") {
      if (!temCargoMod(interaction.member)) return interaction.reply({ content: "❌ Só staff pode fechar tickets!", flags: 64 });
      const channelId = interaction.message.channelId;
      let ticket = tickets[channelId];
      
      if (!ticket) {
        const canal = interaction.channel;
        if (canal.parentId === CATEGORIA_TICKETS_ID) {
          const nomeParts = canal.name.split('-');
          const userId = nomeParts.length > 1 ? nomeParts.slice(1).join('-') : null;
          if (userId) {
            ticket = {
              userId: userId,
              categoria: "Desconhecida",
              staffId: null,
              staffTag: null,
              abertura: Date.now(),
              respostas: {},
              etapa: 0
            };
            tickets[channelId] = ticket;
          }
        }
        if (!ticket) {
          return interaction.reply({ content: "❌ Não foi possível identificar este ticket. Feche o canal manualmente.", flags: 64 });
        }
      }

      await interaction.deferReply();
      const mensagens = await interaction.channel.messages.fetch({ limit: 100 });
      const transcript = mensagens.reverse().map((m) => `[${new Date(m.createdTimestamp).toLocaleString("pt-BR")}] ${m.author.tag}: ${m.content || "[anexo/embed]"}`).join("\n");
      await enviarLogTicket(interaction.guild,
        new EmbedBuilder().setTitle("📋 Ticket Fechado").setColor("Red")
          .addFields(
            { name: "Canal", value: interaction.channel.name },
            { name: "Usuário", value: `<@${ticket.userId}>` },
            { name: "Categoria", value: ticket.categoria },
            { name: "Atendente", value: ticket.staffTag || "Não reivindicado" },
            { name: "Fechado por", value: interaction.user.tag }
          )
          .setTimestamp(),
        [{ attachment: Buffer.from(transcript, "utf-8"), name: `transcript-${interaction.channel.name}.txt` }]
      );
      const usuario = await client.users.fetch(ticket.userId).catch(() => null);
      if (usuario) await enviarAvaliacaoDM(usuario, ticket.staffTag || "Não identificado", ticket.categoria, interaction.guild);
      await interaction.editReply("✅ Ticket fechado! Canal será deletado em 5 segundos...");
      delete tickets[interaction.channel.id];
      setTimeout(async () => { try { await interaction.channel.delete(); } catch {} }, 5000);
      return;
    }

    // ---- Deletar canal (confirmação) ----
    if (interaction.customId.startsWith("confirmar_deletar_canal_")) {
      const canalId = interaction.customId.split("_")[3];
      const canal = await interaction.guild.channels.fetch(canalId).catch(() => null);
      if (!canal) return interaction.update({ content: "❌ Este canal já foi deletado ou não existe mais.", components: [] });
      if (!temCargoMod(interaction.member)) return interaction.update({ content: "❌ Você não tem permissão para deletar canais.", components: [] });
      try {
        const nomeCanal = canal.name;
        await canal.delete(`Deletado por ${interaction.user.tag}`);
        const embedLog = new EmbedBuilder()
          .setTitle("🗑️ Canal Deletado")
          .setColor("Red")
          .addFields(
            { name: "Staff", value: interaction.user.tag },
            { name: "Canal deletado", value: `#${nomeCanal}` },
            { name: "ID do canal", value: canalId }
          )
          .setTimestamp();
        await enviarLogMod(interaction.guild, embedLog);
        await interaction.update({ content: `✅ O canal **#${nomeCanal}** foi deletado com sucesso por ${interaction.user}.`, components: [] });
      } catch (err) {
        console.error("[ERRO DELETAR CANAL]", err);
        await interaction.update({ content: "❌ Erro ao deletar o canal. Verifique minhas permissões.", components: [] });
      }
      return;
    }

    if (interaction.customId === "cancelar_deletar_canal") {
      await interaction.update({ content: "❌ Operação cancelada. Nenhum canal foi deletado.", components: [] });
      return;
    }

    // ---- Formulário de staff - Iniciar ----
    if (interaction.customId === "formulario_iniciar") {
      const userId = interaction.user.id;
      for (const [channelId, estado] of Object.entries(formulariosPendentes)) {
        if (estado.userId === userId) {
          return interaction.reply({ content: "❌ Você já tem um formulário em andamento.", flags: 64 });
        }
      }
      try {
        await interaction.reply({ content: "✅ Criando seu canal privado... Aguarde.", flags: 64 });
        const channel = await criarCanalFormulario(interaction, userId);
        await interaction.editReply({ content: `✅ Canal criado: ${channel.toString()}` });
      } catch (error) {
        console.error('[ERRO BOTÃO INICIAR]', error);
        await interaction.editReply({ content: '❌ Erro ao iniciar o formulário.' });
      }
      return;
    }

    // ---- Formulário - Confirmar ----
    if (interaction.customId === "form_confirmar") {
      try {
        const estado = formulariosPendentes[interaction.channel.id];
        if (!estado) return interaction.reply({ content: "❌ Sessão expirada.", flags: 64 });
        const userId = estado.userId;
        await enviarRespostaStaff(userId, estado.respostas, interaction.guild);
        formulariosEnviados[userId] = { respostas: estado.respostas, guildId: interaction.guild.id };
        if (estado.timeout) clearTimeout(estado.timeout);
        delete formulariosPendentes[interaction.channel.id];
        await interaction.update({ content: "✅ Formulário enviado com sucesso! Aguarde a análise.", embeds: [], components: [] });
        setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
      } catch (error) {
        console.error('[ERRO CONFIRMAR]', error);
        await interaction.reply({ content: '❌ Erro ao enviar o formulário.', flags: 64 });
      }
      return;
    }

    // ---- Formulário - Cancelar ----
    if (interaction.customId === "form_cancelar") {
      const estado = formulariosPendentes[interaction.channel.id];
      if (estado?.timeout) clearTimeout(estado.timeout);
      delete formulariosPendentes[interaction.channel.id];
      await interaction.update({ content: "❌ Formulário cancelado.", embeds: [], components: [] });
      setTimeout(() => interaction.channel.delete().catch(() => {}), 2000);
      return;
    }

    // ---- Formulário - Aceitar Staff ----
    if (interaction.customId.startsWith("form_aceitar_")) {
      const userId = interaction.customId.split('_')[2];
      const data = formulariosEnviados[userId];
      if (!data) return interaction.reply({ content: "❌ Candidatura não encontrada.", flags: 64 });
      if (!temCargoMod(interaction.member)) return interaction.reply({ content: "❌ Você não tem permissão.", flags: 64 });
      const user = await client.users.fetch(userId).catch(() => null);
      if (user) {
        const embedAprovado = new EmbedBuilder()
          .setTitle('🎉 Parabéns! Você foi aprovado!')
          .setColor('Green')
          .setDescription('Sua candidatura para staff foi **aceita**! Em breve você receberá mais instruções.\n\nAgradecemos o interesse!')
          .setFooter({ text: `Aprovado por ${interaction.user.tag}` })
          .setTimestamp();
        await user.send({ embeds: [embedAprovado] }).catch(() => console.log(`[DM] Não foi possível enviar DM para ${user.tag}`));
      }
      delete formulariosEnviados[userId];
      await interaction.reply({ content: `✅ Candidatura de <@${userId}> aprovada! DM enviada.`, flags: 64 });
      return;
    }

    // ---- Formulário - Recusar Staff ----
    if (interaction.customId.startsWith("form_recusar_")) {
      const userId = interaction.customId.split('_')[2];
      const data = formulariosEnviados[userId];
      if (!data) return interaction.reply({ content: "❌ Candidatura não encontrada.", flags: 64 });
      if (!temCargoMod(interaction.member)) return interaction.reply({ content: "❌ Você não tem permissão.", flags: 64 });
      const user = await client.users.fetch(userId).catch(() => null);
      if (user) {
        const embedReprovado = new EmbedBuilder()
          .setTitle('😔 Obrigado pelo interesse!')
          .setColor('Red')
          .setDescription('Infelizmente, sua candidatura para staff não foi aprovada desta vez.\n\n**Não desanime!** Continue participando da comunidade!')
          .setFooter({ text: `Recusado por ${interaction.user.tag}` })
          .setTimestamp();
        await user.send({ embeds: [embedReprovado] }).catch(() => console.log(`[DM] Não foi possível enviar DM para ${user.tag}`));
      }
      delete formulariosEnviados[userId];
      await interaction.reply({ content: `❌ Candidatura de <@${userId}> recusada. DM enviada.`, flags: 64 });
      return;
    }

    // ---- Webhook - Toggle executor ----
    if (interaction.customId.startsWith('exec_toggle_')) {
      if (!temCargoMod(interaction.member)) return interaction.reply({ content: "❌ Sem permissão.", flags: 64 });
      const id = interaction.customId.replace('exec_toggle_', '');
      const config = carregarExecutores();
      const executor = config.executores.find(e => e.id === id);
      if (!executor) return interaction.reply({ content: "❌ Executor não encontrado.", flags: 64 });
      executor.ativo = !executor.ativo;
      salvarExecutores(config);
      await enviarWebhookExecutores(interaction.guild);
      await atualizarPainelFixo(interaction.guild);
      await interaction.reply({ content: `✅ ${executor.nome} agora está ${executor.ativo ? 'ATIVO' : 'INATIVO'}!`, flags: 64 });
      return;
    }

    // ---- Webhook - Editar executor (abre modal) ----
    if (interaction.customId.startsWith('exec_edit_')) {
      if (!temCargoMod(interaction.member)) return interaction.reply({ content: "❌ Sem permissão.", flags: 64 });
      const id = interaction.customId.replace('exec_edit_', '');
      const config = carregarExecutores();
      const executor = config.executores.find(e => e.id === id);
      if (!executor) return interaction.reply({ content: "❌ Executor não encontrado.", flags: 64 });
      const modal = new ModalBuilder().setCustomId(`exec_modal_${id}`).setTitle(`Editar ${executor.nome}`);
      modal.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('exec_nome').setLabel('Nome').setStyle(TextInputStyle.Short).setValue(executor.nome).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('exec_corAtivo').setLabel('Cor (ativo) hex').setStyle(TextInputStyle.Short).setValue(executor.corAtivo || '#2ecc71').setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('exec_corInativo').setLabel('Cor (inativo) hex').setStyle(TextInputStyle.Short).setValue(executor.corInativo || '#e74c3c').setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('exec_thumbnail').setLabel('URL Thumbnail').setStyle(TextInputStyle.Short).setValue(executor.thumbnail || '').setRequired(false)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('exec_campos').setLabel('Campos (Nome|Valor|inline)').setStyle(TextInputStyle.Paragraph).setValue(executor.campos.map(c => `${c.name}|${c.value}|${c.inline}`).join('\n')).setRequired(true))
      );
      await interaction.showModal(modal);
      return;
    }

    // ---- Webhook - Enviar ----
    if (interaction.customId === 'exec_enviar_webhook') {
      if (!temCargoMod(interaction.member)) return interaction.reply({ content: "❌ Sem permissão.", flags: 64 });
      await interaction.reply({ content: '⏳ Enviando webhook...', flags: 64 });
      await enviarWebhookExecutores(interaction.guild);
      await interaction.editReply({ content: '✅ Webhook reenviado com sucesso!' });
      return;
    }

    // ---- CALL - ABRIR MODAL (painel fixo) ----
    if (interaction.customId === 'abrir_modal_call') {
      const modal = new ModalBuilder()
        .setCustomId('modal_criar_call')
        .setTitle('Criar Call');
      
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('call_nome')
            .setLabel('Nome do canal (opcional)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Ex: Minha Call')
            .setRequired(false)
            .setMaxLength(50)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('call_limite')
            .setLabel('Limite de pessoas (1-10)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Ex: 5')
            .setRequired(true)
            .setMaxLength(2)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('call_musica')
            .setLabel('Chamar bot de música? (sim/não)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Digite "sim" ou "não"')
            .setRequired(true)
            .setMaxLength(3)
        )
      );

      await interaction.showModal(modal);
      return;
    }
  }

  // ---- MODAIS ----
  if (interaction.isModalSubmit()) {
    if (interaction.customId === 'modal_verificacao') {
      await processarVerificacaoModal(interaction);
      return;
    }

    if (interaction.customId === "modal_avaliacao_staff") {
      const staffName = interaction.fields.getTextInputValue("staff_name_input");
      const comment = interaction.fields.getTextInputValue("comment_input");
      const rating = parseInt(interaction.fields.getTextInputValue("rating_input"));
      if (isNaN(rating) || rating < 1 || rating > 5) {
        return interaction.reply({ content: "❌ A nota deve ser um número entre 1 e 5.", ephemeral: true });
      }
      const estrelas = "⭐".repeat(rating);
      const logChannel = await interaction.guild.channels.fetch(CANAL_AVALIACOES_LOGS_ID).catch(() => null);
      if (logChannel) {
        await logChannel.send({ embeds: [new EmbedBuilder()
          .setTitle("📝 Nova Avaliação de Staff")
          .setColor("Green")
          .addFields(
            { name: "👤 Avaliador", value: `${interaction.user.tag} (${interaction.user.id})` },
            { name: "🛠️ Staff Avaliado", value: staffName },
            { name: "⭐ Nota", value: `${estrelas} (${rating}/5)` },
            { name: "💬 Comentário", value: comment || "Nenhum comentário." }
          )
          .setTimestamp()]
        });
        await interaction.reply({ content: "✅ Sua avaliação foi enviada com sucesso!", ephemeral: true });
      } else {
        await interaction.reply({ content: "❌ Não foi possível encontrar o canal de logs de avaliação.", ephemeral: true });
      }
      return;
    }

    if (interaction.customId.startsWith('exec_modal_')) {
      if (!temCargoMod(interaction.member)) return interaction.reply({ content: "❌ Sem permissão.", flags: 64 });
      const id = interaction.customId.replace('exec_modal_', '');
      const config = carregarExecutores();
      const executor = config.executores.find(e => e.id === id);
      if (!executor) return interaction.reply({ content: "❌ Executor não encontrado.", flags: 64 });
      executor.nome = interaction.fields.getTextInputValue('exec_nome');
      executor.corAtivo = interaction.fields.getTextInputValue('exec_corAtivo');
      executor.corInativo = interaction.fields.getTextInputValue('exec_corInativo');
      executor.thumbnail = interaction.fields.getTextInputValue('exec_thumbnail');
      const camposRaw = interaction.fields.getTextInputValue('exec_campos');
      const linhas = camposRaw.split('\n').filter(line => line.trim());
      executor.campos = linhas.map(line => {
        const parts = line.split('|').map(s => s.trim());
        return { name: parts[0] || 'Campo', value: parts[1] || 'Valor', inline: parts[2] ? parts[2].toLowerCase() === 'true' : false };
      });
      salvarExecutores(config);
      await enviarWebhookExecutores(interaction.guild);
      await atualizarPainelFixo(interaction.guild);
      await interaction.reply({ content: `✅ ${executor.nome} atualizado com sucesso!`, flags: 64 });
      return;
    }

    // ---- CALL - MODAL ----
    if (interaction.customId === 'modal_criar_call') {
      await criarCallModal(interaction);
      return;
    }
  }

  // ---- SELECT MENU (ticket) ----
  if (interaction.isStringSelectMenu() && interaction.customId === "ticket_categoria") {
    const categoria = interaction.values[0];
    const userId = interaction.user.id;
    const guild = interaction.guild;
    const ticketExistente = Object.values(tickets).find((t) => t.userId === userId);
    if (ticketExistente) return interaction.reply({ content: "❌ Você já tem um ticket aberto!", flags: 64 });
    await interaction.deferReply({ flags: 64 });

    const nomes = {
      duvida_script: "📜 Dúvida Script",
      duvida_executor: "⚙️ Dúvida Executor",
      outros: "💬 Outros"
    };
    const nomeCategoria = nomes[categoria] || categoria;
    const nomeCanal = `ticket-${interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;

    try {
      const todosCargos = await guild.roles.fetch();
      const permissoes = [
        { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: userId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
        { id: CARGO_STAFF_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
        { id: CARGO_SUPORTE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
        { id: guild.members.me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] }
      ];

      const cargosParaNegar = todosCargos.filter(r => 
        r.id !== guild.roles.everyone.id && 
        r.id !== CARGO_STAFF_ID && 
        r.id !== CARGO_SUPORTE_ID && 
        r.id !== guild.members.me.id
      );
      for (const cargo of cargosParaNegar.values()) {
        permissoes.push({ id: cargo.id, deny: [PermissionFlagsBits.ViewChannel] });
      }

      const canalTicket = await guild.channels.create({
        name: nomeCanal,
        type: ChannelType.GuildText,
        parent: CATEGORIA_TICKETS_ID,
        permissionOverwrites: permissoes,
      });

      const agora = Date.now();
      tickets[canalTicket.id] = {
        userId,
        categoria: nomeCategoria,
        staffId: null,
        staffTag: null,
        abertura: agora,
        respostas: {},
        etapa: 0
      };

      const embed = new EmbedBuilder()
        .setTitle(`🎫 Ticket — ${nomeCategoria}`).setColor("Blue")
        .setImage("https://i.imgur.com/6sSikdc.png")
        .setDescription(`Olá ${interaction.user}! 👋\n\nSeu ticket foi aberto na categoria **${nomeCategoria}**.\nNossa equipe irá te atender o mais rápido possível!\n\n⏰ Abertura: <t:${Math.floor(agora / 1000)}:F>`)
        .addFields(
          { name: "👤 Usuário", value: `${interaction.user}` },
          { name: "📂 Categoria", value: nomeCategoria },
          { name: "🛠️ Suporte", value: `<@&${CARGO_SUPORTE_ID}>` }
        )
        .setFooter({ text: "Scripts SDZ • Suporte" }).setTimestamp();

      const botoes = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("reivindicar_ticket").setLabel("🙋 Reivindicar Ticket").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("fechar_ticket").setLabel("🔒 Fechar Ticket").setStyle(ButtonStyle.Danger),
      );

      await canalTicket.send({ content: `${interaction.user} | <@&${CARGO_SUPORTE_ID}>`, embeds: [embed], components: [botoes] });

      await iniciarTicketAutomatizado(canalTicket, userId);

      await enviarLogTicket(guild, new EmbedBuilder().setTitle("🎫 Ticket Aberto").setColor("Blue")
        .addFields(
          { name: "Usuário", value: `${interaction.user.tag}` },
          { name: "Categoria", value: nomeCategoria },
          { name: "Canal", value: `${canalTicket}` }
        ).setTimestamp());

      await interaction.editReply(`✅ Ticket aberto! Acesse: ${canalTicket}`);
      setTimeout(() => enviarPainelTicket(guild), 3000);
    } catch (err) {
      console.error("[ERRO TICKET]", err.message);
      await interaction.editReply("❌ Erro ao criar o ticket. Avisa um admin!");
    }
    return;
  }

  // ---- COMANDOS SLASH ----
  if (!interaction.isChatInputCommand()) return;

  // ========== VERIFICAÇÃO ==========
  if (interaction.commandName === 'verificacao') {
    const sub = interaction.options.getSubcommand();
    if (sub === 'configurar') {
      if (!temCargoMod(interaction.member)) return interaction.reply({ content: '❌ Apenas staff pode configurar.', flags: 64 });
      const cargoNaoVerificado = interaction.options.getRole('cargo-nao-verificado');
      const cargoMembro = interaction.options.getRole('cargo-membro');
      const canal = interaction.options.getChannel('canal');
      const config = lerConfig();
      if (cargoNaoVerificado) config.cargoNaoVerificado = cargoNaoVerificado.id;
      if (cargoMembro) config.cargoMembroVerificado = cargoMembro.id;
      if (canal) config.canalVerificacao = canal.id;
      salvarConfig(config);
      let resposta = '✅ Configurações salvas!';
      if (cargoNaoVerificado) resposta += `\nCargo não verificado: ${cargoNaoVerificado}`;
      if (cargoMembro) resposta += `\nCargo verificado: ${cargoMembro}`;
      if (canal) resposta += `\nCanal de verificação: ${canal}`;
      await interaction.reply({ content: resposta, flags: 64 });
      return;
    }
    if (sub === 'painel') {
      if (!temCargoMod(interaction.member)) return interaction.reply({ content: '❌ Apenas staff pode enviar o painel.', flags: 64 });
      const config = lerConfig();
      const canalId = config.canalVerificacao;
      if (!canalId) return interaction.reply({ content: '❌ Canal de verificação não configurado.', flags: 64 });
      const canal = await interaction.guild.channels.fetch(canalId).catch(() => null);
      if (!canal) return interaction.reply({ content: '❌ Canal configurado não encontrado.', flags: 64 });
      const embed = new EmbedBuilder()
        .setTitle('🔐 Verificação de Segurança')
        .setDescription('Clique no botão abaixo para se verificar.')
        .setColor('Blue')
        .setImage('https://i.imgur.com/tov858d.png')
        .setTimestamp();
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('verificar_geral').setLabel('🔐 Iniciar Verificação').setStyle(ButtonStyle.Success).setEmoji('🔐')
      );
      await canal.send({ embeds: [embed], components: [row] });
      await interaction.reply({ content: `✅ Painel de verificação enviado em ${canal}!`, flags: 64 });
      return;
    }
    if (sub === 'configurar-permissoes') {
      if (!temCargoMod(interaction.member)) return interaction.reply({ content: '❌ Apenas staff pode executar.', flags: 64 });
      await interaction.deferReply({ flags: 64 });
      const config = lerConfig();
      if (!config.cargoNaoVerificado || !config.cargoMembroVerificado) {
        return interaction.editReply({ content: '❌ Cargos de verificação não configurados.' });
      }
      const total = await configurarPermissoesCanais(interaction.guild);
      await interaction.editReply({ content: `✅ Permissões configuradas em **${total}** canais!` });
      return;
    }
    if (sub === 'dar-cargo-todos') {
      if (!temCargoMod(interaction.member)) return interaction.reply({ content: '❌ Apenas staff pode executar.', flags: 64 });
      await interaction.deferReply({ flags: 64 });
      const config = lerConfig();
      const cargoMembro = config.cargoMembroVerificado;
      if (!cargoMembro) return interaction.editReply({ content: '❌ Cargo de membro verificado não configurado.' });
      const members = await interaction.guild.members.fetch();
      let count = 0;
      for (const [, member] of members) {
        if (!member.user.bot && !member.roles.cache.has(cargoMembro)) {
          try { await member.roles.add(cargoMembro); count++; } catch {}
        }
      }
      await interaction.editReply({ content: `✅ Cargo verificado adicionado para **${count}** membros.` });
      return;
    }
    if (sub === 'remover-cargo-nao-verificado') {
      if (!temCargoMod(interaction.member)) return interaction.reply({ content: '❌ Apenas staff pode executar.', flags: 64 });
      await interaction.deferReply({ flags: 64 });
      const config = lerConfig();
      const cargoNaoVerificado = config.cargoNaoVerificado;
      if (!cargoNaoVerificado) return interaction.editReply({ content: '❌ Cargo de não verificado não configurado.' });
      const members = await interaction.guild.members.fetch();
      let count = 0;
      for (const [, member] of members) {
        if (!member.user.bot && member.roles.cache.has(cargoNaoVerificado)) {
          try { await member.roles.remove(cargoNaoVerificado); count++; } catch {}
        }
      }
      await interaction.editReply({ content: `✅ Cargo não verificado removido de **${count}** membros.` });
      return;
    }
  }

  // ========== STATUS ==========
  if (interaction.commandName === 'status') {
    const sub = interaction.options.getSubcommand();
    if (sub === 'configurar') {
      if (!temCargoMod(interaction.member)) return interaction.reply({ content: '❌ Apenas staff pode configurar.', flags: 64 });
      const canal = interaction.options.getChannel('canal');
      if (!canal) return interaction.reply({ content: '❌ Você precisa fornecer um canal.', flags: 64 });
      const config = lerConfig();
      config.canalStatus = canal.id;
      salvarConfig(config);
      await interaction.reply({ content: `✅ Canal de status configurado: ${canal}`, flags: 64 });
      await atualizarStatus(interaction.guild);
      return;
    }
    if (sub === 'enviar') {
      if (!temCargoMod(interaction.member)) return interaction.reply({ content: '❌ Apenas staff pode enviar.', flags: 64 });
      await interaction.deferReply({ flags: 64 });
      await atualizarStatus(interaction.guild);
      await interaction.editReply('✅ Status atualizado!');
      return;
    }
  }

  // ========== CALL ==========
  if (interaction.commandName === 'call') {
    const sub = interaction.options.getSubcommand();
    if (sub === 'configurar') {
      if (!temCargoMod(interaction.member)) return interaction.reply({ content: '❌ Apenas staff pode configurar.', flags: 64 });
      const categoria = interaction.options.getChannel('categoria');
      const logCanal = interaction.options.getChannel('log-canal');
      const botId = interaction.options.getString('bot-id');
      const painelCanal = interaction.options.getChannel('painel-canal');
      const config = lerConfig();
      if (categoria) config.categoriaCall = categoria.id;
      if (logCanal) config.canalLogCall = logCanal.id;
      if (botId) config.botMusicaId = botId;
      if (painelCanal) config.canalPainelCall = painelCanal.id;
      salvarConfig(config);
      let resposta = '✅ Configurações salvas!';
      if (categoria) resposta += `\nCategoria: ${categoria.name}`;
      if (logCanal) resposta += `\nCanal de logs: ${logCanal.name}`;
      if (botId) resposta += `\nBot de música ID: ${botId}`;
      if (painelCanal) resposta += `\nPainel será enviado em: ${painelCanal}`;
      await interaction.reply({ content: resposta, flags: 64 });
      if (painelCanal) {
        await enviarPainelCall(interaction.guild);
      }
      return;
    }
    if (sub === 'painel') {
      if (!temCargoMod(interaction.member)) return interaction.reply({ content: '❌ Apenas staff pode enviar o painel.', flags: 64 });
      await interaction.deferReply({ flags: 64 });
      await enviarPainelCall(interaction.guild);
      await interaction.editReply('✅ Painel de call enviado!');
      return;
    }
  }

  // ========== COMANDOS ORIGINAIS ==========
  // --- /say ---
  if (interaction.commandName === "say") {
    if (!temCargoMod(interaction.member)) return interaction.reply({ content: "❌ Sem permissão.", flags: 64 });
    const texto = interaction.options.getString("mensagem");
    const canal = interaction.options.getChannel("canal") || interaction.channel;
    await canal.send(texto);
    await interaction.reply({ content: "✅ Enviado!", flags: 64 });
  }

  // --- /avatar ---
  if (interaction.commandName === "avatar") {
    const user = interaction.options.getUser("usuario") || interaction.user;
    await interaction.reply({ embeds: [new EmbedBuilder().setTitle(`Avatar de ${user.username}`).setImage(user.displayAvatarURL({ size: 1024, extension: "png" })).setColor("Blue")] });
  }

  // --- /video ---
  if (interaction.commandName === "video") {
    if (!temCargoMod(interaction.member)) return interaction.reply({ content: "❌ Sem permissão.", flags: 64 });
    const link = interaction.options.getString("link");
    const canal = interaction.options.getChannel("canal");
    const titulo = interaction.options.getString("titulo");
    const imagem = interaction.options.getString("imagem");
    const videoIdMatch = link.match(/(?:youtu\.be\/|v=)([a-zA-Z0-9_-]{11})/);
    const thumbnailUrl = imagem || (videoIdMatch ? `https://img.youtube.com/vi/${videoIdMatch[1]}/maxresdefault.jpg` : null);
    const embed = new EmbedBuilder()
      .setTitle(`🔥 ${titulo || "VÍDEO NOVO"}`)
      .setDescription(`📌 **Assista agora:**\n[CLIQUE AQUI PARA VER O VÍDEO](${link})`)
      .setColor("Red").setFooter({ text: `${interaction.guild.name} • Notificação Automática` }).setTimestamp();
    if (thumbnailUrl) embed.setImage(thumbnailUrl);
    await canal.send({ content: "🔔 **Fala galera, vídeo novo no canal!**", embeds: [embed] });
    await interaction.reply({ content: "✅ Anúncio enviado!", flags: 64 });
  }

  // --- /avaliar ---
  if (interaction.commandName === "avaliar") {
    const staff = interaction.options.getUser("staff");
    if (staff.id === interaction.user.id) return interaction.reply({ content: "❌ Você não pode se avaliar!", flags: 64 });
    if (staff.bot) return interaction.reply({ content: "❌ Não pode avaliar um bot!", flags: 64 });
    const embed = new EmbedBuilder()
      .setTitle("⭐ Avaliar Staff").setColor("Gold")
      .setDescription(`Você está avaliando **${staff.username}** pelo atendimento no chat.\n\nClique em uma estrela abaixo:`)
      .setThumbnail(staff.displayAvatarURL())
      .setFooter({ text: "A avaliação será enviada no canal de avaliações" });
    const botoes = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`avaliacao_chat_1_${staff.id}`).setLabel("⭐").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`avaliacao_chat_2_${staff.id}`).setLabel("⭐⭐").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`avaliacao_chat_3_${staff.id}`).setLabel("⭐⭐⭐").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`avaliacao_chat_4_${staff.id}`).setLabel("⭐⭐⭐⭐").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`avaliacao_chat_5_${staff.id}`).setLabel("⭐⭐⭐⭐⭐").setStyle(ButtonStyle.Success)
    );
    await interaction.reply({ embeds: [embed], components: [botoes], flags: 64 });
  }

  // --- /kick ---
  if (interaction.commandName === "kick") {
    if (!temCargoMod(interaction.member)) return interaction.reply({ content: "❌ Você não tem permissão para usar este comando.", flags: 64 });
    const usuario = interaction.options.getUser("usuario");
    const motivo = interaction.options.getString("motivo") || "Não informado";
    if (usuario.id === interaction.user.id) return interaction.reply({ content: "❌ Você não pode se expulsar.", flags: 64 });
    const member = await interaction.guild.members.fetch(usuario.id).catch(() => null);
    if (!member) return interaction.reply({ content: "❌ Usuário não encontrado no servidor.", flags: 64 });
    if (!member.kickable) return interaction.reply({ content: "❌ Não tenho permissão para expulsar este usuário.", flags: 64 });
    try {
      await member.kick(`Expulso por ${interaction.user.tag} - Motivo: ${motivo}`);
      await enviarDMPunicao(usuario, interaction.user.tag, "EXPULSO", motivo);
      const embedLog = new EmbedBuilder().setTitle("👢 Kick").setColor("Orange").addFields({ name: "Staff", value: interaction.user.tag }, { name: "Usuário", value: usuario.tag }, { name: "Motivo", value: motivo }).setTimestamp();
      await enviarLogMod(interaction.guild, embedLog);
      await interaction.reply(`✅ **${usuario.tag}** foi expulso. Motivo: ${motivo}`);
    } catch (err) { console.error("[ERRO KICK]", err); await interaction.reply({ content: "❌ Erro ao expulsar o usuário.", flags: 64 }); }
  }

  // --- /ban ---
  if (interaction.commandName === "ban") {
    if (!temCargoMod(interaction.member)) return interaction.reply({ content: "❌ Você não tem permissão para usar este comando.", flags: 64 });
    const usuario = interaction.options.getUser("usuario");
    const motivo = interaction.options.getString("motivo") || "Não informado";
    if (usuario.id === interaction.user.id) return interaction.reply({ content: "❌ Você não pode se banir.", flags: 64 });
    const member = await interaction.guild.members.fetch(usuario.id).catch(() => null);
    if (member && !member.bannable) return interaction.reply({ content: "❌ Não tenho permissão para banir este usuário.", flags: 64 });
    try {
      await interaction.guild.members.ban(usuario.id, { reason: `Banido por ${interaction.user.tag} - Motivo: ${motivo}` });
      await enviarDMPunicao(usuario, interaction.user.tag, "BANIDO", motivo);
      const embedLog = new EmbedBuilder().setTitle("🔨 Ban").setColor("Red").addFields({ name: "Staff", value: interaction.user.tag }, { name: "Usuário", value: usuario.tag }, { name: "Motivo", value: motivo }).setTimestamp();
      await enviarLogMod(interaction.guild, embedLog);
      await interaction.reply(`✅ **${usuario.tag}** foi banido. Motivo: ${motivo}`);
    } catch (err) { console.error("[ERRO BAN]", err); await interaction.reply({ content: "❌ Erro ao banir o usuário.", flags: 64 }); }
  }

  // --- /mute ---
  if (interaction.commandName === "mute") {
    if (!temCargoMod(interaction.member)) return interaction.reply({ content: "❌ Você não tem permissão para usar este comando.", flags: 64 });
    const usuario = interaction.options.getUser("usuario");
    const duracao = interaction.options.getInteger("duracao");
    const motivo = interaction.options.getString("motivo") || "Não informado";
    if (usuario.id === interaction.user.id) return interaction.reply({ content: "❌ Você não pode se mutar.", flags: 64 });
    const member = await interaction.guild.members.fetch(usuario.id).catch(() => null);
    if (!member) return interaction.reply({ content: "❌ Usuário não encontrado no servidor.", flags: 64 });
    if (!member.moderatable) return interaction.reply({ content: "❌ Não tenho permissão para mutar este usuário.", flags: 64 });
    const duracaoMs = duracao * 60 * 1000;
    try {
      await member.timeout(duracaoMs, `Mutado por ${interaction.user.tag} - Motivo: ${motivo}`);
      await enviarDMPunicao(usuario, interaction.user.tag, "MUTADO", motivo);
      const embedLog = new EmbedBuilder().setTitle("🔇 Mute").setColor("Yellow").addFields({ name: "Staff", value: interaction.user.tag }, { name: "Usuário", value: usuario.tag }, { name: "Duração", value: `${duracao} minuto(s)` }, { name: "Motivo", value: motivo }).setTimestamp();
      await enviarLogMod(interaction.guild, embedLog);
      await interaction.reply(`✅ **${usuario.tag}** foi mutado por ${duracao} minuto(s). Motivo: ${motivo}`);
    } catch (err) { console.error("[ERRO MUTE]", err); await interaction.reply({ content: "❌ Erro ao mutar o usuário.", flags: 64 }); }
  }

  // --- /formulario ---
  if (interaction.commandName === "formulario") {
    const sub = interaction.options.getSubcommand();
    if (sub === "configurar") {
      if (!temCargoMod(interaction.member)) return interaction.reply({ content: "❌ Apenas staff pode configurar.", flags: 64 });
      const canal = interaction.options.getChannel("canal");
      const categoria = interaction.options.getChannel("categoria");
      if (!canal) return interaction.reply({ content: "❌ Você precisa fornecer um canal.", flags: 64 });
      const config = lerConfig();
      config.canalFormulario = canal.id;
      if (categoria) config.categoriaFormulario = categoria.id;
      salvarConfig(config);
      await interaction.reply({ content: `✅ Configurações salvas!\nCanal público: ${canal}\nCategoria: ${categoria ? categoria.name : 'Usando padrão (tickets)'}`, flags: 64 });
    } else if (sub === "enviar") {
      if (!temCargoMod(interaction.member)) return interaction.reply({ content: "❌ Apenas staff pode enviar o painel.", flags: 64 });
      await enviarPainelFormulario(interaction.guild);
      await interaction.reply({ content: "✅ Painel do formulário enviado no canal configurado!", flags: 64 });
    }
  }

  // --- /webhook ---
  if (interaction.commandName === "webhook") {
    const sub = interaction.options.getSubcommand();
    if (!temCargoMod(interaction.member)) return interaction.reply({ content: "❌ Você não tem permissão.", flags: 64 });
    if (sub === "painel") {
      await interaction.deferReply({ flags: 64 });
      await enviarPainelFixo(interaction.guild);
      await interaction.editReply({ content: "✅ Painel fixo enviado/atualizado!" });
    } else if (sub === "enviar") {
      await interaction.deferReply({ flags: 64 });
      await enviarWebhookExecutores(interaction.guild);
      await interaction.editReply({ content: "✅ Webhook reenviado com sucesso!" });
    } else if (sub === "configurar") {
      const canal = interaction.options.getChannel("canal");
      const config = carregarExecutores();
      config.canalPainelFixo = canal.id;
      salvarExecutores(config);
      await interaction.reply({ content: `✅ Canal do painel fixo configurado para ${canal}!`, flags: 64 });
      await enviarPainelFixo(interaction.guild);
    }
  }

  // --- /lockdown ---
  if (interaction.commandName === "lockdown") {
    if (!temCargoMod(interaction.member)) return interaction.reply({ content: "❌ Sem permissão.", flags: 64 });
    const motivo = interaction.options.getString("motivo") || "Sem motivo especificado";
    await interaction.deferReply({ flags: 64 });
    const canais = await interaction.guild.channels.fetch();
    const everyone = interaction.guild.roles.everyone;
    let fechados = 0;
    for (const [, canal] of canais) {
      if (canal.id === CANAL_AVISO_ID || !canal.isTextBased()) continue;
      try { await canal.permissionOverwrites.edit(everyone, { SendMessages: false, ViewChannel: false }); fechados++; } catch {}
    }
    const canalAviso = await interaction.guild.channels.fetch(CANAL_AVISO_ID).catch(() => null);
    if (canalAviso) {
      await canalAviso.permissionOverwrites.edit(everyone, { SendMessages: false, ViewChannel: true });
      await canalAviso.send({ embeds: [new EmbedBuilder().setTitle("🔒 SERVIDOR EM LOCKDOWN").setColor("Red").setDescription(`O servidor foi bloqueado.\n\n**Motivo:** ${motivo}`).setTimestamp()] });
    }
    await enviarLogMod(interaction.guild, new EmbedBuilder().setTitle("🔒 Lockdown Ativado").setColor("Red").addFields({ name: "Admin", value: interaction.user.tag }, { name: "Motivo", value: motivo }, { name: "Canais fechados", value: `${fechados}` }).setTimestamp());
    await interaction.editReply(`✅ Lockdown ativado! **${fechados}** canais fechados.`);
  }

  if (interaction.commandName === "unlockdown") {
    if (!temCargoMod(interaction.member)) return interaction.reply({ content: "❌ Sem permissão.", flags: 64 });
    await interaction.deferReply({ flags: 64 });
    const canais = await interaction.guild.channels.fetch();
    const everyone = interaction.guild.roles.everyone;
    let abertos = 0;
    for (const [, canal] of canais) {
      if (!canal.isTextBased()) continue;
      try { await canal.permissionOverwrites.edit(everyone, { SendMessages: true, ViewChannel: true }); abertos++; } catch {}
    }
    const canalAviso = await interaction.guild.channels.fetch(CANAL_AVISO_ID).catch(() => null);
    if (canalAviso) await canalAviso.send({ embeds: [new EmbedBuilder().setTitle("🔓 LOCKDOWN ENCERRADO").setColor("Green").setDescription("O servidor foi reaberto! Podem falar normalmente.").setTimestamp()] });
    await enviarLogMod(interaction.guild, new EmbedBuilder().setTitle("🔓 Lockdown Desativado").setColor("Green").addFields({ name: "Admin", value: interaction.user.tag }, { name: "Canais abertos", value: `${abertos}` }).setTimestamp());
    await interaction.editReply(`✅ Lockdown desativado! **${abertos}** canais reabertos.`);
  }

  if (interaction.commandName === "esconder-canal") {
    if (!temCargoMod(interaction.member)) return interaction.reply({ content: "❌ Sem permissão.", flags: 64 });
    try {
      await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { ViewChannel: false });
      await interaction.reply({ content: `✅ Canal escondido!`, flags: 64 });
      await enviarLogMod(interaction.guild, new EmbedBuilder().setTitle("🙈 Canal Escondido").setColor("Grey").addFields({ name: "Admin", value: interaction.user.tag }, { name: "Canal", value: interaction.channel.name }).setTimestamp());
    } catch { await interaction.reply({ content: "❌ Não consegui esconder.", flags: 64 }); }
  }

  if (interaction.commandName === "mostrar-canal") {
    if (!temCargoMod(interaction.member)) return interaction.reply({ content: "❌ Sem permissão.", flags: 64 });
    try {
      await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { ViewChannel: true, SendMessages: true });
      await interaction.reply({ content: `✅ Canal visível!`, flags: 64 });
      await enviarLogMod(interaction.guild, new EmbedBuilder().setTitle("👁️ Canal Revelado").setColor("Green").addFields({ name: "Admin", value: interaction.user.tag }, { name: "Canal", value: interaction.channel.name }).setTimestamp());
    } catch { await interaction.reply({ content: "❌ Não consegui mostrar.", flags: 64 }); }
  }

  if (interaction.commandName === "lock") {
    if (!temCargoMod(interaction.member)) return interaction.reply({ content: "❌ Sem permissão.", flags: 64 });
    const motivo = interaction.options.getString("motivo") || "Sem motivo";
    try {
      await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: false });
      await interaction.reply(`🔒 Canal bloqueado! **Motivo:** ${motivo}`);
      await enviarLogMod(interaction.guild, new EmbedBuilder().setTitle("🔒 Canal Bloqueado").setColor("Red").addFields({ name: "Admin", value: interaction.user.tag }, { name: "Canal", value: interaction.channel.name }, { name: "Motivo", value: motivo }).setTimestamp());
    } catch { await interaction.reply({ content: "❌ Não consegui bloquear.", flags: 64 }); }
  }

  if (interaction.commandName === "unlock") {
    if (!temCargoMod(interaction.member)) return interaction.reply({ content: "❌ Sem permissão.", flags: 64 });
    try {
      await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: true });
      await interaction.reply(`🔓 Canal desbloqueado!`);
      await enviarLogMod(interaction.guild, new EmbedBuilder().setTitle("🔓 Canal Desbloqueado").setColor("Green").addFields({ name: "Admin", value: interaction.user.tag }, { name: "Canal", value: interaction.channel.name }).setTimestamp());
    } catch { await interaction.reply({ content: "❌ Não consegui desbloquear.", flags: 64 }); }
  }

  if (interaction.commandName === "slowmode") {
    if (!temCargoMod(interaction.member)) return interaction.reply({ content: "❌ Sem permissão.", flags: 64 });
    const segundos = interaction.options.getInteger("segundos");
    try {
      await interaction.channel.setRateLimitPerUser(segundos);
      await interaction.reply(segundos === 0 ? `✅ Modo lento desativado!` : `🐢 Modo lento: **${segundos} segundos** entre mensagens.`);
    } catch { await interaction.reply({ content: "❌ Não consegui ativar modo lento.", flags: 64 }); }
  }

  if (interaction.commandName === "painel-ticket") {
    if (!temCargoMod(interaction.member)) return interaction.reply({ content: "❌ Sem permissão.", flags: 64 });
    await enviarPainelTicket(interaction.guild);
    await interaction.reply({ content: "✅ Painel de ticket enviado!", flags: 64 });
  }

  if (interaction.commandName === "painel-avaliacao") {
    if (!temCargoMod(interaction.member)) return interaction.reply({ content: "❌ Sem permissão.", flags: 64 });
    await enviarPainelAvaliacao(interaction.guild);
    await interaction.reply({ content: "✅ Painel de avaliação enviado!", flags: 64 });
  }

  if (interaction.commandName === "fechar-ticket") {
    if (!temCargoMod(interaction.member)) return interaction.reply({ content: "❌ Só staff pode fechar tickets!", flags: 64 });
    const ticket = tickets[interaction.channel.id];
    if (!ticket) return interaction.reply({ content: "❌ Esse não é um canal de ticket!", flags: 64 });
    await interaction.deferReply();
    const mensagens = await interaction.channel.messages.fetch({ limit: 100 });
    const transcript = mensagens.reverse().map((m) => `[${new Date(m.createdTimestamp).toLocaleString("pt-BR")}] ${m.author.tag}: ${m.content || "[anexo/embed]"}`).join("\n");
    await enviarLogTicket(interaction.guild,
      new EmbedBuilder().setTitle("📋 Ticket Fechado").setColor("Red")
        .addFields(
          { name: "Canal", value: interaction.channel.name },
          { name: "Usuário", value: `<@${ticket.userId}>` },
          { name: "Categoria", value: ticket.categoria },
          { name: "Atendente", value: ticket.staffTag || "Não reivindicado" },
          { name: "Fechado por", value: interaction.user.tag }
        )
        .setTimestamp(),
      [{ attachment: Buffer.from(transcript, "utf-8"), name: `transcript-${interaction.channel.name}.txt` }]
    );
    const usuario = await client.users.fetch(ticket.userId).catch(() => null);
    if (usuario) await enviarAvaliacaoDM(usuario, ticket.staffTag || "Não identificado", ticket.categoria, interaction.guild);
    await interaction.editReply("✅ Ticket fechado! Canal será deletado em 5 segundos...");
    delete tickets[interaction.channel.id];
    setTimeout(async () => { try { await interaction.channel.delete(); } catch {} }, 5000);
  }

  // --- /deletar-canal ---
  if (interaction.commandName === "deletar-canal") {
    if (!temCargoMod(interaction.member)) return interaction.reply({ content: "❌ Você não tem permissão.", flags: 64 });
    const canal = interaction.options.getChannel("canal") || interaction.channel;
    const motivo = interaction.options.getString("motivo") || "Não informado";
    const canaisProtegidos = [
      CANAL_SUGESTOES_ID, CANAL_LOGS_MOD_ID, CANAL_LOGS_TICKET_ID,
      CANAL_AVISO_ID, CANAL_TICKET_PAINEL, CANAL_AVALIACOES_ID, CANAL_AVALIACOES_LOGS_ID
    ];
    if (canaisProtegidos.includes(canal.id)) {
      return interaction.reply({ content: "❌ Este canal é protegido e não pode ser deletado.", flags: 64 });
    }
    await interaction.reply({
      content: `⚠️ Tem certeza que deseja deletar **#${canal.name}**?\nMotivo: ${motivo}\n\nClique em **Confirmar**.`,
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`confirmar_deletar_canal_${canal.id}`).setLabel("✅ Confirmar").setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId(`cancelar_deletar_canal`).setLabel("❌ Cancelar").setStyle(ButtonStyle.Secondary)
        )
      ],
      flags: 64
    });
  }
});

// =========================== FUNÇÃO PARA ENVIAR AVALIAÇÃO DM ===========================
async function enviarAvaliacaoDM(user, staffTag, categoria, guild) {
  try {
    const embed = new EmbedBuilder()
      .setTitle("⭐ Avalie o atendimento!")
      .setColor("Gold")
      .setDescription(`Seu ticket foi fechado.\n\n**Staff que te atendeu:** ${staffTag}\n**Categoria:** ${categoria}\n\nComo você avalia o atendimento?`)
      .setFooter({ text: "Clique em uma estrela para avaliar" });
    const botoes = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("avaliacao_ticket_1").setLabel("⭐").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("avaliacao_ticket_2").setLabel("⭐⭐").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("avaliacao_ticket_3").setLabel("⭐⭐⭐").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("avaliacao_ticket_4").setLabel("⭐⭐⭐⭐").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("avaliacao_ticket_5").setLabel("⭐⭐⭐⭐⭐").setStyle(ButtonStyle.Success)
    );
    await user.send({ embeds: [embed], components: [botoes] });
    avaliacoesPendentes[user.id] = { staffTag, categoria, guildId: guild.id };
  } catch (err) { console.error("[ERRO DM AVALIAÇÃO]", err.message); }
}

// =========================== MONITORAMENTO PASSIVO ===========================
setInterval(() => {
  const agora = Date.now();
  if (agora - monitoramentoAtividade.ultimoReset >= 60000) {
    if (monitoramentoAtividade.contagem > 50) {
      const guild = client.guilds.cache.get(GUILD_ID);
      if (guild) {
        const canalLogs = guild.channels.cache.get(CANAL_LOGS_MOD_ID);
        if (canalLogs) {
          canalLogs.send({
            embeds: [new EmbedBuilder()
              .setTitle('📈 Pico de Atividade Detectado')
              .setColor('Orange')
              .setDescription(`Foram enviadas **${monitoramentoAtividade.contagem} mensagens** no último minuto.`)
              .setTimestamp()
            ]
          });
        }
      }
    }
    monitoramentoAtividade.contagem = 0;
    monitoramentoAtividade.ultimoReset = agora;
  }
}, 60000);

// =========================== READY ===========================
client.once("ready", async () => {
  console.log(`✅ Bot online como ${client.user.tag}`);

  const commands = [
    new SlashCommandBuilder().setName('verificacao').setDescription('Gerencia o sistema de verificação')
      .addSubcommand(sub => sub.setName('configurar').setDescription('Configura os cargos e canal de verificação')
        .addRoleOption(opt => opt.setName('cargo-nao-verificado').setDescription('Cargo para membros não verificados').setRequired(false))
        .addRoleOption(opt => opt.setName('cargo-membro').setDescription('Cargo para membros verificados').setRequired(false))
        .addChannelOption(opt => opt.setName('canal').setDescription('Canal onde o painel será enviado').setRequired(false).addChannelTypes(ChannelType.GuildText)))
      .addSubcommand(sub => sub.setName('painel').setDescription('Envia o painel de verificação no canal configurado'))
      .addSubcommand(sub => sub.setName('configurar-permissoes').setDescription('Configura as permissões de todos os canais'))
      .addSubcommand(sub => sub.setName('dar-cargo-todos').setDescription('Dá o cargo de verificado para todos os membros'))
      .addSubcommand(sub => sub.setName('remover-cargo-nao-verificado').setDescription('Remove o cargo de não verificado')),
    new SlashCommandBuilder().setName('status').setDescription('Painel de status do servidor')
      .addSubcommand(sub => sub.setName('configurar').setDescription('Define o canal do status')
        .addChannelOption(opt => opt.setName('canal').setDescription('Canal de destino').setRequired(true).addChannelTypes(ChannelType.GuildText)))
      .addSubcommand(sub => sub.setName('enviar').setDescription('Envia/atualiza o status')),
    new SlashCommandBuilder().setName('call').setDescription('Sistema de call com painel fixo')
      .addSubcommand(sub => sub.setName('configurar').setDescription('Configura o sistema (staff)')
        .addChannelOption(opt => opt.setName('categoria').setDescription('Categoria onde os canais serão criados').setRequired(false).addChannelTypes(ChannelType.GuildCategory))
        .addChannelOption(opt => opt.setName('log-canal').setDescription('Canal para logs').setRequired(false).addChannelTypes(ChannelType.GuildText))
        .addStringOption(opt => opt.setName('bot-id').setDescription('ID do bot de música').setRequired(false))
        .addChannelOption(opt => opt.setName('painel-canal').setDescription('Canal onde o painel fixo será enviado').setRequired(false).addChannelTypes(ChannelType.GuildText)))
      .addSubcommand(sub => sub.setName('painel').setDescription('Envia o painel fixo de call (staff)')),
    new SlashCommandBuilder().setName("say").setDescription("Faz o bot enviar uma mensagem")
      .addStringOption(opt => opt.setName("mensagem").setDescription("O que o bot vai dizer").setRequired(true))
      .addChannelOption(opt => opt.setName("canal").setDescription("Canal de destino").setRequired(false)),
    new SlashCommandBuilder().setName("avatar").setDescription("Mostra a foto de perfil")
      .addUserOption(opt => opt.setName("usuario").setDescription("De quem ver o avatar").setRequired(false)),
    new SlashCommandBuilder().setName("video").setDescription("Anuncia um vídeo novo")
      .addStringOption(opt => opt.setName("link").setDescription("Link do vídeo").setRequired(true))
      .addChannelOption(opt => opt.setName("canal").setDescription("Canal onde anunciar").setRequired(true))
      .addStringOption(opt => opt.setName("titulo").setDescription("Título personalizado").setRequired(false))
      .addStringOption(opt => opt.setName("imagem").setDescription("Link de imagem").setRequired(false)),
    new SlashCommandBuilder().setName("avaliar").setDescription("Avalie um membro do staff")
      .addUserOption(opt => opt.setName("staff").setDescription("Qual staff").setRequired(true)),
    new SlashCommandBuilder().setName("kick").setDescription("[STAFF] Expulsa um membro")
      .addUserOption(opt => opt.setName("usuario").setDescription("Usuário a ser expulso").setRequired(true))
      .addStringOption(opt => opt.setName("motivo").setDescription("Motivo").setRequired(false)),
    new SlashCommandBuilder().setName("ban").setDescription("[STAFF] Bane um membro")
      .addUserOption(opt => opt.setName("usuario").setDescription("Usuário a ser banido").setRequired(true))
      .addStringOption(opt => opt.setName("motivo").setDescription("Motivo").setRequired(false)),
    new SlashCommandBuilder().setName("mute").setDescription("[STAFF] Muta um membro")
      .addUserOption(opt => opt.setName("usuario").setDescription("Usuário a ser mutado").setRequired(true))
      .addIntegerOption(opt => opt.setName("duracao").setDescription("Duração em minutos").setRequired(true))
      .addStringOption(opt => opt.setName("motivo").setDescription("Motivo").setRequired(false)),
    new SlashCommandBuilder().setName("lockdown").setDescription("[STAFF] Bloqueia todos os canais")
      .addStringOption(opt => opt.setName("motivo").setDescription("Motivo").setRequired(false)),
    new SlashCommandBuilder().setName("unlockdown").setDescription("[STAFF] Desbloqueia todos os canais"),
    new SlashCommandBuilder().setName("esconder-canal").setDescription("[STAFF] Esconde o canal atual"),
    new SlashCommandBuilder().setName("mostrar-canal").setDescription("[STAFF] Mostra o canal atual"),
    new SlashCommandBuilder().setName("lock").setDescription("[STAFF] Bloqueia o canal atual")
      .addStringOption(opt => opt.setName("motivo").setDescription("Motivo").setRequired(false)),
    new SlashCommandBuilder().setName("unlock").setDescription("[STAFF] Desbloqueia o canal atual"),
    new SlashCommandBuilder().setName("slowmode").setDescription("[STAFF] Define modo lento")
      .addIntegerOption(opt => opt.setName("segundos").setDescription("Segundos").setRequired(true)),
    new SlashCommandBuilder().setName("painel-ticket").setDescription("[STAFF] Envia o painel de tickets"),
    new SlashCommandBuilder().setName("painel-avaliacao").setDescription("[STAFF] Envia o painel de avaliação"),
    new SlashCommandBuilder().setName("fechar-ticket").setDescription("Fecha o ticket atual"),
    new SlashCommandBuilder().setName("formulario").setDescription("Gerencia o formulário de recrutamento")
      .addSubcommand(sub => sub.setName("configurar").setDescription("Define o canal público")
        .addChannelOption(opt => opt.setName("canal").setDescription("Canal").setRequired(true).addChannelTypes(ChannelType.GuildText))
        .addChannelOption(opt => opt.setName("categoria").setDescription("Categoria para canais privados").setRequired(false).addChannelTypes(ChannelType.GuildCategory)))
      .addSubcommand(sub => sub.setName("enviar").setDescription("Envia o painel")),
    new SlashCommandBuilder().setName("deletar-canal").setDescription("[STAFF] Deleta um canal")
      .addChannelOption(opt => opt.setName("canal").setDescription("Canal a ser deletado").setRequired(false))
      .addStringOption(opt => opt.setName("motivo").setDescription("Motivo").setRequired(false)),
    new SlashCommandBuilder().setName("webhook").setDescription("[STAFF] Gerencia o webhook de executores")
      .addSubcommand(sub => sub.setName("painel").setDescription("Envia o painel fixo"))
      .addSubcommand(sub => sub.setName("enviar").setDescription("Reenvia o webhook"))
      .addSubcommand(sub => sub.setName("configurar").setDescription("Configura o canal do painel")
        .addChannelOption(opt => opt.setName("canal").setDescription("Canal").setRequired(true).addChannelTypes(ChannelType.GuildText))),
  ];

  const rest = new REST({ version: "10" }).setToken(TOKEN);
  try {
    console.log("🔄 Registrando comandos...");
    await rest.put(Routes.applicationGuildCommands(client.user.id, GUILD_ID), { body: commands });
    console.log("✅ Comandos registrados com sucesso!");
  } catch (error) {
    console.error("❌ Erro ao registrar comandos:", error);
  }

  const guild = client.guilds.cache.get(GUILD_ID);
  if (guild) {
    const config = lerConfig();
    if (config.cargoNaoVerificado && config.cargoMembroVerificado) {
      await configurarPermissoesCanais(guild);
    }
    await enviarPainelAvaliacao(guild);
    await enviarPainelFixo(guild);
    if (config.canalStatus) {
      await atualizarStatus(guild);
      setInterval(() => atualizarStatus(guild), 5 * 60 * 1000);
    }
    if (config.canalPainelCall) {
      await enviarPainelCall(guild);
    }
  } else {
    console.warn("⚠️ Servidor não encontrado. Verifique o GUILD_ID.");
  }

  setInterval(() => {
    const agora = Date.now();
    for (const [userId, data] of Object.entries(verificacoesPendentes)) {
      if (agora - data.timestamp > 5 * 60 * 1000) {
        delete verificacoesPendentes[userId];
        console.log(`[VERIF] Verificação de ${userId} expirada.`);
      }
    }
  }, 60000);
});

client.login(TOKEN);