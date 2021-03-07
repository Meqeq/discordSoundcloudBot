
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

export async function getTrack(trackId: string, clientId: string) : Promise<Uint8Array> {
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

        return toUint8Array(fragments);

    } catch(e) {
        console.log(e);
        return new Uint8Array();
    }
}