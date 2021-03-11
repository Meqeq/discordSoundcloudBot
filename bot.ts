import VoiceGateway, { VoiceGatewayProps } from './voiceGateway.ts';
import { getUser, getChannels, sendMessage } from './api.ts';
import { Guild, Message, GatewayMessage, Opcodes, HelloMessage, Actions, ReadyMessage, VoiceStateUpdate, VoiceState, User, VoiceServerUpdate } from './interfaces.ts';

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
    private gateway: WebSocket;
    private guild : Guild | undefined;
    private voiceGateway : VoiceGateway | undefined;
    private _id = "";

    private handlers : Map<Actions, Handler> = new Map();

    constructor(token: string) {
        this.token = token;

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

    private onMessage = (event: MessageEvent) => {
        const message : GatewayMessage<unknown> = JSON.parse(event.data);
        
        switch(message.op) {
            case Opcodes.Hello: 
                this.startHeartbeat((<GatewayMessage<HelloMessage>> message).d.heartbeat_interval);
                this.identify();
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

    public joinVoice(guild: string, channel: string) {
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
    }

    public getUserVoiceChannel(user: User) : string {
        if(!this.guild) return "";

        const voiceState = this.guild.voice_states.find(value => value.user_id == user.id);

        if(!voiceState) return "";

        return voiceState.channel_id;
    }

    private handleDispatch(payload: GatewayMessage<unknown>) {
        const handler = this.handlers.get(<Actions> payload.t);

        switch(payload.t) {
            case Actions.MessageCreate: {
                const message = <Message> payload.d;

                if(message.author.id != this.id && message.author.id != "805921493702672384") {
                    message.respond = (content: string) => sendMessage(message.channel_id, content);
                    if(handler) handler(message);
                }
                    
                break;
            }   

            case Actions.GuildCreate:
                this.guild = <Guild> payload.d;

                if(handler) handler(payload.d);

                break;

            case Actions.Ready: 
                //console.log(payload.d);
                this._id = (<ReadyMessage>payload.d).user.id;
                break;

            case Actions.VoiceState: {
                const state = <VoiceStateUpdate> payload.d;
                
                if(!this.guild) return;

                if(state.channel_id == null) {
                    this.guild.voice_states = this.guild.voice_states.filter(value => value.user_id != state.user_id);
                } else {
                    const user = this.guild.voice_states.findIndex(value => value.user_id != state.user_id);
                    const { member, ...p } = state;
                    if(user != -1) {
                        this.guild.voice_states[user] = p;
                    } else {
                        this.guild.voice_states.push(p);
                    }

                }

                //console.log(this.guild?.voice_states);
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
                

            default: 
                console.log(payload.t);
        }
        /*
            case 'VOICE_STATE_UPDATE':
                this.voiceGatewayProps.userId = message.d.user_id;
                this.voiceGatewayProps.sessionId = message.d.session_id;
                break;
            case 'VOICE_SERVER_UPDATE':
                this.voiceGatewayProps.token = message.d.token;
                this.voiceGatewayProps.serverId = message.d.guild_id;
                this.voiceGatewayProps.address = message.d.endpoint;

                this.voiceGateway = new VoiceGateway(this.voiceGatewayProps);
        }*/
    }

    private onStart = (event: Event) => {
        console.log("Bot is alive");
    }

    private onClose = (event: CloseEvent) => {
        console.log(event);
    }

    private startHeartbeat(interval: number) {
        const heartbeat = JSON.stringify({
            op: Opcodes.Heartbeat,
            d: null
        });
        
        setInterval(() => {
            this.gateway.send(heartbeat);
        }, interval);
    }

    private identify() {
        const msg = JSON.stringify({
            op: Opcodes.Identify,
            d: {
                token: this.token,
                intents: Intents.GUILDS | Intents.GUILD_VOICE_STATES | Intents.GUILD_MESSAGES,
                properties: { $os: "linux", $browser: "my_library", $device: "my_library" }
            }
        });
    
        this.gateway.send(msg);
    }
}

export default Bot;