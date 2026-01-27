---

# LivePix Frontend ⚡️

Overlay de Pix em tempo real para lives , construído com **Next.js**, **shadcn/ui** e **Server-Sent Events (SSE)**.

Este frontend consome eventos em tempo real do backend e exibe:

* Alertas de doações para o streamer
* QR Code Pix para o usuário realizar pagamentos

---

## ✨ Funcionalidades

### 🎥 Overlay Streamer (Alertas)

* Alertas em tempo real via SSE
* Fila de eventos
* Exibição de **nome**, **valor** e **mensagem**
* Animações suaves
* Status normalizado (**APPROVED / PENDING / FAILED / etc.**)

### 👤 Overlay Usuário (QR Code Pix)

* Geração de Pix via backend
* Exibição de **QR Code** e **Pix Copia e Cola**
* Fila de pagamentos Pix
* Contador de expiração
* Animação de confirmação
* Fechamento automático após pagamento aprovado

### 🌐 Estado Global

* Gerenciamento de estado com **Zustand**
* Sincronização entre overlay de QR Code e overlay de alertas

---

## 🧱 Stack

* Next.js (App Router)
* React
* TypeScript
* shadcn/ui
* Zustand
* Server-Sent Events (`EventSource`)

---

## 🚀 Como rodar localmente

### ✅ Requisitos

* Node.js **18+**
* **pnpm**

### 📦 Instalação

```bash
pnpm install
```
### 🔧 Variáveis de ambiente

Crie um arquivo `.env.local` na raiz do projeto.

```env
NEXT_PUBLIC_API=http://localhost:8080
```

Ou, usando proxy (recomendado com ngrok):

```env
NEXT_PUBLIC_API=/api
```

### ▶️ Executar o projeto

```bash
pnpm dev
```

---

## 🖥️ Rotas de Overlay (OBS)

### Overlay Streamer (Alertas)

```
/overlay/streamer/alerts
```

### Overlay Usuário (QR Code Pix)

```
/overlay/user/qr
```

---

## 🔔 SSE (Tempo Real)

```http
GET /alerts/stream
```

### Eventos tratados

* `connected`
* `pix`

### Exemplo de payload

```json
{
  "paymentId": 1326029452,
  "status": "APROVADO",
  "ok": true,
  "nome": "Sergio",
  "valor": 10.0,
  "mensagem": "Opa e ai, tudo bem?",
  "em": "2026-01-26T22:30:36.713Z"
}
```

---

## 🌍 Usar com ngrok

```bash
ngrok http 3000
```

---

## 🔐 Segurança

* Proteger overlays com token (`?token=...`)
* Evitar expor rotas sensíveis
* Limitar tamanho das mensagens exibidas

---

## 📄 Licença

Projeto para estudo e portfólio.

---

## 👤 Autor

**Cayo Duarte Vidal**
Next.js • Zustand • SSE

---
