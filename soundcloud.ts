
const api = "https://api-v2.soundcloud.com";

async function getArrayBuffer(link: string) {
    const result = await fetch(link);

    return await result.arrayBuffer();
}

function toUint8Array(fragments: ArrayBuffer[]) : Uint8Array {
    const totalLength = fragments.reduce((acc, value) => acc + value.byteLength, 10);

    const result = new Uint8Array(totalLength);

    fragments.reduce((prev, value) => {
        result.set(new Uint8Array(value), prev);
        return prev + value.byteLength;
    }, 0);

    return result;
}

export interface SoundcloudUser {
    username: string;
    id: string;
}

export interface TrackInfo {
    title: string;
    genre: string;
    duration: number;
    user: SoundcloudUser;
}

export async function getTrack(trackId: string, clientId: string) : Promise<[TrackInfo | undefined, Uint8Array]> {
    try {
        const track = await fetch(`${api}/tracks/${trackId}?client_id=${clientId}`);

        const trackData = await track.json();

        const opus = trackData.media.transcodings.find((value: any) => value.preset == "opus_0_0");

        if(!opus) throw new Error("No opus");
        
        const opusData = await (await fetch(opus.url + `?client_id=${clientId}`)).json();
        
        const linkInfo = await (await fetch(opusData.url)).text();

        const links = linkInfo.replace(/#.*\n*/g, "").split("\n");
        links.pop();

        const promises = links.map(value => getArrayBuffer(value));

        const fragments = await Promise.all(promises);

        return [trackData, toUint8Array(fragments)];

    } catch(e) {
        console.log(e);
        return [undefined, new Uint8Array()];
    }
}

export const getPlaylistId = async (url: string) : Promise<[string | undefined, string | undefined]> => {
    try {
        const site = await (await fetch(url)).text();

        const match = site.match(/playlists:(\d+)/);

        if(!match) throw new Error("Can't find playlist id");

        const frag = url.split("/");
        if(frag.length > 6) 
            return [match[1], frag[6]];
        
        return [match[1], undefined];

    } catch(e) {
        console.log(e);
        return [undefined, undefined];
    }
}

export const getPlaylist = async (id: string, clientId: string, secret?: string | undefined) : Promise<string[]> => {
    try {
        let path = `${api}/playlists/${id}?client_id=${clientId}`;

        if(secret)  
            path += `&secret_token=${secret}`;

        const playlist = await (await fetch(path)).json();

        return playlist.tracks.map((value: any) => value.id);
    } catch(e) {
        console.log(e);
        return [];
    }
}