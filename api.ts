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

    //console.log(path, result.headers.get("X-RateLimit-Limit"), result.headers.get(""));

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

export const editMessage = (channel: string, id: string, content: string) : Promise<Message> => {
    return fetchApi(`/channels/${channel}/messages/${id}`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            content,
            tts: false
        })
    });
}

let queue = 0;
const timeToWait = 0.3;
export const addReaction = (channel: string, id: string, reaction: string) => {
    queue++;
    return new Promise((resolve, reject) => {
        setTimeout(async() => {
            const request = await fetch(api + `/channels/${channel}/messages/${id}/reactions/${reaction}/@me`, {
                method: "PUT",
                headers: {
                    "Authorization": "Bot " + keys.botId,
                }
            });

            queue--;

            resolve(request.ok);
        }, queue*timeToWait*1000);
    });
}




