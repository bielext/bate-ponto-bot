require('dotenv').config();

process.on('unhandledRejection', console.error);
process.on('uncaughtException', console.error);

const {
    Client,
    GatewayIntentBits,
    SlashCommandBuilder,
    REST,
    Routes,
    EmbedBuilder
} = require('discord.js');

const sqlite3 = require('sqlite3').verbose();

// ==============================
// ENV
// ==============================

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const BANNER =
'https://media.discordapp.net/attachments/1498166599495192727/1508615281386324199/banner_bgk.png?ex=6a162ef7&is=6a14dd77&hm=4aed1bbf3ca9ba3a4e409c4f8e925dc3c42fe69a10a42493947241fd292ee518&=&format=webp&quality=lossless&width=550&height=310';

// ==============================
// CLIENT
// ==============================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers
    ]
});

// ==============================
// DATABASE
// ==============================

const db = new sqlite3.Database('./ponto.db');

db.run(`
CREATE TABLE IF NOT EXISTS pontos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    entrada TEXT,
    saida TEXT,
    tempo INTEGER
)
`);

// ==============================
// COMMANDS
// ==============================

const commands = [

    new SlashCommandBuilder()
        .setName('abrir-ponto')
        .setDescription('Abrir expediente'),

    new SlashCommandBuilder()
        .setName('encerrar-ponto')
        .setDescription('Encerrar expediente'),

    new SlashCommandBuilder()
        .setName('horas')
        .setDescription('Ver horas totais'),

    new SlashCommandBuilder()
        .setName('resetar-horas')
        .setDescription('Resetar horas de um usuário')
        .addUserOption(option =>
            option
                .setName('usuario')
                .setDescription('Usuário para resetar')
                .setRequired(true)
        )

].map(command => command.toJSON());

// ==============================
// REGISTER COMMANDS
// ==============================

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {

    try {

        console.log('🔄 Registrando comandos...');

        await rest.put(
            Routes.applicationGuildCommands(
                CLIENT_ID,
                GUILD_ID
            ),
            { body: commands }
        );

        console.log('✅ Comandos registrados.');

    } catch (error) {

        console.error(error);

    }

})();

// ==============================
// READY
// ==============================

client.once('ready', () => {

    console.log(`✅ ${client.user.tag} ONLINE`);

});

// ==============================
// INTERACTIONS
// ==============================

client.on('interactionCreate', async interaction => {

    if (!interaction.isChatInputCommand()) return;

const CARGO_ID = process.env.CARGO_ID;

const possuiCargo = interaction.member.roles.cache.has(CARGO_ID);

if (!possuiCargo) {

    return interaction.reply({
        content: '❌ Você não possui o cargo permitido.',
        ephemeral: true
    });

}

    // ==============================
    // ABRIR PONTO
    // ==============================

    if (interaction.commandName === 'abrir-ponto') {

        db.get(`
        SELECT *
        FROM pontos
        WHERE user_id = ?
        AND saida IS NULL
        `, [interaction.user.id], (err, row) => {

            if (err) {
                console.error(err);

                return interaction.reply({
                    content: '❌ Erro no banco de dados.',
                    ephemeral: true
                });
            }

            if (row) {

                return interaction.reply({
                    content: '❌ Você já possui um ponto aberto.',
                    ephemeral: true
                });

            }

            const agora = new Date();

            db.run(`
            INSERT INTO pontos (
                user_id,
                entrada,
                saida,
                tempo
            )
            VALUES (?, ?, ?, ?)
            `, [
                interaction.user.id,
                agora.toISOString(),
                null,
                0
            ]);

            const embed = new EmbedBuilder()
                .setTitle('🟢 PONTO ABERTO')
                .setDescription(
                    `🚀 ${interaction.user} iniciou expediente`
                )
                .setColor('#00ff88')
                .setThumbnail(
                    interaction.user.displayAvatarURL({
                        dynamic: true
                    })
                )
                .setImage(BANNER)
                .addFields({
                    name: '⏰ Horário',
                    value: `<t:${Math.floor(agora.getTime()/1000)}:F>`
                })
                .setFooter({
                    text: 'BGK • Sistema de Bate Ponto'
                })
                .setTimestamp();

            interaction.reply({
                embeds: [embed]
            });

        });

    }

// ==============================
// RESETAR HORAS
// ==============================

if (interaction.commandName === 'resetar-horas') {

    const STAFF_ID = process.env.STAFF_ID;

    const possuiStaff = interaction.member.roles.cache.has(STAFF_ID);

    if (!possuiStaff) {

        return interaction.reply({
            content: '❌ Você não possui permissão.',
            ephemeral: true
        });

    }

    const usuario = interaction.options.getUser('usuario');

    db.run(`
    DELETE FROM pontos
    WHERE user_id = ?
    `, [usuario.id], function(err) {

        if (err) {

            console.error(err);

            return interaction.reply({
                content: '❌ Erro ao resetar horas.',
                ephemeral: true
            });

        }

        const embed = new EmbedBuilder()
            .setTitle('🗑 HORAS RESETADAS')
            .setColor('#ffcc00')
            .setThumbnail(
                usuario.displayAvatarURL({
                    dynamic: true
                })
            )
            .setImage(BANNER)
            .addFields(
                {
                    name: '👤 Usuário',
                    value: `${usuario}`
                },
                {
                    name: '📊 Status',
                    value: 'Horas resetadas com sucesso.'
                }
            )
            .setFooter({
                text: 'BGK • Sistema de Bate Ponto'
            })
            .setTimestamp();

        interaction.reply({
            embeds: [embed]
        });

    });

}

    // ==============================
    // ENCERRAR PONTO
    // ==============================

    if (interaction.commandName === 'encerrar-ponto') {

        db.get(`
        SELECT *
        FROM pontos
        WHERE user_id = ?
        AND saida IS NULL
        ORDER BY id DESC
        LIMIT 1
        `, [interaction.user.id], (err, row) => {

            if (err) {
                console.error(err);

                return interaction.reply({
                    content: '❌ Erro no banco de dados.',
                    ephemeral: true
                });
            }

            if (!row) {

                return interaction.reply({
                    content: '❌ Você não possui ponto aberto.',
                    ephemeral: true
                });

            }

            const entrada = new Date(row.entrada);
            const saida = new Date();

            const tempoTotal = Math.floor(
                (saida - entrada) / 1000
            );

            db.run(`
            UPDATE pontos
            SET saida = ?, tempo = ?
            WHERE id = ?
            `, [
                saida.toISOString(),
                tempoTotal,
                row.id
            ]);

            const horas = Math.floor(tempoTotal / 3600);

            const minutos = Math.floor(
                (tempoTotal % 3600) / 60
            );

            const segundos = tempoTotal % 60;

            const embed = new EmbedBuilder()
                .setTitle('🔴 PONTO ENCERRADO')
                .setColor('#ff0000')
                .setThumbnail(
                    interaction.user.displayAvatarURL({
                        dynamic: true
                    })
                )
                .setImage(BANNER)
                .addFields(
                    {
                        name: '👤 Usuário',
                        value: `${interaction.user}`
                    },
                    {
                        name: '⏱ Tempo Total',
                        value: `${horas}h ${minutos}m ${segundos}s`
                    }
                )
                .setFooter({
                    text: 'BGK • Sistema de Bate Ponto'
                })
                .setTimestamp();

            interaction.reply({
                embeds: [embed]
            });

        });

    }

    // ==============================
    // HORAS
    // ==============================

    if (interaction.commandName === 'horas') {

        db.get(`
        SELECT SUM(tempo) as total
        FROM pontos
        WHERE user_id = ?
        `, [interaction.user.id], (err, row) => {

            if (err) {
                console.error(err);

                return interaction.reply({
                    content: '❌ Erro no banco de dados.',
                    ephemeral: true
                });
            }

            const total = row.total || 0;

            const horas = Math.floor(total / 3600);

            const minutos = Math.floor(
                (total % 3600) / 60
            );

            const embed = new EmbedBuilder()
                .setTitle('📊 HORAS TOTAIS')
                .setColor('#5865F2')
                .setThumbnail(
                    interaction.user.displayAvatarURL({
                        dynamic: true
                    })
                )
                .setImage(BANNER)
                .addFields(
                    {
                        name: '👤 Usuário',
                        value: `${interaction.user}`
                    },
                    {
                        name: '🕒 Tempo',
                        value: `${horas}h ${minutos}m`
                    }
                )
                .setFooter({
                    text: 'BGK • Sistema de Bate Ponto'
                })
                .setTimestamp();

            interaction.reply({
                embeds: [embed]
            });

        });

    }

});

// ==============================
// LOGIN
// ==============================

client.login(TOKEN);