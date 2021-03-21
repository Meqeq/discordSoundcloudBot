import Bot from './bot.ts';
import { getTrack, getPlaylist, getPlaylistId } from './soundcloud.ts';
import { Actions, Message, Guild } from './interfaces.ts';
import { getPlayer } from './player.ts';

import { SoundcloudPlayer } from './soundcloudPlayer.ts';

import keys from './secret.ts';

const bot = new Bot(keys.botId, keys.clientId);

bot.handle(Actions.MessageCreate, async (payload : unknown) => {
    const message = <Message> payload;

    if(message.channel_id != "808449028743233586") return;

    const voiceChannel = bot.getUserVoiceChannel(message.author);

    if(!voiceChannel) 
        return message.respond("Not in voice channel");

    const match = message.content.match(/#(\w+) *(.+)*/);

    if(match) {
        switch(match[1]) {
            case "play":
                bot.playTrack(match[2], voiceChannel, message.channel_id);
                break;
            case "playin":
                message.respond(bot.playin ? "GRAM" : "NIE GRAM");
                break;
            case "playlist": {
                
                const [id, secret] = await getPlaylistId(match[2]);
                
                if(!id) break;

                await bot.preparePlayer(voiceChannel);

                const tracks = await getPlaylist(id, keys.clientId, secret);
                
                tracks.forEach((value) => bot.enqueue(value));
                
                bot.play(message.channel_id);
                break;
            }
                
            default:
                console.log("Unknown command");
        }
    }

});

bot.handle(Actions.GuildCreate, (payload: unknown) => {
    const guild = <Guild> payload;

    //console.log(guild);
});

//await Deno.writeFile('ll.wav', audio);
