import VoiceGateway, { VoiceGatewayProps, UdpConnection } from './voiceGateway.ts';
import { getUser, getChannels, sendMessage, editMessage, addReaction } from './api.ts';
import { Guild, Message, GatewayMessage, Opcodes, HelloMessage, Actions, ReadyMessage, VoiceStateUpdate, VoiceState, User, VoiceServerUpdate, ReactionAdd } from './interfaces.ts';

import { SoundcloudPlayer } from './soundcloudPlayer.ts';

export enum Intents {
    GUILDS = 1 << 0,
    GUILD_MEMBERS = 1 << 1,
    GUILD_BANS = 1 << 2,
    GUILD_EMOJIS = 1 << 3,
    GUILD_INTEGRATIONS = 1 << 4,
    GUILD_WEBHOOKS = 1 << 5,
    GUILD_INVITES = 1 << 6,
    GUILD_VOICE_STATES = 1 << 7,
    GUILD_PRESENCES = 1 << 8,
    GUILD_MESSAGES = 1 << 9,
    GUILD_MESSAGE_REACTIONS = 1 << 10,
    GUILD_MESSAGE_TYPING = 1 << 11,
    DIRECT_MESSAGES = 1 << 12,
    DIRECT_MESSAGE_REACTIONS = 1 << 13,
    DIRECT_MESSAGE_TYPING = 1 << 14
}

type Handler = (payload: unknown) => void;

class Bot {
    private sockAddr = "wss://gateway.discord.gg/?v=8&encoding=json";

    private token : string;
    private clientId: string;
    private gateway: WebSocket;
    private guild : Guild | undefined;
    private voiceGateway : VoiceGateway | undefined;
    private player : SoundcloudPlayer | undefined;
    private _id = "";
    private _session_id = "";
    private seq = 0;
    private connected = false;
    private interval : number | undefined;
    private playerMessage : string | undefined;

    private handlers : Map<Actions, Handler> = new Map();

    constructor(token: string, clientId: string) {
        this.token = token;
        this.clientId = clientId;
        this.gateway = new WebSocket(this.sockAddr);

        this.gateway.onopen = this.onStart;
        this.gateway.onmessage = this.onMessage;
        this.gateway.onclose = this.onClose;
    }

    private resumeConnection() {
        this.gateway = new WebSocket(this.sockAddr);

        this.gateway.onopen = this.onStart;
        this.gateway.onmessage = this.onMessage;
        this.gateway.onclose = this.onClose;
    }

    get guild_id() : string {
        if(this.guild) return this.guild.id;
        return "";
    }

    get id() : string {
        return this._id;
    }

    get inVoiceChannel() : boolean {
        return this.voiceGateway ? true : false;
    }

    private onMessage = (event: MessageEvent) => {
        const message : GatewayMessage<unknown> = JSON.parse(event.data);

        this.seq = message.s;
        
        switch(message.op) {
            case Opcodes.Hello: 
                this.startHeartbeat((<GatewayMessage<HelloMessage>> message).d.heartbeat_interval);
                if(this.connected)
                    this.resume();
                else
                    this.identify();

                this.connected = true;
                break;
            case Opcodes.HeartbeatACK:
                //console.log("Heartbeat ack");
                break;
            case Opcodes.Dispatch:
                this.handleDispatch(message);
        }
    }

    public handle(action: Actions, handler: Handler) {
        this.handlers.set(action, handler);
    }

    private joinVoice(guild: string, channel: string) : Promise<UdpConnection> {
        return new Promise((resolve, reject) => {
            const joinMsg = JSON.stringify({
                op: Opcodes.VoiceStateUpdate,
                d: {
                    guild_id: guild,
                    channel_id: channel,
                    self_mute: false,
                    self_deaf: false
                }
            });

            this.gateway.send(joinMsg);
    
            const it = setInterval(() => {
                if(this.voiceGateway?.udpConnection) {
                    clearInterval(it);
                    resolve(this.voiceGateway.udpConnection)
                }    
            }, 200);
        });
    }

    public async playSoundcloud(id: string, channelId: string) {
        if(!this.inVoiceChannel)
            await this.joinVoice(this.guild_id, channelId); 
    }

    public async playTrack(id: string, channelId: string, commChannel: string) {
        if(!this.player) {
            const udpConnection = await this.joinVoice(this.guild_id, channelId);
            this.player = new SoundcloudPlayer({
                ...udpConnection, clientId: this.clientId
            });
        }

        this.player.enqueue(id);
        await this.player.play(commChannel);
    }

    public enqueue(id: string) {
        this.player?.enqueue(id);
    }

    public async preparePlayer(channelId: string) {
        if(!this.player) {
            const udpConnection = await this.joinVoice(this.guild_id, channelId);
            this.player = new SoundcloudPlayer({
                ...udpConnection, clientId: this.clientId
            });
        }
    }

    public async play(commChannel: string) {
        await this.player?.play(commChannel);
    }

    get playin() {
        return this.player?.playing;
    }

    public getUserVoiceChannel(user: User | string) : string | undefined {
        if(!this.guild) return "";

        console.log(typeof user);

        let voiceState;
        if(typeof user == "string")
            voiceState = this.guild.voice_states.find(value => value.user_id == user);
        else
            voiceState = this.guild.voice_states.find(value => value.user_id == user.id);

        if(!voiceState) return undefined;

        return voiceState.channel_id;
    }

    private toMinutes(timestamp: number) : string {
        timestamp /= 1000;
        const minutes = Math.floor(timestamp/60);
        const seconds = Math.floor(timestamp - (minutes * 60));
        return (minutes > 9 ? minutes : "0" + minutes) + ":" + (seconds > 9 ? seconds : "0" + seconds);
    }

    private playerInfo(channelId: string, messageId: string) {
        const it = setInterval(() => {
            if(!this.player) return;

            const pi = this.player.playerInput;

            if(!pi.play) {
                clearInterval(it);
                return;
            }

            if(pi.timestamp && pi.trackInfo) {
                const played = pi.timestamp/48;
                const duration = pi.trackInfo?.duration || 100;
                const perc = played / duration;

                let info = "**Playin**: " + pi.trackInfo?.title + "\n";
                info += "**By**: " + pi.trackInfo?.user.username + "\n";
                info += this.toMinutes(played) + " [";

                const amount = Math.floor(perc*20);
                let i = 0;
                for(i; i < amount+1; i++)
                    info += "=";
                
                for(let j = 0; j < 2.5*(20 - i); j++)
                    info += " ";

                info += " ] " + this.toMinutes(duration);

                editMessage(channelId, messageId, info);
            }
                
        }, 5000);
    }

    private handleDispatch(payload: GatewayMessage<unknown>) {
        const handler = this.handlers.get(<Actions> payload.t);

        switch(payload.t) {
            case Actions.MessageCreate: {
                const message = <Message> payload.d;

                if(message.author.id != this.id && message.author.id != "805921493702672384") {
                    message.respond = (content: string) => sendMessage(message.channel_id, content);
                    if(handler) handler(message);
                } else {
                    const isPlayin = message.content.match(/playin/i);

                    if(isPlayin) {
                        addReaction(message.channel_id, message.id, "⏯").then(console.log).catch(console.log);
                        addReaction(message.channel_id, message.id, "⏹️").then(console.log).catch(console.log);
                        addReaction(message.channel_id, message.id, "⏭️").then(console.log).catch(console.log);
                        this.playerInfo(message.channel_id, message.id);
                    }
                }   
                    
                break;
            }   

            case Actions.GuildCreate:
                this.guild = <Guild> payload.d;

                if(handler) handler(payload.d);

                break;

            case Actions.Ready: {
                const readyMessage = <ReadyMessage>payload.d;

                this._id = readyMessage.user.id;
                this._session_id = readyMessage.session_id;

                break;
            }

            case Actions.VoiceState: {
                const state = <VoiceStateUpdate> payload.d;
                
                if(!this.guild) return;

                if(state.channel_id == null) {
                    this.guild.voice_states = this.guild.voice_states.filter(value => value.user_id != state.user_id);
                } else {
                    const user = this.guild.voice_states.findIndex(value => value.user_id == state.user_id);
                    const { member, ...p } = state;

                    if(user != -1) {
                        this.guild.voice_states[user] = p;
                    } else {
                        this.guild.voice_states.push(p);
                    }
                }

                break;
            }

            case Actions.VoiceServer: {
                if(this.guild) {
                    const botVoice = this.guild.voice_states.find(value => value.user_id == this._id);

                    if(!botVoice) return;

                    const voiceUpdate = <VoiceServerUpdate> payload.d;

                    this.voiceGateway = new VoiceGateway({
                        userId: botVoice.user_id,
                        sessionId: botVoice.session_id,
                        token: voiceUpdate.token,
                        serverId: voiceUpdate.guild_id,
                        address: voiceUpdate.endpoint
                    })
                    
                }
                break;
            }

            case Actions.MessageUpdate: 
                break;

            case Actions.ReactionAdd: {
                const p = <ReactionAdd> payload.d;
                if(p.user_id != this.id) {
                    switch(p.emoji.name) {
                        case "⏭️":
                            this.player?.skip();
                            break;
                            
                    }
                }
                break;
            }

            case Actions.ReactionRemove: {
                const p = <ReactionAdd> payload.d;
                if(p.user_id != this.id) {
                    switch(p.emoji.name) {
                        case "⏭️":
                            this.player?.skip();
                            break;
                            
                    }
                }
                break;
            }
            
            default: 
                console.log(payload.t);
        }
    }

    private onStart = (event: Event) => {
        console.log("Bot is alive");
    }

    private onClose = (event: CloseEvent) => {
        console.log("Disconnected");
        clearInterval(this.interval);
        this.resumeConnection(); 
    }

    private startHeartbeat(interval: number) {
        const heartbeat = JSON.stringify({
            op: Opcodes.Heartbeat,
            d: null
        });
        
        this.interval = setInterval(() => {
            this.gateway.send(heartbeat);
        }, interval);
    }

    private identify() {
        const msg = JSON.stringify({
            op: Opcodes.Identify,
            d: {
                token: this.token,
                intents: Intents.GUILDS | Intents.GUILD_VOICE_STATES | Intents.GUILD_MESSAGES | Intents.GUILD_MESSAGE_REACTIONS,
                properties: { $os: "linux", $browser: "my_library", $device: "my_library" }
            }
        });
    
        this.gateway.send(msg);
    }

    private resume() {
        const msg = JSON.stringify({
            op: Opcodes.Resume,
            d: {
                token: this.token,
                session_id: this._session_id,
                seq: this.seq
            }
        });

        this.gateway.send(msg);
    }
}

export default Bot;