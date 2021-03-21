import { Opus, OpusApplication } from "https://deno.land/x/opus@0.1.1/opus.ts";

import { getPlayer, PlayerInput } from './player.ts';
import { UdpSocket, preparePacket } from './udpSender.ts';
import { getTrack } from './soundcloud.ts';

import keys from './secret.ts';

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

export interface UdpConnection {
    hostname: string;
    port: number;
    secretKey: Uint8Array;
    ssrc: number;
}

class VoiceGateway {
    private gateway: WebSocket;
    private props: VoiceGatewayProps;
    private sequence = 0;
    private timestamp = 0;
    private nonce = 0;
    private interval : number | undefined;
    private connected = false;

    private socket : UdpSocket | undefined;

    private secretKey: Uint8Array | undefined;
    private hostname: string | undefined;
    private port: number | undefined;
    private ssrc: number | undefined;
    get udpConnection() : UdpConnection | undefined {
        if(this.secretKey && this.hostname && this.port && this.ssrc) 
            return {
                secretKey: this.secretKey, port: this.port,
                hostname: this.hostname, ssrc: this.ssrc
            };
        else
            return undefined;
    }
    
    constructor(props: VoiceGatewayProps) {
        this.gateway = new WebSocket("wss://" + props.address);

        this.gateway.onopen = this.onStart;
        this.gateway.onmessage = this.onMessage;
        this.gateway.onclose = this.onClose;

        this.props = props;
    }

    private onMessage = (event: MessageEvent) => {
        const message = JSON.parse(event.data);

        switch(message.op) {
            case Opcodes.Hello:
                console.log("HELLO");
                if(this.connected)
                    this.resume();
                else
                    this.identify();
                
                this.startHeartbeat(message.d.heartbeat_interval);
                this.connected = true;
                break;
            case Opcodes.Ready:
                console.log("READY");
                this.hostname = message.d.ip;
                this.port = Number(message.d.port);

                this.selectProtocol();
                this.setSpeak();
                //this.socket = new UdpSocket(this.ip, this.port);
                break;
            case Opcodes.Session:
                console.log("SESSION");
                this.ssrc = message.d.encodings[0].ssrc;
                this.secretKey = Uint8Array.from(message.d.secret_key);
                break;
            default:
                console.log(message);
        }
    }

    private resumeConnection() {
        this.gateway = new WebSocket("wss://" + this.props.address);

        this.gateway.onopen = this.onStart;
        this.gateway.onmessage = this.onMessage;
        this.gateway.onclose = this.onClose;
    }

    private resume() {
        const msg = JSON.stringify({
            op: Opcodes.Resume,
            d: {
                server_id: this.props.serverId,
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
                    address: this.hostname,
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

    private startHeartbeat(interval: number) {
        const heartbeat = JSON.stringify({
            op: Opcodes.Heartbeat,
            d: null
        });
        
        this.interval = setInterval(() => {
            this.gateway.send(heartbeat);
        }, interval);
    }

    private identify() {
        const msg = JSON.stringify({
            op: Opcodes.Identify,
            d: {
                server_id: this.props.serverId,
                user_id: this.props.userId,
                session_id: this.props.sessionId,
                token: this.props.token
            }
        });
    
        this.gateway.send(msg);
    }

    private onStart = (event: Event) => {
        //console.log(event);
    }

    private onClose = (event: CloseEvent) => {
        clearInterval(this.interval);
        this.resumeConnection();
    }
}

export default VoiceGateway;