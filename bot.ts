import VoiceGateway, { VoiceGatewayProps } from './voiceGateway.ts';

export interface Author {
    username: string;
    id: string;
}

export interface MessageInfo {
    content: string;
    author: Author;
    channel: string;
    guild: string;
}

export type Handler = (info: MessageInfo, botAction: BotAction) => void;

export interface BotAction {
    response: (message: string, channel: string) => Promise<Response>;
}

export enum Action { message }

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

class Bot {
    private sockAddr = "wss://gateway.discord.gg/?v=8&encoding=json";
    private api = "https://discord.com/api/v8/";

    private token: string;
    private gateway: WebSocket;

    private handlers: Map<Action, Handler> = new Map();

    private voiceGatewayProps: VoiceGatewayProps = { 
        address: "", token: "", userId: "", serverId: "", sessionId: ""
    };

    private voiceGateway: VoiceGateway | undefined;

    constructor(token: string) {
        this.token = token;

        this.gateway = new WebSocket(this.sockAddr);

        this.gateway.onopen = this.onStart;
        this.gateway.onmessage = this.onMessage;
        this.gateway.onclose = this.onClose;
    }

    private startHeartbeat(interval: number) {
        const heartbeat = JSON.stringify({
            op: 1,
            d: null
        });
        
        setInterval(() => {
            this.gateway.send(heartbeat);
        }, interval);
    }

    private identify() {
        const msg = JSON.stringify({
            op: 2,
            d: {
                token: this.token,
                intents: Intents.GUILDS | Intents.GUILD_VOICE_STATES | Intents.GUILD_MESSAGES,
                properties: { $os: "linux", $browser: "my_library", $device: "my_library" }
            }
        });
    
        this.gateway.send(msg);
    }

    private onStart = (event: Event) => {
        console.log("Bot is alive");
    }

    private onMessage = (event: MessageEvent) => {
        const message = JSON.parse(event.data);
        //console.log("KEK", message.op);
        switch(message.op) {
            case 10:
                this.startHeartbeat(message.d.heartbeat_interval);
                this.identify();
                break;
            case 11:
                console.log("Heartbeat ACK");
                break;
            case 0: 
                this.handleDispatch(message);
                //console.log(message);
                break;
            default:
                console.log(message);
                break;
        }
    }

    private onClose = (event: CloseEvent) => {
        console.log(event);
    }

    private sendMessage = (message: string, channel: string) : Promise<Response> => {
        return fetch(this.api + `channels/${channel}/messages`, {
            method: "POST",
            headers: {
                "Authorization": "Bot " + this.token,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                content: message,
                tts: false
            })
        })
    }

    public joinVoice(guild: string, channel: string) {
        const joinMsg = JSON.stringify({
            op: 4,
            d: {
                guild_id: guild,
                channel_id: channel,
                self_mute: false,
                self_deaf: false
            }
        });
        
        this.gateway.send(joinMsg);
    }

    private handleDispatch(message: any) {
        const type = message.t;
        const msg = message.d.content;
        let handler: Handler | undefined;
        //console.log(type);
        switch(type) {
            case 'MESSAGE_CREATE':
                handler = this.handlers.get(Action.message);
                if(handler)
                    handler({
                        author: {
                            username: message.d.author.username,
                            id: message.d.author.id
                        },
                        content: message.d.content,
                        channel: message.d.channel_id,
                        guild: message.d.guild_id
                    }, {
                        response: this.sendMessage
                    });
                break;
            case 'VOICE_STATE_UPDATE':
                this.voiceGatewayProps.userId = message.d.user_id;
                this.voiceGatewayProps.sessionId = message.d.session_id;
                break;
            case 'VOICE_SERVER_UPDATE':
                this.voiceGatewayProps.token = message.d.token;
                this.voiceGatewayProps.serverId = message.d.guild_id;
                this.voiceGatewayProps.address = message.d.endpoint;

                this.voiceGateway = new VoiceGateway(this.voiceGatewayProps);

                break;
        }
    }

    public handle(action: Action, handler: Handler) {
        this.handlers.set(action, handler);
    }
}

export default Bot;