// deno-lint-ignore-file camelcase

export enum ChannelType {
    GUILD_TEXT = 0,
    DM = 1,	
    GUILD_VOICE = 2,
    GROUP_DM = 3,
    GUILD_CATEGORY = 4,	
    GUILD_NEW0S = 5,
    GUILD_STORE = 6
}

export interface Channel {
    id: string,
    name: string,
    type: ChannelType
}

export interface User {
    id: string;
    username: string;
    avatar: string;
    discriminator: string;
    public_flags: number;
}

export interface VoiceState {
    user_id: string;
    session_id: string;
    channel_id: string;
    guild_id: string;
}

export interface Guild {
    id: string;
    name: string;
    channels: Channel[],
    members: User[],
    member_count: number,
    voice_states: VoiceState[]
}

export interface Message {
    id: string;
    guild_id: string;
    channel_id: string;
    author: User;
    content: string;
    type: number;
    timestamp: string;
    tts: boolean;
    respond: (content: string) => Promise<Message>;
}

export enum Opcodes {
    Dispatch = 0, Heartbeat = 1, Identify = 2,
	PresenceUpdate = 3, VoiceStateUpdate = 4,
    Resume = 6, Reconnect = 7,	
    RequestGuildMembers	= 8, InvalidSession	= 9,
    Hello = 10, HeartbeatACK = 11
}

export interface GatewayMessage<T> {
    t: string;
    op: Opcodes,
    d: T
}

export interface HelloMessage {
    heartbeat_interval: number;
}

export enum Actions {
    MessageCreate = "MESSAGE_CREATE", Ready = "READY",
    GuildCreate = "GUILD_CREATE", VoiceState = "VOICE_STATE_UPDATE",
    VoiceServer = "VOICE_SERVER_UPDATE"
}

export interface ReadyMessage {
    user: User,
    session_id: string;
}

export interface VoiceStateUpdate extends VoiceState {
    member: User;
}

export interface VoiceServerUpdate {
    token: string;
    guild_id: string;
    endpoint: string;
}