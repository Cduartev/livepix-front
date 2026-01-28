"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLojaPix } from "@/stores/useLojaPix";
import {
    Activity,
    History,
    Volume2,
    Wifi,
    Trash2,
    Eye,
    RefreshCcw,
    Bell,
    TrendingUp,
    Clock,
    CheckCircle2,
    AlertCircle
} from "lucide-react";

type AlertEventRaw = {
    paymentId: number;
    status?: string;
    ok?: unknown;
    nome?: string;
    valor?: number;
    mensagem?: string;
    em?: string;
};

type AlertEvent = {
    paymentId: number;
    status: string;
    nome: string;
    valor: number;
    mensagem: string;
    em: string; // ISO
};

type QueueItem = AlertEvent & { _id: string };

const DISPLAY_MS = 6000;
const GAP_MS = 250;

const HISTORY_LIMIT = 50;
const LS_KEY = "meetplay:pix-history:v1";

// Som fixo do seu public/
const SOUND_URL = "/sounds/pix.mp3";

// Evita “metralhar” som quando chegam vários eventos rápido
const SOUND_THROTTLE_MS = 450;

function formatBRL(value: number) {
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
    }).format(value);
}

function formatTimeBR(iso: string) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
}

function buildSseUrl(apiBase: string) {
    const base = (apiBase || "").replace(/\/$/, "");
    if (!base) return "/api/alerts/stream";
    return `${base}/alerts/stream`;
}

function safeParseHistory(value: string | null): QueueItem[] {
    if (!value) return [];
    try {
        const parsed = JSON.parse(value) as QueueItem[];
        if (!Array.isArray(parsed)) return [];
        return parsed
            .filter((x) => x && typeof x === "object" && typeof x._id === "string")
            .slice(0, HISTORY_LIMIT);
    } catch {
        return [];
    }
}

export default function PaginaSobreposicaoAlertas() {
    const [current, setCurrent] = useState<QueueItem | null>(null);

    // diagnóstico SSE
    const [conn, setConn] = useState<"connecting" | "connected" | "error">(
        "connecting"
    );

    // diagnóstico áudio
    const [audioState, setAudioState] = useState<
        "init" | "ready" | "blocked" | "pending"
    >("init");
    const [audioHint, setAudioHint] = useState("");

    // histórico
    const [history, setHistory] = useState<QueueItem[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);

    // fila e timers
    const queueRef = useRef<QueueItem[]>([]);
    const showingRef = useRef(false);

    const timersRef = useRef<number[]>([]);
    const addTimer = (id: number) => timersRef.current.push(id);
    const clearTimers = () => {
        timersRef.current.forEach((t) => window.clearTimeout(t));
        timersRef.current = [];
    };

    const apiBase = useMemo(() => {
        const env = (process.env.NEXT_PUBLIC_API ?? "").trim();
        return env || "/api";
    }, []);

    // ===== ÁUDIO MP3 =====
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const pendingPlayRef = useRef(false);
    const lastPlayAtRef = useRef(0);

    const initAudio = () => {
        if (audioRef.current) return audioRef.current;

        const a = new Audio(SOUND_URL);
        a.preload = "auto";
        a.volume = 1.0; // alto
        audioRef.current = a;

        return a;
    };

    // tenta “armar” o áudio (play/pause mutado)
    const tryUnlockAudio = async () => {
        const a = initAudio();

        try {
            a.currentTime = 0;
            a.muted = true;
            await a.play();
            a.pause();
            a.muted = false;

            setAudioState("ready");
            setAudioHint("");

            // se estava pendente, toca agora
            if (pendingPlayRef.current) {
                pendingPlayRef.current = false;
                void playAlertSound();
            }

            return true;
        } catch {
            setAudioState((prev) => (prev === "pending" ? "pending" : "blocked"));
            if (!audioHint) {
                setAudioHint("Som bloqueado. Clique para liberar.");
            }
            return false;
        }
    };

    const playAlertSound = async () => {
        const a = initAudio();

        const now = Date.now();
        if (now - lastPlayAtRef.current < SOUND_THROTTLE_MS) return;
        lastPlayAtRef.current = now;

        try {
            a.volume = 1.0;
            a.muted = false;
            a.currentTime = 0;

            await a.play();

            setAudioState("ready");
            setAudioHint("");
        } catch {
            // autoplay bloqueado -> marca pendente
            pendingPlayRef.current = true;
            setAudioState("pending");
            setAudioHint("Som bloqueado. Clique para liberar.");
        }
    };

    // Inicializa + tenta unlock e registra “gestos” para destravar
    useEffect(() => {
        setAudioState("init");
        initAudio();
        void tryUnlockAudio();

        const onGesture = () => {
            void tryUnlockAudio();
        };

        window.addEventListener("pointerdown", onGesture);
        window.addEventListener("keydown", onGesture);
        window.addEventListener("touchstart", onGesture);

        const onVis = () => {
            if (document.visibilityState === "visible") void tryUnlockAudio();
        };
        document.addEventListener("visibilitychange", onVis);

        return () => {
            window.removeEventListener("pointerdown", onGesture);
            window.removeEventListener("keydown", onGesture);
            window.removeEventListener("touchstart", onGesture);
            document.removeEventListener("visibilitychange", onVis);

            // cleanup
            audioRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // carregar histórico
    useEffect(() => {
        const initial = safeParseHistory(
            typeof window !== "undefined" ? window.localStorage.getItem(LS_KEY) : null
        );
        if (initial.length) setHistory(initial);
    }, []);

    // persistir histórico
    useEffect(() => {
        try {
            window.localStorage.setItem(
                LS_KEY,
                JSON.stringify(history.slice(0, HISTORY_LIMIT))
            );
        } catch {
            // ignore
        }
    }, [history]);

    function showNext() {
        const next = queueRef.current.shift();
        if (!next) {
            showingRef.current = false;
            setCurrent(null);
            return;
        }

        showingRef.current = true;
        setCurrent(next);

        addTimer(
            window.setTimeout(() => {
                setCurrent(null);
                addTimer(window.setTimeout(showNext, GAP_MS));
            }, DISPLAY_MS)
        );
    }

    const clearHistory = () => {
        setHistory([]);
        setUnreadCount(0);
        try {
            window.localStorage.removeItem(LS_KEY);
        } catch {
            // ignore
        }
    };

    const markAllRead = () => setUnreadCount(0);

    // SSE
    useEffect(() => {
        const url = buildSseUrl(apiBase);

        setConn("connecting");
        const es = new EventSource(url);

        const onConnected = () => setConn("connected");

        const onPix = (event: Event) => {
            try {
                const raw = JSON.parse((event as MessageEvent).data) as AlertEventRaw;
                const pix = useLojaPix.getState();

                const nome = (raw.nome ?? "").trim() || "Anônimo";
                const mensagem = (raw.mensagem ?? "").trim();
                const valor = Number(raw.valor ?? 0);

                const statusNorm = pix.normalizeStatus(raw.status, raw.ok);
                const status =
                    statusNorm === "UNKNOWN" ? "RECEBIDO" : String(statusNorm);

                const normalized: AlertEvent = {
                    paymentId: Number(raw.paymentId),
                    status,
                    nome,
                    mensagem,
                    valor: Number.isFinite(valor) ? valor : 0,
                    em: raw.em && raw.em.trim() ? raw.em : new Date().toISOString(),
                };

                pix.updateStatusIfExists(normalized.paymentId, normalized.status);

                const item: QueueItem = {
                    ...normalized,
                    _id: `${normalized.paymentId}-${Date.now()}`,
                };

                // 🔊 toca seu MP3
                void playAlertSound();

                // histórico
                setHistory((prev) => [item, ...prev].slice(0, HISTORY_LIMIT));
                setUnreadCount((c) => Math.min(c + 1, HISTORY_LIMIT));

                // fila de exibição
                queueRef.current.push(item);
                if (!showingRef.current) showNext();
            } catch {
                // ignora
            }
        };

        es.addEventListener("connected", onConnected);
        es.addEventListener("pix", onPix);

        es.onerror = () => setConn("error");

        return () => {
            clearTimers();
            es.removeEventListener("connected", onConnected);
            es.removeEventListener("pix", onPix);
            es.close();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [apiBase]);

    return (
        <main className="min-h-screen w-full bg-[#0a0a0c] text-zinc-100 font-sans selection:bg-indigo-500/30">
            {/* Header / Top Bar */}
            <div className="h-16 border-b border-zinc-800/50 bg-black/40 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-50">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                        <div className="h-8 w-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
                            <Activity className="h-5 w-5 text-white" />
                        </div>
                        <h1 className="font-bold text-lg tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
                            LivePix Control
                        </h1>
                    </div>

                    <div className="hidden sm:flex items-center gap-4">
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-800">
                            <div className={`h-2 w-2 rounded-full ${conn === "connected" ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-red-500 animate-pulse"}`} />
                            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                                <Wifi className="h-3 w-3" />
                                {conn === "connected" ? "Stream Live" : conn === "connecting" ? "Conectando..." : "Erro"}
                            </span>
                        </div>

                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 cursor-pointer hover:bg-zinc-800 transition-colors" onClick={() => void tryUnlockAudio()}>
                            <div className={`h-2 w-2 rounded-full ${audioState === "ready" ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-amber-500 animate-pulse"}`} />
                            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5 line-clamp-1">
                                <Volume2 className="h-3.5 w-3.5" />
                                {audioState === "ready" ? "Áudio Pronto" : "Áudio Bloqueado"}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {unreadCount > 0 && (
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] font-bold animate-in fade-in zoom-in">
                            <Bell className="h-3 w-3" />
                            {unreadCount} NOVOS
                        </div>
                    )}
                    <Button variant="ghost" size="sm" onClick={markAllRead} className="text-zinc-400 hover:text-white hover:bg-zinc-800/50 text-[11px] font-semibold h-8 uppercase tracking-widest">
                        Check All
                    </Button>
                </div>
            </div>

            <div className="p-6 max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* Lado Esquerdo: Alerta Atual & Stats */}
                <div className="lg:col-span-7 space-y-6">

                    {/* Hero Alerta */}
                    <Card className="bg-zinc-900/40 border-zinc-800/50 backdrop-blur shadow-2xl overflow-hidden relative group transition-all duration-500 hover:border-indigo-500/30">
                        {current && (
                            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent animate-shimmer scale-x-150"></div>
                        )}
                        <CardContent className="p-0">
                            {current ? (
                                <div className="p-10 flex flex-col items-center text-center space-y-6 animate-in fade-in zoom-in duration-500">
                                    <div className="relative">
                                        <div className="absolute -inset-4 bg-indigo-500/20 rounded-full blur-2xl animate-pulse"></div>
                                        <div className="relative h-20 w-20 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-indigo-500/40 rotate-12 transition-transform duration-700 hover:rotate-0">
                                            <TrendingUp className="h-10 w-10 text-white" />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Badge variant="outline" className="bg-indigo-500/10 border-indigo-500/30 text-indigo-400 text-xs py-1 px-3 rounded-full font-mono uppercase tracking-[0.2em] mb-4">
                                            Novo Depósito • {current.status}
                                        </Badge>
                                        <h2 className="text-5xl font-black tracking-tighter sm:text-6xl lg:text-7xl">
                                            {formatBRL(current.valor)}
                                        </h2>
                                        <p className="text-xl sm:text-2xl font-semibold text-zinc-400 flex items-center justify-center gap-2">
                                            de <span className="text-white underline decoration-indigo-500/40 decoration-4 underline-offset-8">{current.nome}</span>
                                        </p>
                                    </div>

                                    {current.mensagem ? (
                                        <div className="max-w-md w-full p-6 bg-zinc-950/50 border border-zinc-800 rounded-2xl relative overflow-hidden group-hover:border-zinc-700 transition-colors">
                                            <div className="absolute top-2 left-3 opacity-20"><Volume2 size={32} /></div>
                                            <p className="text-lg text-zinc-100 leading-relaxed font-medium italic relative z-10 break-words">
                                                “{current.mensagem}”
                                            </p>
                                        </div>
                                    ) : (
                                        <p className="text-zinc-500 italic text-sm">(Sem mensagem do doador)</p>
                                    )}

                                    <div className="flex items-center gap-6 text-zinc-500 text-xs font-mono uppercase tracking-widest pt-4">
                                        <div className="flex items-center gap-2">
                                            <Clock className="h-3.5 w-3.5" />
                                            {formatTimeBR(current.em)}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Activity className="h-3.5 w-3.5" />
                                            ID #{current.paymentId}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="h-[480px] flex flex-col items-center justify-center text-center p-10 space-y-4 opacity-40">
                                    <div className="h-20 w-20 bg-zinc-800 rounded-full flex items-center justify-center text-zinc-600">
                                        <Activity className="h-10 w-10" />
                                    </div>
                                    <div className="space-y-1">
                                        <h3 className="text-xl font-bold text-zinc-300">Aguardando Eventos</h3>
                                        <p className="text-sm max-w-[280px]">Os alertas automáticos aparecerão aqui assim que um Pix for confirmado.</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <div className="h-1 w-8 bg-zinc-800 rounded-full animate-pulse"></div>
                                        <div className="h-1 w-8 bg-zinc-800 rounded-full animate-pulse delay-150"></div>
                                        <div className="h-1 w-8 bg-zinc-800 rounded-full animate-pulse delay-300"></div>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <div className="grid grid-cols-2 gap-4">
                        <Button
                            variant="secondary"
                            className="bg-zinc-900/60 border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700 text-zinc-300 h-14 rounded-2xl gap-3 transition-all"
                            onClick={() => void playAlertSound()}
                        >
                            <Volume2 className="h-5 w-5" />
                            <span className="font-bold uppercase tracking-tight">Testar Som</span>
                        </Button>
                        <Button
                            variant="secondary"
                            className="bg-zinc-900/60 border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700 text-zinc-300 h-14 rounded-2xl gap-3 transition-all"
                            onClick={() => window.location.reload()}
                        >
                            <RefreshCcw className="h-5 w-5" />
                            <span className="font-bold uppercase tracking-tight">Reiniciar</span>
                        </Button>
                    </div>
                </div>

                {/* Lado Direito: Histórico */}
                <div className="lg:col-span-5 flex flex-col h-full max-h-[calc(100vh-140px)]">
                    <Card className="bg-zinc-900/40 border-zinc-800/50 backdrop-blur shadow-xl flex flex-col h-full overflow-hidden">
                        <CardContent className="p-0 flex flex-col h-full">
                            <div className="p-5 border-b border-zinc-800 flex items-center justify-between bg-black/20">
                                <div className="flex items-center gap-3">
                                    <History className="h-5 w-5 text-zinc-500" />
                                    <h3 className="font-bold text-sm uppercase tracking-widest text-zinc-300">Recentes</h3>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={clearHistory}
                                    className="h-8 text-[10px] font-bold text-zinc-500 hover:text-red-400 hover:bg-red-500/10 uppercase tracking-tighter"
                                >
                                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                                    Limpar
                                </Button>
                            </div>

                            <ScrollArea className="flex-1 p-5">
                                <div className="space-y-4">
                                    {history.length === 0 ? (
                                        <div className="py-20 flex flex-col items-center justify-center text-center opacity-30 space-y-3">
                                            <History className="h-10 w-10" />
                                            <p className="text-sm italic">O histórico está vazio.</p>
                                        </div>
                                    ) : (
                                        history.map((item, idx) => (
                                            <div
                                                key={item._id}
                                                className={`group relative rounded-2xl border ${idx === 0 ? 'border-indigo-500/30 bg-indigo-500/5 shadow-lg shadow-indigo-500/5' : 'border-zinc-800 bg-zinc-900/30'} p-4 transition-all duration-300 hover:translate-x-1 hover:border-zinc-700 overflow-hidden`}
                                            >
                                                {idx === 0 && (
                                                    <div className="absolute top-0 right-0 px-2 py-0.5 bg-indigo-500 text-[8px] font-bold text-white uppercase rounded-bl-lg tracking-widest">Recent</div>
                                                )}

                                                <div className="flex items-start justify-between gap-4">
                                                    <div className="min-w-0 space-y-1">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="text-sm font-bold truncate text-white">
                                                                {item.nome}
                                                            </span>
                                                            <span className="text-sm font-black text-indigo-400">
                                                                {formatBRL(item.valor)}
                                                            </span>
                                                        </div>

                                                        <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-500 uppercase tracking-tighter">
                                                            <Clock className="h-3 w-3" />
                                                            {formatTimeBR(item.em)}
                                                            <span className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-[8px] text-zinc-400">
                                                                #{item.paymentId}
                                                            </span>
                                                        </div>

                                                        {item.mensagem && (
                                                            <div className="text-xs text-zinc-400 mt-2 line-clamp-2 leading-relaxed italic border-l border-zinc-800 pl-3 group-hover:border-zinc-600 transition-colors">
                                                                “{item.mensagem}”
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Button
                                                            variant="secondary"
                                                            size="icon"
                                                            className="h-8 w-8 rounded-xl bg-zinc-800 hover:bg-indigo-600 hover:text-white border-zinc-700"
                                                            onClick={() => setCurrent(item)}
                                                            title="Reexibir alerta"
                                                        >
                                                            <Eye className="h-3.5 w-3.5" />
                                                        </Button>
                                                        <Button
                                                            variant="secondary"
                                                            size="icon"
                                                            className="h-8 w-8 rounded-xl bg-zinc-800 hover:bg-zinc-700 border-zinc-700"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                void playAlertSound();
                                                            }}
                                                            title="Tocar som"
                                                        >
                                                            <Volume2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </ScrollArea>

                            {history.length > 0 && (
                                <div className="p-4 border-t border-zinc-800/50 text-[9px] font-bold text-zinc-600 uppercase tracking-[0.2em] text-center bg-black/10">
                                    History Limit: {HISTORY_LIMIT} Events
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            <style jsx global>{`
                @keyframes shimmer {
                    0% { transform: translateX(-100%) scaleX(2); }
                    100% { transform: translateX(100%) scaleX(2); }
                }
                .animate-shimmer {
                    animation: shimmer 2s infinite ease-in-out;
                }
                ::-webkit-scrollbar {
                    width: 6px;
                }
                ::-webkit-scrollbar-track {
                    background: transparent;
                }
                ::-webkit-scrollbar-thumb {
                    background: #27272a;
                    border-radius: 10px;
                }
                ::-webkit-scrollbar-thumb:hover {
                    background: #3f3f46;
                }
            `}</style>
        </main>
    );
}
