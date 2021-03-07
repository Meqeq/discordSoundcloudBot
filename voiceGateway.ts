import { Opus, OpusApplication } from "https://deno.land/x/opus@0.1.1/opus.ts";
import sodium from "https://deno.land/x/sodium/basic.ts";

await sodium.ready;

export enum Opcodes {
    Identify = 0, Select = 1, Ready = 2,
    Heartbeat = 3, Session = 4, Speaking = 5,
    HeartbeatACK = 6, Resume = 7, Hello = 8,
    Resumed	= 9, Client = 13,
}

export interface VoiceGatewayProps {
    address: string;
    serverId: string;
    userId: string;
    token: string;
    sessionId: string;
}

class VoiceGateway {
    private gateway: WebSocket;
    private props: VoiceGatewayProps;

    private ip = "";
    private ssrc = 0;
    private port = 0;
    private sequence = 0;
    private packetSize = 256;
    private timestamp = 0;
    private nonce = 0;
    

    constructor(props: VoiceGatewayProps) {

        this.gateway = new WebSocket("wss://" + props.address);

        this.gateway.onopen = this.onStart;
        this.gateway.onmessage = this.onMessage;
        this.gateway.onclose = this.onClose;

        this.props = props;
    }

    private onStart = (event: Event) => {
        //console.log(event);
    }

    private onClose = (event: CloseEvent) => {
        console.log(event);
    }

    private startHeartbeat(interval: number) {
        const heartbeat = JSON.stringify({
            op: 3,
            d: null
        });
        
        setInterval(() => {
            this.gateway.send(heartbeat);
        }, interval);
    }

    private identify() {
        const msg = JSON.stringify({
            op: 0,
            d: {
                server_id: this.props.serverId,
                user_id: this.props.userId,
                session_id: this.props.sessionId,
                token: this.props.token
            }
        });
    
        this.gateway.send(msg);
    }

    private selectProtocol() {
        const msg = JSON.stringify({
            op: Opcodes.Select,
            d: {
                protocol: "udp",
                data: {
                    address: this.ip,
                    port: this.port,
                    mode: "xsalsa20_poly1305_lite"
                }
            }
        });

        this.gateway.send(msg);
    }

    private setSpeak() {
        const msg = JSON.stringify({
            "op": Opcodes.Speaking,
            "d": {
                "speaking": 1,
                "delay": 0,
                "ssrc": this.ssrc
            }
        });

        this.gateway.send(msg);
    }

    private numberToArray(nr: number) : number[] {
        const byteArray = [0, 0, 0, 0];
        
        for (let i = 0; i < byteArray.length; i++) {
            const byte = nr & 0xff;
            byteArray[i] = byte;
            nr = (nr - byte) / 256;
        }
        
        return byteArray;
    }

    private preparePacket(chunk: Uint8Array, secretKey: Uint8Array, ssrc: number, tss: number) : Uint8Array {
        const ts = this.numberToArray(this.timestamp);
        const seqs = this.numberToArray(this.sequence++);
        const ss = this.numberToArray(ssrc);
        this.timestamp += tss;
        const rtpHeader = Uint8Array.from([
            0x80, 0x78, seqs[1], seqs[0],
            ...ts.reverse(), ...ss.reverse()
        ]);

        const nonce = Uint8Array.from([
            ...this.numberToArray(this.nonce).reverse(), 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0
        ]);

        const data2 = sodium.crypto_secretbox_easy(chunk, nonce, secretKey);

        return Uint8Array.from([
            ...rtpHeader,
            ...data2,
            ...this.numberToArray(this.nonce++).reverse()
        ]);
    }

    private async decodeOpus(audio: Uint8Array) : Promise<Deno.File> {
        await Deno.writeFile("temp1.wav", audio);

        const tempName = "temp2.wav";

        const command = Deno.run({
            cmd: ["opusdec", "temp1.wav", tempName],
        });

        const { code } = await command.status();

        if(code != 0) throw new Error("Opusdec error");

        return await Deno.open(tempName);
    }

    private getOpus(audio: Uint8Array) {
        const decode = this.decodeOpus(audio);
        return async function* (sampleRate: number, channels: number, frameSize: number) {
            const [file] = await Promise.all([
                decode, Opus.load()
            ]);

            const encoder = new Opus(sampleRate, channels, OpusApplication.AUDIO);

            const buffer = new Uint8Array(frameSize*4);

            while(true) {
                const res = await file.read(buffer);

                if(!res) break; 

                const encodedPacket = encoder.encode(buffer, frameSize)

                yield encodedPacket;
            }

            encoder.delete();

            return new Uint8Array();
        }
    }

    private async send(message: any) {
        const secretKey = Uint8Array.from(message.d.secret_key);
        const ssrc = message.d.encodings[0].ssrc;

        const addr : Deno.NetAddr = {transport: "udp", port: this.port, hostname: this.ip};

        const socket = await Deno.listenDatagram({
            port: 18181,
            transport: "udp",
            hostname: "0.0.0.0"
        });

        //console.log(this.ip);
        let address = this.ip.split("").map(value => value.charCodeAt(0));
        
        address = [ ...address, ...new Array(64-address.length).fill(0)];

        const port = this.numberToArray(this.port);

        const ipDiscovery = Uint8Array.from([
            ...this.numberToArray(this.ssrc).reverse(),
            ...new Array(66).fill(0)
        ]);

        const SAMPLE_RATE = 48000;
        
        const CHANNELS = 2;

        
        const audio = (await Deno.readFile('ll.wav'));

        const frameSize = 960;

        const decoder = this.getOpus(audio);

        const packets = decoder(SAMPLE_RATE, CHANNELS, frameSize);

        let i = 0;
        const it = setInterval(async () => {
            const encodedPacket = await packets.next();
    
            if(encodedPacket.done) {
                clearInterval(it);
            } else {
                const packet = this.preparePacket(encodedPacket.value, secretKey, ssrc, frameSize);
                socket.send(packet, addr);    
            }

            i += 1;
        }, 20);
  

        for await (const req of socket) {
            //console.log("LELELE", req);
        }
    }

    private onMessage = (event: MessageEvent) => {
        const message = JSON.parse(event.data);
        //console.log("KEK", message.op);
        switch(message.op) {
            case Opcodes.Hello:
                this.identify();
                this.startHeartbeat(message.d.heartbeat_interval);
                break;
            case Opcodes.Ready:
                this.ip = message.d.ip;
                this.port = Number(message.d.port);
                this.ssrc = message.d.ssrc;

                this.selectProtocol();
                this.setSpeak();
                break;
            case Opcodes.Session:
                this.send(message);
                break;
            default:
                console.log(message);
        }
    }
}

export default VoiceGateway;