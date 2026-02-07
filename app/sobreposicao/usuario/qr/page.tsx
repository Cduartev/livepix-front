"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Copy, ChevronLeft, ChevronRight, X, User, Mail, DollarSign, MessageSquare, ShieldCheck, Clock } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import { useLojaPix, type PixCharge, type PixStatus } from "@/stores/useLojaPix";

type CreatePixChargeRequest = {
    nome: string;
    valor: number;
    mensagem?: string;
    email: string;
};

type CreatePixChargeResponse = {
    paymentId: number;
    status: PixStatus;
    qrCode: string | null;
    qrCodeBase64: string | null;
    expiresAt?: string | null;
};

type PixSseEventRaw = {
    paymentId: number;
    status?: string;
    ok?: unknown;
    nome?: string;
    valor?: number;
    mensagem?: string;
    em?: string;
};

function toNumberBR(value: string) {
    const normalized = value.replace(/\./g, "").replace(",", ".");
    const n = Number(normalized);
    return Number.isFinite(n) ? n : NaN;
}

function formatCountdown(ms: number) {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function PaginaSobreposicaoQr() {
    const apiBase = useMemo(
        () => (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080").replace(/\/$/, ""),
        []
    );

    // store
    const enqueue = useLojaPix((s) => s.enqueue);
    const closeActive = useLojaPix((s) => s.closeActive);
    const setActive = useLojaPix((s) => s.setActive);
    const activePaymentId = useLojaPix((s) => s.activePaymentId);
    const active = useLojaPix((s) => s.getActive());
    const queue = useLojaPix((s) => s.queue);

    // form
    const [nome, setNome] = useState("");
    const [valor, setValor] = useState("10,00");
    const [mensagem, setMensagem] = useState("");
    const [email, setEmail] = useState("");

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    // contador
    const [countdown, setCountdown] = useState<string | null>(null);

    const qrImgSrc = active?.qrCodeBase64 ? `data:image/png;base64,${active.qrCodeBase64}` : null;
    const isApproved = active?.status === "APPROVED";
    const isExpired = active?.status === "EXPIRED";

    // fila: índice do ativo
    const activeIndex = activePaymentId
        ? queue.findIndex((q) => q.paymentId === activePaymentId)
        : -1;

    const hasPrev = activeIndex > 0;
    const hasNext = activeIndex >= 0 && activeIndex < queue.length - 1;

    const prevId = hasPrev ? queue[activeIndex - 1].paymentId : null;
    const nextId = hasNext ? queue[activeIndex + 1].paymentId : null;

    // SSE (QR precisa ouvir também)
    useEffect(() => {
        const url = `${apiBase}/alerts/stream`;
        const es = new EventSource(url);

        const onPix = (event: Event) => {
            try {
                const raw = JSON.parse((event as MessageEvent).data) as PixSseEventRaw;

                const pix = useLojaPix.getState();
                const normalizedStatus = pix.normalizeStatus(raw.status, raw.ok);

                // não sobrescreve com UNKNOWN
                if (normalizedStatus === "UNKNOWN") return;

                pix.updateStatusIfExists(Number(raw.paymentId), normalizedStatus);
            } catch {
                // ignore
            }
        };

        es.addEventListener("pix", onPix);

        return () => {
            es.removeEventListener("pix", onPix);
            es.close();
        };
    }, [apiBase]);

    async function gerarPix() {
        setError(null);

        const v = toNumberBR(valor);
        if (!nome.trim()) {
            setError("Informe o nome.");
            return;
        }
        if (!email.trim() || !email.includes("@")) {
            setError("Informe um e-mail válido.");
            return;
        }
        if (!Number.isFinite(v) || v <= 0) {
            setError("Informe um valor válido (ex: 10,00).");
            return;
        }

        const payload: CreatePixChargeRequest = {
            nome: nome.trim(),
            valor: Number(v.toFixed(2)),
            mensagem: mensagem.trim() ? mensagem.trim() : undefined,
            email: email.trim(),
        };

        setLoading(true);
        try {
            const r = await fetch(`${apiBase}/pix/cobrar`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!r.ok) {
                const text = await r.text().catch(() => "");
                throw new Error(`Falha ao gerar Pix (HTTP ${r.status}). ${text}`);
            }

            const data = (await r.json()) as CreatePixChargeResponse;

            const normalizedStatus: PixStatus = data.status
                ? useLojaPix.getState().normalizeStatus(data.status, undefined)
                : "PENDING";

            const charge: PixCharge = {
                paymentId: Number(data.paymentId),
                status: normalizedStatus,
                qrCode: data.qrCode ?? null,
                qrCodeBase64: data.qrCodeBase64 ?? null,
                expiresAt: data.expiresAt ?? null,
                createdAt: new Date().toISOString(),
            };

            enqueue(charge);

            if (!charge.qrCodeBase64) {
                setError("Pix gerado, mas não veio o QR Code Base64. Verifique a resposta do backend.");
            }
        } catch (e: any) {
            setError(e?.message ?? "Erro inesperado ao gerar Pix.");
        } finally {
            setLoading(false);
        }
    }

    async function copiarCodigo() {
        const text = active?.qrCode;
        if (!text) return;

        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
        } catch {
            setCopied(false);
            setError("Não foi possível copiar automaticamente. Selecione e copie manualmente.");
        }
    }

    // auto-fechar quando aprovado (mostra check e avança fila)
    useEffect(() => {
        if (!active || !isApproved) return;

        const t = window.setTimeout(() => {
            closeActive(); // remove o ativo e avança para o próximo, se existir
        }, 1400);

        return () => window.clearTimeout(t);
    }, [activePaymentId, isApproved, closeActive, active]);

    // contador de expiração
    useEffect(() => {
        if (!active?.expiresAt) {
            setCountdown(null);
            return;
        }

        const tick = () => {
            const diff = new Date(active.expiresAt!).getTime() - Date.now();
            if (diff <= 0) {
                setCountdown("00:00");
                useLojaPix.getState().updateStatus(active.paymentId, "EXPIRED");
                return;
            }
            setCountdown(formatCountdown(diff));
        };

        tick();
        const id = window.setInterval(tick, 300);
        return () => window.clearInterval(id);
    }, [activePaymentId, active?.expiresAt]);

    // Se expirar, você decide: manter na tela com aviso OU remover e seguir.
    // Aqui: remove automaticamente após 1.2s para não travar fila.
    useEffect(() => {
        if (!active || !isExpired) return;
        const t = window.setTimeout(() => {
            closeActive();
        }, 1200);
        return () => window.clearTimeout(t);
    }, [activePaymentId, isExpired, closeActive, active]);

    return (
        <main className="min-h-screen w-full bg-[#f8fafc] dark:bg-zinc-950 p-4 sm:p-8 flex items-center justify-center font-sans overflow-x-hidden relative">
            {/* Background Decorative Elements */}
            <div className="absolute top-0 -left-4 w-72 h-72 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob"></div>
            <div className="absolute top-0 -right-4 w-72 h-72 bg-purple-400 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-2000"></div>
            <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-400 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-4000"></div>

            <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-2 gap-8 items-start relative z-10">
                {/* Lado Esquerdo: Formulário */}
                <div className="space-y-6">
                    <div className="space-y-2 text-left">
                        <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Enviar Pix</h2>
                        <p className="text-zinc-500 dark:text-zinc-400 text-lg">
                            Preencha os dados abaixo para gerar seu QR Code e apoiar a live.
                        </p>
                    </div>

                    <Card className="border-zinc-200/50 dark:border-zinc-800/50 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl shadow-2xl overflow-hidden rounded-3xl">
                        <CardContent className="p-8 space-y-5">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="nome" className="text-zinc-700 dark:text-zinc-300 font-medium">Seu Nome</Label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-2.5 h-5 w-5 text-zinc-400" />
                                        <Input
                                            id="nome"
                                            value={nome}
                                            onChange={(e) => setNome(e.target.value)}
                                            placeholder="Ex: João da Live"
                                            className="pl-10 h-11 border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/50 rounded-xl"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="valor" className="text-zinc-700 dark:text-zinc-300 font-medium">Valor contributors (R$)</Label>
                                    <div className="relative">
                                        <DollarSign className="absolute left-3 top-2.5 h-5 w-5 text-zinc-400" />
                                        <Input
                                            id="valor"
                                            value={valor}
                                            onChange={(e) => setValor(e.target.value)}
                                            placeholder="10,00"
                                            className="pl-10 h-11 border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/50 rounded-xl"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="email" className="text-zinc-700 dark:text-zinc-300 font-medium">E-mail</Label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-2.5 h-5 w-5 text-zinc-400" />
                                    <Input
                                        id="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="seu@email.com"
                                        type="email"
                                        className="pl-10 h-11 border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/50 rounded-xl"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="mensagem" className="text-zinc-700 dark:text-zinc-300 font-medium">Mensagem (opcional)</Label>
                                <div className="relative flex items-start">
                                    <MessageSquare className="absolute left-3 top-3 h-5 w-5 text-zinc-400" />
                                    <textarea
                                        id="mensagem"
                                        value={mensagem}
                                        onChange={(e) => setMensagem(e.target.value)}
                                        placeholder="Escreva algo legal aqui..."
                                        maxLength={140}
                                        className="w-full min-h-[100px] pl-10 pt-2.5 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/50 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
                                    />
                                </div>
                            </div>

                            {error && (
                                <div className="p-3 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 rounded-xl text-red-600 dark:text-red-400 text-sm flex items-center gap-2">
                                    <X className="h-4 w-4" />
                                    {error}
                                </div>
                            )}

                            <Button
                                onClick={gerarPix}
                                disabled={loading}
                                className="w-full h-12 text-lg font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                            >
                                {loading ? (
                                    <div className="flex items-center gap-2 animate-pulse">
                                        Gerando Pix...
                                    </div>
                                ) : (
                                    "Gerar QR Code Agora"
                                )}
                            </Button>

                            <div className="flex items-center justify-center gap-6 pt-4 border-t border-zinc-100 dark:border-zinc-800/50 text-zinc-400 dark:text-zinc-600">
                                <div className="flex items-center gap-1.5 text-xs">
                                    <ShieldCheck className="h-4 w-4" />
                                    Pagamento Seguro
                                </div>
                                <div className="flex items-center gap-1.5 text-xs">
                                    <Clock className="h-4 w-4" />
                                    Expira em 5 min
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Lado Direito: QR Code e Fila */}
                <div className="space-y-6">
                    {active ? (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                            <Card className="border-blue-500/20 dark:border-blue-500/30 bg-blue-50/50 dark:bg-blue-900/10 backdrop-blur-2xl shadow-2xl rounded-3xl overflow-hidden ring-1 ring-blue-500/20">
                                <CardHeader className="p-6 pb-0 flex flex-row items-center justify-between space-y-0">
                                    <CardTitle className="text-xl font-bold text-blue-900 dark:text-blue-100 flex items-center gap-2">
                                        Seu QR Code
                                        {countdown && (
                                            <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-[10px] font-mono font-bold text-blue-600 dark:text-blue-400 animate-pulse">
                                                {countdown}
                                            </span>
                                        )}
                                    </CardTitle>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={closeActive}
                                            className="h-8 w-8 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400"
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </CardHeader>

                                <CardContent className="p-8 space-y-6">
                                    {isApproved ? (
                                        <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                                            <div className="h-24 w-24 bg-green-100 dark:bg-green-900/30 text-green-600 rounded-full flex items-center justify-center shadow-inner animate-bounce">
                                                <CheckCircle2 className="h-16 w-16" />
                                            </div>
                                            <div>
                                                <h3 className="text-2xl font-bold text-green-700 dark:text-green-400">Sucesso!</h3>
                                                <p className="text-zinc-600 dark:text-zinc-400">Seu Pix foi confirmado.</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="relative group mx-auto">
                                                <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl blur opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
                                                <div className="relative bg-white dark:bg-zinc-950 p-4 rounded-2xl ring-1 ring-zinc-200 dark:ring-zinc-800">
                                                    {qrImgSrc ? (
                                                        <img
                                                            src={qrImgSrc}
                                                            alt="QR Code Pix"
                                                            className="w-full h-auto aspect-square object-contain rounded-lg"
                                                        />
                                                    ) : (
                                                        <div className="aspect-square flex items-center justify-center bg-zinc-50 dark:bg-zinc-900 rounded-lg text-zinc-400 border-2 border-dashed border-zinc-200 dark:border-zinc-800">
                                                            Aguardando QR Code...
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {active.qrCode && (
                                                <div className="space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <Label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Pix Copia e Cola</Label>
                                                        <button
                                                            onClick={copiarCodigo}
                                                            className="flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:opacity-80 transition-opacity"
                                                        >
                                                            {copied ? <CheckCircle2 className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                                            {copied ? "Copiado!" : "Copiar Código"}
                                                        </button>
                                                    </div>
                                                    <div className="group relative">
                                                        <div className="p-4 bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-[10px] break-all font-mono leading-relaxed text-zinc-600 dark:text-zinc-400 max-h-24 overflow-y-auto scrollbar-hide">
                                                            {active.qrCode}
                                                        </div>
                                                        <div className="absolute inset-0 bg-gradient-to-t from-zinc-50 dark:from-zinc-950/50 via-transparent to-transparent pointer-events-none h-6 top-auto bottom-0 rounded-b-2xl opacity-50"></div>
                                                    </div>
                                                </div>
                                            )}

                                            {isExpired && (
                                                <div className="p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20 rounded-xl text-amber-600 dark:text-amber-400 text-xs italic text-center">
                                                    Este código expirou e será removido em breve.
                                                </div>
                                            )}
                                        </>
                                    )}

                                    {/* Navegação entre QRs se houver fila */}
                                    {queue.length > 1 && (
                                        <div className="flex items-center justify-between pt-4 border-t border-white dark:border-zinc-800/30">
                                            <div className="flex items-center gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    disabled={!prevId}
                                                    onClick={() => prevId && setActive(prevId)}
                                                    className="h-8 w-8 rounded-full hover:bg-white/50 dark:hover:bg-zinc-800"
                                                >
                                                    <ChevronLeft className="h-4 w-4" />
                                                </Button>
                                                <span className="text-xs font-medium text-zinc-500">
                                                    {activeIndex + 1} de {queue.length}
                                                </span>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    disabled={!nextId}
                                                    onClick={() => nextId && setActive(nextId)}
                                                    className="h-8 w-8 rounded-full hover:bg-white/50 dark:hover:bg-zinc-800"
                                                >
                                                    <ChevronRight className="h-4 w-4" />
                                                </Button>
                                            </div>
                                            <div className="text-[10px] font-mono text-zinc-400">
                                                ID: {active.paymentId}
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center p-12 text-center space-y-4 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl opacity-50">
                            <div className="h-16 w-16 bg-zinc-100 dark:bg-zinc-900 rounded-full flex items-center justify-center text-zinc-400">
                                <ShieldCheck className="h-8 w-8" />
                            </div>
                            <div className="space-y-1">
                                <p className="font-semibold text-zinc-900 dark:text-zinc-50">Nenhum Pix ativo</p>
                                <p className="text-sm text-zinc-500">Preencha o formulário para gerar um QR Code.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <style jsx global>{`
                @keyframes blob {
                    0% { transform: translate(0px, 0px) scale(1); }
                    33% { transform: translate(30px, -50px) scale(1.1); }
                    66% { transform: translate(-20px, 20px) scale(0.9); }
                    100% { transform: translate(0px, 0px) scale(1); }
                }
                .animate-blob {
                    animation: blob 7s infinite;
                }
                .animation-delay-2000 {
                    animation-delay: 2s;
                }
                .animation-delay-4000 {
                    animation-delay: 4s;
                }
                .scrollbar-hide::-webkit-scrollbar {
                    display: none;
                }
                .scrollbar-hide {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            `}</style>
        </main>
    );
}
