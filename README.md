
# LivePix 
**Sistema de pagamentos Pix em tempo real para lives (OBS) — Frontend + Backend**
## 🔗 Repositório Frontend

👉 [https://github.com/cayoduarte/livepix-frontend](https://github.com/Cduartev/livepix-front)
## 🔗 Repositório Backend

👉 [https://github.com/cayoduarte/livepix-backend](https://github.com/Cduartev/livepix-backend)

![Java](https://img.shields.io/badge/Java-21+-orange)
![Spring Boot](https://img.shields.io/badge/Spring%20Boot-4-green)
![Next.js](https://img.shields.io/badge/Next.js-App%20Router-black)
![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Relational-blue)
![SSE](https://img.shields.io/badge/SSE-Real--Time-yellow)
![Pix](https://img.shields.io/badge/Pix-Brasil-green)
![Mercado Pago](https://img.shields.io/badge/Mercado%20Pago-API-blue)

## 📌 Visão Geral

**LivePix** é um sistema completo de **pagamentos Pix em tempo real**, projetado para uso em **lives e streamings**, integrando:

* Backend Java com **Mercado Pago (Pix real)**
* Webhooks de produção
* **Server-Sent Events (SSE)** para comunicação em tempo real
* Frontend em **Next.js** com overlays prontos para OBS

O projeto foi desenvolvido com foco em:

* Arquitetura limpa
* Separação clara de responsabilidades
* Fluxo real de produção (dinheiro real)
* Comunicação assíncrona confiável
* Experiência em tempo real para o usuário

---

## 🧱 Arquitetura Geral

```
[ OBS / Browser Source ]
          |
          | SSE (EventSource)
          v
   [ Frontend Overlay ]
          |
          | REST API
          v
   [ LivePix Backend ]
          |
          | API Mercado Pago
          v
     [ Mercado Pago ]
          |
          | Webhook
          v
   [ LivePix Backend ]
```

### 🔁 Fluxo Real de Pagamento

1. Usuário solicita geração de Pix
2. Backend cria cobrança via Mercado Pago
3. Usuário paga pelo app do banco
4. Mercado Pago envia **webhook**
5. Backend:

   * valida o evento
   * atualiza o status no banco
   * publica evento `pix` via SSE
6. Frontend reage automaticamente:

   * alerta na live
   * confirmação visual
   * fechamento do QR Code

---

## ✨ Funcionalidades

### 💰 Pagamentos Pix (Backend)

* Integração real com **Mercado Pago**
* Suporte a **sandbox** e **produção**
* Geração de:

  * `paymentId`
  * QR Code (texto)
  * QR Code Base64 (imagem)
* Backend como **single source of truth**

### 🔔 Webhooks

* Endpoint dedicado para notificações do Mercado Pago
* Processamento de eventos reais de produção
* Atualização segura do status no banco
* Disparo de eventos em tempo real via SSE

### 📡 Server-Sent Events (SSE)

* Conexão persistente
* Múltiplos clientes simultâneos
* Eventos:

  * `connected`
  * `pix`
* Ideal para:

  * overlays de live
  * dashboards
  * notificações em tempo real

### 🎥 Overlays (Frontend)

#### Overlay Streamer

* Alertas em tempo real
* Fila de eventos
* Animações suaves
* Exibição de nome, valor e mensagem

#### Overlay Usuário

* QR Code Pix
* Pix Copia e Cola
* Contador de expiração
* Animação de confirmação
* Fechamento automático após pagamento aprovado

### 🌐 Estado Global

* Gerenciamento com **Zustand**
* Sincronização entre QR Code e alertas
* Frontend totalmente desacoplado da lógica crítica

---

## 🧪 Ambiente de Desenvolvimento

* Endpoint DEV exclusivo para simulação de pagamento
* Ativo apenas com `SPRING_PROFILES_ACTIVE=dev`
* Nunca exposto em produção

```http
POST /dev/approve/{paymentId}
```

---

## 🔔 SSE — Eventos

```http
GET /alerts/stream
```

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

## 🧱 Stack Tecnológica

### Backend

* Java 21+ (20 / 21 / 25)
* Spring Boot
* Spring Web
* Spring Data JPA
* SseEmitter
* PostgreSQL
* Mercado Pago API (Pix)

### Frontend

* Next.js (App Router)
* React
* TypeScript
* shadcn/ui
* Zustand
* EventSource (SSE)

---

## 🚀 Execução Local

### Backend

```env
MP_ACCESS_TOKEN=TEST-xxxxxxxx
SPRING_PROFILES_ACTIVE=dev
SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/livepix
SPRING_DATASOURCE_USERNAME=postgres
SPRING_DATASOURCE_PASSWORD=postgres
```

```bash
./mvnw spring-boot:run
```

Backend:

```
http://localhost:8080
```

### Frontend

```env
NEXT_PUBLIC_API=http://localhost:8080
```

```bash
pnpm install
pnpm dev
```

Frontend:

```
http://localhost:3000
```

---

## 🖥️ Rotas de Overlay (OBS)

```
/overlay/streamer/alerts
/overlay/user/qr
```

---

## 🔐 Segurança

* Frontend **não aprova pagamentos**
* Backend concentra toda lógica crítica
* Webhook como única confirmação real
* Endpoint DEV isolado por profile

Recomendações para produção:

* Validação de assinatura do webhook
* Idempotência por `paymentId`
* Controle de acesso ao SSE

---

## 📈 Destaques para Portfólio

* Integração com sistema financeiro real
* Eventos assíncronos em produção
* Arquitetura orientada a eventos
* Fluxo real de negócio (não é CRUD)
* Separação clara entre frontend e backend
* Pensado para ambiente real e OBS

---

## 👤 Autor

**Cayo Duarte Vidal**
Software Engineer
Java • Spring Boot • REST APIs • SSE • PostgreSQL • Pix • Mercado Pago • Next.js

---

