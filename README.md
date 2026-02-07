# LivePix

**Sistema de pagamentos Pix em tempo real para lives (OBS) — Frontend + Backend**

## 🔗 Repositórios

- **Frontend:** [https://github.com/Cduartev/livepix-front](https://github.com/Cduartev/livepix-front)
- **Backend:** [https://github.com/Cduartev/livepix-backend](https://github.com/Cduartev/livepix-backend)

![Java](https://img.shields.io/badge/Java-21+-orange)
![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3-green)
![Next.js](https://img.shields.io/badge/Next.js-App%20Router-black)
![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Relational-blue)
![SSE](https://img.shields.io/badge/SSE-Real--Time-yellow)
![Pix](https://img.shields.io/badge/Pix-Brasil-green)
![Mercado Pago](https://img.shields.io/badge/Mercado%20Pago-API-blue)

## 📌 Visão Geral

**LivePix** é um sistema completo de **pagamentos Pix em tempo real**, projetado para uso em **lives e streamings**. Ele permite que streamers recebam doações via Pix e exibam alertas instantâneos na tela do OBS.

O projeto integra:

- **Backend Java** com integração real ao **Mercado Pago**.
- **Webhooks** para confirmação de pagamento automática.
- **Server-Sent Events (SSE)** para atualização instantânea do frontend.
- **Frontend Next.js** com overlays (sobreposições) otimizadas para o OBS.

---

## 🧱 Arquitetura e Fluxo

O sistema funciona como uma ponte entre o doador, o Mercado Pago e o Streamer:

1. **Solicitação:** O usuário preenche o formulário no Overlay de Usuário.
2. **Criação:** O backend gera uma cobrança Pix no Mercado Pago e retorna o QR Code.
3. **Pagamento:** O usuário paga via app do banco.
4. **Notificação:** O Mercado Pago avisa o backend via **Webhook**.
5. **Processamento:** O backend valida, salva no banco de dados e dispara um evento via **SSE**.
6. **Alerta:** O Overlay do Streamer "ouve" o evento e exibe o alerta com som e animação.

---

## ✨ Funcionalidades

### 💰 Gestão de Pagamentos (Backend)

- **Integração Real:** Usa a API do Mercado Pago para gerar Pix autênticos.
- **Tradução e Semântica:** Código totalmente em português para facilitar a manutenção (`modelo`, `repositorio`, `servico`).
- **Segurança:** O backend é a única fonte da verdade. O frontend nunca aprova pagamentos.

### � Comunicação em Tempo Real (SSE)

- Usa conexões persistentes para garantir latência zero nos alertas.
- Eventos padronizados: `connected` (boas-vindas) e `pix` (novo pagamento aprovado).

### 🎥 Sobreposições (Overlays Frontend)

- **Sobreposição do Streamer:** Fila de alertas persistente, animações e histórico de recebidos.
- **Sobreposição do Usuário:** Interface intuitiva para gerar o Pix, copiar o código e visualizar o status de aprovação.

---

## 🖥️ Rotas de Sobreposição (OBS)

As URLs que você deve adicionar como "Navegador" no seu OBS:

- **Alertas do Streamer:** `http://localhost:3000/sobreposicao/streamer/alertas`
- **QR Code do Usuário:** `http://localhost:3000/sobreposicao/usuario/qr`

---

## 🛠️ Tecnologias Utilizadas

### Backend

- Java 21 / Spring Boot 3
- Spring Data JPA / PostgreSQL
- SseEmitter (Comunicação em tempo real)
- Mercado Pago SDK

### Frontend

- Next.js 15 (App Router)
- Tailwind CSS / shadcn/ui
- Zustand (Gerenciamento de estado via `useLojaPix`)
- EventSource (SSE)

---

## 🚀 Como Executar

### 1. Backend

Configure o arquivo `application.yaml` ou variáveis de ambiente:

- `MP_ACCESS_TOKEN`: Seu token do Mercado Pago.
- Banco de Dados PostgreSQL configurado.

```bash
# Na pasta livepix-backend
./mvnw spring-boot:run
```

### 2. Frontend

Configure as variáveis de ambiente:

1. Crie um arquivo `.env.local` na raiz do projeto (ou configure no painel da Vercel).
2. Adicione a URL do backend:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:8080
   ```

```bash
# Na pasta livepix-front
pnpm install
pnpm dev
```

---

## ☁️ Deploy

### Backend (Render)

1. Crie um novo **Web Service** no Render.
2. Conecte seu repositório `livepix-backend`.
3. Configure as variáveis de ambiente (`MP_ACCESS_TOKEN`, `SPRING_DATASOURCE_URL`, etc).
4. O Render fornecerá uma URL (ex: `https://livepix-backend.onrender.com`).

### Frontend (Vercel)

1. Crie um novo projeto na Vercel.
2. Importe o repositório `livepix-front`.
3. Nas configurações do projeto > **Environment Variables**:
   - Adicione `NEXT_PUBLIC_API_URL` com o valor da URL do seu backend no Render (ex: `https://livepix-backend.onrender.com`).
4. Faça o deploy. A Vercel detectará automaticamente o Next.js.

---

## 👤 Autor

**Cayo Duarte Vidal**
Software Engineer especializado em Java, Spring Boot e ecossistema Modern Web.
