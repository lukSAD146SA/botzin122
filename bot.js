const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

const TOKEN              = process.env.TOKEN;
const GUILD_ID           = "1508302017980924064";
const MUTE_MS            = 5 * 60 * 1000;
const CANAL_SUGESTOES_ID = "1511518813701804062";
const CANAL_LOGS_ID      = "1510353328821764289";
const CANAL_AVISO_ID     = "1508390560795197500";

const economia    = {};
const apostas     = {};
const inventarios = {};

const CARGOS_ISENTOS = ["1509304131263926292", "1508405150572871720"];

// ============================================================
// LOJA
// ============================================================
const LOJA = [
  {
    id: "vip",
    nome: "🌟 Cargo VIP",
    preco: 500,
    roleId: "1521544208073228528",
    tipo: "cargo",
  },
  {
    id: "silenciador",
    nome: "🔇 Silenciador",
    preco: 5000,
    tipo: "item",
    descricao: "Muta alguém por 5 minutos. Use: /usar item:silenciador",
  },
  {
    id: "apelido",
    nome: "🏷️ Apelido",
    preco: 1000,
    tipo: "item",
    descricao: "Muda o apelido de alguém por 1h. Use: /usar item:apelido",
  },
  {
    id: "caixa",
    nome: "🎁 Caixa Misteriosa",
    preco: 5000,
    tipo: "item",
    descricao: "Ganhe entre 100 e 10.000 ZéCoins. Use: /usar item:caixa",
  },
];

// ============================================================
// FUNÇÕES AUXILIARES
// ============================================================
function getPerfil(userId) {
  if (!economia[userId]) {
    economia[userId] = { saldo: 0, ultimoDiario: 0, ultimoTrabalho: 0 };
  }
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

async function enviarLog(guild, embed) {
  try {
    const canal = await guild.channels.fetch(CANAL_LOGS_ID);
    if (canal) await canal.send({ embeds: [embed] });
  } catch (err) {
    console.error("[ERRO LOG]", err.message);
  }
}

// ============================================================
// PALAVRÕES
// ============================================================
const PALAVROES = [
  "foda", "fodas", "fodasse", "fodase", "fudeu", "fudendo", "fudido",
  "foder", "fodam", "fodao", "fodão", "foda-se",
  "vai se foder", "vai foder",
  "merda", "merdinha", "merdao", "merdão",
  "puta", "puto", "putinha", "putão", "putaria",
  "fdp", "filhadaputa", "filhodaputa",
  "filha da puta", "filho da puta",
  "filha de puta", "filho de puta",
  "caralho", "carai", "crl",
  "porra", "porrinha", "porrada",
  "cuzao", "cuzão", "cuzinho", "cuzona",
  "tomar no cu", "vai tomar no cu", "vtc",
  "buceta", "bct", "bucetinha", "bucetao", "bucetão",
  "viado", "viadinho", "viadao", "viadão", "viadagem",
  "corno", "corna", "cornao", "cornão",
  "arrombado", "arrombada", "arrombao", "arrombão",
  "idiota", "imbecil",
  "otario", "otário", "otarinho",
  "babaca", "babaquice",
  "safado", "safada", "safadao", "safadão", "safadinha",
  "vagabundo", "vagabunda", "vagabundao", "vagabundão",
  "bosta", "bostinha", "bostao", "bostão",
  "cagando", "cagar", "cagou", "cagão", "caguei", "cagada",
  "piranha", "piranhao", "piranhão",
  "piroca", "pirocao", "pirocão",
  "rolinha", "rolao", "rolão",
  "cacete", "cacetao", "cacetão",
  "punheta", "punhetao", "punhetão", "punheteiro",
  "broxa", "broxou", "broxar", "broxada",
  "desgraça", "desgraçado", "desgracado", "desgraçada",
  "escroto", "escrota", "escrotao", "escrotão",
  "retardado", "retardada", "retardadao", "retardadão",
  "cretino", "cretina", "cretinagem",
  "pqp", "vsf", "tmnc", "tnc", "kct", "vtmc",
  "sua mae", "sua mãe", "sua vó", "sua vo",
  "vai a merda", "vai se ferrar",
  "nazista", "nazismo", "racista", "racismo",
  "fascista", "fascismo", "terrorista",
  "lazarento", "prostituta",
  "nojento", "nojenta",
  "escoria", "escória",
];

const PALAVROES_EXATAS = [
  "cu", "lixo", "burro", "burra", "anta", "pinto",
  "rola", "merd", "porr", "bct", "inutil", "inútil",
  "macaco", "macaca", "hitler", "nazi",
];

function buildPattern(word) {
  return word.split("").map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "+").join("");
}

const PADROES        = PALAVROES.map((p) => new RegExp(buildPattern(p), "gi"));
const PADROES_EXATOS = PALAVROES_EXATAS.map((p) => new RegExp(`\\b${buildPattern(p)}\\b`, "gi"));

function contemPalavrão(texto) {
  return [...PADROES, ...PADROES_EXATOS].some((regex) => {
    regex.lastIndex = 0;
    return regex.test(texto);
  });
}

// ============================================================
// BOT PRONTO
// ============================================================
client.once("clientReady", async () => {
  console.log(`✅ Bot online como ${client.user.tag}`);

  const commands = [
    new SlashCommandBuilder()
      .setName("say")
      .setDescription("Faz o bot enviar uma mensagem")
      .addStringOption((opt) =>
        opt.setName("mensagem").setDescription("O que o bot vai dizer").setRequired(true)
      )
      .addChannelOption((opt) =>
        opt.setName("canal").setDescription("Canal de destino (padrão: atual)").setRequired(false)
      ),

    new SlashCommandBuilder()
      .setName("avatar")
      .setDescription("Mostra a foto de perfil de alguém em tamanho grande")
      .addUserOption((opt) =>
        opt.setName("usuario").setDescription("De quem ver o avatar").setRequired(false)
      ),

    new SlashCommandBuilder()
      .setName("video")
      .setDescription("Anuncia um vídeo novo do YouTube")
      .addStringOption((opt) =>
        opt.setName("link").setDescription("Link do vídeo do YouTube").setRequired(true)
      )
      .addChannelOption((opt) =>
        opt.setName("canal").setDescription("Canal onde anunciar").setRequired(true)
      )
      .addStringOption((opt) =>
        opt.setName("titulo").setDescription("Título personalizado (opcional)").setRequired(false)
      )
      .addStringOption((opt) =>
        opt.setName("imagem").setDescription("Link direto de imagem (opcional)").setRequired(false)
      ),

    new SlashCommandBuilder()
      .setName("diario")
      .setDescription("Resgata sua recompensa diária de ZéCoins"),

    new SlashCommandBuilder()
      .setName("trabalhar")
      .setDescription("Trabalhe para ganhar ZéCoins (a cada 1 hora)"),

    new SlashCommandBuilder()
      .setName("carteira")
      .setDescription("Veja seu saldo de ZéCoins")
      .addUserOption((opt) =>
        opt.setName("usuario").setDescription("Ver saldo de outra pessoa").setRequired(false)
      ),

    new SlashCommandBuilder()
      .setName("loja")
      .setDescription("Veja os itens disponíveis na loja"),

    new SlashCommandBuilder()
      .setName("comprar")
      .setDescription("Compra um item da loja")
      .addStringOption((opt) =>
        opt.setName("item").setDescription("ID do item (veja em /loja)").setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName("inventario")
      .setDescription("Veja seus itens comprados"),

    new SlashCommandBuilder()
      .setName("usar")
      .setDescription("Usa um item do seu inventário")
      .addStringOption((opt) =>
        opt.setName("item").setDescription("ID do item (silenciador, apelido, caixa)").setRequired(true)
      )
      .addUserOption((opt) =>
        opt.setName("usuario").setDescription("Alvo (necessário para silenciador e apelido)").setRequired(false)
      )
      .addStringOption((opt) =>
        opt.setName("novo-apelido").setDescription("Novo apelido (necessário para apelido)").setRequired(false)
      ),

    new SlashCommandBuilder()
      .setName("rank")
      .setDescription("Veja o ranking dos membros mais ricos"),

    new SlashCommandBuilder()
      .setName("dar-moedas")
      .setDescription("[ADMIN] Dá ZéCoins para alguém")
      .addUserOption((opt) =>
        opt.setName("usuario").setDescription("Quem vai receber").setRequired(true)
      )
      .addIntegerOption((opt) =>
        opt.setName("quantidade").setDescription("Quantas moedas dar").setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName("apostar")
      .setDescription("Desafia alguém para uma aposta de ZéCoins")
      .addUserOption((opt) =>
        opt.setName("usuario").setDescription("Quem você quer desafiar").setRequired(true)
      )
      .addIntegerOption((opt) =>
        opt.setName("valor").setDescription("Quantas ZéCoins apostar").setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName("lockdown")
      .setDescription("[ADMIN] Ativa ou desativa o lockdown do servidor")
      .addStringOption((opt) =>
        opt.setName("motivo").setDescription("Motivo do lockdown (opcional)").setRequired(false)
      ),

    new SlashCommandBuilder()
      .setName("esconder-canal")
      .setDescription("[ADMIN] Torna o canal invisível para membros comuns"),

    new SlashCommandBuilder()
      .setName("mostrar-canal")
      .setDescription("[ADMIN] Torna o canal visível novamente para membros comuns"),

    new SlashCommandBuilder()
      .setName("lock")
      .setDescription("[ADMIN] Bloqueia envio de mensagens no canal atual")
      .addStringOption((opt) =>
        opt.setName("motivo").setDescription("Motivo do lock (opcional)").setRequired(false)
      ),

    new SlashCommandBuilder()
      .setName("unlock")
      .setDescription("[ADMIN] Desbloqueia envio de mensagens no canal atual"),

    new SlashCommandBuilder()
      .setName("slowmode")
      .setDescription("[ADMIN] Ativa modo lento no canal")
      .addIntegerOption((opt) =>
        opt.setName("segundos").setDescription("Segundos entre mensagens (0 para desativar)").setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName("limpar")
      .setDescription("[ADMIN] Apaga mensagens do canal")
      .addIntegerOption((opt) =>
        opt.setName("quantidade").setDescription("Quantas mensagens apagar (máx 100)").setRequired(true)
      ),
  ].map((cmd) => cmd.toJSON());

  const rest = new REST({ version: "10" }).setToken(TOKEN);
  try {
    await rest.put(Routes.applicationGuildCommands(client.user.id, GUILD_ID), { body: commands });
    console.log("✅ Comandos registrados!");
  } catch (err) {
    console.error("[ERRO COMANDOS]", err.message);
  }
});

// ============================================================
// MENSAGENS
// ============================================================
client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.guild) return;

  if (message.channel.id === CANAL_SUGESTOES_ID) {
    try {
      await message.react("✅");
      await message.reply("Certo, iremos ver se conseguimos o mais rápido possível!");
    } catch (err) {
      console.error("[ERRO AUTO-CHECK]", err.message);
    }
    return;
  }

  if (!contemPalavrão(message.content)) return;

  const temCargoIsento = message.member.roles.cache.some((role) =>
    CARGOS_ISENTOS.includes(role.id)
  );
  if (temCargoIsento) return;

  const userId  = message.author.id;
  const msgText = message.content;

  try { await message.delete(); } catch {}

  try {
    await message.member.timeout(MUTE_MS, "Automod: linguagem inapropriada");
    await message.channel.send(
      `⚠️ ${message.author}, linguagem inapropriada! Você foi mutado por 5 minutos.`
    );
    console.log(`[MUTE] ${message.author.tag} mutado.`);

    const logEmbed = new EmbedBuilder()
      .setTitle("🔇 Mute Automático")
      .setColor("Orange")
      .addFields(
        { name: "Usuário",  value: `${message.author.tag} (\`${userId}\`)` },
        { name: "Canal",    value: `<#${message.channel.id}>` },
        { name: "Mensagem", value: `||${msgText.slice(0, 200)}||` },
        { name: "Duração",  value: "5 minutos" }
      )
      .setTimestamp();

    await enviarLog(message.guild, logEmbed);
  } catch (err) {
    console.error(`[ERRO MUTE] ${err.message}`);
  }
});

// ============================================================
// SLASH COMMANDS + BOTÕES
// ============================================================
client.on("interactionCreate", async (interaction) => {

  // ---- BOTÕES DA APOSTA ----
  if (interaction.isButton()) {
    const aposta = apostas[interaction.message.id];
    if (!aposta) return;

    if (interaction.user.id !== aposta.desafiado) {
      return interaction.reply({ content: "❌ Essa aposta não é com você!", ephemeral: true });
    }

    if (interaction.customId === "aposta_recusar") {
      delete apostas[interaction.message.id];
      await interaction.update({
        content: `❌ <@${aposta.desafiado}> recusou a aposta!`,
        embeds: [],
        components: [],
      });
      return;
    }

    if (interaction.customId === "aposta_aceitar") {
      const perfilDesafiante = getPerfil(aposta.desafiante);
      const perfilDesafiado  = getPerfil(aposta.desafiado);

      if (perfilDesafiante.saldo < aposta.valor) {
        delete apostas[interaction.message.id];
        return interaction.update({
          content: `❌ <@${aposta.desafiante}> não tem mais ZéCoins suficientes!`,
          embeds: [],
          components: [],
        });
      }

      if (perfilDesafiado.saldo < aposta.valor) {
        delete apostas[interaction.message.id];
        return interaction.update({
          content: `❌ Você não tem ZéCoins suficientes para aceitar!`,
          embeds: [],
          components: [],
        });
      }

      const resultado  = Math.random() < 0.5 ? "cara" : "coroa";
      const vencedorId = resultado === "cara" ? aposta.desafiante : aposta.desafiado;
      const perdedorId = resultado === "cara" ? aposta.desafiado  : aposta.desafiante;

      getPerfil(vencedorId).saldo += aposta.valor;
      getPerfil(perdedorId).saldo -= aposta.valor;

      delete apostas[interaction.message.id];

      const embed = new EmbedBuilder()
        .setTitle("🪙 Resultado da Aposta!")
        .setColor("Gold")
        .addFields(
          { name: "Resultado",   value: resultado === "cara" ? "🟡 CARA" : "⚪ COROA" },
          { name: "🏆 Vencedor", value: `<@${vencedorId}> ganhou **${aposta.valor} ZéCoins**!` },
          { name: "💸 Perdedor", value: `<@${perdedorId}> perdeu **${aposta.valor} ZéCoins**` },
        )
        .setTimestamp();

      await interaction.update({ content: "", embeds: [embed], components: [] });
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  // ---- /say ----
  if (interaction.commandName === "say") {
    if (!interaction.member.permissions.has("Administrator")) {
      return interaction.reply({ content: "❌ Sem permissão.", ephemeral: true });
    }
    const texto = interaction.options.getString("mensagem");
    const canal = interaction.options.getChannel("canal") || interaction.channel;
    await canal.send(texto);
    await interaction.reply({ content: "✅ Mensagem enviada!", ephemeral: true });
  }

  // ---- /avatar ----
  if (interaction.commandName === "avatar") {
    const user      = interaction.options.getUser("usuario") || interaction.user;
    const avatarUrl = user.displayAvatarURL({ size: 1024, extension: "png" });
    const embed = new EmbedBuilder()
      .setTitle(`Avatar de ${user.username}`)
      .setImage(avatarUrl)
      .setColor("Blue");
    await interaction.reply({ embeds: [embed] });
  }

  // ---- /video ----
  if (interaction.commandName === "video") {
    if (!interaction.member.permissions.has("Administrator")) {
      return interaction.reply({ content: "❌ Sem permissão.", ephemeral: true });
    }
    const link   = interaction.options.getString("link");
    const canal  = interaction.options.getChannel("canal");
    const titulo = interaction.options.getString("titulo");
    const imagem = interaction.options.getString("imagem");

    const videoIdMatch = link.match(/(?:youtu\.be\/|v=)([a-zA-Z0-9_-]{11})/);
    const thumbnailUrl = imagem || (videoIdMatch
      ? `https://img.youtube.com/vi/${videoIdMatch[1]}/maxresdefault.jpg`
      : null);

    const embed = new EmbedBuilder()
      .setTitle(`🔥 ${titulo || "VÍDEO NOVO"}`)
      .setDescription(`📌 **Assista agora:**\n[CLIQUE AQUI PARA VER O VÍDEO](${link})`)
      .setColor("Red")
      .setFooter({ text: `${interaction.guild.name} • Notificação Automática` })
      .setTimestamp();

    if (thumbnailUrl) embed.setImage(thumbnailUrl);
    await canal.send({ content: "🔔 **Fala galera, vídeo novo no canal!**", embeds: [embed] });
    await interaction.reply({ content: "✅ Anúncio enviado!", ephemeral: true });
  }

  // ---- /diario ----
  if (interaction.commandName === "diario") {
    const perfil   = getPerfil(interaction.user.id);
    const agora    = Date.now();
    const cooldown = 24 * 60 * 60 * 1000;

    if (agora - perfil.ultimoDiario < cooldown) {
      const restante = cooldown - (agora - perfil.ultimoDiario);
      return interaction.reply({
        content: `⏳ Você já resgatou hoje! Volte em **${formatarTempo(restante)}**.`,
        ephemeral: true,
      });
    }

    const recompensa = Math.floor(Math.random() * 51) + 50;
    perfil.saldo += recompensa;
    perfil.ultimoDiario = agora;

    await interaction.reply(
      `💰 ${interaction.user} resgatou **${recompensa} ZéCoins**! Saldo atual: **${perfil.saldo} ZéCoins**`
    );
  }

  // ---- /trabalhar ----
  if (interaction.commandName === "trabalhar") {
    const perfil   = getPerfil(interaction.user.id);
    const agora    = Date.now();
    const cooldown = 60 * 60 * 1000;

    if (agora - perfil.ultimoTrabalho < cooldown) {
      const restante = cooldown - (agora - perfil.ultimoTrabalho);
      return interaction.reply({
        content: `⏳ Você está cansado! Volte em **${formatarTempo(restante)}**.`,
        ephemeral: true,
      });
    }

    const trabalhos = [
      "entregou pizza e ganhou",
      "consertou um computador e faturou",
      "vendeu um script raro e lucrou",
      "ajudou um streamer e recebeu",
      "fez um frila de design e cobrou",
    ];

    const trabalho = trabalhos[Math.floor(Math.random() * trabalhos.length)];
    const ganho    = Math.floor(Math.random() * 26) + 15;
    perfil.saldo += ganho;
    perfil.ultimoTrabalho = agora;

    await interaction.reply(
      `💼 ${interaction.user} ${trabalho} **${ganho} ZéCoins**! Saldo atual: **${perfil.saldo} ZéCoins**`
    );
  }

  // ---- /carteira ----
  if (interaction.commandName === "carteira") {
    const user   = interaction.options.getUser("usuario") || interaction.user;
    const perfil = getPerfil(user.id);
    const embed  = new EmbedBuilder()
      .setTitle(`💰 Carteira de ${user.username}`)
      .setDescription(`Saldo: **${perfil.saldo} ZéCoins**`)
      .setColor("Gold")
      .setThumbnail(user.displayAvatarURL());
    await interaction.reply({ embeds: [embed] });
  }

  // ---- /loja ----
  if (interaction.commandName === "loja") {
    const embed = new EmbedBuilder()
      .setTitle("🛒 Loja ZéCoins")
      .setColor("Purple")
      .setDescription(
        LOJA.map((item) =>
          `**${item.nome}** — \`${item.preco} ZéCoins\`\nID: \`${item.id}\`${item.descricao ? `\n*${item.descricao}*` : ""}`
        ).join("\n\n")
      )
      .setFooter({ text: "Use /comprar item:ID para comprar" });
    await interaction.reply({ embeds: [embed] });
  }

  // ---- /comprar ----
  if (interaction.commandName === "comprar") {
    const itemId = interaction.options.getString("item");
    const item   = LOJA.find((i) => i.id === itemId);

    if (!item) {
      return interaction.reply({ content: "❌ Item não encontrado. Use `/loja` pra ver os IDs.", ephemeral: true });
    }

    const perfil = getPerfil(interaction.user.id);

    if (perfil.saldo < item.preco) {
      return interaction.reply({
        content: `❌ Saldo insuficiente! Você tem **${perfil.saldo}** e precisa de **${item.preco} ZéCoins**.`,
        ephemeral: true,
      });
    }

    perfil.saldo -= item.preco;

    if (item.tipo === "cargo") {
      try {
        await interaction.member.roles.add(item.roleId);
        await interaction.reply(`✅ Você comprou **${item.nome}**! Cargo adicionado.`);
      } catch (err) {
        perfil.saldo += item.preco;
        await interaction.reply({ content: "❌ Erro ao adicionar o cargo. Avisa um admin!", ephemeral: true });
      }
    } else {
      const inv = getInventario(interaction.user.id);
      inv[item.id] = (inv[item.id] || 0) + 1;
      await interaction.reply(`✅ Você comprou **${item.nome}**! Use \`/usar item:${item.id}\` para utilizar.`);
    }
  }

  // ---- /inventario ----
  if (interaction.commandName === "inventario") {
    const inv   = getInventario(interaction.user.id);
    const itens = Object.entries(inv).filter(([, qtd]) => qtd > 0);

    if (itens.length === 0) {
      return interaction.reply({ content: "🎒 Seu inventário está vazio!", ephemeral: true });
    }

    const linhas = itens.map(([id, qtd]) => {
      const item = LOJA.find((i) => i.id === id);
      return `${item ? item.nome : id} — **${qtd}x**`;
    });

    const embed = new EmbedBuilder()
      .setTitle(`🎒 Inventário de ${interaction.user.username}`)
      .setDescription(linhas.join("\n"))
      .setColor("Blue");

    await interaction.reply({ embeds: [embed] });
  }

  // ---- /usar ----
  if (interaction.commandName === "usar") {
    const itemId  = interaction.options.getString("item");
    const alvo    = interaction.options.getUser("usuario");
    const novoApe = interaction.options.getString("novo-apelido");
    const inv     = getInventario(interaction.user.id);

    if (!inv[itemId] || inv[itemId] <= 0) {
      return interaction.reply({ content: "❌ Você não tem esse item no inventário!", ephemeral: true });
    }

    if (itemId === "silenciador") {
      if (!alvo) return interaction.reply({ content: "❌ Menciona um usuário!", ephemeral: true });
      const membro = await interaction.guild.members.fetch(alvo.id).catch(() => null);
      if (!membro) return interaction.reply({ content: "❌ Usuário não encontrado.", ephemeral: true });

      try {
        await membro.timeout(5 * 60 * 1000, `Silenciador usado por ${interaction.user.tag}`);
        inv[itemId]--;
        await interaction.reply(`🔇 **${interaction.user}** usou um Silenciador em **${alvo}**! Mutado por 5 minutos.`);
        const logEmbed = new EmbedBuilder()
          .setTitle("🔇 Silenciador Usado").setColor("Orange")
          .addFields(
            { name: "Usado por", value: `${interaction.user.tag}` },
            { name: "Alvo",      value: `${alvo.tag}` },
            { name: "Duração",   value: "5 minutos" }
          ).setTimestamp();
        await enviarLog(interaction.guild, logEmbed);
      } catch {
        await interaction.reply({ content: "❌ Não consegui mutar esse usuário!", ephemeral: true });
      }
    }

    else if (itemId === "apelido") {
      if (!alvo || !novoApe) return interaction.reply({ content: "❌ Usa assim: `/usar item:apelido usuario:@fulano novo-apelido:Nome`", ephemeral: true });
      const membro = await interaction.guild.members.fetch(alvo.id).catch(() => null);
      if (!membro) return interaction.reply({ content: "❌ Usuário não encontrado.", ephemeral: true });

      const apelidoAntigo = membro.nickname || membro.user.username;
      try {
        await membro.setNickname(novoApe);
        inv[itemId]--;
        await interaction.reply(`🏷️ **${interaction.user}** mudou o apelido de **${alvo}** para **${novoApe}** por 1 hora!`);
        setTimeout(async () => {
          try { await membro.setNickname(apelidoAntigo === membro.user.username ? null : apelidoAntigo); } catch {}
        }, 60 * 60 * 1000);
        const logEmbed = new EmbedBuilder()
          .setTitle("🏷️ Apelido Alterado").setColor("Blue")
          .addFields(
            { name: "Usado por",      value: `${interaction.user.tag}` },
            { name: "Alvo",           value: `${alvo.tag}` },
            { name: "Apelido antigo", value: apelidoAntigo },
            { name: "Apelido novo",   value: novoApe },
            { name: "Duração",        value: "1 hora" }
          ).setTimestamp();
        await enviarLog(interaction.guild, logEmbed);
      } catch {
        await interaction.reply({ content: "❌ Não consegui mudar o apelido!", ephemeral: true });
      }
    }

    else if (itemId === "caixa") {
      const premios = [
        { valor: 100,   chance: 40, label: "😐 Sorte fraca" },
        { valor: 500,   chance: 30, label: "🙂 Sorte boa" },
        { valor: 1000,  chance: 15, label: "😄 Boa sorte!" },
        { valor: 3000,  chance: 10, label: "🤩 Muita sorte!" },
        { valor: 10000, chance: 5,  label: "🤑 JACKPOT!" },
      ];

      const sorteio = Math.random() * 100;
      let acumulado = 0;
      let premio = premios[0];
      for (const p of premios) {
        acumulado += p.chance;
        if (sorteio <= acumulado) { premio = p; break; }
      }

      getPerfil(interaction.user.id).saldo += premio.valor;
      inv[itemId]--;

      const embed = new EmbedBuilder()
        .setTitle("🎁 Caixa Misteriosa Aberta!")
        .setColor("Gold")
        .setDescription(`${premio.label}\n\n${interaction.user} ganhou **${premio.valor} ZéCoins**!`)
        .setTimestamp();
      await interaction.reply({ embeds: [embed] });
    }

    else {
      await interaction.reply({ content: "❌ Esse item não pode ser usado assim.", ephemeral: true });
    }
  }

  // ---- /rank ----
  if (interaction.commandName === "rank") {
    const ranking = Object.entries(economia)
      .sort(([, a], [, b]) => b.saldo - a.saldo)
      .slice(0, 10);

    if (ranking.length === 0) return interaction.reply("Ninguém tem ZéCoins ainda!");

    const linhas = await Promise.all(
      ranking.map(async ([userId, dados], index) => {
        const user = await client.users.fetch(userId).catch(() => null);
        const nome = user ? user.username : "Desconhecido";
        const medalha = ["🥇", "🥈", "🥉"][index] || `${index + 1}º`;
        return `${medalha} **${nome}** — ${dados.saldo} ZéCoins`;
      })
    );

    const embed = new EmbedBuilder()
      .setTitle("🏆 Ranking ZéCoins")
      .setDescription(linhas.join("\n"))
      .setColor("Gold");
    await interaction.reply({ embeds: [embed] });
  }

  // ---- /dar-moedas ----
  if (interaction.commandName === "dar-moedas") {
    if (!interaction.member.permissions.has("Administrator")) {
      return interaction.reply({ content: "❌ Sem permissão.", ephemeral: true });
    }
    const user   = interaction.options.getUser("usuario");
    const qtd    = interaction.options.getInteger("quantidade");
    const perfil = getPerfil(user.id);
    perfil.saldo += qtd;
    await interaction.reply(`✅ ${user} recebeu **${qtd} ZéCoins**! Saldo atual: **${perfil.saldo}**`);
  }

  // ---- /apostar ----
  if (interaction.commandName === "apostar") {
    const desafiado = interaction.options.getUser("usuario");
    const valor     = interaction.options.getInteger("valor");

    if (desafiado.id === interaction.user.id) return interaction.reply({ content: "❌ Você não pode apostar contra si mesmo!", ephemeral: true });
    if (desafiado.bot) return interaction.reply({ content: "❌ Você não pode apostar contra um bot!", ephemeral: true });
    if (valor <= 0) return interaction.reply({ content: "❌ O valor precisa ser maior que 0!", ephemeral: true });

    const perfilDesafiante = getPerfil(interaction.user.id);
    if (perfilDesafiante.saldo < valor) {
      return interaction.reply({
        content: `❌ Saldo insuficiente! Você tem **${perfilDesafiante.saldo} ZéCoins**.`,
        ephemeral: true,
      });
    }

    const embed = new EmbedBuilder()
      .setTitle("🎲 Desafio de Aposta!")
      .setColor("Gold")
      .setDescription(
        `${interaction.user} desafiou ${desafiado} para uma aposta de **${valor} ZéCoins**!\n\n` +
        `🪙 O resultado será decidido por **cara ou coroa**.\n` +
        `${desafiado}, você aceita o desafio?`
      )
      .setFooter({ text: "A aposta expira em 60 segundos" })
      .setTimestamp();

    const botoes = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("aposta_aceitar").setLabel("✅ Aceitar").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("aposta_recusar").setLabel("❌ Recusar").setStyle(ButtonStyle.Danger),
    );

    const msg = await interaction.reply({
      content: `${desafiado}`,
      embeds: [embed],
      components: [botoes],
      fetchReply: true,
    });

    apostas[msg.id] = { desafiante: interaction.user.id, desafiado: desafiado.id, valor };

    setTimeout(async () => {
      if (apostas[msg.id]) {
        delete apostas[msg.id];
        try { await msg.edit({ content: "⏰ A aposta expirou!", embeds: [], components: [] }); } catch {}
      }
    }, 60000);
  }

  // ---- /lockdown ----
  if (interaction.commandName === "lockdown") {
    if (!interaction.member.permissions.has("Administrator")) {
      return interaction.reply({ content: "❌ Sem permissão.", ephemeral: true });
    }

    const motivo  = interaction.options.getString("motivo") || "Sem motivo especificado";
    const canais  = await interaction.guild.channels.fetch();
    const everyone = interaction.guild.roles.everyone;

    await interaction.deferReply({ ephemeral: true });

    let fechados = 0;

    for (const [, canal] of canais) {
      // Pula o canal de aviso e canais que não são de texto
      if (canal.id === CANAL_AVISO_ID) continue;
      if (!canal.isTextBased()) continue;

      try {
        await canal.permissionOverwrites.edit(everyone, {
          SendMessages: false,
          ViewChannel: false,
        });
        fechados++;
      } catch {}
    }

    // Canal de aviso fica aberto e visível
    const canalAviso = await interaction.guild.channels.fetch(CANAL_AVISO_ID).catch(() => null);
    if (canalAviso) {
      await canalAviso.permissionOverwrites.edit(everyone, {
        SendMessages: false,
        ViewChannel: true,
      });

      await canalAviso.send({
        embeds: [
          new EmbedBuilder()
            .setTitle("🔒 SERVIDOR EM LOCKDOWN")
            .setColor("Red")
            .setDescription(`O servidor foi bloqueado por um administrador.\n\n**Motivo:** ${motivo}`)
            .setTimestamp()
        ]
      });
    }

    const logEmbed = new EmbedBuilder()
      .setTitle("🔒 Lockdown Ativado")
      .setColor("Red")
      .addFields(
        { name: "Admin",   value: `${interaction.user.tag}` },
        { name: "Motivo",  value: motivo },
        { name: "Canais fechados", value: `${fechados}` }
      )
      .setTimestamp();
    await enviarLog(interaction.guild, logEmbed);

    await interaction.editReply(`✅ Lockdown ativado! **${fechados}** canais fechados.`);
  }

  // ---- /unlockdown ----
  // Para desativar o lockdown basta usar /lockdown de novo — mas vamos separar em comando próprio
  // Adicione esse comando se quiser desativar: /unlockdown
  // Por ora o lockdown é desfeito manualmente no Discord ou com /mostrar-canal em cada canal

  // ---- /esconder-canal ----
  if (interaction.commandName === "esconder-canal") {
    if (!interaction.member.permissions.has("Administrator")) {
      return interaction.reply({ content: "❌ Sem permissão.", ephemeral: true });
    }

    const everyone = interaction.guild.roles.everyone;
    try {
      await interaction.channel.permissionOverwrites.edit(everyone, { ViewChannel: false });
      await interaction.reply({ content: `✅ Canal **${interaction.channel.name}** está agora invisível para membros.`, ephemeral: true });

      const logEmbed = new EmbedBuilder()
        .setTitle("🙈 Canal Escondido")
        .setColor("Grey")
        .addFields(
          { name: "Admin", value: `${interaction.user.tag}` },
          { name: "Canal", value: `${interaction.channel.name}` }
        )
        .setTimestamp();
      await enviarLog(interaction.guild, logEmbed);
    } catch (err) {
      await interaction.reply({ content: "❌ Não consegui esconder o canal.", ephemeral: true });
    }
  }

  // ---- /mostrar-canal ----
  if (interaction.commandName === "mostrar-canal") {
    if (!interaction.member.permissions.has("Administrator")) {
      return interaction.reply({ content: "❌ Sem permissão.", ephemeral: true });
    }

    const everyone = interaction.guild.roles.everyone;
    try {
      await interaction.channel.permissionOverwrites.edit(everyone, { ViewChannel: true, SendMessages: true });
      await interaction.reply({ content: `✅ Canal **${interaction.channel.name}** está visível novamente.`, ephemeral: true });

      const logEmbed = new EmbedBuilder()
        .setTitle("👁️ Canal Revelado")
        .setColor("Green")
        .addFields(
          { name: "Admin", value: `${interaction.user.tag}` },
          { name: "Canal", value: `${interaction.channel.name}` }
        )
        .setTimestamp();
      await enviarLog(interaction.guild, logEmbed);
    } catch {
      await interaction.reply({ content: "❌ Não consegui mostrar o canal.", ephemeral: true });
    }
  }

  // ---- /lock ----
  if (interaction.commandName === "lock") {
    if (!interaction.member.permissions.has("Administrator")) {
      return interaction.reply({ content: "❌ Sem permissão.", ephemeral: true });
    }

    const motivo   = interaction.options.getString("motivo") || "Sem motivo especificado";
    const everyone = interaction.guild.roles.everyone;

    try {
      await interaction.channel.permissionOverwrites.edit(everyone, { SendMessages: false });
      await interaction.reply(`🔒 Canal bloqueado! **Motivo:** ${motivo}`);

      const logEmbed = new EmbedBuilder()
        .setTitle("🔒 Canal Bloqueado")
        .setColor("Orange")
        .addFields(
          { name: "Admin",  value: `${interaction.user.tag}` },
          { name: "Canal",  value: `${interaction.channel.name}` },
          { name: "Motivo", value: motivo }
        )
        .setTimestamp();
      await enviarLog(interaction.guild, logEmbed);
    } catch {
      await interaction.reply({ content: "❌ Não consegui bloquear o canal.", ephemeral: true });
    }
  }

  // ---- /unlock ----
  if (interaction.commandName === "unlock") {
    if (!interaction.member.permissions.has("Administrator")) {
      return interaction.reply({ content: "❌ Sem permissão.", ephemeral: true });
    }

    const everyone = interaction.guild.roles.everyone;
    try {
      await interaction.channel.permissionOverwrites.edit(everyone, { SendMessages: true });
      await interaction.reply(`🔓 Canal desbloqueado!`);

      const logEmbed = new EmbedBuilder()
        .setTitle("🔓 Canal Desbloqueado")
        .setColor("Green")
        .addFields(
          { name: "Admin", value: `${interaction.user.tag}` },
          { name: "Canal", value: `${interaction.channel.name}` }
        )
        .setTimestamp();
      await enviarLog(interaction.guild, logEmbed);
    } catch {
      await interaction.reply({ content: "❌ Não consegui desbloquear o canal.", ephemeral: true });
    }
  }

  // ---- /slowmode ----
  if (interaction.commandName === "slowmode") {
    if (!interaction.member.permissions.has("Administrator")) {
      return interaction.reply({ content: "❌ Sem permissão.", ephemeral: true });
    }

    const segundos = interaction.options.getInteger("segundos");
    try {
      await interaction.channel.setRateLimitPerUser(segundos);
      if (segundos === 0) {
        await interaction.reply(`✅ Modo lento desativado!`);
      } else {
        await interaction.reply(`🐢 Modo lento ativado: **${segundos} segundos** entre mensagens.`);
      }
    } catch {
      await interaction.reply({ content: "❌ Não consegui ativar o modo lento.", ephemeral: true });
    }
  }

  // ---- /limpar ----
  if (interaction.commandName === "limpar") {
    if (!interaction.member.permissions.has("Administrator")) {
      return interaction.reply({ content: "❌ Sem permissão.", ephemeral: true });
    }

    const quantidade = Math.min(interaction.options.getInteger("quantidade"), 100);
    try {
      await interaction.deferReply({ ephemeral: true });
      const deletadas = await interaction.channel.bulkDelete(quantidade, true);
      await interaction.editReply(`✅ **${deletadas.size}** mensagens apagadas!`);

      const logEmbed = new EmbedBuilder()
        .setTitle("🗑️ Mensagens Apagadas")
        .setColor("Red")
        .addFields(
          { name: "Admin",     value: `${interaction.user.tag}` },
          { name: "Canal",     value: `${interaction.channel.name}` },
          { name: "Quantidade", value: `${deletadas.size}` }
        )
        .setTimestamp();
      await enviarLog(interaction.guild, logEmbed);
    } catch {
      await interaction.editReply("❌ Não consegui apagar as mensagens. Mensagens com mais de 14 dias não podem ser apagadas em massa.");
    }
  }
});

client.login(TOKEN);