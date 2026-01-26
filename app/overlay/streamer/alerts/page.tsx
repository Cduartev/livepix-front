"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { usePixStore } from "@/stores/usePixStore";

type AlertEventRaw = {
  paymentId: number;
  status?: string; // "APROVADO"
  ok?: boolean;    // true
  nome?: string;
  valor?: number;
  mensagem?: string;
  em?: string;     // pode não vir
};

type AlertEvent = {
  paymentId: number;
  status: string; // normalizado
  nome: string;
  valor: number;
  mensagem: string;
  em: string;
};

type QueueItem = AlertEvent & { _id: string };

function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export default function AlertsOverlayPage() {
  const [current, setCurrent] = useState<QueueItem | null>(null);

  const queueRef = useRef<QueueItem[]>([]);
  const showingRef = useRef(false);

  const timersRef = useRef<number[]>([]);
  const addTimer = (id: number) => timersRef.current.push(id);
  const clearTimers = () => {
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
  };

  useEffect(() => {
    const apiBase = (process.env.NEXT_PUBLIC_API ?? "http://localhost:8080").replace(
      /\/$/,
      ""
    );
    const url = `${apiBase}/alerts/stream`;

    const es = new EventSource(url);

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
          addTimer(window.setTimeout(showNext, 250));
        }, 6000)
      );
    }

    const onPix = (event: Event) => {
      try {
        const raw = JSON.parse((event as MessageEvent).data) as AlertEventRaw;

        const pix = usePixStore.getState();

        const nome = (raw.nome ?? "").trim() || "Anônimo";
        const mensagem = (raw.mensagem ?? "").trim();
        const valor = Number(raw.valor ?? 0);

        const normalized: AlertEvent = {
          paymentId: Number(raw.paymentId),
          status: String(pix.normalizeStatus(raw.status, raw.ok)),
          nome,
          mensagem,
          valor: Number.isFinite(valor) ? valor : 0,
          em: raw.em && raw.em.trim() ? raw.em : new Date().toISOString(),
        };

        // Atualiza o Pix do overlay QR (se existir na fila)
        pix.updateStatusIfExists(normalized.paymentId, normalized.status);

        // Mantém o overlay streamer de alertas
        queueRef.current.push({
          ...normalized,
          _id: `${normalized.paymentId}-${Date.now()}`,
        });

        if (!showingRef.current) showNext();
      } catch {
        // ignora payload inválido
      }
    };

    es.addEventListener("pix", onPix);

    es.onerror = () => {
      // reconecta sozinho
    };

    return () => {
      clearTimers();
      es.removeEventListener("pix", onPix);
      es.close();
    };
  }, []);

  return (
    <main className="min-h-screen w-full bg-transparent p-6 flex items-start justify-end">
      {current ? (
        <Card className="w-[380px] border border-border/60 bg-background/90 backdrop-blur shadow-lg">
          <CardContent className="p-4 space-y-2">
            <div className="text-xs text-muted-foreground">
              Pix recebido • status: <span className="font-medium">{current.status}</span>
            </div>

            <div className="text-lg font-semibold leading-tight">
              {current.nome} enviou {formatBRL(current.valor)}
            </div>

            {current.mensagem ? (
              <div className="text-sm text-foreground/90 break-words">
                “{current.mensagem}”
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}