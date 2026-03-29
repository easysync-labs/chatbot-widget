import { ChatWindow } from '../chat-core/components/ChatWindow'

export default function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl" style={{ height: '700px' }}>
        <ChatWindow
          apiUrl="/api/chatbot/chat"
          theme="light"
          title="EasySync Chat"
          subtitle="Assistente de vendas"
        />
      </div>
    </div>
  )
}
