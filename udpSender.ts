import sodium from "https://deno.land/x/sodium/basic.ts";

await sodium.ready;

export const nToArr = (num: number) : number[] => {
    const byteArray = [0, 0, 0, 0];

    for(let i = 3; i >= 0; i--) {
        byteArray[i] = num % 256;
        num = Math.floor(num / 256);
    }

    return byteArray;
}

interface PacketInfo {
    chunk: Uint8Array,
    secretKey: Uint8Array,
    ssrc: number,
    timestamp: number,
    sequence: number,
    nonce: number
}

export const preparePacket = (input: PacketInfo) : Uint8Array => {
    const sequence = nToArr(input.sequence);

    const rtpHeader = Uint8Array.from([
        0x80, 0x78, sequence[2], sequence[3],
        ...nToArr(input.timestamp), ...nToArr(input.ssrc)
    ]);

    const nonce = Uint8Array.from([
        ...nToArr(input.nonce), 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0
    ]);

    const data = sodium.crypto_secretbox_easy(input.chunk, nonce, input.secretKey);

    return Uint8Array.from([
        ...rtpHeader,
        ...data,
        ...nToArr(input.nonce)
    ]);
}

export class UdpSocket {
    private socket : Deno.DatagramConn;
    private address : Deno.NetAddr;

    constructor(hostname: string, port: number) {
        this.address = {
            transport: "udp", port, hostname
        };

        this.socket = Deno.listenDatagram({
            port: 18181,
            transport: "udp",
            hostname: "0.0.0.0"
        });
    }

    public async send(packet: Uint8Array) {
        return await this.socket.send(packet, this.address);
    }
}