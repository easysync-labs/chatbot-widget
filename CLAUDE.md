# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Desenvolvimento
npm run dev        # Inicia o servidor Vite em http://localhost:5173

# Build
npm run build      # Compila TypeScript e gera bundle em dist/
npm run preview    # Pré-visualiza o build gerado

# Não há linter ou testes configurados
```

## Arquitetura

Este é um chatbot frontend em React 18/Vite/TypeScript/Tailwind com Redux para gerenciamento de estado. O chat envia o histórico completo de mensagens a cada requisição para uma API backend.

### Proxy de API

O Vite faz proxy de `/api/*` → `http://localhost:8080`. O único endpoint usado é `POST /api/chatbot/chat`.

- Requisição: `{ messages: [{ role, content }] }`
- Resposta: `{ reply: string, items?: ResponseItem[] }` — `items` são grupos de produtos retornados como cartões no chat

### Fluxo de dados

```
ChatInput → useChat() → sendMessage (thunk) → sendChatMessage() (services/api.ts) → Redux store → re-render
```

O histórico completo de mensagens é sempre enviado para a API (não apenas a última). Mensagens com `role: "system"` existem no estado mas são filtradas do display no `MessageList`.

### Camadas

| Camada | Caminho | Responsabilidade |
|--------|---------|-----------------|
| UI Components | `src/chat-core/components/` | Renderização, temas light/dark |
| Hook de chat | `src/chat-core/hooks/useChat.ts` | Interface entre UI e Redux |
| Redux slice | `src/features/chat/` | Estado, thunk assíncrono, tipos |
| API service | `src/services/api.ts` | Comunicação HTTP |
| Store | `src/app/` | Configuração Redux e hooks tipados |

### Tipos principais (`src/features/chat/types.ts`)

- `Message` — mensagem com `id`, `role`, `content`, `timestamp`, `items?`
- `ResponseItem` — categoria de produtos com array de `ProductResult`
- `ProductResult` — produto com `id`, `description`, `manufacturer`, `score`

### Componentes

- `App.tsx` — passa `apiUrl`, `theme`, `title`, `subtitle` para `ChatWindow`
- `ChatWindow` — orquestra o layout e aplica variantes de tema
- `MessageItem` — renderiza markdown com `react-markdown` + `remark-gfm` para mensagens do assistente; exibe `ProductCards` quando `items` existe
- `ProductCards` — exibe grupos de produtos com score de relevância como percentual

### Estilo

Tailwind com suporte a dark mode via estratégia `class`. Estilos customizados para scrollbar e markdown estão em `src/styles.css` (classe `.chat-msg-list` e seletores `.prose`).
