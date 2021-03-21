import { Opus, OpusApplication } from "https://deno.land/x/opus@0.1.1/opus.ts";
import { BufReader, PartialReadError } from "https://deno.land/std@0.90.0/io/mod.ts";

import { TrackInfo } from './soundcloud.ts';
/*
class Player {
    private audio : Uint8Array;

    constructor() {
        this.audio = new Uint8Array();


    }

    getPlayer() {
        const player = function* () {
            
        }

        return player();
    }
}*/

const player = function* () {

}

export interface PlayerInput {
    audio: Uint8Array,
    sampleRate: number,
    channels: number,
    frameSize: number,
    play: boolean,
    trackInfo : TrackInfo | undefined;
    timestamp: number;
}

const writeTo = async (p: Uint8Array, dst: Deno.Writer & Deno.Closer) : Promise<number> => {
    const size = 24*1024;

    let offset = 0;

    while(offset < p.length) {
        const length = await dst.write(p.slice(offset, offset+size));

        offset += length;
    }

    dst.close();

    return offset;
}

const oggPlayer = async function* (p: PlayerInput) : AsyncGenerator<Uint8Array, Uint8Array, Uint8Array> {
    const decoder = Deno.run({
        cmd: ["opusdec", "-", "-"],
        stdout: "piped",
        stdin: "piped",
        stderr: "null"
    });

    const written = writeTo(p.audio, decoder.stdin);
    written.then( res => {
        console.log("Complete");
    }).catch( err => {
        //console.log("Error");
    });


    await Opus.load();
    const encoder = new Opus(p.sampleRate, p.channels, OpusApplication.AUDIO);

    const output = new BufReader(decoder.stdout);
    const fragment = new Uint8Array(p.frameSize * 4);
    let played = 0;

    while(p.play) {
        try {
            const packet = await output.readFull(fragment);
            if(!packet) break;
            
            const encodedPacket = encoder.encode(packet, p.frameSize);
            played += packet.length;

            yield encodedPacket;

        } catch(e) {
            if (e instanceof PartialReadError) {
                if(!e.partial) break;

                const encodedPacket = encoder.encode(e.partial, p.frameSize);
                played += e.partial.length;
                
                yield encodedPacket;

                break;
            }
        }
    }

    encoder.delete();

    
    //decoder.stdin.close();
    //decoder.stdout.close();
    decoder.kill(9);

    return Uint8Array.from([played]);
}

export function getPlayer(p: PlayerInput) {
    return oggPlayer(p);   
}   