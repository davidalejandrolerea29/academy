// RecordingService — graba la videollamada en el navegador del profesor.
// Compone los videos en un <canvas>, mezcla el audio (Web Audio), graba con MediaRecorder
// y sube el webm por chunks al backend (almacenamiento local + retención 48h).

export interface RecordingSource {
    screen: MediaStream | null;                 // pantalla compartida activa (o null)
    cameras: { id: string; stream: MediaStream; name: string }[]; // cámaras (local + remotas)
    audioStreams: MediaStream[];                // streams con audio a mezclar
}

export class RecordingService {
    private apiUrl: string;
    private token: string;
    private getSource: () => RecordingSource;

    private canvas: HTMLCanvasElement | null = null;
    private ctx: CanvasRenderingContext2D | null = null;
    private videoEls: Map<string, HTMLVideoElement> = new Map();
    private rafId = 0;

    private audioCtx: AudioContext | null = null;
    private dest: MediaStreamAudioDestinationNode | null = null;
    private connectedAudio: Set<string> = new Set();

    private recorder: MediaRecorder | null = null;
    private recordingId: number | null = null;
    private startTime = 0;
    private uploadChain: Promise<any> = Promise.resolve();
    public recording = false;

    private readonly W = 1280;
    private readonly H = 720;

    constructor(apiUrl: string, token: string, getSource: () => RecordingSource) {
        this.apiUrl = apiUrl;
        this.token = token;
        this.getSource = getSource;
    }

    async start(roomId: string | number): Promise<void> {
        // 1) Crear la grabación en el backend
        const res = await fetch(`${this.apiUrl}/auth/recordings/start`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({ room_id: roomId }),
        });
        if (!res.ok) throw new Error('No autorizado a grabar o error del servidor.');
        const data = await res.json();
        this.recordingId = data.recording_id;

        // 2) Canvas + loop de dibujo
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.W;
        this.canvas.height = this.H;
        this.ctx = this.canvas.getContext('2d');
        this.drawLoop();

        // 3) Audio mezclado
        this.audioCtx = new AudioContext();
        this.dest = this.audioCtx.createMediaStreamDestination();

        // 4) Stream compuesto (video del canvas + audio mezclado)
        const canvasStream = this.canvas.captureStream(24);
        const mixed = new MediaStream();
        canvasStream.getVideoTracks().forEach(t => mixed.addTrack(t));
        this.dest.stream.getAudioTracks().forEach(t => mixed.addTrack(t));

        // 5) MediaRecorder -> sube cada chunk
        const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
            ? 'video/webm;codecs=vp8,opus'
            : 'video/webm';
        this.recorder = new MediaRecorder(mixed, { mimeType: mime, videoBitsPerSecond: 1_500_000 });
        this.recorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) this.queueUpload(e.data);
        };
        this.startTime = Date.now();
        this.recorder.start(4000); // chunk cada 4s
        this.recording = true;
    }

    private queueUpload(blob: Blob) {
        const id = this.recordingId;
        if (id == null) return;
        // Encadena las subidas para preservar el ORDEN de los chunks (clave para webm)
        this.uploadChain = this.uploadChain.then(async () => {
            const fd = new FormData();
            fd.append('chunk', blob, 'chunk.webm');
            try {
                await fetch(`${this.apiUrl}/auth/recordings/${id}/chunk`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${this.token}`, 'Accept': 'application/json' },
                    body: fd,
                });
            } catch (e) {
                console.error('[Recording] fallo subiendo chunk:', e);
            }
        });
    }

    private getVideoEl(id: string, stream: MediaStream): HTMLVideoElement {
        let el = this.videoEls.get(id);
        if (!el || el.srcObject !== stream) {
            el = document.createElement('video');
            el.srcObject = stream;
            el.muted = true;
            el.playsInline = true;
            el.play().catch(() => {});
            this.videoEls.set(id, el);
        }
        return el;
    }

    private drawLoop = () => {
        const ctx = this.ctx;
        if (!ctx) return;
        const src = this.getSource();

        ctx.fillStyle = '#111827';
        ctx.fillRect(0, 0, this.W, this.H);

        const drawContain = (el: HTMLVideoElement, x: number, y: number, w: number, h: number) => {
            if (!el.videoWidth) return;
            const r = Math.min(w / el.videoWidth, h / el.videoHeight);
            const dw = el.videoWidth * r, dh = el.videoHeight * r;
            ctx.drawImage(el, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
        };
        const drawCover = (el: HTMLVideoElement, x: number, y: number, w: number, h: number) => {
            if (!el.videoWidth) return;
            const r = Math.max(w / el.videoWidth, h / el.videoHeight);
            const dw = el.videoWidth * r, dh = el.videoHeight * r;
            ctx.save();
            ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
            ctx.drawImage(el, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
            ctx.restore();
        };

        if (src.screen) {
            // Pantalla grande (contain) + cámaras chicas abajo
            drawContain(this.getVideoEl('screen', src.screen), 0, 0, this.W, this.H - 150);
            const n = Math.min(src.cameras.length, 5);
            const tw = 200, th = 130, gap = 10;
            let x0 = (this.W - (n * tw + (n - 1) * gap)) / 2;
            src.cameras.slice(0, n).forEach((c, i) => {
                drawCover(this.getVideoEl(c.id, c.stream), x0 + i * (tw + gap), this.H - 140, tw, th);
            });
        } else {
            // Grilla de cámaras
            const cams = src.cameras;
            const n = Math.max(cams.length, 1);
            const cols = n <= 1 ? 1 : n <= 4 ? 2 : 3;
            const rows = Math.ceil(n / cols);
            const cw = this.W / cols, ch = this.H / rows;
            cams.forEach((c, i) => {
                const cx = (i % cols) * cw, cy = Math.floor(i / cols) * ch;
                drawCover(this.getVideoEl(c.id, c.stream), cx + 4, cy + 4, cw - 8, ch - 8);
            });
        }

        // Mezcla audio: conecta las fuentes nuevas que aparezcan
        if (this.audioCtx && this.dest) {
            for (const s of src.audioStreams) {
                if (s.getAudioTracks().length === 0) continue;
                const key = s.id;
                if (!this.connectedAudio.has(key)) {
                    try {
                        this.audioCtx.createMediaStreamSource(s).connect(this.dest);
                        this.connectedAudio.add(key);
                    } catch (e) { /* noop */ }
                }
            }
        }

        this.rafId = requestAnimationFrame(this.drawLoop);
    };

    async stop(): Promise<void> {
        if (!this.recording) return;
        this.recording = false;
        const duration = Math.round((Date.now() - this.startTime) / 1000);

        await new Promise<void>((resolve) => {
            if (!this.recorder) return resolve();
            this.recorder.onstop = () => resolve();
            try { this.recorder.stop(); } catch { resolve(); }
        });

        cancelAnimationFrame(this.rafId);
        this.videoEls.forEach(el => { el.srcObject = null; });
        this.videoEls.clear();
        try { await this.audioCtx?.close(); } catch { /* noop */ }
        this.connectedAudio.clear();

        // Esperar a que terminen todas las subidas de chunks y recién ahí completar
        await this.uploadChain;
        if (this.recordingId != null) {
            try {
                await fetch(`${this.apiUrl}/auth/recordings/${this.recordingId}/complete`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.token}`,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                    },
                    body: JSON.stringify({ duration }),
                });
            } catch (e) { console.error('[Recording] fallo al completar:', e); }
        }
        this.recordingId = null;
    }
}
