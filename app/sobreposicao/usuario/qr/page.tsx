"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Copy, ChevronLeft, ChevronRight, X } from "lucide-react";

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
        () => (process.env.NEXT_PUBLIC_API ?? "http://localhost:8080").replace(/\/$/, ""),
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
        <main className="min-h-screen w-full bg-transparent p-6 flex items-start justify-center">
            <div className="w-full max-w-xl space-y-4">
                {/* FORM GERAR */}
                <Card className="border border-border/60 bg-background/90 backdrop-blur shadow-lg">
                    <CardHeader>
                        <CardTitle>Gerar Pix</CardTitle>
                    </CardHeader>

                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="nome">Seu nome</Label>
                            <Input
                                id="nome"
                                value={nome}
                                onChange={(e) => setNome(e.target.value)}
                                placeholder="Ex: João da Live"
                                maxLength={60}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="valor">Valor (R$)</Label>
                            <Input
                                id="valor"
                                value={valor}
                                onChange={(e) => setValor(e.target.value)}
                                placeholder="Ex: 10,00"
                                inputMode="decimal"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="email">Seu e-mail</Label>
                            <Input
                                id="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Ex: joao@email.com"
                                type="email"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="mensagem">Mensagem (opcional)</Label>
                            <Input
                                id="mensagem"
                                value={mensagem}
                                onChange={(e) => setMensagem(e.target.value)}
                                placeholder="Ex: Salve! Tamo junto!"
                                maxLength={140}
                            />
                        </div>

                        {error ? <div className="text-sm text-red-600">{error}</div> : null}

                        <Button onClick={gerarPix} disabled={loading} className="w-full">
                            {loading ? "Gerando..." : "Gerar Pix"}
                        </Button>

                        {queue.length ? (
                            <div className="text-xs text-muted-foreground">
                                Fila de QR: <span className="font-medium text-foreground">{queue.length}</span>
                            </div>
                        ) : null}
                    </CardContent>
                </Card>

                {/* CARD DO QR */}
                {active ? (
                    <Card className="border border-border/60 bg-background/90 backdrop-blur shadow-lg">
                        <CardHeader>
                            <CardTitle className="flex items-center justify-between gap-3">
                                <span>QR Code</span>

                                {countdown ? (
                                    <span className="text-xs font-medium text-muted-foreground">
                                        expira em: {countdown}
                                    </span>
                                ) : null}
                            </CardTitle>
                        </CardHeader>

                        <CardContent className="space-y-4">
                            {/* Navegação da fila */}
                            <div className="flex items-center justify-between gap-2">
                                <div className="text-sm text-muted-foreground">
                                    {activeIndex >= 0 ? (
                                        <>
                                            item <span className="font-medium text-foreground">{activeIndex + 1}</span> de{" "}
                                            <span className="font-medium text-foreground">{queue.length}</span>
                                        </>
                                    ) : (
                                        <>fila</>
                                    )}
                                </div>

                                <div className="flex items-center gap-2">
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="icon"
                                        onClick={() => prevId && setActive(prevId)}
                                        disabled={!prevId}
                                        aria-label="Anterior"
                                        title="Anterior"
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                    </Button>

                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="icon"
                                        onClick={() => nextId && setActive(nextId)}
                                        disabled={!nextId}
                                        aria-label="Próximo"
                                        title="Próximo"
                                    >
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>

                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={closeActive}
                                        aria-label="Remover da fila"
                                        title="Remover"
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>

                            <div className="text-sm text-muted-foreground">
                                paymentId: <span className="font-medium text-foreground">{active.paymentId}</span> • status:{" "}
                                <span className="font-medium text-foreground">{active.status}</span>
                            </div>

                            {/* Check / QR */}
                            {isApproved ? (
                                <div className="flex flex-col items-center justify-center py-8">
                                    <div className="check-pop">
                                        <CheckCircle2 className="h-20 w-20" />
                                    </div>
                                    <div className="mt-3 text-base font-semibold">Pagamento confirmado</div>
                                    <div className="text-sm text-muted-foreground">Avançando na fila...</div>

                                    <style jsx>{`
                    .check-pop {
                      animation: pop 420ms ease-out forwards;
                      transform: scale(0.8);
                      opacity: 0;
                    }
                    @keyframes pop {
                      0% {
                        transform: scale(0.6);
                        opacity: 0;
                      }
                      70% {
                        transform: scale(1.08);
                        opacity: 1;
                      }
                      100% {
                        transform: scale(1);
                        opacity: 1;
                      }
                    }
                  `}</style>
                                </div>
                            ) : (
                                <>
                                    {qrImgSrc ? (
                                        <div className="flex items-center justify-center">
                                            <img
                                                src={qrImgSrc}
                                                alt="QR Code Pix"
                                                className="w-[320px] h-80 max-w-full object-contain rounded-md"
                                            />
                                        </div>
                                    ) : (
                                        <div className="text-sm text-muted-foreground">Nenhum QR Code disponível.</div>
                                    )}

                                    {active.qrCode ? (
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="text-sm font-medium">Copia e cola (Pix)</div>

                                                <Button
                                                    type="button"
                                                    variant="secondary"
                                                    size="sm"
                                                    onClick={copiarCodigo}
                                                    disabled={!active.qrCode}
                                                    className="gap-2"
                                                >
                                                    <Copy className="h-4 w-4" />
                                                    {copied ? "Copiado" : "Copiar"}
                                                </Button>
                                            </div>

                                            <div className="text-xs break-all rounded-md border p-3 bg-background">
                                                {active.qrCode}
                                            </div>

                                            {isExpired ? (
                                                <div className="text-xs text-red-600">
                                                    Esse Pix expirou. Avançando para o próximo...
                                                </div>
                                            ) : null}
                                        </div>
                                    ) : null}
                                </>
                            )}
                        </CardContent>
                    </Card>
                ) : null}
            </div>
        </main>
    );
}
