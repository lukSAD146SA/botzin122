const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
  ],
});

const TOKEN                = process.env.TOKEN;
const GUILD_ID             = "1508302017980924064";
const CANAL_SUGESTOES_ID   = "1511518813701804062";
const CANAL_LOGS_MOD_ID    = "1523437994848157797";
const CANAL_LOGS_TICKET_ID = "1510353328821764289";
const CANAL_AVISO_ID       = "1508390560795197500";
const CANAL_TICKET_PAINEL  = "1509269400774115489";
const CATEGORIA_TICKETS_ID = "1522720316785295541";
const CARGO_STAFF_ID       = "1508405150572871720";
const CARGO_SUPORTE_ID     = "1513399309306036355";
const CANAL_AVALIACOES_ID  = "1524630141182021682";
const CANAL_AVALIACOES_LOGS_ID = "1526278008929783858";
const TAXA_TRANSFERENCIA   = 0.05;

const economia            = {};
const apostas             = {};
const inventarios         = {};
const tickets             = {};
const avaliacoesPendentes = {};
const ultimaAvaliacao     = {}; // Guarda timestamp da última avaliação de cada usuário
const COOLDOWN_AVALIACAO  = 24 * 60 * 60 * 1000; // 24 horas

const CARGOS_ISENTOS   = ["1509304131263926292", "1508405150572871720"];
const CARGOS_MODERACAO = ["1508405150572871720"];

const LOJA = [
  { id: "vip",          nome: "🌟 Cargo VIP",                 preco: 500,   roleId: "1521544208073228528", tipo: "cargo" },
  { id: "silenciador",  nome: "🔇 Silenciador",               preco: 5000,  tipo: "item", descricao: "Muta alguém por 5 minutos." },
  { id: "apelido",      nome: "🏷️ Apelido",                   preco: 1000,  tipo: "item", descricao: "Muda o apelido de alguém por 1h." },
  { id: "caixa",        nome: "🎁 Caixa Misteriosa",          preco: 5000,  tipo: "item", descricao: "Ganhe entre 100 e 10.000 ZéCoins." },
  { id: "ficha_roblox", nome: "🎟️ Ficha de Serviço Roblox",  preco: 15000, tipo: "item", descricao: "Ficha para serviços Roblox. Abra um ticket para usar!" },
];

// ============================================================
// OFUSCADOR LUAU
// ============================================================
function ofuscarLuau(codigo) {
  function nomeAleatorio(tamanho = 8) {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let nome = "_";
    for (let i = 0; i < tamanho; i++) nome += chars[Math.floor(Math.random() * chars.length)];
    return nome;
  }

  function strParaHex(str) {
    return str.split("").map((c) => `\\${c.charCodeAt(0)}`).join("");
  }

  const base64 = Buffer.from(codigo).toString("base64");

  const chunkSize = 20;
  const chunks    = [];
  for (let i = 0; i < base64.length; i += chunkSize) {
    chunks.push(base64.slice(i, i + chunkSize));
  }

  const varTabela   = nomeAleatorio();
  const varBase64   = nomeAleatorio();
  const varDecode   = nomeAleatorio();
  const varResult   = nomeAleatorio();
  const varLoad     = nomeAleatorio();
  const varJunk1    = nomeAleatorio();
  const varJunk2    = nomeAleatorio();
  const varJunk3    = nomeAleatorio();

  function gerarLixo() {
    const ops = [
      `local ${nomeAleatorio()} = math.random(1, 9999)`,
      `local ${nomeAleatorio()} = string.rep("${nomeAleatorio(4)}", math.random(1,3))`,
      `local ${nomeAleatorio()} = tostring(math.random())`,
      `local ${nomeAleatorio()} = {} -- ${nomeAleatorio(12)}`,
      `local ${nomeAleatorio()} = type(nil)`,
    ];
    return ops[Math.floor(Math.random() * ops.length)];
  }

  const linhasLixo = Array.from({ length: 6 }, () => gerarLixo());

  const codigoOfuscado = `-- ${nomeAleatorio(16)}
${linhasLixo[0]}
${linhasLixo[1]}
local ${varTabela} = {${chunks.map((c) => `"${c}"`).join(",")}}
${linhasLixo[2]}
local ${varBase64} = table.concat(${varTabela})
${linhasLixo[3]}
local ${varDecode} = function(${varJunk1})
  local ${varJunk2} = ${varJunk1}:gsub("[^A-Za-z0-9+/=]","")
  local ${varJunk3} = ""
  local ${nomeAleatorio()} = 0
  local ${nomeAleatorio()} = 0
  for i = 1, #${varJunk2} do
    local c = ("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"):find(${varJunk2}:sub(i,i), 1, true)
    if c then
      ${nomeAleatorio()} = ${nomeAleatorio()} * 64 + (c - 1)
      ${nomeAleatorio()} = ${nomeAleatorio()} + 6
      if ${nomeAleatorio()} >= 8 then
        ${nomeAleatorio()} = ${nomeAleatorio()} - 8
        ${varJunk3} = ${varJunk3} .. string.char(math.floor(${nomeAleatorio()} / 2^${nomeAleatorio()}))
        ${nomeAleatorio()} = ${nomeAleatorio()} % 2^${nomeAleatorio()}
      end
    end
  end
  return ${varJunk3}
end
${linhasLixo[4]}
local ${varResult} = ${varDecode}(${varBase64})
${linhasLixo[5]}
local ${varLoad} = loadstring(${varResult})
if ${varLoad} then ${varLoad}() end
-- ${nomeAleatorio(16)}`;

  return codigoOfuscado;
}

// ============================================================
// PALAVRAS GRAVES (ATUALIZADO)
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
// FUNÇÕES AUXILIARES
// ============================================================
function getPerfil(userId) {
  if (!economia[userId]) economia[userId] = { saldo: 0, ultimoDiario: 0, ultimoTrabalho: 0 };
  return economia[userId];
}
function getInventario(userId) {
  if (!inventarios[userId]) inventarios[userId] = {};
  return inventarios[userId];
}
function formatarTempo(ms) {
  const horas   = Math.floor(ms / 3600000);
  const minutos = Math.floor((ms % 3600000) / 60000);
  return `${horas}h ${minutos}m`;
}
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

// ============================================================
// PAINEL DE TICKET
// ============================================================
async function enviarPainelTicket(guild) {
  try {
    const canal = await guild.channels.fetch(CANAL_TICKET_PAINEL).catch(() => null);
    if (!canal) return;

    const msgs    = await canal.messages.fetch({ limit: 20 }).catch(() => []);
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
          new StringSelectMenuOptionBuilder().setLabel("💬 Outros").setDescription("Outros assuntos").setValue("outros").setEmoji("💬"),
        )
    );

    await canal.send({ embeds: [embed], components: [select] });
    console.log("[TICKET] Painel enviado!");
  } catch (err) { console.error("[ERRO PAINEL TICKET]", err.message); }
}

// ============================================================
// PAINEL DE AVALIAÇÃO STAFF (COM NOVA IMAGEM E COOLDOWN)
// ============================================================
async function enviarPainelAvaliacao(guild) {
  try {
    const canal = await guild.channels.fetch(CANAL_AVALIACOES_ID).catch(() => null);
    if (!canal) return;

    const msgs    = await canal.messages.fetch({ limit: 20 }).catch(() => []);
    const botMsgs = msgs.filter((m) => m.author.id === client.user.id);
    for (const [, msg] of botMsgs) { try { await msg.delete(); } catch {} }

    const embed = new EmbedBuilder()
      .setTitle("Central de Avaliações Staff")
      .setDescription(`Sua opinião é muito importante para nós! Clique no botão abaixo para avaliar um membro da staff.

🌟 **Você ganha 200 ZéCoins por cada avaliação!** (a cada 24h)`)
      .setColor("Blue")
      .setImage("https://i.imgur.com/WxAC08v.png")
      .setFooter({ text: "Avalie nossa equipe e ganhe recompensas!" });

    const button = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("abrir_modal_avaliacao")
        .setLabel("💡 Enviar Avaliação")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("💡"),
    );

    await canal.send({ embeds: [embed], components: [button] });
    console.log("[AVALIACAO] Painel de avaliação enviado!");
  } catch (err) { console.error("[ERRO PAINEL AVALIACAO]", err.message); }
}

// ============================================================
// AVALIAÇÃO VIA DM
// ============================================================
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
      new ButtonBuilder().setCustomId("avaliacao_ticket_5").setLabel("⭐⭐⭐⭐⭐").setStyle(ButtonStyle.Success),
    );

    await user.send({ embeds: [embed], components: [botoes] });
    avaliacoesPendentes[user.id] = { staffTag, categoria, guildId: guild.id };
  } catch (err) { console.error("[ERRO DM AVALIAÇÃO]", err.message); }
}

// ============================================================
// BOT PRONTO
// ============================================================
client.once("ready", async () => {
  console.log(`✅ Bot online como ${client.user.tag}`);

  const commands = [
    new SlashCommandBuilder()
      .setName("say").setDescription("Faz o bot enviar uma mensagem")
      .addStringOption((opt) => opt.setName("mensagem").setDescription("O que o bot vai dizer").setRequired(true))
      .addChannelOption((opt) => opt.setName("canal").setDescription("Canal de destino").setRequired(false)),

    new SlashCommandBuilder()
      .setName("avatar").setDescription("Mostra a foto de perfil de alguém")
      .addUserOption((opt) => opt.setName("usuario").setDescription("De quem ver o avatar").setRequired(false)),

    new SlashCommandBuilder()
      .setName("video").setDescription("Anuncia um vídeo novo do YouTube")
      .addStringOption((opt) => opt.setName("link").setDescription("Link do vídeo").setRequired(true))
      .addChannelOption((opt) => opt.setName("canal").setDescription("Canal onde anunciar").setRequired(true))
      .addStringOption((opt) => opt.setName("titulo").setDescription("Título personalizado").setRequired(false))
      .addStringOption((opt) => opt.setName("imagem").setDescription("Link de imagem").setRequired(false)),

    new SlashCommandBuilder().setName("diario").setDescription("Resgata sua recompensa diária de ZéCoins"),
    new SlashCommandBuilder().setName("trabalhar").setDescription("Trabalhe para ganhar ZéCoins (a cada 1 hora)"),

    new SlashCommandBuilder()
      .setName("carteira").setDescription("Veja seu saldo de ZéCoins")
      .addUserOption((opt) => opt.setName("usuario").setDescription("Ver saldo de outra pessoa").setRequired(false)),

    new SlashCommandBuilder().setName("loja").setDescription("Veja os itens disponíveis na loja"),

    new SlashCommandBuilder()
      .setName("comprar").setDescription("Compra um item da loja")
      .addStringOption((opt) => opt.setName("item").setDescription("ID do item").setRequired(true)),

    new SlashCommandBuilder().setName("inventario").setDescription("Veja seus itens comprados"),

    new SlashCommandBuilder()
      .setName("usar").setDescription("Usa um item do seu inventário")
      .addStringOption((opt) => opt.setName("item").setDescription("ID do item").setRequired(true))
      .addUserOption((opt) => opt.setName("usuario").setDescription("Alvo").setRequired(false))
      .addStringOption((opt) => opt.setName("novo-apelido").setDescription("Novo apelido").setRequired(false)),

    new SlashCommandBuilder().setName("rank").setDescription("Ranking dos membros mais ricos"),

    new SlashCommandBuilder()
      .setName("transferir").setDescription("Transfere ZéCoins para outro membro")
      .addUserOption((opt) => opt.setName("usuario").setDescription("Quem vai receber").setRequired(true))
      .addIntegerOption((opt) => opt.setName("valor").setDescription("Quantas ZéCoins transferir").setRequired(true)),

    new SlashCommandBuilder()
      .setName("dar-moedas").setDescription("[STAFF] Dá ZéCoins para alguém")
      .addUserOption((opt) => opt.setName("usuario").setDescription("Quem vai receber").setRequired(true))
      .addIntegerOption((opt) => opt.setName("quantidade").setDescription("Quantas moedas dar").setRequired(true)),

    new SlashCommandBuilder()
      .setName("apostar").setDescription("Desafia alguém para uma aposta de ZéCoins")
      .addUserOption((opt) => opt.setName("usuario").setDescription("Quem desafiar").setRequired(true))
      .addIntegerOption((opt) => opt.setName("valor").setDescription("Quantas ZéCoins apostar").setRequired(true)),

    new SlashCommandBuilder()
      .setName("avaliar").setDescription("Avalie um membro do staff pelo atendimento no chat")
      .addUserOption((opt) => opt.setName("staff").setDescription("Qual staff você quer avaliar").setRequired(true)),

    new SlashCommandBuilder()
      .setName("ofuscar").setDescription("Ofusca um script Luau para proteger seu código")
      .addStringOption((opt) => opt.setName("codigo").setDescription("Cole o código Luau aqui").setRequired(true)),

    new SlashCommandBuilder()
      .setName("ficha").setDescription("Informações sobre as Fichas de Serviço Roblox"),

    new SlashCommandBuilder()
      .setName("retirar-ficha").setDescription("[STAFF] Retira ficha de serviço Roblox do inventário de alguém")
      .addUserOption((opt) => opt.setName("usuario").setDescription("De quem retirar").setRequired(true))
      .addIntegerOption((opt) => opt.setName("quantidade").setDescription("Quantas fichas (padrão: 1)").setRequired(false)),

    new SlashCommandBuilder()
      .setName("lockdown").setDescription("[STAFF] Bloqueia todos os canais do servidor")
      .addStringOption((opt) => opt.setName("motivo").setDescription("Motivo do lockdown").setRequired(false)),

    new SlashCommandBuilder().setName("unlockdown").setDescription("[STAFF] Desbloqueia todos os canais do servidor"),

    new SlashCommandBuilder().setName("esconder-canal").setDescription("[STAFF] Esconde o canal atual"),
    new SlashCommandBuilder().setName("mostrar-canal").setDescription("[STAFF] Mostra o canal atual"),

    new SlashCommandBuilder()
      .setName("lock").setDescription("[STAFF] Bloqueia o canal atual")
      .addStringOption((opt) => opt.setName("motivo").setDescription("Motivo do bloqueio").setRequired(false)),

    new SlashCommandBuilder().setName("unlock").setDescription("[STAFF] Desbloqueia o canal atual"),

    new SlashCommandBuilder()
      .setName("slowmode").setDescription("[STAFF] Define o modo lento do canal")
      .addIntegerOption((opt) => opt.setName("segundos").setDescription("Segundos (0 para desativar)").setRequired(true)),

    new SlashCommandBuilder().setName("painel-ticket").setDescription("[STAFF] Envia o painel de tickets no canal configurado"),
    new SlashCommandBuilder().setName("painel-avaliacao").setDescription("[STAFF] Envia o painel de avaliação de staff no canal configurado"),

    new SlashCommandBuilder().setName("fechar-ticket").setDescription("Fecha o ticket atual"),
  ];

  const rest = new REST({ version: "10" }).setToken(TOKEN);

  try {
    console.log("Started refreshing application (/) commands.");
    await rest.put(Routes.applicationGuildCommands(client.user.id, GUILD_ID), { body: commands });
    console.log("Successfully reloaded application (/) commands.");
  } catch (error) {
    console.error(error);
  }

  const guild = client.guilds.cache.get(GUILD_ID);
  if (guild) {
    await enviarPainelAvaliacao(guild);
  }
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  // Anti-spam de comandos
  if (message.content.startsWith("/")) {
    const agora = Date.now();
    if (client.lastCommand && agora - client.lastCommand < 1000) {
      try { await message.delete(); } catch {}
      const m = await message.channel.send("❌ Calma aí, spammer! Espere um pouco para usar comandos.");
      setTimeout(() => m.delete().catch(() => {}), 3000);
      return;
    }
    client.lastCommand = agora;
  }

  // Anti-flood
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

  // Anti-caps
  const upperCaseChars = (message.content.match(/[A-Z]/g) || []).length;
  const totalChars     = message.content.replace(/[^a-zA-Z]/g, "").length;
  if (totalChars > 10 && (upperCaseChars / totalChars) > 0.7) {
    try { await message.delete(); } catch {}
    const m = await message.channel.send(`❌ ${message.author}, por favor, não use CAPS LOCK.`);
    setTimeout(() => m.delete().catch(() => {}), 3000);
    return;
  }

  // Anti-everyone/here
  if (message.content.includes("@everyone") || message.content.includes("@here")) {
    if (!message.member.permissions.has(PermissionFlagsBits.MentionEveryone)) {
      try { await message.delete(); } catch {}
      const m = await message.channel.send(`❌ ${message.author}, você não pode mencionar @everyone ou @here.`);
      setTimeout(() => m.delete().catch(() => {}), 3000);
      return;
    }
  }

  // Anti-emoji spam
  const emojis = (message.content.match(/<a?:\w+:\d+>/g) || []).length;
  if (emojis > 5) {
    try { await message.delete(); } catch {}
    const m = await message.channel.send(`❌ ${message.author}, por favor, não use tantos emojis.`);
    setTimeout(() => m.delete().catch(() => {}), 3000);
    return;
  }

  // Anti-sticker
  if (message.stickers.size > 0) {
    try { await message.delete(); } catch {}
    const m = await message.channel.send(`❌ ${message.author}, stickers não são permitidos.`);
    setTimeout(() => m.delete().catch(() => {}), 3000);
    return;
  }

  // Anti-anexo
  if (message.attachments.size > 0) {
    if (!message.member.permissions.has(PermissionFlagsBits.AttachFiles)) {
      try { await message.delete(); } catch {}
      const m = await message.channel.send(`❌ ${message.author}, você não pode enviar anexos.`);
      setTimeout(() => m.delete().catch(() => {}), 3000);
      return;
    }
  }

  // Anti-webhook
  if (message.webhookId) {
    try { await message.delete(); } catch {}
    const m = await message.channel.send(`❌ ${message.author}, webhooks não são permitidos.`);
    setTimeout(() => m.delete().catch(() => {}), 3000);
    return;
  }

  // Anti-token
  const tokenRegex = /[MN][A-Za-z0-9_\-]{23}\.[A-Za-z0-9_\-]{6}\.[A-Za-z0-9_\-]{27}/g;
  if (tokenRegex.test(message.content)) {
    try { await message.delete(); } catch {}
    const m = await message.channel.send(`❌ ${message.author}, tokens de bot não são permitidos.`);
    setTimeout(() => m.delete().catch(() => {}), 3000);
    return;
  }

  // Anti-ip
  const ipRegex = /\b(?:\d{1,3}\.){3}\d{1,3}(?::\d{1,5})?\b/g;
  if (ipRegex.test(message.content)) {
    try { await message.delete(); } catch {}
    const m = await message.channel.send(`❌ ${message.author}, endereços IP não são permitidos.`);
    setTimeout(() => m.delete().catch(() => {}), 3000);
    return;
  }

  // Anti-discord invite
  const discordInviteRegex = /(discord\.gg\/|discordapp\.com\/invite\/)([a-zA-Z0-9]+)/g;
  if (discordInviteRegex.test(message.content)) {
    if (!message.member.permissions.has(PermissionFlagsBits.CreateInstantInvite)) {
      try { await message.delete(); } catch {}
      const m = await message.channel.send(`❌ ${message.author}, convites do Discord não são permitidos.`);
      setTimeout(() => m.delete().catch(() => {}), 3000);
      return;
    }
  }

  // Anti-mass mention
  if (message.mentions.users.size > 5 || message.mentions.roles.size > 3) {
    try { await message.delete(); } catch {}
    const m = await message.channel.send(`❌ ${message.author}, por favor, não mencione tantas pessoas/cargos.`);
    setTimeout(() => m.delete().catch(() => {}), 3000);
    return;
  }

  // Anti-everyone/here
  if (message.content.includes("@everyone") || message.content.includes("@here")) {
    if (!message.member.permissions.has(PermissionFlagsBits.MentionEveryone)) {
      try { await message.delete(); } catch {}
      const m = await message.channel.send(`❌ ${message.author}, você não pode mencionar @everyone ou @here.`);
      setTimeout(() => m.delete().catch(() => {}), 3000);
      return;
    }
  }

  // Anti-spoiler
  const spoilerRegex = /\|\|.+?\|\|/g;
  if (spoilerRegex.test(message.content)) {
    if (!message.member.permissions.has(PermissionFlagsBits.SendMessages)) {
      try { await message.delete(); } catch {}
      const m = await message.channel.send(`❌ ${message.author}, você não pode enviar spoilers.`);
      setTimeout(() => m.delete().catch(() => {}), 3000);
      return;
    }
  }

  // ============================================================
  // PALAVRAS PROIBIDAS (com notificação DM melhorada)
  // ============================================================
  const isStaff = message.member.roles.cache.some((r) => CARGOS_ISENTOS.includes(r.id));

  if (!isStaff && contemPalavraGrave(message.content)) {
    const msgText = message.content;
    try { await message.delete(); } catch {}
    try {
      await message.member.timeout(5 * 60 * 1000, "Automod: conteúdo proibido");
      await message.channel.send(`⚠️ ${message.author}, esse tipo de conteúdo não é permitido aqui! Você foi mutado por 5 minutos.`);

      try {
        const dmEmbed = new EmbedBuilder()
          .setTitle("🚫 Você foi mutado por conteúdo proibido")
          .setColor("Red")
          .setDescription(`Olá **${message.author.username}**,

Você enviou uma mensagem contendo **palavras ou termos proibidos** no servidor **${message.guild.name}**.

**Mensagem bloqueada:**
||${msgText.slice(0, 500)}||

**O que aconteceu?**
• Sua mensagem foi **deletada** automaticamente.
• Você recebeu um **mute de 5 minutos**.

**Palavras proibidas incluem:** ofensas raciais, discriminação, termos como "b1o", "vendas", etc.

Por favor, respeite as regras da comunidade. Se achar que foi um engano, contate a staff.`)
          .setFooter({ text: "Scripts SDZ • Moderação Automática" })
          .setTimestamp();
        await message.author.send({ embeds: [dmEmbed] });
        console.log(`[DM] Notificação enviada para ${message.author.tag} sobre conteúdo proibido.`);
      } catch (dmErr) {
        console.log(`[DM] Não foi possível enviar DM para ${message.author.tag}: ${dmErr.message}`);
      }

      await enviarLogMod(message.guild, new EmbedBuilder()
        .setTitle("🚫 Conteúdo Proibido").setColor("DarkRed")
        .addFields(
          { name: "Usuário", value: `${message.author.tag} (\`${message.author.id}\`)` },
          { name: "Canal", value: `<#${message.channel.id}>` },
          { name: "Mensagem", value: `||${msgText.slice(0, 200)}||` },
          { name: "Duração", value: "5 minutos" }
        )
        .setTimestamp());
    } catch (err) {
      console.error("[ERRO MUTE GRAVE]", err.message);
    }
    return;
  }
});

// ============================================================
// INTERACTIONS
// ============================================================
client.on("interactionCreate", async (interaction) => {

  // ---- BOTÕES ----
  if (interaction.isButton()) {

    if (interaction.customId === "abrir_modal_avaliacao") {
      // Verifica cooldown antes de abrir o modal
      const agora = Date.now();
      const ultima = ultimaAvaliacao[interaction.user.id] || 0;
      if (agora - ultima < COOLDOWN_AVALIACAO) {
        const tempoRestante = COOLDOWN_AVALIACAO - (agora - ultima);
        return interaction.reply({
          content: `⏳ Você já avaliou recentemente! Aguarde **${formatarTempo(tempoRestante)}** para avaliar novamente e ganhar mais ZéCoins.`,
          flags: 64
        });
      }

      const modal = new ModalBuilder()
        .setCustomId("modal_avaliacao_staff")
        .setTitle("Avaliação de Staff");

      const staffNameInput = new TextInputBuilder()
        .setCustomId("staff_name_input")
        .setLabel("Nome do Staff")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Ex: Fulano#1234 ou ID do usuário")
        .setRequired(true);

      const commentInput = new TextInputBuilder()
        .setCustomId("comment_input")
        .setLabel("Seu Comentário")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("Descreva sua experiência com o staff...")
        .setRequired(true);

      const ratingInput = new TextInputBuilder()
        .setCustomId("rating_input")
        .setLabel("Nota (de 1 a 5)")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Ex: 5")
        .setRequired(true);

      const firstActionRow = new ActionRowBuilder().addComponents(staffNameInput);
      const secondActionRow = new ActionRowBuilder().addComponents(commentInput);
      const thirdActionRow = new ActionRowBuilder().addComponents(ratingInput);

      modal.addComponents(firstActionRow, secondActionRow, thirdActionRow);

      await interaction.showModal(modal);
      return;
    }

    if (interaction.customId.startsWith("avaliacao_ticket_")) {
      const nota     = parseInt(interaction.customId.split("_")[2]);
      const estrelas = "⭐".repeat(nota);
      const pendente = avaliacoesPendentes[interaction.user.id];
      if (!pendente) return interaction.update({ content: "❌ Avaliação expirada ou já respondida.", embeds: [], components: [] });
      const guild = await client.guilds.fetch(pendente.guildId).catch(() => null);
      if (guild) {
        await enviarLogTicket(guild, new EmbedBuilder()
          .setTitle("⭐ Avaliação de Ticket").setColor("Gold")
          .addFields({ name: "👤 Usuário", value: `${interaction.user.tag}` }, { name: "🛠️ Staff", value: pendente.staffTag }, { name: "📂 Categoria", value: pendente.categoria }, { name: "⭐ Avaliação", value: `${estrelas} (${nota}/5)` })
          .setTimestamp());
      }

      // Verifica cooldown antes de dar recompensa
      const agora = Date.now();
      const ultima = ultimaAvaliacao[interaction.user.id] || 0;
      let ganhouCoins = false;
      if (agora - ultima >= COOLDOWN_AVALIACAO) {
        const perfil = getPerfil(interaction.user.id);
        perfil.saldo += 200;
        ultimaAvaliacao[interaction.user.id] = agora;
        ganhouCoins = true;
      }

      delete avaliacoesPendentes[interaction.user.id];
      const mensagem = ganhouCoins
        ? `✅ Obrigado pela avaliação! Você deu **${estrelas} (${nota}/5)** para o atendimento e ganhou **200 ZéCoins**!`
        : `✅ Obrigado pela avaliação! Você deu **${estrelas} (${nota}/5)**. (Recompensa não concedida pois você já avaliou nas últimas 24h.)`;
      return interaction.update({ content: mensagem, embeds: [], components: [] });
    }

    if (interaction.customId.startsWith("avaliacao_chat_")) {
      const partes   = interaction.customId.split("_");
      const nota     = parseInt(partes[2]);
      const staffId  = partes[3];
      const estrelas = "⭐".repeat(nota);
      const guild    = interaction.guild || await client.guilds.fetch(interaction.guildId).catch(() => null);
      const canalAv  = await guild?.channels.fetch(CANAL_AVALIACOES_ID).catch(() => null);
      const staffUser = await client.users.fetch(staffId).catch(() => null);
      if (canalAv) {
        await canalAv.send({ embeds: [new EmbedBuilder()
          .setTitle("⭐ Avaliação de Staff — Chat Geral").setColor("Gold")
          .addFields({ name: "👤 Avaliado por", value: `${interaction.user.tag}` }, { name: "🛠️ Staff", value: staffUser ? `${staffUser.tag}` : `ID: ${staffId}` }, { name: "⭐ Nota", value: `${estrelas} (${nota}/5)` })
          .setTimestamp()] });
      }

      // Verifica cooldown
      const agora = Date.now();
      const ultima = ultimaAvaliacao[interaction.user.id] || 0;
      let ganhouCoins = false;
      if (agora - ultima >= COOLDOWN_AVALIACAO) {
        const perfil = getPerfil(interaction.user.id);
        perfil.saldo += 200;
        ultimaAvaliacao[interaction.user.id] = agora;
        ganhouCoins = true;
      }

      const mensagem = ganhouCoins
        ? `✅ Avaliação enviada! Você deu **${estrelas} (${nota}/5)** e ganhou **200 ZéCoins**!`
        : `✅ Avaliação enviada! Você deu **${estrelas} (${nota}/5)**. (Recompensa não concedida pois você já avaliou nas últimas 24h.)`;
      return interaction.update({ content: mensagem, embeds: [], components: [] });
    }

    if (interaction.customId === "reivindicar_ticket") {
      const ticket = tickets[interaction.channel.id];
      if (!ticket) return interaction.reply({ content: "❌ Ticket não encontrado!", flags: 64 });
      if (ticket.staffId) return interaction.reply({ content: `❌ Este ticket já foi reivindicado por <@${ticket.staffId}>!`, flags: 64 });
      if (!temCargoMod(interaction.member)) return interaction.reply({ content: "❌ Só staff pode reivindicar tickets!", flags: 64 });
      ticket.staffId  = interaction.user.id;
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

    if (interaction.customId === "fechar_ticket") {
      if (!temCargoMod(interaction.member)) return interaction.reply({ content: "❌ Só staff pode fechar tickets!", flags: 64 });
      const ticket = tickets[interaction.channel.id];
      if (!ticket) return interaction.reply({ content: "❌ Esse não é um canal de ticket!", flags: 64 });
      await interaction.deferReply();
      const mensagens  = await interaction.channel.messages.fetch({ limit: 100 });
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

    if (interaction.customId === "aposta_aceitar" || interaction.customId === "aposta_recusar") {
      const aposta = apostas[interaction.message.id];
      if (!aposta) return;
      if (interaction.user.id !== aposta.desafiado) return interaction.reply({ content: "❌ Essa aposta não é com você!", flags: 64 });
      if (interaction.customId === "aposta_recusar") {
        delete apostas[interaction.message.id];
        return interaction.update({ content: `❌ <@${aposta.desafiado}> recusou a aposta!`, embeds: [], components: [] });
      }
      const pD  = getPerfil(aposta.desafiante);
      const pDo = getPerfil(aposta.desafiado);
      if (pD.saldo < aposta.valor)  { delete apostas[interaction.message.id]; return interaction.update({ content: `❌ <@${aposta.desafiante}> não tem mais ZéCoins!`, embeds: [], components: [] }); }
      if (pDo.saldo < aposta.valor) { delete apostas[interaction.message.id]; return interaction.update({ content: `❌ Você não tem ZéCoins suficientes!`, embeds: [], components: [] }); }
      const resultado  = Math.random() < 0.5 ? "cara" : "coroa";
      const vencedorId = resultado === "cara" ? aposta.desafiante : aposta.desafiado;
      const perdedorId = resultado === "cara" ? aposta.desafiado  : aposta.desafiante;
      getPerfil(vencedorId).saldo += aposta.valor;
      getPerfil(perdedorId).saldo -= aposta.valor;
      delete apostas[interaction.message.id];
      return interaction.update({
        content: "",
        embeds: [new EmbedBuilder().setTitle("🪙 Resultado da Aposta!").setColor("Gold")
          .addFields({ name: "Resultado", value: resultado === "cara" ? "🟡 CARA" : "⚪ COROA" }, { name: "🏆 Vencedor", value: `<@${vencedorId}> ganhou **${aposta.valor} ZéCoins**!` }, { name: "💸 Perdedor", value: `<@${perdedorId}> perdeu **${aposta.valor} ZéCoins**` })
          .setTimestamp()],
        components: [],
      });
    }
    return;
  }

  // ---- MODALS ----
  if (interaction.isModalSubmit()) {
    if (interaction.customId === "modal_avaliacao_staff") {
      const staffName = interaction.fields.getTextInputValue("staff_name_input");
      const comment   = interaction.fields.getTextInputValue("comment_input");
      const rating    = parseInt(interaction.fields.getTextInputValue("rating_input"));

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

        // Verifica cooldown e dá recompensa se possível
        const agora = Date.now();
        const ultima = ultimaAvaliacao[interaction.user.id] || 0;
        let ganhouCoins = false;
        if (agora - ultima >= COOLDOWN_AVALIACAO) {
          const perfil = getPerfil(interaction.user.id);
          perfil.saldo += 200;
          ultimaAvaliacao[interaction.user.id] = agora;
          ganhouCoins = true;
        }

        const mensagem = ganhouCoins
          ? `✅ Sua avaliação foi enviada com sucesso! Você ganhou **200 ZéCoins** pela sua participação.`
          : `✅ Sua avaliação foi enviada com sucesso! (Recompensa não concedida pois você já avaliou nas últimas 24h.)`;

        await interaction.reply({ content: mensagem, ephemeral: true });
      } else {
        await interaction.reply({ content: "❌ Não foi possível encontrar o canal de logs de avaliação. Por favor, contate um administrador.", ephemeral: true });
      }
      return;
    }
  }

  // ---- SELECT MENU ----
  if (interaction.isStringSelectMenu()) {
    if (interaction.customId === "ticket_categoria") {
      const categoria = interaction.values[0];
      const userId    = interaction.user.id;
      const guild     = interaction.guild;
      const ticketExistente = Object.values(tickets).find((t) => t.userId === userId);
      if (ticketExistente) return interaction.reply({ content: "❌ Você já tem um ticket aberto!", flags: 64 });
      await interaction.deferReply({ flags: 64 });
      const nomes = { duvida_script: "📜 Dúvida Script", duvida_executor: "⚙️ Dúvida Executor", outros: "💬 Outros" };
      const nomeCategoria = nomes[categoria] || categoria;
      const nomeCanal     = `ticket-${interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
      try {
        const canalTicket = await guild.channels.create({
          name: nomeCanal, type: ChannelType.GuildText, parent: CATEGORIA_TICKETS_ID,
          permissionOverwrites: [
            { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
            { id: userId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
            { id: CARGO_SUPORTE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
            { id: CARGO_STAFF_ID,   allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
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
        try { await interaction.message.edit({ components: [interaction.message.components[0]] }); } catch {}
        await interaction.editReply(`✅ Ticket aberto! Acesse: ${canalTicket}`);
        setTimeout(() => enviarPainelTicket(guild), 3000);
      } catch (err) {
        console.error("[ERRO TICKET]", err.message);
        await interaction.editReply("❌ Erro ao criar o ticket. Avisa um admin!");
      }
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  // ---- /say ----
  if (interaction.commandName === "say") {
    if (!temCargoMod(interaction.member)) return interaction.reply({ content: "❌ Sem permissão.", flags: 64 });
    const texto = interaction.options.getString("mensagem");
    const canal = interaction.options.getChannel("canal") || interaction.channel;
    await canal.send(texto);
    await interaction.reply({ content: "✅ Enviado!", flags: 64 });
  }

  // ---- /avatar ----
  if (interaction.commandName === "avatar") {
    const user = interaction.options.getUser("usuario") || interaction.user;
    await interaction.reply({ embeds: [new EmbedBuilder().setTitle(`Avatar de ${user.username}`).setImage(user.displayAvatarURL({ size: 1024, extension: "png" })).setColor("Blue")] });
  }

  // ---- /video ----
  if (interaction.commandName === "video") {
    if (!temCargoMod(interaction.member)) return interaction.reply({ content: "❌ Sem permissão.", flags: 64 });
    const link   = interaction.options.getString("link");
    const canal  = interaction.options.getChannel("canal");
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

  // ---- /diario ----
  if (interaction.commandName === "diario") {
    const perfil = getPerfil(interaction.user.id);
    const agora  = Date.now();
    const cd     = 24 * 60 * 60 * 1000;
    if (agora - perfil.ultimoDiario < cd) return interaction.reply({ content: `⏳ Volte em **${formatarTempo(cd - (agora - perfil.ultimoDiario))}**.`, flags: 64 });
    const r = Math.floor(Math.random() * 51) + 50;
    perfil.saldo += r; perfil.ultimoDiario = agora;
    await interaction.reply(`💰 ${interaction.user} resgatou **${r} ZéCoins**! Saldo: **${perfil.saldo}**`);
  }

  // ---- /trabalhar ----
  if (interaction.commandName === "trabalhar") {
    const perfil = getPerfil(interaction.user.id);
    const agora  = Date.now();
    const cd     = 60 * 60 * 1000;
    if (agora - perfil.ultimoTrabalho < cd) return interaction.reply({ content: `⏳ Volte em **${formatarTempo(cd - (agora - perfil.ultimoTrabalho))}**.`, flags: 64 });
    const trabalhos = ["entregou pizza e ganhou", "consertou um computador e faturou", "vendeu um script raro e lucrou", "ajudou um streamer e recebeu", "fez um frila de design e cobrou"];
    const trabalho = trabalhos[Math.floor(Math.random() * trabalhos.length)];
    const ganho = Math.floor(Math.random() * 26) + 15;
    perfil.saldo += ganho; perfil.ultimoTrabalho = agora;
    await interaction.reply(`💼 ${interaction.user} ${trabalho} **${ganho} ZéCoins**! Saldo: **${perfil.saldo}**`);
  }

  // ---- /carteira ----
  if (interaction.commandName === "carteira") {
    const user   = interaction.options.getUser("usuario") || interaction.user;
    const perfil = getPerfil(user.id);
    await interaction.reply({ embeds: [new EmbedBuilder().setTitle(`💰 Carteira de ${user.username}`).setDescription(`Saldo: **${perfil.saldo} ZéCoins**`).setColor("Gold").setThumbnail(user.displayAvatarURL())] });
  }

  // ---- /loja ----
  if (interaction.commandName === "loja") {
    await interaction.reply({ embeds: [new EmbedBuilder().setTitle("🛒 Loja ZéCoins").setColor("Purple")
      .setDescription(LOJA.map((i) => `**${i.nome}** — \`${i.preco} ZéCoins\`\nID: \`${i.id}\`${i.descricao ? `\n*${i.descricao}*` : ""}`).join("\n\n"))
      .setFooter({ text: "Use /comprar item:ID para comprar" })] });
  }

  // ---- /comprar ----
  if (interaction.commandName === "comprar") {
    const itemId = interaction.options.getString("item");
    const item   = LOJA.find((i) => i.id === itemId);
    if (!item) return interaction.reply({ content: "❌ Item não encontrado.", flags: 64 });
    const perfil = getPerfil(interaction.user.id);
    if (perfil.saldo < item.preco) return interaction.reply({ content: `❌ Saldo insuficiente! Você tem **${perfil.saldo}** e precisa de **${item.preco}**.`, flags: 64 });
    perfil.saldo -= item.preco;
    if (item.tipo === "cargo") {
      try {
        await interaction.member.roles.add(item.roleId);
        await interaction.reply(`✅ Você comprou **${item.nome}**! Cargo adicionado.`);
      } catch { perfil.saldo += item.preco; await interaction.reply({ content: "❌ Erro ao adicionar o cargo.", flags: 64 }); }
    } else {
      const inv = getInventario(interaction.user.id);
      inv[item.id] = (inv[item.id] || 0) + 1;
      await interaction.reply(`✅ Você comprou **${item.nome}**! Use \`/usar item:${item.id}\``);
    }
  }

  // ---- /inventario ----
  if (interaction.commandName === "inventario") {
    const inv   = getInventario(interaction.user.id);
    const itens = Object.entries(inv).filter(([, q]) => q > 0);
    if (!itens.length) return interaction.reply({ content: "🎒 Inventário vazio!", flags: 64 });
    const linhas = itens.map(([id, q]) => `${LOJA.find((i) => i.id === id)?.nome || id} — **${q}x**`);
    await interaction.reply({ embeds: [new EmbedBuilder().setTitle(`🎒 Inventário de ${interaction.user.username}`).setDescription(linhas.join("\n")).setColor("Blue")] });
  }

  // ---- /usar ----
  if (interaction.commandName === "usar") {
    const itemId  = interaction.options.getString("item");
    const alvo    = interaction.options.getUser("usuario");
    const novoApe = interaction.options.getString("novo-apelido");
    const inv     = getInventario(interaction.user.id);
    if (!inv[itemId] || inv[itemId] <= 0) return interaction.reply({ content: "❌ Você não tem esse item!", flags: 64 });

    if (itemId === "silenciador") {
      if (!alvo) return interaction.reply({ content: "❌ Menciona um usuário!", flags: 64 });
      const membro = await interaction.guild.members.fetch(alvo.id).catch(() => null);
      if (!membro) return interaction.reply({ content: "❌ Usuário não encontrado.", flags: 64 });
      try {
        await membro.timeout(5 * 60 * 1000); inv[itemId]--;
        await interaction.reply(`🔇 **${interaction.user}** usou Silenciador em **${alvo}**!`);
        await enviarLogMod(interaction.guild, new EmbedBuilder().setTitle("🔇 Silenciador Usado").setColor("Orange").addFields({ name: "Usado por", value: interaction.user.tag }, { name: "Alvo", value: alvo.tag }).setTimestamp());
      } catch { await interaction.reply({ content: "❌ Não consegui mutar!", flags: 64 }); }
    } else if (itemId === "apelido") {
      if (!alvo || !novoApe) return interaction.reply({ content: "❌ Use: `/usar item:apelido usuario:@fulano novo-apelido:Nome`", flags: 64 });
      const membro = await interaction.guild.members.fetch(alvo.id).catch(() => null);
      if (!membro) return interaction.reply({ content: "❌ Usuário não encontrado.", flags: 64 });
      const antigo = membro.nickname || membro.user.username;
      try {
        await membro.setNickname(novoApe); inv[itemId]--;
        await interaction.reply(`🏷️ **${interaction.user}** mudou apelido de **${alvo}** para **${novoApe}** por 1h!`);
        setTimeout(async () => { try { await membro.setNickname(antigo === membro.user.username ? null : antigo); } catch {} }, 60 * 60 * 1000);
        await enviarLogMod(interaction.guild, new EmbedBuilder().setTitle("🏷️ Apelido Alterado").setColor("Blue").addFields({ name: "Usado por", value: interaction.user.tag }, { name: "Alvo", value: alvo.tag }, { name: "Antigo", value: antigo }, { name: "Novo", value: novoApe }).setTimestamp());
      } catch { await interaction.reply({ content: "❌ Não consegui mudar o apelido!", flags: 64 }); }
    } else if (itemId === "ficha_roblox") {
      await interaction.reply({ content: "🎟️ Para usar sua ficha, abra um ticket e informe à staff o serviço desejado!", flags: 64 });
    } else if (itemId === "caixa") {
      const premios = [{ valor: 100, chance: 40, label: "😐 Sorte fraca" }, { valor: 500, chance: 30, label: "🙂 Sorte boa" }, { valor: 1000, chance: 15, label: "😄 Boa sorte!" }, { valor: 3000, chance: 10, label: "🤩 Muita sorte!" }, { valor: 10000, chance: 5, label: "🤑 JACKPOT!" }];
      let ac = 0, premio = premios[0];
      const s = Math.random() * 100;
      for (const p of premios) { ac += p.chance; if (s <= ac) { premio = p; break; } }
      getPerfil(interaction.user.id).saldo += premio.valor; inv[itemId]--;
      await interaction.reply({ embeds: [new EmbedBuilder().setTitle("🎁 Caixa Misteriosa!").setColor("Gold").setDescription(`${premio.label}\n\n${interaction.user} ganhou **${premio.valor} ZéCoins**!`).setTimestamp()] });
    } else { await interaction.reply({ content: "❌ Item não pode ser usado assim.", flags: 64 }); }
  }

  // ---- /rank ----
  if (interaction.commandName === "rank") {
    const ranking = Object.entries(economia).sort(([, a], [, b]) => b.saldo - a.saldo).slice(0, 10);
    if (!ranking.length) return interaction.reply("Ninguém tem ZéCoins ainda!");
    const linhas = await Promise.all(ranking.map(async ([uid, d], i) => {
      const u = await client.users.fetch(uid).catch(() => null);
      return `${["🥇","🥈","🥉"][i] || `${i+1}º`} **${u?.username || "Desconhecido"}** — ${d.saldo} ZéCoins`;
    }));
    await interaction.reply({ embeds: [new EmbedBuilder().setTitle("🏆 Ranking ZéCoins").setDescription(linhas.join("\n")).setColor("Gold")] });
  }

  // ---- /transferir ----
  if (interaction.commandName === "transferir") {
    const alvo  = interaction.options.getUser("usuario");
    const valor = interaction.options.getInteger("valor");
    if (alvo.id === interaction.user.id) return interaction.reply({ content: "❌ Você não pode transferir para si mesmo!", flags: 64 });
    if (alvo.bot) return interaction.reply({ content: "❌ Não pode transferir para um bot!", flags: 64 });
    if (valor <= 0) return interaction.reply({ content: "❌ Valor precisa ser maior que 0!", flags: 64 });
    const perfilRemetente = getPerfil(interaction.user.id);
    const taxa = Math.floor(valor * TAXA_TRANSFERENCIA);
    const valorLiquido = valor - taxa;
    if (perfilRemetente.saldo < valor) return interaction.reply({ content: `❌ Saldo insuficiente! Você tem **${perfilRemetente.saldo}** e precisa de **${valor}** (incluindo taxa de ${taxa}).`, flags: 64 });
    perfilRemetente.saldo -= valor;
    getPerfil(alvo.id).saldo += valorLiquido;
    await interaction.reply({ embeds: [new EmbedBuilder().setTitle("💸 Transferência Realizada!").setColor("Green")
      .addFields({ name: "De", value: `${interaction.user}` }, { name: "Para", value: `${alvo}` }, { name: "Valor", value: `${valor} ZéCoins` }, { name: "Taxa (5%)", value: `${taxa} ZéCoins` }, { name: "Recebido", value: `${valorLiquido} ZéCoins` })
      .setTimestamp()] });
  }

  // ---- /dar-moedas ----
  if (interaction.commandName === "dar-moedas") {
    if (!temCargoMod(interaction.member)) return interaction.reply({ content: "❌ Sem permissão.", flags: 64 });
    const user = interaction.options.getUser("usuario");
    const qtd  = interaction.options.getInteger("quantidade");
    const p    = getPerfil(user.id);
    p.saldo += qtd;
    await interaction.reply(`✅ ${user} recebeu **${qtd} ZéCoins**! Saldo: **${p.saldo}**`);
  }

  // ---- /apostar ----
  if (interaction.commandName === "apostar") {
    const desafiado = interaction.options.getUser("usuario");
    const valor     = interaction.options.getInteger("valor");
    if (desafiado.id === interaction.user.id) return interaction.reply({ content: "❌ Não pode apostar contra si mesmo!", flags: 64 });
    if (desafiado.bot) return interaction.reply({ content: "❌ Não pode apostar contra um bot!", flags: 64 });
    if (valor <= 0) return interaction.reply({ content: "❌ Valor precisa ser maior que 0!", flags: 64 });
    const pD = getPerfil(interaction.user.id);
    if (pD.saldo < valor) return interaction.reply({ content: `❌ Saldo insuficiente! Você tem **${pD.saldo}**.`, flags: 64 });
    const embed = new EmbedBuilder().setTitle("🎲 Desafio de Aposta!").setColor("Gold")
      .setDescription(`${interaction.user} desafiou ${desafiado} para uma aposta de **${valor} ZéCoins**!\n\n🪙 Decidido por **cara ou coroa**.\n${desafiado}, você aceita?`)
      .setFooter({ text: "A aposta expira em 60 segundos" }).setTimestamp();
    const msg = await interaction.reply({ content: `${desafiado}`, embeds: [embed], fetchReply: true, components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("aposta_aceitar").setLabel("✅ Aceitar").setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId("aposta_recusar").setLabel("❌ Recusar").setStyle(ButtonStyle.Danger))] });
    apostas[msg.id] = { desafiante: interaction.user.id, desafiado: desafiado.id, valor };
    setTimeout(async () => { if (apostas[msg.id]) { delete apostas[msg.id]; try { await msg.edit({ content: "⏰ A aposta expirou!", embeds: [], components: [] }); } catch {} } }, 60000);
  }

  // ---- /avaliar ----
  if (interaction.commandName === "avaliar") {
    // Verifica cooldown antes de abrir as opções de avaliação
    const agora = Date.now();
    const ultima = ultimaAvaliacao[interaction.user.id] || 0;
    if (agora - ultima < COOLDOWN_AVALIACAO) {
      const tempoRestante = COOLDOWN_AVALIACAO - (agora - ultima);
      return interaction.reply({
        content: `⏳ Você já avaliou recentemente! Aguarde **${formatarTempo(tempoRestante)}** para avaliar novamente e ganhar mais ZéCoins.`,
        flags: 64
      });
    }

    const staff = interaction.options.getUser("staff");
    if (staff.id === interaction.user.id) return interaction.reply({ content: "❌ Você não pode se avaliar!", flags: 64 });
    if (staff.bot) return interaction.reply({ content: "❌ Não pode avaliar um bot!", flags: 64 });
    const embed = new EmbedBuilder()
      .setTitle("⭐ Avaliar Staff").setColor("Gold")
      .setDescription(`Você está avaliando **${staff.username}** pelo atendimento no chat.\n\nClique em uma estrela abaixo:\n\n🌟 **Você ganha 200 ZéCoins por avaliar!** (a cada 24h)`)
      .setThumbnail(staff.displayAvatarURL())
      .setFooter({ text: "A avaliação será enviada no canal de avaliações" });
    const botoes = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`avaliacao_chat_1_${staff.id}`).setLabel("⭐").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`avaliacao_chat_2_${staff.id}`).setLabel("⭐⭐").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`avaliacao_chat_3_${staff.id}`).setLabel("⭐⭐⭐").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`avaliacao_chat_4_${staff.id}`).setLabel("⭐⭐⭐⭐").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`avaliacao_chat_5_${staff.id}`).setLabel("⭐⭐⭐⭐⭐").setStyle(ButtonStyle.Success),
    );
    await interaction.reply({ embeds: [embed], components: [botoes], flags: 64 });
  }

  // ---- /ofuscar ----
  if (interaction.commandName === "ofuscar") {
    const codigo = interaction.options.getString("codigo");

    if (codigo.length > 4000) {
      return interaction.reply({ content: "❌ Código muito grande! Máximo de 4000 caracteres.", flags: 64 });
    }

    await interaction.deferReply({ flags: 64 });

    try {
      const ofuscado = ofuscarLuau(codigo);

      const buffer = Buffer.from(ofuscado, "utf-8");

      const embed = new EmbedBuilder()
        .setTitle("🔒 Código Ofuscado!")
        .setColor("Green")
        .setDescription(
          `Seu script Luau foi ofuscado com sucesso!\n\n` +
          `**Técnicas aplicadas:**\n` +
          `• Codificação em Base64\n` +
          `• Variáveis renomeadas aleatoriamente\n` +
          `• Código lixo inserido\n` +
          `• Strings fragmentadas em chunks\n\n` +
          `⚠️ Baixe o arquivo abaixo com seu código protegido.`
        )
        .setFooter({ text: "Scripts SDZ • Ofuscador Luau" })
        .setTimestamp();

      await interaction.editReply({
        embeds: [embed],
        files: [{ attachment: buffer, name: "script_ofuscado.lua" }],
      });
    } catch (err) {
      console.error("[ERRO OFUSCADOR]", err.message);
      await interaction.editReply("❌ Erro ao ofuscar o código. Verifique se é um script Luau válido.");
    }
  }

  // ---- /ficha ----
  if (interaction.commandName === "ficha") {
    await interaction.reply({ embeds: [new EmbedBuilder()
      .setTitle("🎟️ Ficha de Serviço Roblox").setColor("Aqua")
      .setDescription("As Fichas de Serviço Roblox são itens especiais que permitem solicitar serviços de upar contas em jogos Roblox.\n\n**Como obter:**\nCompre na loja por **15.000 ZéCoins** usando `/comprar item:ficha_roblox`.\n\n**Como usar:**\nApós adquirir sua ficha, abra um ticket e informe à nossa equipe qual serviço você deseja. A staff fará a retirada da ficha do seu inventário para iniciar o serviço.")
      .setFooter({ text: "Adquira já sua ficha e turbine sua conta Roblox!" })], flags: 64 });
  }

  // ---- /retirar-ficha ----
  if (interaction.commandName === "retirar-ficha") {
    if (!temCargoMod(interaction.member)) return interaction.reply({ content: "❌ Sem permissão.", flags: 64 });
    const user       = interaction.options.getUser("usuario");
    const quantidade = interaction.options.getInteger("quantidade") || 1;
    const inv        = getInventario(user.id);
    if (!inv["ficha_roblox"] || inv["ficha_roblox"] < quantidade) {
      return interaction.reply({ content: `❌ ${user.username} não possui ${quantidade} Ficha(s) de Serviço Roblox.`, flags: 64 });
    }
    inv["ficha_roblox"] -= quantidade;
    await interaction.reply(`✅ ${quantidade} Ficha(s) retirada(s) do inventário de **${user.username}**.`);
    await enviarLogMod(interaction.guild, new EmbedBuilder().setTitle("🎟️ Ficha Retirada").setColor("Red")
      .addFields({ name: "Staff", value: interaction.user.tag }, { name: "Usuário", value: user.tag }, { name: "Quantidade", value: `${quantidade}` }).setTimestamp());
  }

  // ---- /lockdown ----
  if (interaction.commandName === "lockdown") {
    if (!temCargoMod(interaction.member)) return interaction.reply({ content: "❌ Sem permissão.", flags: 64 });
    const motivo  = interaction.options.getString("motivo") || "Sem motivo especificado";
    await interaction.deferReply({ flags: 64 });
    const canais  = await interaction.guild.channels.fetch();
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

  // ---- /unlockdown ----
  if (interaction.commandName === "unlockdown") {
    if (!temCargoMod(interaction.member)) return interaction.reply({ content: "❌ Sem permissão.", flags: 64 });
    await interaction.deferReply({ flags: 64 });
    const canais  = await interaction.guild.channels.fetch();
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

  // ---- /esconder-canal ----
  if (interaction.commandName === "esconder-canal") {
    if (!temCargoMod(interaction.member)) return interaction.reply({ content: "❌ Sem permissão.", flags: 64 });
    try {
      await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { ViewChannel: false });
      await interaction.reply({ content: `✅ Canal escondido!`, flags: 64 });
      await enviarLogMod(interaction.guild, new EmbedBuilder().setTitle("🙈 Canal Escondido").setColor("Grey").addFields({ name: "Admin", value: interaction.user.tag }, { name: "Canal", value: interaction.channel.name }).setTimestamp());
    } catch { await interaction.reply({ content: "❌ Não consegui esconder.", flags: 64 }); }
  }

  // ---- /mostrar-canal ----
  if (interaction.commandName === "mostrar-canal") {
    if (!temCargoMod(interaction.member)) return interaction.reply({ content: "❌ Sem permissão.", flags: 64 });
    try {
      await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { ViewChannel: true, SendMessages: true });
      await interaction.reply({ content: `✅ Canal visível!`, flags: 64 });
      await enviarLogMod(interaction.guild, new EmbedBuilder().setTitle("👁️ Canal Revelado").setColor("Green").addFields({ name: "Admin", value: interaction.user.tag }, { name: "Canal", value: interaction.channel.name }).setTimestamp());
    } catch { await interaction.reply({ content: "❌ Não consegui mostrar.", flags: 64 }); }
  }

  // ---- /lock ----
  if (interaction.commandName === "lock") {
    if (!temCargoMod(interaction.member)) return interaction.reply({ content: "❌ Sem permissão.", flags: 64 });
    const motivo = interaction.options.getString("motivo") || "Sem motivo";
    try {
      await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: false });
      await interaction.reply(`🔒 Canal bloqueado! **Motivo:** ${motivo}`);
      await enviarLogMod(interaction.guild, new EmbedBuilder().setTitle("🔒 Canal Bloqueado").setColor("Red").addFields({ name: "Admin", value: interaction.user.tag }, { name: "Canal", value: interaction.channel.name }, { name: "Motivo", value: motivo }).setTimestamp());
    } catch { await interaction.reply({ content: "❌ Não consegui bloquear.", flags: 64 }); }
  }

  // ---- /unlock ----
  if (interaction.commandName === "unlock") {
    if (!temCargoMod(interaction.member)) return interaction.reply({ content: "❌ Sem permissão.", flags: 64 });
    try {
      await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: true });
      await interaction.reply(`🔓 Canal desbloqueado!`);
      await enviarLogMod(interaction.guild, new EmbedBuilder().setTitle("🔓 Canal Desbloqueado").setColor("Green").addFields({ name: "Admin", value: interaction.user.tag }, { name: "Canal", value: interaction.channel.name }).setTimestamp());
    } catch { await interaction.reply({ content: "❌ Não consegui desbloquear.", flags: 64 }); }
  }

  // ---- /slowmode ----
  if (interaction.commandName === "slowmode") {
    if (!temCargoMod(interaction.member)) return interaction.reply({ content: "❌ Sem permissão.", flags: 64 });
    const segundos = interaction.options.getInteger("segundos");
    try {
      await interaction.channel.setRateLimitPerUser(segundos);
      await interaction.reply(segundos === 0 ? `✅ Modo lento desativado!` : `🐢 Modo lento: **${segundos} segundos** entre mensagens.`);
    } catch { await interaction.reply({ content: "❌ Não consegui ativar modo lento.", flags: 64 }); }
  }

  // ---- /painel-ticket ----
  if (interaction.commandName === "painel-ticket") {
    if (!temCargoMod(interaction.member)) return interaction.reply({ content: "❌ Sem permissão.", flags: 64 });
    await enviarPainelTicket(interaction.guild);
    await interaction.reply({ content: "✅ Painel de ticket enviado!", flags: 64 });
  }

  // ---- /painel-avaliacao ----
  if (interaction.commandName === "painel-avaliacao") {
    if (!temCargoMod(interaction.member)) return interaction.reply({ content: "❌ Sem permissão.", flags: 64 });
    await enviarPainelAvaliacao(interaction.guild);
    await interaction.reply({ content: "✅ Painel de avaliação enviado!", flags: 64 });
  }

  // ---- /fechar-ticket ----
  if (interaction.commandName === "fechar-ticket") {
    if (!temCargoMod(interaction.member)) return interaction.reply({ content: "❌ Só staff pode fechar tickets!", flags: 64 });
    const ticket = tickets[interaction.channel.id];
    if (!ticket) return interaction.reply({ content: "❌ Esse não é um canal de ticket!", flags: 64 });
    await interaction.deferReply();
    const mensagens  = await interaction.channel.messages.fetch({ limit: 100 });
    const transcript = mensagens.reverse().map((m) => `[${new Date(m.createdTimestamp).toLocaleString("pt-BR")}] ${m.author.tag}: ${m.content || "[anexo/embed]"}`).join("\n");
    await enviarLogTicket(interaction.guild, new EmbedBuilder().setTitle("📋 Ticket Fechado").setColor("Red")
      .addFields({ name: "Canal", value: interaction.channel.name }, { name: "Usuário", value: `<@${ticket.userId}>` }, { name: "Categoria", value: ticket.categoria }, { name: "Atendente", value: ticket.staffTag || "Não reivindicado" }, { name: "Fechado por", value: interaction.user.tag })
      .setTimestamp(), [{ attachment: Buffer.from(transcript, "utf-8"), name: `transcript-${interaction.channel.name}.txt` }]);
    const usuario = await client.users.fetch(ticket.userId).catch(() => null);
    if (usuario) await enviarAvaliacaoDM(usuario, ticket.staffTag || "Não identificado", ticket.categoria, interaction.guild);
    await interaction.editReply("✅ Ticket fechado! Canal será deletado em 5 segundos...");
    delete tickets[interaction.channel.id];
    setTimeout(async () => { try { await interaction.channel.delete(); } catch {} }, 5000);
  }
});

client.login(TOKEN);