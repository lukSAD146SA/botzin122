const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, AttachmentBuilder } = require("discord.js");
const fs = require('fs');
const path = require('path');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
  ],
});

// ===================== TOKEN =====================
const TOKEN = process.env.TOKEN;
if (!TOKEN) {
  console.error("❌ TOKEN não encontrado! Defina a variável de ambiente TOKEN.");
  process.exit(1);
}

// ===================== CONFIGURAÇÕES =====================
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
const CANAL_LOGS_OFUSCADOR_ID = "1529261917116301503";
const CANAL_FORMULARIO_STAFF_ID = "1529652387361591428"; // Canal onde as respostas do formulário são enviadas com botões

const CARGOS_MODERACAO = ["1508405150572871720"];
const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutos

// ============================================================
// DADOS EM MEMÓRIA (não persistentes)
// ============================================================
const tickets = {};
const stickyMessages = {};
const userChunks = {};
const ticketTimeouts = {};
const formulariosPendentes = {};
const formulariosEnviados = {};

// ============================================================
// FUNÇÕES AUXILIARES
// ============================================================
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

async function enviarLogOfuscador(guild, embed, files = []) {
  try {
    const canal = await guild.channels.fetch(CANAL_LOGS_OFUSCADOR_ID).catch(() => null);
    if (canal) await canal.send({ embeds: [embed], files });
  } catch (err) { console.error("[ERRO LOG OFUSCADOR]", err.message); }
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

// ============================================================
// OFUSCADOR AVANÇADO
// ============================================================
function ofuscar(codigo, numChunks) {
  if (!codigo || codigo.trim() === '') return '';
  const codigoComNull = "--[[ \x00 ]] " + codigo;
  let hex = '';
  for (let i = 0; i < codigoComNull.length; i++) {
    const code = codigoComNull.charCodeAt(i);
    hex += '\\x' + code.toString(16).padStart(2, '0');
  }
  hex = '\\xef\\xbb\\xbf' + hex;
  let chunks = [];
  if (numChunks <= 1) {
    chunks = [hex];
  } else {
    const len = hex.length;
    let cortes = new Set();
    while (cortes.size < numChunks - 1) {
      const pos = Math.floor(Math.random() * (len - 1)) + 1;
      cortes.add(pos);
    }
    let sorted = Array.from(cortes).sort((a, b) => a - b);
    let start = 0;
    for (let cut of sorted) {
      if (cut > start) {
        chunks.push(hex.substring(start, cut));
        start = cut;
      }
    }
    if (start < len) chunks.push(hex.substring(start));
    chunks = chunks.filter(c => c.length > 0);
    if (chunks.length === 0) chunks = [hex];
  }
  let ofuscado = '';
  const sep = ['..', '.. ', '..  ', ' ..', ' .. ', '\n..\n', '\n.. ', ' ..\n'];
  for (let i = 0; i < chunks.length; i++) {
    ofuscado += chunks[i];
    if (i < chunks.length - 1) {
      ofuscado += sep[Math.floor(Math.random() * sep.length)];
    }
  }
  const loadOfuscado = '"\\x6c\\x6f\\x61\\x64"';
  const HEADER = "-----powered by https://discord.gg/tR27QgcHyr\n";
  return HEADER + `_G[${loadOfuscado}](${ofuscado})()`;
}

// ============================================================
// PAINEL DE TICKET
// ============================================================
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

// ============================================================
// PAINEL DE AVALIAÇÃO
// ============================================================
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

// ============================================================
// GIVEAWAY
// ============================================================
const giveaways = {};

async function atualizarGiveaway(messageId) {
  const giveaway = giveaways[messageId];
  if (!giveaway || giveaway.ended) return;
  const agora = Date.now();
  const tempoRestante = giveaway.endTime - agora;
  if (tempoRestante <= 0) {
    await finalizarGiveaway(messageId);
    return;
  }
  const canal = await client.channels.fetch(giveaway.channelId).catch(() => null);
  if (!canal) return;
  const msg = await canal.messages.fetch(messageId).catch(() => null);
  if (!msg) return;
  const embed = new EmbedBuilder()
    .setTitle(`🎉 GIVEAWAY: ${giveaway.prize}`)
    .setColor("Gold")
    .setDescription(`Clique no botão **Participar** para concorrer!\n\n**Tempo restante:** ${formatarTempo(tempoRestante)}\n**Vencedores:** ${giveaway.winners}\n**Participantes:** ${giveaway.entered.length}`)
    .setFooter({ text: `Host: ${giveaway.hostTag || "Desconhecido"} • ID: ${messageId}` })
    .setTimestamp();
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`giveaway_join_${messageId}`)
      .setLabel("🎁 Participar")
      .setStyle(ButtonStyle.Primary)
  );
  await msg.edit({ embeds: [embed], components: [row] });
}

async function finalizarGiveaway(messageId) {
  const giveaway = giveaways[messageId];
  if (!giveaway || giveaway.ended) return;
  giveaway.ended = true;
  const canal = await client.channels.fetch(giveaway.channelId).catch(() => null);
  if (!canal) return;
  const msg = await canal.messages.fetch(messageId).catch(() => null);
  if (!msg) return;
  const participantes = giveaway.entered;
  let vencedores = [];
  const numeroVencedores = Math.min(giveaway.winners, participantes.length);
  if (participantes.length === 0) {
    const embed = new EmbedBuilder()
      .setTitle(`🎉 GIVEAWAY ENCERRADO: ${giveaway.prize}`)
      .setColor("Red")
      .setDescription(`😢 Ninguém participou deste giveaway!`)
      .setFooter({ text: `Host: ${giveaway.hostTag || "Desconhecido"}` })
      .setTimestamp();
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`giveaway_ended_${messageId}`)
        .setLabel("❌ Encerrado")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true)
    );
    await msg.edit({ embeds: [embed], components: [row] });
    delete giveaways[messageId];
    return;
  }
  const shuffled = [...participantes];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  vencedores = shuffled.slice(0, numeroVencedores);
  giveaway.winnerIds = vencedores;
  const mencoes = vencedores.map(id => `<@${id}>`).join(", ");
  const embed = new EmbedBuilder()
    .setTitle(`🎉 GIVEAWAY ENCERRADO: ${giveaway.prize}`)
    .setColor("Green")
    .setDescription(`**Vencedor(es):** ${mencoes}\n\nParabéns aos ganhadores!`)
    .addFields(
      { name: "Total de participantes", value: `${participantes.length}`, inline: true },
      { name: "Número de vencedores", value: `${vencedores.length}`, inline: true }
    )
    .setFooter({ text: `Host: ${giveaway.hostTag || "Desconhecido"}` })
    .setTimestamp();
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`giveaway_ended_${messageId}`)
      .setLabel("✅ Encerrado")
      .setStyle(ButtonStyle.Success)
      .setDisabled(true)
  );
  await msg.edit({ embeds: [embed], components: [row] });
  const logEmbed = new EmbedBuilder()
    .setTitle("🎁 Giveaway Finalizado")
    .setColor("Green")
    .addFields(
      { name: "Prêmio", value: giveaway.prize },
      { name: "Vencedores", value: mencoes || "Nenhum" },
      { name: "Participantes", value: `${participantes.length}` }
    )
    .setTimestamp();
  await enviarLogMod(canal.guild, logEmbed);
  delete giveaways[messageId];
}

// ============================================================
// PALAVRAS PROIBIDAS
// ============================================================
const PALAVRAS_GRAVES = [
  "hitler", "nazista", "nazismo", "nazi",
  "racista", "racismo", "fascista", "fascismo",
  "terrorista", "pedofil", "pedofilo",
  "macaco", "macaca",
  "b1o", "vendas", "venda", "vender",
];
function contemPalavraGrave(texto) {
  return PALAVRAS_GRAVES.some((p) => {
    const regex = new RegExp(`\\b${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}+\\b`, "gi");
    return regex.test(texto);
  });
}

// ============================================================
// CONFIGURAÇÃO PERSISTENTE (formulário)
// ============================================================
const CONFIG_PATH = path.join(__dirname, 'config.json');

function lerConfig() {
  try {
    const data = fs.readFileSync(CONFIG_PATH, 'utf8');
    return JSON.parse(data);
  } catch {
    return { canalFormulario: null, categoriaFormulario: null };
  }
}

function salvarConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

// ============================================================
// PERGUNTAS DO FORMULÁRIO
// ============================================================
const PERGUNTAS = [
  {
    id: 'nome',
    label: 'Qual o seu nome completo?',
    placeholder: 'Ex: João Silva',
    required: true,
    minLength: 3,
    maxLength: 60
  },
  {
    id: 'idade',
    label: 'Quantos anos você tem?',
    placeholder: 'Ex: 18',
    required: true,
    minLength: 1,
    maxLength: 3
  },
  {
    id: 'discord',
    label: 'Qual seu Discord (com tag)?',
    placeholder: 'Ex: João#1234',
    required: true,
    minLength: 5,
    maxLength: 40
  },
  {
    id: 'experiencia',
    label: 'Você já foi staff em algum outro servidor? Se sim, onde e por quanto tempo?',
    placeholder: 'Descreva sua experiência anterior...',
    required: true,
    maxLength: 500
  },
  {
    id: 'disponibilidade',
    label: 'Quantas horas por dia, em média, você consegue ficar online?',
    placeholder: 'Ex: 4 horas',
    required: true,
    maxLength: 30
  },
  {
    id: 'motivacao',
    label: 'Por que você quer ser staff aqui?',
    placeholder: 'Explique sua motivação...',
    required: true,
    maxLength: 500
  },
  {
    id: 'habilidades',
    label: 'Você tem conhecimento em moderação (comandos, bots, etc.)? Descreva.',
    placeholder: 'Ex: Sei usar os comandos de mute, kick, ban, conheço bots de moderação...',
    required: true,
    maxLength: 500
  },
  {
    id: 'cenario',
    label: 'Como você reagiria se um membro estivesse desrespeitando as regras repetidamente?',
    placeholder: 'Descreva sua abordagem...',
    required: true,
    maxLength: 500
  }
];

// ============================================================
// FUNÇÃO PARA ENVIAR O PAINEL DO FORMULÁRIO (público)
// ============================================================
async function enviarPainelFormulario(guild) {
  const config = lerConfig();
  const canalId = config.canalFormulario;
  if (!canalId) {
    console.warn('[FORM] Canal do formulário não configurado. Use /formulario configurar.');
    return;
  }
  const canal = await guild.channels.fetch(canalId).catch(() => null);
  if (!canal) {
    console.warn('[FORM] Canal configurado não encontrado.');
    return;
  }

  const msgs = await canal.messages.fetch({ limit: 20 }).catch(() => []);
  const botMsgs = msgs.filter((m) => m.author.id === client.user.id);
  for (const [, msg] of botMsgs) {
    try { await msg.delete(); } catch {}
  }

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
    .setFooter({ text: 'Script do Zé • Recrutamento • Todos os direitos reservados' })
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

// ============================================================
// FUNÇÃO PARA CRIAR CANAL PRIVADO E INICIAR FORMULÁRIO
// ============================================================
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

// ============================================================
// FUNÇÃO PARA ENVIAR PRÓXIMA PERGUNTA (no canal privado)
// ============================================================
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

// ============================================================
// FUNÇÃO PARA MOSTRAR RESUMO E CONFIRMAÇÃO (no canal privado)
// ============================================================
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
    new ButtonBuilder()
      .setCustomId('form_confirmar')
      .setLabel('✅ Confirmar e Enviar')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('form_cancelar')
      .setLabel('❌ Cancelar')
      .setStyle(ButtonStyle.Danger)
  );

  const msg = await channel.send({
    content: `<@${userId}>`,
    embeds: [embed],
    components: [row]
  });

  estado.mensagemId = msg.id;
}

// ============================================================
// FUNÇÃO PARA ENVIAR RESPOSTA AO CANAL STAFF (sem webhook)
// ============================================================
async function enviarRespostaStaff(userId, respostas, guild) {
  const canalStaff = await guild.channels.fetch(CANAL_FORMULARIO_STAFF_ID).catch(() => null);
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
    new ButtonBuilder()
      .setCustomId(`form_aceitar_${userId}`)
      .setLabel('✅ Aceitar Staff')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`form_recusar_${userId}`)
      .setLabel('❌ Recusar Staff')
      .setStyle(ButtonStyle.Danger)
  );

  await canalStaff.send({
    content: `🔔 Nova candidatura de <@${userId}>!`,
    embeds: [embed],
    components: [row]
  });

  console.log(`[FORM] Candidatura de ${userId} enviada ao canal staff.`);
}

// ============================================================
// SISTEMA DE GERENCIAMENTO DE WEBHOOKS (EXECUTORES)
// ============================================================
const EXECUTORES_PATH = path.join(__dirname, 'executores.json');

function carregarExecutores() {
  try {
    const data = fs.readFileSync(EXECUTORES_PATH, 'utf8');
    return JSON.parse(data);
  } catch {
    const padrao = {
      webhookURL: 'https://discord.com/api/webhooks/1519217665498021958/gV-6bHq1nGbnzvB0rPMXEAinzQAjLTaZtJvEm6IbXHCRrAnnx0vWE7jynpZcD6HqUkes',
      avatarURL: 'https://cdn.discordapp.com/icons/1508302017980924064/4e99cb3869df3a62beb943e9d14861e7.png?size=2048',
      executores: [
        {
          id: 'ronix',
          nome: 'Ronix',
          cor: '#e74c3c',
          ativo: true,
          thumbnail: 'https://cdn.discordapp.com/emojis/1509291842288746576.png?size=128',
          campos: [
            { name: 'Key-System', value: 'Sem key 🔑', inline: true },
            { name: 'Crash ao injetar', value: 'Sim ⚠️', inline: true },
            { name: 'Multi instance', value: 'Bugado ⚠️', inline: true },
            { name: 'Download', value: '[📥 Ronix-Installer.exe](https://wrdcdn.net/r/154522/1776624538288/Ronix-Installer.exe)', inline: false }
          ]
        },
        {
          id: 'medium',
          nome: 'Medium',
          cor: '#e74c3c',
          ativo: true,
          thumbnail: 'https://cdn.discordapp.com/emojis/1509291686730404063.png?size=128',
          campos: [
            { name: 'Key-System', value: 'Sem key 🔑', inline: true },
            { name: 'Crash', value: 'Sim ⚠️', inline: true },
            { name: 'Execução de scripts', value: 'Bugado ⚠️', inline: true },
            { name: 'Download', value: '[📥 Download](https://filerift.com/file/BEN2BKv00w)', inline: false }
          ]
        },
        {
          id: 'vortex',
          nome: 'Vortex',
          cor: '#e74c3c',
          ativo: true,
          thumbnail: 'https://cdn.discordapp.com/emojis/1515117448351977574.png?size=128',
          campos: [
            { name: 'Key-System', value: 'Possui key 🔑', inline: true },
            { name: 'Crash', value: 'Sim ⚠️', inline: true },
            { name: 'Download', value: '[📥 Download](https://gofile.io/d/4qiSvR)', inline: false }
          ]
        },
        {
          id: 'velocity',
          nome: 'Velocity',
          cor: '#e74c3c',
          ativo: true,
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

  const embeds = executores
    .filter(ex => ex.ativo)
    .map(ex => {
      const corHex = ex.cor ? parseInt(ex.cor.replace('#', ''), 16) : 0xe74c3c;
      return {
        title: ex.nome,
        thumbnail: { url: ex.thumbnail || '' },
        color: corHex,
        fields: ex.campos || []
      };
    });

  const payload = {
    username: 'Executores PC • Script do Zé',
    avatar_url: avatarURL || 'https://cdn.discordapp.com/icons/1508302017980924064/4e99cb3869df3a62beb943e9d14861e7.png?size=2048',
    embeds: embeds
  };

  try {
    const response = await fetch(webhookURL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (response.ok) {
      console.log('[WEBHOOK] Painel enviado com sucesso!');
    } else {
      console.error('[WEBHOOK] Erro ao enviar:', response.status, await response.text());
    }
  } catch (err) {
    console.error('[WEBHOOK] Erro ao enviar:', err);
  }
}

async function enviarPainelExecutores(interaction) {
  const config = carregarExecutores();
  const { executores } = config;

  const embed = new EmbedBuilder()
    .setTitle('📊 Painel de Executores')
    .setDescription('Gerencie os executores que aparecem no webhook. Clique nos botões abaixo para ativar/desativar ou editar.')
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
        new ButtonBuilder()
          .setCustomId(`exec_toggle_${ex.id}`)
          .setLabel(ex.ativo ? '❌ Desativar' : '✅ Ativar')
          .setStyle(ex.ativo ? ButtonStyle.Danger : ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`exec_edit_${ex.id}`)
          .setLabel('✏️ Editar')
          .setStyle(ButtonStyle.Secondary)
      );
    rows.push(row);
  }

  const sendRow = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('exec_enviar_webhook')
        .setLabel('📤 Enviar Webhook')
        .setStyle(ButtonStyle.Primary)
    );

  rows.push(sendRow);

  await interaction.editReply({
    content: '✅ Painel carregado.',
    embeds: [embed],
    components: rows
  });
}

// ============================================================
// EVENTO READY
// ============================================================
client.once("ready", async () => {
  console.log(`✅ Bot online como ${client.user.tag}`);

  const commands = [
    new SlashCommandBuilder().setName("say").setDescription("Faz o bot enviar uma mensagem").addStringOption((opt) => opt.setName("mensagem").setDescription("O que o bot vai dizer").setRequired(true)).addChannelOption((opt) => opt.setName("canal").setDescription("Canal de destino").setRequired(false)),
    new SlashCommandBuilder().setName("avatar").setDescription("Mostra a foto de perfil de alguém").addUserOption((opt) => opt.setName("usuario").setDescription("De quem ver o avatar").setRequired(false)),
    new SlashCommandBuilder().setName("video").setDescription("Anuncia um vídeo novo do YouTube").addStringOption((opt) => opt.setName("link").setDescription("Link do vídeo").setRequired(true)).addChannelOption((opt) => opt.setName("canal").setDescription("Canal onde anunciar").setRequired(true)).addStringOption((opt) => opt.setName("titulo").setDescription("Título personalizado").setRequired(false)).addStringOption((opt) => opt.setName("imagem").setDescription("Link de imagem").setRequired(false)),
    new SlashCommandBuilder().setName("ofuscar").setDescription("Cria um canal privado para ofuscar seu script Luau com segurança."),
    new SlashCommandBuilder().setName("avaliar").setDescription("Avalie um membro do staff pelo atendimento no chat").addUserOption((opt) => opt.setName("staff").setDescription("Qual staff você quer avaliar").setRequired(true)),
    new SlashCommandBuilder().setName("kick").setDescription("[STAFF] Expulsa um membro do servidor").addUserOption(opt => opt.setName("usuario").setDescription("Usuário a ser expulso").setRequired(true)).addStringOption(opt => opt.setName("motivo").setDescription("Motivo da expulsão").setRequired(false)),
    new SlashCommandBuilder().setName("ban").setDescription("[STAFF] Bane um membro do servidor").addUserOption(opt => opt.setName("usuario").setDescription("Usuário a ser banido").setRequired(true)).addStringOption(opt => opt.setName("motivo").setDescription("Motivo do banimento").setRequired(false)),
    new SlashCommandBuilder().setName("mute").setDescription("[STAFF] Muta um membro por um período").addUserOption(opt => opt.setName("usuario").setDescription("Usuário a ser mutado").setRequired(true)).addIntegerOption(opt => opt.setName("duracao").setDescription("Duração em minutos").setRequired(true)).addStringOption(opt => opt.setName("motivo").setDescription("Motivo do mute").setRequired(false)),
    new SlashCommandBuilder().setName("lockdown").setDescription("[STAFF] Bloqueia todos os canais do servidor").addStringOption((opt) => opt.setName("motivo").setDescription("Motivo do lockdown").setRequired(false)),
    new SlashCommandBuilder().setName("unlockdown").setDescription("[STAFF] Desbloqueia todos os canais do servidor"),
    new SlashCommandBuilder().setName("esconder-canal").setDescription("[STAFF] Esconde o canal atual"),
    new SlashCommandBuilder().setName("mostrar-canal").setDescription("[STAFF] Mostra o canal atual"),
    new SlashCommandBuilder().setName("lock").setDescription("[STAFF] Bloqueia o canal atual").addStringOption((opt) => opt.setName("motivo").setDescription("Motivo do bloqueio").setRequired(false)),
    new SlashCommandBuilder().setName("unlock").setDescription("[STAFF] Desbloqueia o canal atual"),
    new SlashCommandBuilder().setName("slowmode").setDescription("[STAFF] Define o modo lento do canal").addIntegerOption((opt) => opt.setName("segundos").setDescription("Segundos (0 para desativar)").setRequired(true)),
    new SlashCommandBuilder().setName("painel-ticket").setDescription("[STAFF] Envia o painel de tickets no canal configurado"),
    new SlashCommandBuilder().setName("painel-avaliacao").setDescription("[STAFF] Envia o painel de avaliação de staff no canal configurado"),
    new SlashCommandBuilder().setName("fechar-ticket").setDescription("Fecha o ticket atual"),
    new SlashCommandBuilder()
      .setName("formulario")
      .setDescription("Gerencia o formulário de recrutamento")
      .addSubcommand(sub => 
        sub.setName("configurar")
          .setDescription("Define o canal público para o formulário")
          .addChannelOption(opt => opt.setName("canal").setDescription("Canal onde o painel será enviado").setRequired(true).addChannelTypes(ChannelType.GuildText))
          .addChannelOption(opt => opt.setName("categoria").setDescription("Categoria onde os canais privados serão criados (opcional)").setRequired(false).addChannelTypes(ChannelType.GuildCategory))
      )
      .addSubcommand(sub =>
        sub.setName("enviar")
          .setDescription("Envia o painel do formulário no canal configurado")
      ),
    new SlashCommandBuilder().setName("deletar-canal").setDescription("[STAFF] Deleta um canal do servidor (texto ou voz)").addChannelOption(opt => opt.setName("canal").setDescription("Canal a ser deletado (se omitido, usa o canal atual)").setRequired(false)).addStringOption(opt => opt.setName("motivo").setDescription("Motivo da deleção (opcional)").setRequired(false)),
    new SlashCommandBuilder()
      .setName("giveaway")
      .setDescription("Sistema de giveaways")
      .addSubcommand(sub => sub.setName("criar").setDescription("Cria um novo giveaway").addChannelOption(opt => opt.setName("canal").setDescription("Canal onde o giveaway será anunciado").setRequired(true).addChannelTypes(ChannelType.GuildText)).addStringOption(opt => opt.setName("premio").setDescription("Prêmio do giveaway").setRequired(true)).addStringOption(opt => opt.setName("duracao").setDescription("Duração (ex: 1h, 30m, 1d)").setRequired(true)).addIntegerOption(opt => opt.setName("vencedores").setDescription("Número de vencedores (padrão: 1)").setRequired(false).setMinValue(1).setMaxValue(25)).addRoleOption(opt => opt.setName("cargo_obrigatorio").setDescription("Cargo obrigatório para participar (opcional)").setRequired(false)))
      .addSubcommand(sub => sub.setName("reroll").setDescription("Sorteia novamente os vencedores de um giveaway encerrado").addStringOption(opt => opt.setName("mensagem_id").setDescription("ID da mensagem do giveaway").setRequired(true)))
      .addSubcommand(sub => sub.setName("listar").setDescription("Lista todos os giveaways ativos no servidor"))
      .addSubcommand(sub => sub.setName("encerrar").setDescription("Encerra um giveaway ativo manualmente").addStringOption(opt => opt.setName("mensagem_id").setDescription("ID da mensagem do giveaway").setRequired(true))),
    // Novo comando para webhook de executores
    new SlashCommandBuilder()
      .setName("webhook")
      .setDescription("[STAFF] Gerencia o webhook de executores")
      .addSubcommand(sub => 
        sub.setName("painel")
          .setDescription("Abre o painel de gerenciamento de executores")
      )
      .addSubcommand(sub =>
        sub.setName("enviar")
          .setDescription("Reenvia o webhook com a configuração atual")
      ),
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
    await enviarPainelAvaliacao(guild);
    console.log("📌 Painel de avaliação enviado (se o canal existir).");
  } else {
    console.warn("⚠️ Servidor não encontrado. Verifique o GUILD_ID.");
  }

  setInterval(async () => {
    for (const messageId in giveaways) {
      if (!giveaways[messageId].ended) {
        await atualizarGiveaway(messageId);
      }
    }
  }, 15000);
});

// ============================================================
// EVENTO DE MENSAGENS (sticky, flood, etc.)
// ============================================================
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  // Sticky
  if (message.content.startsWith(".st")) {
    if (!temCargoMod(message.member)) {
      return message.reply("❌ Você não tem permissão para usar este comando.");
    }
    const args = message.content.slice(3).trim();
    const channelId = message.channel.id;
    if (!args) {
      if (stickyMessages[channelId]) {
        const old = stickyMessages[channelId];
        try {
          const oldMsg = await message.channel.messages.fetch(old.messageId);
          if (oldMsg) await oldMsg.delete();
        } catch {}
        delete stickyMessages[channelId];
        await message.reply("✅ Sticky desativado neste canal.");
      } else {
        await message.reply("ℹ️ Não há sticky ativo neste canal.");
      }
      return;
    }
    const content = args;
    await message.delete().catch(() => {});
    const sent = await message.channel.send(content);
    stickyMessages[channelId] = { content, messageId: sent.id };
    const dmEmbed = new EmbedBuilder()
      .setTitle("📌 Sticky ativado!")
      .setColor("Green")
      .setDescription(`Sticky definida no canal <#${channelId}>:\n\n${content}`)
      .setTimestamp();
    await message.author.send({ embeds: [dmEmbed] }).catch(() => {});
    return;
  }

  // Manter sticky
  const sticky = stickyMessages[message.channel.id];
  if (sticky) {
    if (message.author.id === client.user.id && message.id === sticky.messageId) {
      return;
    }
    try {
      const oldMsg = await message.channel.messages.fetch(sticky.messageId).catch(() => null);
      if (oldMsg) await oldMsg.delete().catch(() => {});
      const newMsg = await message.channel.send(sticky.content);
      sticky.messageId = newMsg.id;
    } catch (err) {
      console.error("[ERRO STICKY]", err.message);
    }
  }

  // Flood
  if (!client.floodUsers) client.floodUsers = {};
  const user = client.floodUsers[message.author.id] || { count: 0, timer: null };
  user.count++;
  if (user.timer) clearTimeout(user.timer);
  user.timer = setTimeout(() => {
    delete client.floodUsers[message.author.id];
  }, 5000);
  client.floodUsers[message.author.id] = user;
  if (user.count > 5) {
    try { await message.delete(); } catch {}
    try {
      await message.member.timeout(60 * 1000, "Automod: flood");
      await message.channel.send(`⚠️ ${message.author}, pare de floodar! Você foi mutado por 1 minuto.`);
      await enviarLogMod(message.guild, new EmbedBuilder()
        .setTitle("🌊 Flood Detectado").setColor("Red")
        .addFields({ name: "Usuário", value: `${message.author.tag} (\`${message.author.id}\`)` }, { name: "Canal", value: `<#${message.channel.id}>` }, { name: "Mensagens", value: `${user.count}` }, { name: "Duração", value: "1 minuto" })
        .setTimestamp());
    } catch (err) { console.error("[ERRO MUTE FLOOD]", err.message); }
    return;
  }

  // @everyone/@here
  if (message.content.includes("@everyone") || message.content.includes("@here")) {
    if (!message.member.roles.cache.has(CARGO_SUPORTE_ID)) {
      try { await message.delete(); } catch {}
      const m = await message.channel.send(`❌ ${message.author}, você não pode mencionar @everyone ou @here.`);
      setTimeout(() => m.delete().catch(() => {}), 3000);
      return;
    }
  }

  // Mass mention
  if (message.mentions.users.size > 5 || message.mentions.roles.size > 3) {
    if (!temCargoMod(message.member)) {
      try { await message.delete(); } catch {}
      const m = await message.channel.send(`❌ ${message.author}, você mencionou muitas pessoas/cargos! Máximo: 5 usuários ou 3 cargos.`);
      setTimeout(() => m.delete().catch(() => {}), 3000);
      return;
    }
  }

  // Palavras proibidas
  const isStaff = message.member.roles.cache.some((r) => CARGOS_MODERACAO.includes(r.id));
  if (!isStaff && contemPalavraGrave(message.content)) {
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
    } catch (err) {
      console.error("[ERRO MUTE GRAVE]", err.message);
    }
    return;
  }

  // ============================================================
  // CAPTURA DE RESPOSTAS DO FORMULÁRIO (canal privado)
  // ============================================================
  const estado = formulariosPendentes[message.channel.id];
  if (!estado) return;

  if (message.author.id !== estado.userId) return;

  if (message.content.toLowerCase() === 'cancelar') {
    if (estado.timeout) clearTimeout(estado.timeout);
    delete formulariosPendentes[message.channel.id];
    await message.reply('❌ Formulário cancelado.');
    setTimeout(() => message.channel.delete().catch(() => {}), 2000);
    return;
  }

  const etapa = estado.etapa;
  if (etapa >= PERGUNTAS.length) return;

  const pergunta = PERGUNTAS[etapa];
  const resposta = message.content.trim();

  if (pergunta.required && !resposta) {
    await message.reply('❌ Esta pergunta é obrigatória. Digite uma resposta válida.');
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

  estado.respostas[pergunta.id] = resposta;
  estado.etapa++;

  await message.reply(`✅ Resposta registrada!`);
  await new Promise(resolve => setTimeout(resolve, 500));
  await enviarProximaPergunta(message.channel, estado.userId);
});

// ============================================================
// INTERACTIONS
// ============================================================
client.on("interactionCreate", async (interaction) => {
  // ---- BOTÕES ----
  if (interaction.isButton()) {
    // Botão "Dúvidas" do formulário (antigo)
    if (interaction.customId === "formulario_duvidas") {
      const select = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("ticket_categoria")
          .setPlaceholder("Escolha uma opção para sua Dúvida.")
          .addOptions(
            new StringSelectMenuOptionBuilder().setLabel("📜 Dúvida sobre o formulário").setDescription("Tire suas dúvidas sobre o processo seletivo").setValue("duvida_formulario").setEmoji("📜"),
            new StringSelectMenuOptionBuilder().setLabel("📜 Dúvida Script").setDescription("Dúvidas sobre scripts").setValue("duvida_script").setEmoji("📜"),
            new StringSelectMenuOptionBuilder().setLabel("⚙️ Dúvida Executor").setDescription("Dúvidas sobre executores").setValue("duvida_executor").setEmoji("⚙️"),
            new StringSelectMenuOptionBuilder().setLabel("💬 Outros").setDescription("Outros assuntos").setValue("outros").setEmoji("💬")
          )
      );
      await interaction.reply({ content: "Escolha o motivo para abrir seu ticket:", components: [select], flags: 64 });
      return;
    }

    // Modal de avaliação (staff)
    if (interaction.customId === "abrir_modal_avaliacao") {
      const modal = new ModalBuilder()
        .setCustomId("modal_avaliacao_staff")
        .setTitle("Avaliação de Staff");
      const staffNameInput = new TextInputBuilder().setCustomId("staff_name_input").setLabel("Nome do Staff").setStyle(TextInputStyle.Short).setPlaceholder("Ex: Fulano#1234 ou ID do usuário").setRequired(true);
      const commentInput = new TextInputBuilder().setCustomId("comment_input").setLabel("Seu Comentário").setStyle(TextInputStyle.Paragraph).setPlaceholder("Descreva sua experiência com o staff...").setRequired(true);
      const ratingInput = new TextInputBuilder().setCustomId("rating_input").setLabel("Nota (de 1 a 5)").setStyle(TextInputStyle.Short).setPlaceholder("Ex: 5").setRequired(true);
      modal.addComponents(
        new ActionRowBuilder().addComponents(staffNameInput),
        new ActionRowBuilder().addComponents(commentInput),
        new ActionRowBuilder().addComponents(ratingInput)
      );
      await interaction.showModal(modal);
      return;
    }

    // Avaliação de ticket
    if (interaction.customId.startsWith("avaliacao_ticket_")) {
      const nota = parseInt(interaction.customId.split("_")[2]);
      const estrelas = "⭐".repeat(nota);
      const pendente = avaliacoesPendentes?.[interaction.user.id];
      if (!pendente) return interaction.update({ content: "❌ Avaliação expirada ou já respondida.", embeds: [], components: [] });
      const guild = await client.guilds.fetch(pendente.guildId).catch(() => null);
      if (guild) {
        await enviarLogTicket(guild, new EmbedBuilder()
          .setTitle("⭐ Avaliação de Ticket").setColor("Gold")
          .addFields({ name: "👤 Usuário", value: `${interaction.user.tag}` }, { name: "🛠️ Staff", value: pendente.staffTag }, { name: "📂 Categoria", value: pendente.categoria }, { name: "⭐ Avaliação", value: `${estrelas} (${nota}/5)` })
          .setTimestamp());
      }
      delete avaliacoesPendentes[interaction.user.id];
      return interaction.update({ content: `✅ Obrigado pela avaliação! Você deu **${estrelas} (${nota}/5)**.`, embeds: [], components: [] });
    }

    // Avaliação de chat
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
          .addFields({ name: "👤 Avaliado por", value: `${interaction.user.tag}` }, { name: "🛠️ Staff", value: staffUser ? `${staffUser.tag}` : `ID: ${staffId}` }, { name: "⭐ Nota", value: `${estrelas} (${nota}/5)` })
          .setTimestamp()] });
      }
      return interaction.update({ content: `✅ Avaliação enviada! Você deu **${estrelas} (${nota}/5)**.`, embeds: [], components: [] });
    }

    // Reivindicar ticket
    if (interaction.customId === "reivindicar_ticket") {
      const ticket = tickets[interaction.channel.id];
      if (!ticket) return interaction.reply({ content: "❌ Ticket não encontrado!", flags: 64 });
      if (ticket.staffId) return interaction.reply({ content: `❌ Este ticket já foi reivindicado por <@${ticket.staffId}>!`, flags: 64 });
      if (!temCargoMod(interaction.member)) return interaction.reply({ content: "❌ Só staff pode reivindicar tickets!", flags: 64 });
      ticket.staffId = interaction.user.id;
      ticket.staffTag = interaction.user.tag;
      const embedAtualizado = new EmbedBuilder()
        .setTitle(`🎫 Ticket — ${ticket.categoria}`).setColor("Green")
        .setThumbnail("https://i.imgur.com/6sSikdc.png")
        .setDescription(`Olá <@${ticket.userId}>! 👋\n\nSeu ticket está sendo atendido por **${interaction.user}**!\n\n📌 **Descreva seu problema com detalhes.**\n⏰ Abertura: <t:${Math.floor(ticket.abertura / 1000)}:F>`)
        .addFields({ name: "👤 Usuário", value: `<@${ticket.userId}>` }, { name: "📂 Categoria", value: ticket.categoria }, { name: "🛠️ Atendente", value: `${interaction.user}` })
        .setFooter({ text: "Scripts SDZ • Suporte" }).setTimestamp();
      try {
        await interaction.message.edit({ embeds: [embedAtualizado], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("fechar_ticket").setLabel("🔒 Fechar Ticket").setStyle(ButtonStyle.Danger))] });
      } catch {}
      await interaction.reply(`✅ ${interaction.user} reivindicou este ticket e irá te atender, <@${ticket.userId}>!`);
      await enviarLogTicket(interaction.guild, new EmbedBuilder()
        .setTitle("🙋 Ticket Reivindicado").setColor("Green")
        .addFields({ name: "Staff", value: interaction.user.tag }, { name: "Usuário", value: `<@${ticket.userId}>` }, { name: "Categoria", value: ticket.categoria }, { name: "Canal", value: `${interaction.channel}` })
        .setTimestamp());
      return;
    }

    // Fechar ticket
    if (interaction.customId === "fechar_ticket") {
      if (!temCargoMod(interaction.member)) return interaction.reply({ content: "❌ Só staff pode fechar tickets!", flags: 64 });
      const ticket = tickets[interaction.channel.id];
      if (!ticket) return interaction.reply({ content: "❌ Esse não é um canal de ticket!", flags: 64 });
      await interaction.deferReply();
      const mensagens = await interaction.channel.messages.fetch({ limit: 100 });
      const transcript = mensagens.reverse().map((m) => `[${new Date(m.createdTimestamp).toLocaleString("pt-BR")}] ${m.author.tag}: ${m.content || "[anexo/embed]"}`).join("\n");
      await enviarLogTicket(interaction.guild,
        new EmbedBuilder().setTitle("📋 Ticket Fechado").setColor("Red")
          .addFields({ name: "Canal", value: interaction.channel.name }, { name: "Usuário", value: `<@${ticket.userId}>` }, { name: "Categoria", value: ticket.categoria }, { name: "Atendente", value: ticket.staffTag || "Não reivindicado" }, { name: "Fechado por", value: interaction.user.tag })
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

    // Deletar canal
    if (interaction.customId.startsWith("confirmar_deletar_canal_")) {
      const canalId = interaction.customId.split("_")[3];
      const canal = await interaction.guild.channels.fetch(canalId).catch(() => null);
      if (!canal) {
        return interaction.update({ content: "❌ Este canal já foi deletado ou não existe mais.", components: [] });
      }
      if (!temCargoMod(interaction.member)) {
        return interaction.update({ content: "❌ Você não tem permissão para deletar canais.", components: [] });
      }
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
    }

    if (interaction.customId === "cancelar_deletar_canal") {
      await interaction.update({ content: "❌ Operação cancelada. Nenhum canal foi deletado.", components: [] });
    }

    // Ofuscador
    if (interaction.customId.startsWith("chunks_")) {
      const chunks = parseInt(interaction.customId.split("_")[1]);
      const channelId = interaction.channel.id;
      if (!userChunks[channelId]) {
        return interaction.reply({ content: "❌ Este ticket expirou ou não existe mais.", ephemeral: true });
      }
      userChunks[channelId].chunks = chunks;
      clearTimeout(userChunks[channelId].timeout);
      userChunks[channelId].timeout = setTimeout(() => {
        deleteChannel(channelId);
      }, INACTIVITY_TIMEOUT);

      await interaction.reply({
        content: `✅ Fragmentos definidos para **${chunks}**. Agora envie seu código em um arquivo **.txt** neste canal.`,
        ephemeral: false
      });

      try {
        const embed = new EmbedBuilder()
          .setColor(0xF5D742)
          .setTitle('🧢 OFUSCADOR DO SEU ZÉ')
          .setDescription(`**Fragmentos selecionados: ${chunks}**\n\nAgora envie seu código como **anexo .txt**.\n\n⚠️ O código será ofuscado e devolvido em um novo .txt.`)
          .setFooter({ text: 'Seu código não é armazenado permanentemente.' });
        await interaction.message.edit({ embeds: [embed], components: [] });
      } catch {}
    }

    // Giveaway
    if (interaction.customId.startsWith("giveaway_join_")) {
      const messageId = interaction.customId.replace("giveaway_join_", "");
      const giveaway = giveaways[messageId];
      if (!giveaway || giveaway.ended) {
        return interaction.reply({ content: "❌ Este giveaway já foi encerrado ou não existe mais.", flags: 64 });
      }
      if (giveaway.requiredRole) {
        const member = interaction.member;
        if (!member.roles.cache.has(giveaway.requiredRole)) {
          const role = await interaction.guild.roles.fetch(giveaway.requiredRole).catch(() => null);
          return interaction.reply({ content: `❌ Você precisa do cargo **${role ? role.name : "desconhecido"}** para participar deste giveaway!`, flags: 64 });
        }
      }
      if (giveaway.entered.includes(interaction.user.id)) {
        return interaction.reply({ content: "❌ Você já está participando deste giveaway!", flags: 64 });
      }
      giveaway.entered.push(interaction.user.id);
      await interaction.reply({ content: "✅ Você entrou no giveaway! Boa sorte! 🍀", flags: 64 });
      await atualizarGiveaway(messageId);
    }

    if (interaction.customId.startsWith("giveaway_ended_")) {
      return interaction.reply({ content: "Este giveaway já foi encerrado.", flags: 64 });
    }

    // ========== FORMULÁRIO: INICIAR (botão no painel público) ==========
    if (interaction.customId === "formulario_iniciar") {
      const userId = interaction.user.id;

      for (const [channelId, estado] of Object.entries(formulariosPendentes)) {
        if (estado.userId === userId) {
          return interaction.reply({ content: "❌ Você já tem um formulário em andamento. Verifique seu canal privado.", flags: 64 });
        }
      }

      try {
        await interaction.reply({ content: "✅ Criando seu canal privado... Aguarde.", flags: 64 });
        const channel = await criarCanalFormulario(interaction, userId);
        await interaction.editReply({ content: `✅ Canal criado: ${channel.toString()}` });
      } catch (error) {
        console.error('[ERRO BOTÃO INICIAR]', error);
        await interaction.editReply({ content: '❌ Erro ao iniciar o formulário. Tente novamente.' });
      }
    }

    // ========== FORMULÁRIO: CONFIRMAR (no canal privado) ==========
    if (interaction.customId === "form_confirmar") {
      try {
        const estado = formulariosPendentes[interaction.channel.id];
        if (!estado) {
          return interaction.reply({ content: "❌ Sessão expirada.", flags: 64 });
        }

        const userId = estado.userId;
        await enviarRespostaStaff(userId, estado.respostas, interaction.guild);
        formulariosEnviados[userId] = { respostas: estado.respostas, guildId: interaction.guild.id };

        if (estado.timeout) clearTimeout(estado.timeout);
        delete formulariosPendentes[interaction.channel.id];

        await interaction.update({ content: "✅ Formulário enviado com sucesso! Aguarde a análise da equipe.", embeds: [], components: [] });

        setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
      } catch (error) {
        console.error('[ERRO CONFIRMAR]', error);
        await interaction.reply({ content: '❌ Erro ao enviar o formulário. Tente novamente.', flags: 64 });
      }
    }

    // ========== FORMULÁRIO: CANCELAR (no canal privado) ==========
    if (interaction.customId === "form_cancelar") {
      const estado = formulariosPendentes[interaction.channel.id];
      if (estado?.timeout) clearTimeout(estado.timeout);
      delete formulariosPendentes[interaction.channel.id];
      await interaction.update({ content: "❌ Formulário cancelado.", embeds: [], components: [] });
      setTimeout(() => interaction.channel.delete().catch(() => {}), 2000);
    }

    // ========== FORMULÁRIO: ACEITAR STAFF (botão no canal staff) ==========
    if (interaction.customId.startsWith("form_aceitar_")) {
      const userId = interaction.customId.split('_')[2];
      const data = formulariosEnviados[userId];
      if (!data) {
        return interaction.reply({ content: "❌ Candidatura não encontrada ou já processada.", flags: 64 });
      }

      if (!temCargoMod(interaction.member)) {
        return interaction.reply({ content: "❌ Você não tem permissão para aceitar candidaturas.", flags: 64 });
      }

      const user = await client.users.fetch(userId).catch(() => null);
      if (user) {
        const embedAprovado = new EmbedBuilder()
          .setTitle('🎉 Parabéns! Você foi aprovado!')
          .setColor('Green')
          .setDescription('Sua candidatura para staff foi **aceita**! Em breve você receberá mais instruções.\n\nAgradecemos o interesse em fazer parte da equipe!')
          .setFooter({ text: `Aprovado por ${interaction.user.tag}` })
          .setTimestamp();
        await user.send({ embeds: [embedAprovado] }).catch(() => console.log(`[DM] Não foi possível enviar DM para ${user.tag}`));
      }

      delete formulariosEnviados[userId];
      await interaction.reply({ content: `✅ Candidatura de <@${userId}> aprovada! DM enviada.`, flags: 64 });
    }

    // ========== FORMULÁRIO: RECUSAR STAFF (botão no canal staff) ==========
    if (interaction.customId.startsWith("form_recusar_")) {
      const userId = interaction.customId.split('_')[2];
      const data = formulariosEnviados[userId];
      if (!data) {
        return interaction.reply({ content: "❌ Candidatura não encontrada ou já processada.", flags: 64 });
      }

      if (!temCargoMod(interaction.member)) {
        return interaction.reply({ content: "❌ Você não tem permissão para recusar candidaturas.", flags: 64 });
      }

      const user = await client.users.fetch(userId).catch(() => null);
      if (user) {
        const embedReprovado = new EmbedBuilder()
          .setTitle('😔 Obrigado pelo interesse!')
          .setColor('Red')
          .setDescription('Infelizmente, sua candidatura para staff não foi aprovada desta vez.\n\n**Não desanime!** Continue participando da comunidade e, no futuro, novas oportunidades podem surgir.\n\nAgradecemos sua disposição em ajudar!')
          .setFooter({ text: `Recusado por ${interaction.user.tag}` })
          .setTimestamp();
        await user.send({ embeds: [embedReprovado] }).catch(() => console.log(`[DM] Não foi possível enviar DM para ${user.tag}`));
      }

      delete formulariosEnviados[userId];
      await interaction.reply({ content: `❌ Candidatura de <@${userId}> recusada. DM enviada.`, flags: 64 });
    }

    // ========== WEBHOOK: TOGGLE EXECUTOR ==========
    if (interaction.customId.startsWith('exec_toggle_')) {
      if (!temCargoMod(interaction.member)) {
        return interaction.reply({ content: "❌ Sem permissão.", flags: 64 });
      }

      const id = interaction.customId.replace('exec_toggle_', '');
      const config = carregarExecutores();
      const executor = config.executores.find(e => e.id === id);
      if (!executor) {
        return interaction.reply({ content: "❌ Executor não encontrado.", flags: 64 });
      }

      executor.ativo = !executor.ativo;
      salvarExecutores(config);
      await enviarWebhookExecutores(interaction.guild);

      await interaction.update({ content: '✅ Status atualizado!', components: [] });
      await enviarPainelExecutores(interaction);
    }

    // ========== WEBHOOK: EDITAR EXECUTOR ==========
    if (interaction.customId.startsWith('exec_edit_')) {
      if (!temCargoMod(interaction.member)) {
        return interaction.reply({ content: "❌ Sem permissão.", flags: 64 });
      }

      const id = interaction.customId.replace('exec_edit_', '');
      const config = carregarExecutores();
      const executor = config.executores.find(e => e.id === id);
      if (!executor) {
        return interaction.reply({ content: "❌ Executor não encontrado.", flags: 64 });
      }

      const modal = new ModalBuilder()
        .setCustomId(`exec_modal_${id}`)
        .setTitle(`Editar ${executor.nome}`);

      const nomeInput = new TextInputBuilder()
        .setCustomId('exec_nome')
        .setLabel('Nome do Executor')
        .setStyle(TextInputStyle.Short)
        .setValue(executor.nome)
        .setRequired(true);

      const corInput = new TextInputBuilder()
        .setCustomId('exec_cor')
        .setLabel('Cor (hex, ex: #e74c3c)')
        .setStyle(TextInputStyle.Short)
        .setValue(executor.cor || '#e74c3c')
        .setRequired(true);

      const thumbnailInput = new TextInputBuilder()
        .setCustomId('exec_thumbnail')
        .setLabel('URL do Thumbnail (imagem)')
        .setStyle(TextInputStyle.Short)
        .setValue(executor.thumbnail || '')
        .setRequired(false);

      const camposInput = new TextInputBuilder()
        .setCustomId('exec_campos')
        .setLabel('Campos (formato: Nome|Valor|inline)')
        .setStyle(TextInputStyle.Paragraph)
        .setValue(executor.campos.map(c => `${c.name}|${c.value}|${c.inline}`).join('\n'))
        .setRequired(true)
        .setPlaceholder('Ex: Key-System|Sem key 🔑|true\nCrash|Sim ⚠️|true');

      modal.addComponents(
        new ActionRowBuilder().addComponents(nomeInput),
        new ActionRowBuilder().addComponents(corInput),
        new ActionRowBuilder().addComponents(thumbnailInput),
        new ActionRowBuilder().addComponents(camposInput)
      );

      await interaction.showModal(modal);
    }

    // ========== WEBHOOK: ENVIAR (botão) ==========
    if (interaction.customId === 'exec_enviar_webhook') {
      if (!temCargoMod(interaction.member)) {
        return interaction.reply({ content: "❌ Sem permissão.", flags: 64 });
      }

      await interaction.reply({ content: '⏳ Enviando webhook...', flags: 64 });
      await enviarWebhookExecutores(interaction.guild);
      await interaction.editReply({ content: '✅ Webhook reenviado com sucesso!' });
    }

    return; // fim dos botões
  }

  // ---- MODAIS ----
  if (interaction.isModalSubmit()) {
    // Modal de avaliação
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
        const embed = new EmbedBuilder()
          .setTitle("📝 Nova Avaliação de Staff")
          .setColor("Green")
          .addFields(
            { name: "👤 Avaliador", value: `${interaction.user.tag} (${interaction.user.id})` },
            { name: "🛠️ Staff Avaliado", value: staffName },
            { name: "⭐ Nota", value: `${estrelas} (${rating}/5)` },
            { name: "💬 Comentário", value: comment || "Nenhum comentário." }
          )
          .setTimestamp();
        await logChannel.send({ embeds: [embed] });
        await interaction.reply({ content: "✅ Sua avaliação foi enviada com sucesso!", ephemeral: true });
      } else {
        await interaction.reply({ content: "❌ Não foi possível encontrar o canal de logs de avaliação.", ephemeral: true });
      }
      return;
    }

    // ========== WEBHOOK: MODAL DE EDIÇÃO ==========
    if (interaction.customId.startsWith('exec_modal_')) {
      if (!temCargoMod(interaction.member)) {
        return interaction.reply({ content: "❌ Sem permissão.", flags: 64 });
      }

      const id = interaction.customId.replace('exec_modal_', '');
      const config = carregarExecutores();
      const executor = config.executores.find(e => e.id === id);
      if (!executor) {
        return interaction.reply({ content: "❌ Executor não encontrado.", flags: 64 });
      }

      const nome = interaction.fields.getTextInputValue('exec_nome');
      const cor = interaction.fields.getTextInputValue('exec_cor');
      const thumbnail = interaction.fields.getTextInputValue('exec_thumbnail');
      const camposRaw = interaction.fields.getTextInputValue('exec_campos');

      executor.nome = nome;
      executor.cor = cor;
      executor.thumbnail = thumbnail;

      const linhas = camposRaw.split('\n').filter(line => line.trim());
      executor.campos = linhas.map(line => {
        const parts = line.split('|').map(s => s.trim());
        return {
          name: parts[0] || 'Campo',
          value: parts[1] || 'Valor',
          inline: parts[2] ? parts[2].toLowerCase() === 'true' : false
        };
      });

      salvarExecutores(config);
      await enviarWebhookExecutores(interaction.guild);

      await interaction.reply({ content: '✅ Executor atualizado com sucesso!', flags: 64 });
    }
  }

  // ---- SELECT MENU (Ticket) ----
  if (interaction.isStringSelectMenu()) {
    if (interaction.customId === "ticket_categoria") {
      const categoria = interaction.values[0];
      const userId = interaction.user.id;
      const guild = interaction.guild;
      const ticketExistente = Object.values(tickets).find((t) => t.userId === userId);
      if (ticketExistente) return interaction.reply({ content: "❌ Você já tem um ticket aberto!", flags: 64 });
      await interaction.deferReply({ flags: 64 });
      const nomes = {
        duvida_formulario: "📜 Dúvida sobre Formulário",
        duvida_script: "📜 Dúvida Script",
        duvida_executor: "⚙️ Dúvida Executor",
        outros: "💬 Outros"
      };
      const nomeCategoria = nomes[categoria] || categoria;
      const nomeCanal = `ticket-${interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
      try {
        const canalTicket = await guild.channels.create({
          name: nomeCanal, type: ChannelType.GuildText, parent: CATEGORIA_TICKETS_ID,
          permissionOverwrites: [
            { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
            { id: userId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
            { id: CARGO_SUPORTE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
            { id: CARGO_STAFF_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
          ],
        });
        const agora = Date.now();
        tickets[canalTicket.id] = { userId, categoria: nomeCategoria, staffId: null, staffTag: null, abertura: agora };
        const embed = new EmbedBuilder()
          .setTitle(`🎫 Ticket — ${nomeCategoria}`).setColor("Blue")
          .setThumbnail("https://i.imgur.com/6sSikdc.png")
          .setDescription(`Olá ${interaction.user}! 👋\n\nSeu ticket foi aberto na categoria **${nomeCategoria}**.\nNossa equipe irá te atender o mais rápido possível!\n\n📌 **Descreva seu problema com detalhes.**\n⏰ Abertura: <t:${Math.floor(agora / 1000)}:F>`)
          .addFields({ name: "👤 Usuário", value: `${interaction.user}` }, { name: "📂 Categoria", value: nomeCategoria }, { name: "🛠️ Suporte", value: `<@&${CARGO_SUPORTE_ID}>` })
          .setFooter({ text: "Scripts SDZ • Suporte" }).setTimestamp();
        const botoes = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("reivindicar_ticket").setLabel("🙋 Reivindicar Ticket").setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId("fechar_ticket").setLabel("🔒 Fechar Ticket").setStyle(ButtonStyle.Danger),
        );
        await canalTicket.send({ content: `${interaction.user} | <@&${CARGO_SUPORTE_ID}>`, embeds: [embed], components: [botoes] });
        await enviarLogTicket(guild, new EmbedBuilder().setTitle("🎫 Ticket Aberto").setColor("Blue")
          .addFields({ name: "Usuário", value: `${interaction.user.tag}` }, { name: "Categoria", value: nomeCategoria }, { name: "Canal", value: `${canalTicket}` }).setTimestamp());
        await interaction.editReply(`✅ Ticket aberto! Acesse: ${canalTicket}`);
        setTimeout(() => enviarPainelTicket(guild), 3000);
      } catch (err) {
        console.error("[ERRO TICKET]", err.message);
        await interaction.editReply("❌ Erro ao criar o ticket. Avisa um admin!");
      }
    }
    return;
  }

  // ---- COMANDOS SLASH ----
  if (!interaction.isChatInputCommand()) return;

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

  // --- /ofuscar ---
  if (interaction.commandName === "ofuscar") {
    await interaction.deferReply({ ephemeral: true });

    const guild = interaction.guild;
    const member = interaction.member;

    if (!guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return interaction.editReply("❌ Eu não tenho permissão para gerenciar canais!");
    }

    const channelName = `ofuscar-${member.user.username}`;
    try {
      const channel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: CATEGORIA_TICKETS_ID,
        permissionOverwrites: [
          { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] },
          { id: guild.members.me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] }
        ]
      });

      userChunks[channel.id] = {
        userId: member.id,
        chunks: 6,
        timeout: null,
        channel: channel
      };

      const timeout = setTimeout(() => {
        deleteChannel(channel.id);
      }, INACTIVITY_TIMEOUT);
      userChunks[channel.id].timeout = timeout;

      const embed = new EmbedBuilder()
        .setColor(0xF5D742)
        .setTitle('🧢 OFUSCADOR DO SEU ZÉ')
        .setDescription('**Solte seu código aqui, 100% seguro para não vazar.**\n\nEscolha a quantidade de **fragmentos** (quanto mais, mais bagunça):')
        .setFooter({ text: 'Seu código será ofuscado e retornado em .txt' });

      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder().setCustomId('chunks_4').setLabel('4').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('chunks_8').setLabel('8').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('chunks_12').setLabel('12').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('chunks_20').setLabel('20').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('chunks_30').setLabel('30').setStyle(ButtonStyle.Primary)
        );

      await channel.send({
        embeds: [embed],
        components: [row]
      });

      await interaction.editReply(`✅ Canal criado: ${channel.toString()}`);
    } catch (error) {
      console.error('Erro ao criar canal de ofuscador:', error);
      await interaction.editReply('❌ Ocorreu um erro ao criar o canal privado.');
    }
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

  // ---- /formulario ----
  if (interaction.commandName === "formulario") {
    const sub = interaction.options.getSubcommand();

    if (sub === "configurar") {
      if (!temCargoMod(interaction.member)) {
        return interaction.reply({ content: "❌ Apenas staff pode configurar o formulário.", flags: 64 });
      }
      const canal = interaction.options.getChannel("canal");
      const categoria = interaction.options.getChannel("categoria");

      if (!canal) {
        return interaction.reply({ content: "❌ Você precisa fornecer um canal.", flags: 64 });
      }

      const config = lerConfig();
      config.canalFormulario = canal.id;
      if (categoria) config.categoriaFormulario = categoria.id;
      salvarConfig(config);

      await interaction.reply({ content: `✅ Configurações salvas!\nCanal público: ${canal}\nCategoria: ${categoria ? categoria.name : 'Usando padrão (tickets)'}\n\n📌 As respostas serão enviadas no canal <#${CANAL_FORMULARIO_STAFF_ID}> com botões de aceitar/recusar.`, flags: 64 });
    }

    else if (sub === "enviar") {
      if (!temCargoMod(interaction.member)) {
        return interaction.reply({ content: "❌ Apenas staff pode enviar o painel.", flags: 64 });
      }
      await enviarPainelFormulario(interaction.guild);
      await interaction.reply({ content: "✅ Painel do formulário enviado no canal configurado!", flags: 64 });
    }
  }

  // ---- /webhook ----
  if (interaction.commandName === "webhook") {
    const sub = interaction.options.getSubcommand();

    if (!temCargoMod(interaction.member)) {
      return interaction.reply({ content: "❌ Você não tem permissão para usar este comando.", flags: 64 });
    }

    if (sub === "painel") {
      await interaction.reply({ content: "⏳ Carregando painel...", flags: 64 });
      await enviarPainelExecutores(interaction);
    } else if (sub === "enviar") {
      await interaction.deferReply({ flags: 64 });
      await enviarWebhookExecutores(interaction.guild);
      await interaction.editReply({ content: "✅ Webhook reenviado com sucesso!" });
    }
  }

  // ---- /lockdown ----
  if (interaction.commandName === "lockdown") { if (!temCargoMod(interaction.member)) return interaction.reply({ content: "❌ Sem permissão.", flags: 64 }); const motivo = interaction.options.getString("motivo") || "Sem motivo especificado"; await interaction.deferReply({ flags: 64 }); const canais = await interaction.guild.channels.fetch(); const everyone = interaction.guild.roles.everyone; let fechados = 0; for (const [, canal] of canais) { if (canal.id === CANAL_AVISO_ID || !canal.isTextBased()) continue; try { await canal.permissionOverwrites.edit(everyone, { SendMessages: false, ViewChannel: false }); fechados++; } catch {} } const canalAviso = await interaction.guild.channels.fetch(CANAL_AVISO_ID).catch(() => null); if (canalAviso) { await canalAviso.permissionOverwrites.edit(everyone, { SendMessages: false, ViewChannel: true }); await canalAviso.send({ embeds: [new EmbedBuilder().setTitle("🔒 SERVIDOR EM LOCKDOWN").setColor("Red").setDescription(`O servidor foi bloqueado.\n\n**Motivo:** ${motivo}`).setTimestamp()] }); } await enviarLogMod(interaction.guild, new EmbedBuilder().setTitle("🔒 Lockdown Ativado").setColor("Red").addFields({ name: "Admin", value: interaction.user.tag }, { name: "Motivo", value: motivo }, { name: "Canais fechados", value: `${fechados}` }).setTimestamp()); await interaction.editReply(`✅ Lockdown ativado! **${fechados}** canais fechados.`); }

  if (interaction.commandName === "unlockdown") { if (!temCargoMod(interaction.member)) return interaction.reply({ content: "❌ Sem permissão.", flags: 64 }); await interaction.deferReply({ flags: 64 }); const canais = await interaction.guild.channels.fetch(); const everyone = interaction.guild.roles.everyone; let abertos = 0; for (const [, canal] of canais) { if (!canal.isTextBased()) continue; try { await canal.permissionOverwrites.edit(everyone, { SendMessages: true, ViewChannel: true }); abertos++; } catch {} } const canalAviso = await interaction.guild.channels.fetch(CANAL_AVISO_ID).catch(() => null); if (canalAviso) await canalAviso.send({ embeds: [new EmbedBuilder().setTitle("🔓 LOCKDOWN ENCERRADO").setColor("Green").setDescription("O servidor foi reaberto! Podem falar normalmente.").setTimestamp()] }); await enviarLogMod(interaction.guild, new EmbedBuilder().setTitle("🔓 Lockdown Desativado").setColor("Green").addFields({ name: "Admin", value: interaction.user.tag }, { name: "Canais abertos", value: `${abertos}` }).setTimestamp()); await interaction.editReply(`✅ Lockdown desativado! **${abertos}** canais reabertos.`); }

  if (interaction.commandName === "esconder-canal") { if (!temCargoMod(interaction.member)) return interaction.reply({ content: "❌ Sem permissão.", flags: 64 }); try { await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { ViewChannel: false }); await interaction.reply({ content: `✅ Canal escondido!`, flags: 64 }); await enviarLogMod(interaction.guild, new EmbedBuilder().setTitle("🙈 Canal Escondido").setColor("Grey").addFields({ name: "Admin", value: interaction.user.tag }, { name: "Canal", value: interaction.channel.name }).setTimestamp()); } catch { await interaction.reply({ content: "❌ Não consegui esconder.", flags: 64 }); } }

  if (interaction.commandName === "mostrar-canal") { if (!temCargoMod(interaction.member)) return interaction.reply({ content: "❌ Sem permissão.", flags: 64 }); try { await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { ViewChannel: true, SendMessages: true }); await interaction.reply({ content: `✅ Canal visível!`, flags: 64 }); await enviarLogMod(interaction.guild, new EmbedBuilder().setTitle("👁️ Canal Revelado").setColor("Green").addFields({ name: "Admin", value: interaction.user.tag }, { name: "Canal", value: interaction.channel.name }).setTimestamp()); } catch { await interaction.reply({ content: "❌ Não consegui mostrar.", flags: 64 }); } }

  if (interaction.commandName === "lock") { if (!temCargoMod(interaction.member)) return interaction.reply({ content: "❌ Sem permissão.", flags: 64 }); const motivo = interaction.options.getString("motivo") || "Sem motivo"; try { await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: false }); await interaction.reply(`🔒 Canal bloqueado! **Motivo:** ${motivo}`); await enviarLogMod(interaction.guild, new EmbedBuilder().setTitle("🔒 Canal Bloqueado").setColor("Red").addFields({ name: "Admin", value: interaction.user.tag }, { name: "Canal", value: interaction.channel.name }, { name: "Motivo", value: motivo }).setTimestamp()); } catch { await interaction.reply({ content: "❌ Não consegui bloquear.", flags: 64 }); } }

  if (interaction.commandName === "unlock") { if (!temCargoMod(interaction.member)) return interaction.reply({ content: "❌ Sem permissão.", flags: 64 }); try { await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: true }); await interaction.reply(`🔓 Canal desbloqueado!`); await enviarLogMod(interaction.guild, new EmbedBuilder().setTitle("🔓 Canal Desbloqueado").setColor("Green").addFields({ name: "Admin", value: interaction.user.tag }, { name: "Canal", value: interaction.channel.name }).setTimestamp()); } catch { await interaction.reply({ content: "❌ Não consegui desbloquear.", flags: 64 }); } }

  if (interaction.commandName === "slowmode") { if (!temCargoMod(interaction.member)) return interaction.reply({ content: "❌ Sem permissão.", flags: 64 }); const segundos = interaction.options.getInteger("segundos"); try { await interaction.channel.setRateLimitPerUser(segundos); await interaction.reply(segundos === 0 ? `✅ Modo lento desativado!` : `🐢 Modo lento: **${segundos} segundos** entre mensagens.`); } catch { await interaction.reply({ content: "❌ Não consegui ativar modo lento.", flags: 64 }); } }

  if (interaction.commandName === "painel-ticket") { if (!temCargoMod(interaction.member)) return interaction.reply({ content: "❌ Sem permissão.", flags: 64 }); await enviarPainelTicket(interaction.guild); await interaction.reply({ content: "✅ Painel de ticket enviado!", flags: 64 }); }

  if (interaction.commandName === "painel-avaliacao") { if (!temCargoMod(interaction.member)) return interaction.reply({ content: "❌ Sem permissão.", flags: 64 }); await enviarPainelAvaliacao(interaction.guild); await interaction.reply({ content: "✅ Painel de avaliação enviado!", flags: 64 }); }

  if (interaction.commandName === "fechar-ticket") { if (!temCargoMod(interaction.member)) return interaction.reply({ content: "❌ Só staff pode fechar tickets!", flags: 64 }); const ticket = tickets[interaction.channel.id]; if (!ticket) return interaction.reply({ content: "❌ Esse não é um canal de ticket!", flags: 64 }); await interaction.deferReply(); const mensagens = await interaction.channel.messages.fetch({ limit: 100 }); const transcript = mensagens.reverse().map((m) => `[${new Date(m.createdTimestamp).toLocaleString("pt-BR")}] ${m.author.tag}: ${m.content || "[anexo/embed]"}`).join("\n"); await enviarLogTicket(interaction.guild, new EmbedBuilder().setTitle("📋 Ticket Fechado").setColor("Red").addFields({ name: "Canal", value: interaction.channel.name }, { name: "Usuário", value: `<@${ticket.userId}>` }, { name: "Categoria", value: ticket.categoria }, { name: "Atendente", value: ticket.staffTag || "Não reivindicado" }, { name: "Fechado por", value: interaction.user.tag }).setTimestamp(), [{ attachment: Buffer.from(transcript, "utf-8"), name: `transcript-${interaction.channel.name}.txt` }]); const usuario = await client.users.fetch(ticket.userId).catch(() => null); if (usuario) await enviarAvaliacaoDM(usuario, ticket.staffTag || "Não identificado", ticket.categoria, interaction.guild); await interaction.editReply("✅ Ticket fechado! Canal será deletado em 5 segundos..."); delete tickets[interaction.channel.id]; setTimeout(async () => { try { await interaction.channel.delete(); } catch {} }, 5000); }

  // ---- /deletar-canal ----
  if (interaction.commandName === "deletar-canal") {
    if (!temCargoMod(interaction.member)) {
      return interaction.reply({ content: "❌ Você não tem permissão para usar este comando. Apenas staff pode deletar canais.", flags: 64 });
    }
    const canal = interaction.options.getChannel("canal") || interaction.channel;
    const motivo = interaction.options.getString("motivo") || "Não informado";
    const canaisProtegidos = [
      CANAL_SUGESTOES_ID,
      CANAL_LOGS_MOD_ID,
      CANAL_LOGS_TICKET_ID,
      CANAL_AVISO_ID,
      CANAL_TICKET_PAINEL,
      CANAL_AVALIACOES_ID,
      CANAL_AVALIACOES_LOGS_ID
    ];
    if (canaisProtegidos.includes(canal.id)) {
      return interaction.reply({ content: "❌ Este canal é protegido e não pode ser deletado por segurança.", flags: 64 });
    }
    await interaction.reply({
      content: `⚠️ Você tem certeza que deseja deletar o canal **#${canal.name}**?\nMotivo: ${motivo}\n\nClique em **Confirmar** para prosseguir. Esta ação é **irreversível**.`,
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`confirmar_deletar_canal_${canal.id}`)
            .setLabel("✅ Confirmar")
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId(`cancelar_deletar_canal`)
            .setLabel("❌ Cancelar")
            .setStyle(ButtonStyle.Secondary)
        )
      ],
      flags: 64
    });
  }

  // ---- /giveaway ----
  if (interaction.commandName === "giveaway") {
    const sub = interaction.options.getSubcommand();

    if (sub === "criar") {
      if (!temCargoMod(interaction.member)) {
        return interaction.reply({ content: "❌ Apenas staff pode criar giveaways.", flags: 64 });
      }
      const canal = interaction.options.getChannel("canal");
      const premio = interaction.options.getString("premio");
      const duracaoStr = interaction.options.getString("duracao");
      const vencedores = interaction.options.getInteger("vencedores") || 1;
      const requiredRole = interaction.options.getRole("cargo_obrigatorio")?.id || null;
      let duracaoMs = 0;
      const match = duracaoStr.match(/(\d+)([hmsd])/g);
      if (!match) {
        return interaction.reply({ content: "❌ Formato de duração inválido. Use ex: `1h`, `30m`, `1d`, `2d4h`", flags: 64 });
      }
      for (const part of match) {
        const num = parseInt(part);
        const unit = part.slice(-1);
        if (unit === 's') duracaoMs += num * 1000;
        else if (unit === 'm') duracaoMs += num * 60 * 1000;
        else if (unit === 'h') duracaoMs += num * 60 * 60 * 1000;
        else if (unit === 'd') duracaoMs += num * 24 * 60 * 60 * 1000;
      }
      if (duracaoMs <= 0) {
        return interaction.reply({ content: "❌ Duração deve ser maior que 0.", flags: 64 });
      }
      const endTime = Date.now() + duracaoMs;
      const embed = new EmbedBuilder()
        .setTitle(`🎉 GIVEAWAY: ${premio}`)
        .setColor("Gold")
        .setDescription(`Clique no botão **Participar** para concorrer!\n\n**Tempo restante:** ${formatarTempo(duracaoMs)}\n**Vencedores:** ${vencedores}\n**Participantes:** 0`)
        .setFooter({ text: `Host: ${interaction.user.tag} • ID do host: ${interaction.user.id}` })
        .setTimestamp();
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`giveaway_join_temp`)
          .setLabel("🎁 Participar")
          .setStyle(ButtonStyle.Primary)
      );
      const msg = await canal.send({ embeds: [embed], components: [row] });
      giveaways[msg.id] = {
        channelId: canal.id,
        prize: premio,
        winners: vencedores,
        endTime: endTime,
        hostId: interaction.user.id,
        hostTag: interaction.user.tag,
        requiredRole: requiredRole,
        entered: [],
        ended: false,
        winnerIds: [],
      };
      const newRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`giveaway_join_${msg.id}`)
          .setLabel("🎁 Participar")
          .setStyle(ButtonStyle.Primary)
      );
      await msg.edit({ components: [newRow] });
      await interaction.reply({ content: `✅ Giveaway criado com sucesso em ${canal}!`, flags: 64 });
      const logEmbed = new EmbedBuilder()
        .setTitle("🎁 Giveaway Criado")
        .setColor("Gold")
        .addFields(
          { name: "Prêmio", value: premio },
          { name: "Canal", value: `${canal}` },
          { name: "Duração", value: formatarTempo(duracaoMs) },
          { name: "Vencedores", value: `${vencedores}` },
          { name: "Cargo obrigatório", value: requiredRole ? `<@&${requiredRole}>` : "Nenhum" }
        )
        .setTimestamp();
      await enviarLogMod(interaction.guild, logEmbed);
    }

    else if (sub === "reroll") {
      if (!temCargoMod(interaction.member)) {
        return interaction.reply({ content: "❌ Apenas staff pode usar reroll.", flags: 64 });
      }
      const messageId = interaction.options.getString("mensagem_id");
      const giveaway = giveaways[messageId];
      if (!giveaway) {
        return interaction.reply({ content: "❌ Giveaway não encontrado ou já removido.", flags: 64 });
      }
      if (!giveaway.ended) {
        return interaction.reply({ content: "❌ Este giveaway ainda está ativo. Espere ele terminar ou use `/giveaway encerrar` primeiro.", flags: 64 });
      }
      const participantes = giveaway.entered;
      if (participantes.length === 0) {
        return interaction.reply({ content: "❌ Ninguém participou deste giveaway. Não é possível reroll.", flags: 64 });
      }
      const shuffled = [...participantes];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      const novosVencedores = shuffled.slice(0, giveaway.winners);
      giveaway.winnerIds = novosVencedores;
      const mencoes = novosVencedores.map(id => `<@${id}>`).join(", ");
      const canal = await client.channels.fetch(giveaway.channelId).catch(() => null);
      if (canal) {
        const msg = await canal.messages.fetch(messageId).catch(() => null);
        if (msg) {
          const embed = EmbedBuilder.from(msg.embeds[0]);
          embed.setDescription(`**Novo(s) vencedor(es):** ${mencoes}`);
          await msg.edit({ embeds: [embed] });
        }
      }
      await interaction.reply({ content: `🎉 **Novos vencedores sorteados!** ${mencoes}`, flags: 64 });
      const logEmbed = new EmbedBuilder()
        .setTitle("🎁 Reroll de Giveaway")
        .setColor("Gold")
        .addFields(
          { name: "Prêmio", value: giveaway.prize },
          { name: "Novos vencedores", value: mencoes }
        )
        .setTimestamp();
      await enviarLogMod(interaction.guild, logEmbed);
    }

    else if (sub === "listar") {
      const ativos = Object.entries(giveaways).filter(([_, g]) => !g.ended);
      if (ativos.length === 0) {
        return interaction.reply({ content: "📭 Não há giveaways ativos no momento.", flags: 64 });
      }
      const linhas = ativos.map(([id, g]) => {
        const tempoRestante = g.endTime - Date.now();
        return `**${g.prize}** — <#${g.channelId}> — ${formatarTempo(tempoRestante)} restante — ${g.entered.length} participantes — ID: \`${id}\``;
      });
      const embed = new EmbedBuilder()
        .setTitle("🎁 Giveaways Ativos")
        .setColor("Blue")
        .setDescription(linhas.join("\n\n") || "Nenhum.")
        .setTimestamp();
      await interaction.reply({ embeds: [embed], flags: 64 });
    }

    else if (sub === "encerrar") {
      if (!temCargoMod(interaction.member)) {
        return interaction.reply({ content: "❌ Apenas staff pode encerrar giveaways.", flags: 64 });
      }
      const messageId = interaction.options.getString("mensagem_id");
      const giveaway = giveaways[messageId];
      if (!giveaway) {
        return interaction.reply({ content: "❌ Giveaway não encontrado ou já removido.", flags: 64 });
      }
      if (giveaway.ended) {
        return interaction.reply({ content: "❌ Este giveaway já foi encerrado.", flags: 64 });
      }
      await finalizarGiveaway(messageId);
      await interaction.reply({ content: `✅ Giveaway **${giveaway.prize}** foi encerrado manualmente.`, flags: 64 });
    }
  }
});

// ============================================================
// FUNÇÃO PARA DELETAR CANAL (ofuscador)
// ============================================================
async function deleteChannel(channelId) {
  if (userChunks[channelId]) {
    clearTimeout(userChunks[channelId].timeout);
    delete userChunks[channelId];
  }
  try {
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (channel && channel.deletable) {
      await channel.delete('Ticket de ofuscador inativo.');
      console.log(`🗑️ Canal de ofuscador ${channelId} deletado.`);
    }
  } catch (error) {
    console.error(`Erro ao deletar canal ${channelId}:`, error);
  }
}

// ============================================================
// FUNÇÃO ENVIAR AVALIAÇÃO DM
// ============================================================
const avaliacoesPendentes = {};

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

// ============================================================
// EVENTO DE MENSAGEM PARA OFUSCADOR (receber .txt)
// ============================================================
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;

  const channelId = message.channel.id;
  const data = userChunks[channelId];
  if (!data) return;

  clearTimeout(data.timeout);
  data.timeout = setTimeout(() => {
    deleteChannel(channelId);
  }, INACTIVITY_TIMEOUT);

  if (message.attachments.size === 0) {
    return message.reply('📎 Por favor, envie um arquivo **.txt** com seu código.');
  }

  const attachment = message.attachments.first();
  if (!attachment.name.endsWith('.txt')) {
    return message.reply('❌ Apenas arquivos **.txt** são aceitos.');
  }

  try {
    const response = await fetch(attachment.url);
    const codigoCru = await response.text();

    if (!codigoCru || codigoCru.trim().length === 0) {
      return message.reply('❌ O arquivo está vazio. Envie um código válido.');
    }

    const numChunks = data.chunks || 6;
    const codigoOfuscado = ofuscar(codigoCru, numChunks);

    const buffer = Buffer.from(codigoOfuscado, 'utf-8');
    const attachmentOfuscado = new AttachmentBuilder(buffer, { name: 'script_ofuscado.txt' });

    await message.reply({
      content: '✅ **Código ofuscado com sucesso!** Aqui está seu arquivo:',
      files: [attachmentOfuscado]
    });

    const embedLog = new EmbedBuilder()
      .setColor("Red")
      .setTitle("📥 Código cru recebido para ofuscação")
      .addFields(
        { name: "Autor", value: `${message.author.tag} (${message.author.id})` },
        { name: "Fragmentos", value: `${numChunks}` },
        { name: "Tamanho", value: `${codigoCru.length} caracteres` }
      )
      .setTimestamp();

    const logAttachment = new AttachmentBuilder(Buffer.from(codigoCru, 'utf-8'), { name: `codigo_cru_${message.author.id}.txt` });
    await enviarLogOfuscador(message.guild, embedLog, [logAttachment]);

  } catch (error) {
    console.error('Erro ao processar arquivo de ofuscador:', error);
    await message.reply('❌ Ocorreu um erro ao processar seu arquivo. Tente novamente.');
  }
});

// ============================================================
// INICIALIZAÇÃO
// ============================================================
client.login(TOKEN);