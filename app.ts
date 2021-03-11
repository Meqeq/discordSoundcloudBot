import Bot from './bot.ts';
import { getTrack } from './soundcloud.ts';
import { Actions, Message, Guild } from './interfaces.ts';

import keys from './secret.ts';

const bot = new Bot(keys.botId);

bot.handle(Actions.MessageCreate, (payload : unknown) => {
    const message = <Message> payload;

    const voiceChannel = bot.getUserVoiceChannel(message.author);

    if(voiceChannel == "") return message.respond("Not in voice channel");

    bot.joinVoice(bot.guild_id, voiceChannel);

});

bot.handle(Actions.GuildCreate, (payload: unknown) => {
    const guild = <Guild> payload;

    //console.log(guild);
})
    

//const audio = await getTrack("539700708", keys.clientId);

//await Deno.writeFile('ll.wav', audio);
