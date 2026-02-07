"use client";

import { useEffect } from "react";
import { useLojaPix } from "@/stores/useLojaPix";

type AlertEventRaw = {
  paymentId: number;
  status?: string;
  ok?: boolean;
  nome?: string;
  valor?: number;
  mensagem?: string;
  em?: string;
};

export function usePixSse() {
  useEffect(() => {
    const apiBase = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(
      /\/$/,
      ""
    );
    const url = `${apiBase}/alerts/stream`;
    const es = new EventSource(url);

    const onPix = (event: Event) => {
      try {
        const raw = JSON.parse((event as MessageEvent).data) as AlertEventRaw;

        const pix = useLojaPix.getState();
        const status = pix.normalizeStatus(raw.status, raw.ok);

        // Atualiza se existir na fila do usuário (QR)
        pix.updateStatusIfExists(Number(raw.paymentId), status);
      } catch {
        // ignore
      }
    };

    es.addEventListener("pix", onPix);

    return () => {
      es.removeEventListener("pix", onPix);
      es.close();
    };
  }, []);
}
