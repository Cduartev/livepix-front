"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLojaPix } from "@/stores/useLojaPix";

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
        day: "2-digit",
        month: "2-digit",
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
                setAudioHint("Som bloqueado pelo navegador. Clique/tecla 1x para liberar.");
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
            setAudioHint("Som bloqueado. Clique/tecla 1x para liberar e tocar os próximos.");
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
        <main className="min-h-screen w-full bg-transparent p-6">
            {/* Top bar */}
            <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary">
                        SSE:{" "}
                        {conn === "connecting"
                            ? "conectando..."
                            : conn === "connected"
                                ? "ok"
                                : "erro"}
                    </Badge>

                    <Badge
                        variant={
                            audioState === "ready"
                                ? "default"
                                : audioState === "pending"
                                    ? "destructive"
                                    : "secondary"
                        }
                    >
                        Áudio:{" "}
                        {audioState === "init"
                            ? "iniciando..."
                            : audioState === "ready"
                                ? "ok"
                                : audioState === "pending"
                                    ? "pendente"
                                    : "bloqueado"}
                    </Badge>

                    {unreadCount > 0 ? (
                        <Badge variant="destructive">{unreadCount} novo(s)</Badge>
                    ) : null}

                    {audioHint ? (
                        <span className="text-xs text-muted-foreground">{audioHint}</span>
                    ) : null}
                </div>

                <div className="flex items-center gap-2">
                    <Button variant="secondary" size="sm" onClick={markAllRead}>
                        Marcar como visto
                    </Button>
                    <Button variant="outline" size="sm" onClick={clearHistory}>
                        Limpar histórico
                    </Button>
                </div>
            </div>

            {/* Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Atual */}
                <Card className="border border-border/60 bg-background/90 backdrop-blur shadow-lg">
                    <CardContent className="p-5 space-y-4">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <div className="text-xs text-muted-foreground">Alerta atual</div>
                                <div className="text-sm text-muted-foreground">
                                    {current ? formatTimeBR(current.em) : "—"}
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => void playAlertSound()}
                                    title="Tocar o som agora"
                                >
                                    🔊 Tocar som
                                </Button>
                            </div>
                        </div>

                        {current ? (
                            <>
                                <div className="text-xs text-muted-foreground">
                                    Pix recebido • status:{" "}
                                    <span className="font-medium">{current.status}</span>
                                </div>

                                <div className="text-2xl font-semibold leading-tight">
                                    {current.nome} enviou {formatBRL(current.valor)}
                                </div>

                                {current.mensagem ? (
                                    <div className="text-sm text-foreground/90 break-words">
                                        “{current.mensagem}”
                                    </div>
                                ) : (
                                    <div className="text-sm text-muted-foreground">
                                        Sem mensagem.
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="text-sm text-muted-foreground">
                                Aguardando novos Pix…
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Histórico */}
                <Card className="border border-border/60 bg-background/90 backdrop-blur shadow-lg">
                    <CardContent className="p-5 space-y-3">
                        <div>
                            <div className="text-sm font-medium">Histórico</div>
                            <div className="text-xs text-muted-foreground">
                                Últimos {HISTORY_LIMIT} eventos (persistidos no navegador)
                            </div>
                        </div>

                        <ScrollArea className="h-[520px] pr-3">
                            <div className="space-y-3">
                                {history.length === 0 ? (
                                    <div className="text-sm text-muted-foreground">
                                        Nenhum Pix recebido ainda.
                                    </div>
                                ) : (
                                    history.map((item, idx) => (
                                        <div
                                            key={item._id}
                                            className="rounded-lg border border-border/50 p-3 bg-background/60"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="text-sm font-semibold truncate">
                                                            {item.nome}
                                                        </span>
                                                        <span className="text-sm">
                                                            {formatBRL(item.valor)}
                                                        </span>
                                                        <Badge variant="secondary" className="text-[10px]">
                                                            {item.status}
                                                        </Badge>
                                                    </div>

                                                    <div className="text-xs text-muted-foreground mt-1">
                                                        {formatTimeBR(item.em)} • paymentId: {item.paymentId}
                                                    </div>

                                                    {item.mensagem ? (
                                                        <div className="text-sm text-foreground/90 mt-2 break-words">
                                                            “{item.mensagem}”
                                                        </div>
                                                    ) : null}
                                                </div>

                                                <div className="flex flex-col gap-2 shrink-0">
                                                    <Button
                                                        variant="secondary"
                                                        size="sm"
                                                        onClick={() => void playAlertSound()}
                                                        title="Tocar som"
                                                    >
                                                        🔊
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => setCurrent(item)}
                                                        title="Reexibir este item no alerta atual"
                                                    >
                                                        Reexibir
                                                    </Button>
                                                </div>
                                            </div>

                                            {idx === 0 ? (
                                                <div className="mt-2 text-[11px] text-muted-foreground">
                                                    Mais recente
                                                </div>
                                            ) : null}
                                        </div>
                                    ))
                                )}
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>
            </div>
        </main>
    );
}
