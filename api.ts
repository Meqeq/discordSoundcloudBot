import keys from "./secret.ts";
import { Channel, User, Message } from './interfaces.ts';

const api = "https://discord.com/api/v8";

export const fetchApi = async <T>(path: string, options?: RequestInit) : Promise<T>=> {
    const result = await fetch(api + path, {
        ...options,
        headers: {
            "Authorization": "Bot " + keys.botId,
            ...options?.headers
        }
    });

    return await result.json();
}

export const getUser = (id: string) : Promise<User> => {
    return fetchApi(`/users/${id}`);
}


export const getChannels = (guildId: string) : Promise<Channel[]> => {
    return fetchApi(`/guilds/${guildId}/channels`);
} 

export const sendMessage = (channel: string, content: string) : Promise<Message> => {
    return fetchApi(`/channels/${channel}/messages`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            content,
            tts: false
        })
    });
}
