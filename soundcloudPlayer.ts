import { getTrack, TrackInfo } from './soundcloud.ts';
import { getPlayer, PlayerInput } from './player.ts';
import { preparePacket } from './udpSender.ts';
import { UdpSocket } from './udpSender.ts';
import { sendMessage } from './api.ts';

export interface PlayerSettings {
    secretKey: Uint8Array;
    clientId: string;
    ssrc: number;
    port: number;
    hostname: string;
}

const defaultSettings = {
    sampleRate: 48000, channels: 2, frameSize: 960, play: true
};


export class SoundcloudPlayer {
    private secretKey: Uint8Array;
    private clientId : string;
    private ssrc: number;

    private _queue : string[] = [];

    private _playing = false;
    get playing() { return this._playing }

    private socket : UdpSocket;
    private _playerInput : PlayerInput;
    get playerInput() { return this._playerInput }

    constructor(settings: PlayerSettings) {
        this.secretKey = settings.secretKey;
        this.clientId = settings.clientId;
        this.ssrc = settings.ssrc;

        this.socket = new UdpSocket(settings.hostname, settings.port);
        this._playerInput = { ...defaultSettings, audio: new Uint8Array(), trackInfo: undefined, timestamp: 0 };
    }

    public enqueue(id: string) {
        this._queue.push(id);
    }

    public playTrack(audio: Uint8Array, trackInfo: TrackInfo) {
        return new Promise((resolve, reject) => {
            let sequence = 0;
            let nonce = 0;

            this._playerInput.audio = audio;
            this._playerInput.trackInfo = trackInfo;
            this._playerInput.timestamp = 0;
            this._playerInput.play = true;

            const player = getPlayer(this._playerInput);

            const interval = setInterval(async () => {
                const chunk = await player.next();
                
                if(chunk.done) {
                    clearInterval(interval);
                    return resolve(true);
                }

                const packet = preparePacket({
                    chunk: chunk.value,
                    timestamp: this._playerInput.timestamp, 
                    nonce, sequence, secretKey: this.secretKey, 
                    ssrc: this.ssrc
                });

                await this.socket.send(packet);
            
                this._playerInput.timestamp += this.playerInput.frameSize;
                sequence++;
                nonce++;
            }, 20);
        });
    }

    public skip() {
        this._playerInput.play = false;
    }

    public async play(commChannel: string) {
        if(this._playing) return;

        sendMessage(commChannel, "Playin: ");

        try {
            this._playing = true;

            while(true) {
                const trackId = this._queue.shift();
    
                if(!trackId) 
                    throw new Error("Empty queue");
                
                const [trackInfo, audio] = await getTrack(trackId, this.clientId);
                if(!trackInfo) continue;

                await this.playTrack(audio, trackInfo);              
            }
        } catch(e) {
            this._playing = false;
            console.log(e);
        }  
    }
}