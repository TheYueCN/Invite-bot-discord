require("./server");
require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildInvites,
  ],
});

let invites = new Map();

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  // Loop through all servers the bot is in
  client.guilds.cache.forEach(async (guild) => {
    try {
      // Fetch invites
      const guildInvites = await guild.invites.fetch();
      invites.set(
        guild.id,
        new Map(guildInvites.map((inv) => [inv.code, inv.uses])),
      );

      // Check if invite-logs channel exists, if not create it
      let logChannel = guild.channels.cache.find(
        (ch) => ch.name === "invite-logs",
      );
      if (!logChannel) {
        logChannel = await guild.channels.create({
          name: "invite-logs",
          type: 0, // Text channel
          permissionOverwrites: [
            {
              id: guild.roles.everyone,
              deny: [PermissionsBitField.Flags.SendMessages], // No one can talk except admins
            },
          ],
        });
        console.log(`Created invite-logs channel in ${guild.name}`);
        logChannel.send("📢 Invite logging is now active!");
      }
    } catch (err) {
      console.log(`Missing permissions in ${guild.name}`);
    }
  });
});

client.on("inviteCreate", (invite) => {
  if (!invites.has(invite.guild.id)) invites.set(invite.guild.id, new Map());
  invites.get(invite.guild.id).set(invite.code, invite.uses);
});

client.on("guildMemberAdd", async (member) => {
  const guild = member.guild;
  let guildInvites;

  try {
    guildInvites = await guild.invites.fetch();
  } catch {
    return console.log(`Missing invite permissions in ${guild.name}`);
  }

  const oldInvites = invites.get(guild.id) || new Map();
  const usedInvite = guildInvites.find(
    (inv) => inv.uses > (oldInvites.get(inv.code) || 0),
  );

  let logChannel = guild.channels.cache.find((ch) => ch.name === "invite-logs");
  if (!logChannel) {
    logChannel = await guild.channels.create({
      name: "invite-logs",
      type: 0,
    });
  }

  if (usedInvite) {
    logChannel.send(
      `👤 **${member.user.tag}** joined using invite **${usedInvite.code}** created by **${usedInvite.inviter.tag}** 🎉`,
    );
  } else {
    logChannel.send(
      `👤 **${member.user.tag}** joined but could not determine which invite was used ❓`,
    );
  }

  // Update cache
  invites.set(
    guild.id,
    new Map(guildInvites.map((inv) => [inv.code, inv.uses])),
  );
});

client.login(process.env.TOKEN);
