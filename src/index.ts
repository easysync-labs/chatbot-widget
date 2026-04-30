import './styles.css'

export { ChatWindow } from './chat-core/components/ChatWindow'
export type { ChatWindowProps, ArqueiroProps } from './chat-core/components/ChatWindow'

// Headless: spawn arqueiro sem renderizar ChatWindow (para uso global invisível)
export { startArqueiro } from './arqueiro'
export type { ArqueiroConfig, ArqueiroHandle } from './arqueiro'
