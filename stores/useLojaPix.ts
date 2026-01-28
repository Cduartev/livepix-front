import { create } from "zustand";

export type PixStatus = "PENDING" | "APPROVED" | "EXPIRED" | "CANCELLED" | "UNKNOWN" | string;

export type PixCharge = {
  paymentId: number;
  status: PixStatus;
  qrCode: string | null;
  qrCodeBase64: string | null;

  expiresAt?: string | null; // ISO string
  createdAt?: string | null; // ISO string
};

type LojaPixState = {
  queue: PixCharge[];
  activePaymentId: number | null;

  openQr: boolean;

  enqueue: (charge: PixCharge) => void;
  setActive: (paymentId: number | null) => void;

  updateStatus: (paymentId: number, status: PixStatus) => void;

  // normaliza status vindo do backend (PT/variações)
  normalizeStatus: (raw?: unknown, ok?: unknown) => PixStatus;

  // atualiza status e retorna se existia na fila
  updateStatusIfExists: (paymentId: number, status: PixStatus) => boolean;

  closeActive: () => void;
  clearAll: () => void;

  getActive: () => PixCharge | null;
};

export const useLojaPix = create<LojaPixState>((set, get) => ({
  queue: [],
  activePaymentId: null,
  openQr: false,

  enqueue: (charge) =>
    set((state) => {
      const nextQueue = [...state.queue, charge];
      const nextActive = state.activePaymentId ?? charge.paymentId;

      return {
        queue: nextQueue,
        activePaymentId: nextActive,
        openQr: true,
      };
    }),

  setActive: (paymentId) =>
    set(() => ({
      activePaymentId: paymentId,
      openQr: paymentId !== null,
    })),

  updateStatus: (paymentId, status) =>
    set((state) => ({
      queue: state.queue.map((c) => (c.paymentId === paymentId ? { ...c, status } : c)),
    })),

  normalizeStatus: (raw, ok) => {
    // ok pode vir como boolean, string, number
    const okTruthy =
      ok === true ||
      ok === "true" ||
      ok === 1 ||
      ok === "1" ||
      ok === "TRUE" ||
      ok === "True";

    const s = String(raw ?? "").trim().toUpperCase();

    // Se não vier status mas ok=true, aprovado
    if (!s && okTruthy) return "APPROVED";

    // Mapeamento por "contém" (mais resiliente)
    if (s.includes("APROV")) return "APPROVED";     // APROVADO, APROVADA, APROVADO_PIX...
    if (s.includes("PEND")) return "PENDING";      // PENDENTE...
    if (s.includes("CANCEL")) return "CANCELLED";  // CANCELADO...
    if (s.includes("EXPIR")) return "EXPIRED";     // EXPIRADO...

    // Se vier em inglês já
    if (s === "APPROVED" || s === "PENDING" || s === "CANCELLED" || s === "EXPIRED") return s;

    return s || "UNKNOWN";
  },

  updateStatusIfExists: (paymentId, status) => {
    const { queue } = get();
    const exists = queue.some((c) => c.paymentId === paymentId);
    if (!exists) return false;

    set((state) => ({
      queue: state.queue.map((c) => (c.paymentId === paymentId ? { ...c, status } : c)),
    }));

    return true;
  },

  closeActive: () =>
    set((state) => {
      if (state.activePaymentId === null) return state;

      // remove o ativo
      const nextQueue = state.queue.filter((c) => c.paymentId !== state.activePaymentId);

      // próximo ativo = primeiro da fila
      const nextActive = nextQueue.length ? nextQueue[0].paymentId : null;

      return {
        queue: nextQueue,
        activePaymentId: nextActive,
        openQr: nextActive !== null,
      };
    }),

  clearAll: () => ({
    queue: [],
    activePaymentId: null,
    openQr: false,
  }),

  getActive: () => {
    const { queue, activePaymentId } = get();
    if (activePaymentId === null) return null;
    return queue.find((c) => c.paymentId === activePaymentId) ?? null;
  },
}));
