import Bot, { Action } from './bot.ts';
import { getTrack } from './soundcloud.ts';

import keys from './secret.ts';

const bot = new Bot(keys.botId);

bot.handle(Action.message, (info, botAction) => {
    //console.log(info);

    if(info.author.username == "Meqeq")
        return;

    botAction.response(info.content.replace(/;/g, ""), info.channel);

    bot.joinVoice(info.guild, keys.guildId);
});
    

const audio = await getTrack("539700708", keys.clientId);

await Deno.writeFile('ll.wav', audio);
