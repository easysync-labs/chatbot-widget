import { useEffect, useState } from 'react'
import {
  ChatbotUserProfile,
  ChatbotUserProfileRequest,
  listUserProfiles,
  updateUserProfile,
} from '../../services/api'

interface ProfileSettingsProps {
  baseUrl: string
  bearerToken: string
  onClose: () => void
  isDark: boolean
}

/**
 * Modal de configuração dos perfis de chat por role do EsUser.
 * Lista os 7 perfis seedados (USER, ADMIN, MANAGER, ...) e permite editar
 * specialty, prompt addon, memory access, capacidades, modelo, max tokens.
 *
 * Endpoint protegido por ROLE_ADMIN — 403 mostra mensagem.
 */
export function ProfileSettings({ baseUrl, bearerToken, onClose, isDark }: ProfileSettingsProps) {
  const [profiles, setProfiles] = useState<ChatbotUserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedRole, setSelectedRole] = useState<string | null>(null)
  const [draft, setDraft] = useState<ChatbotUserProfileRequest>({})
  const [saving, setSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    listUserProfiles(baseUrl, bearerToken)
      .then((ps) => {
        setProfiles(ps)
        if (ps.length > 0) {
          setSelectedRole(ps[0].role)
          setDraft(toDraft(ps[0]))
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Erro carregando perfis'))
      .finally(() => setLoading(false))
  }, [baseUrl, bearerToken])

  const current = profiles.find((p) => p.role === selectedRole)

  function selectRole(role: string) {
    setSelectedRole(role)
    const p = profiles.find((x) => x.role === role)
    if (p) setDraft(toDraft(p))
  }

  function set<K extends keyof ChatbotUserProfileRequest>(k: K, v: ChatbotUserProfileRequest[K]) {
    setDraft((prev) => ({ ...prev, [k]: v }))
  }

  async function save() {
    if (!selectedRole) return
    setSaving(true)
    setError(null)
    setSavedFlash(null)
    try {
      const updated = await updateUserProfile(baseUrl, selectedRole, draft, bearerToken)
      setProfiles((prev) => prev.map((p) => (p.role === updated.role ? updated : p)))
      setDraft(toDraft(updated))
      setSavedFlash('Salvo!')
      setTimeout(() => setSavedFlash(null), 2000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro salvando')
    } finally {
      setSaving(false)
    }
  }

  const cardBg = isDark ? 'bg-gray-800' : 'bg-white'
  const overlay = 'fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm'
  const labelCls = isDark ? 'text-gray-300' : 'text-gray-700'
  const subtle = isDark ? 'text-gray-400' : 'text-gray-500'
  const inputCls = `w-full text-sm px-3 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-400 ${
    isDark ? 'bg-gray-900 border-gray-700 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'
  }`

  return (
    <div className={overlay} onClick={onClose}>
      <div
        className={`${cardBg} w-full max-w-3xl max-h-[85vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`flex items-center justify-between px-5 py-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          <div>
            <h2 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Configurações do chatbot
            </h2>
            <p className={`text-xs ${subtle}`}>Perfil por role do usuário · só ADMIN pode editar</p>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
            title="Fechar"
          >
            <svg className={`w-5 h-5 ${subtle}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {loading && (
          <div className={`p-8 text-center text-sm ${subtle}`}>carregando perfis...</div>
        )}

        {!loading && error && (
          <div className="p-5">
            <div className="bg-red-50 border-l-4 border-red-400 px-4 py-3 text-sm text-red-700 rounded">
              {error}
            </div>
          </div>
        )}

        {!loading && !error && profiles.length > 0 && (
          <div className="flex-1 grid grid-cols-[180px_1fr] min-h-0 overflow-hidden">
            {/* Sidebar roles */}
            <div className={`overflow-y-auto border-r ${isDark ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-gray-50'}`}>
              {profiles.map((p) => {
                const active = p.role === selectedRole
                return (
                  <button
                    key={p.role}
                    onClick={() => selectRole(p.role)}
                    className={`w-full text-left px-4 py-2.5 text-sm border-l-2 transition-colors ${
                      active
                        ? `${isDark ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'} border-blue-500`
                        : `${isDark ? 'text-gray-300 hover:bg-gray-800' : 'text-gray-600 hover:bg-white'} border-transparent`
                    }`}
                  >
                    <div className="font-medium">{p.role}</div>
                    <div className={`text-[11px] truncate mt-0.5 ${subtle}`}>
                      {p.specialty || 'sem especialidade'}
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Editor */}
            <div className="overflow-y-auto p-5 space-y-4">
              {current && (
                <>
                  <div>
                    <label className={`block text-xs font-medium mb-1 ${labelCls}`}>
                      Especialidade <span className={subtle}>(opcional — em branco = sem especialização)</span>
                    </label>
                    <input
                      type="text"
                      className={inputCls}
                      value={draft.specialty ?? ''}
                      onChange={(e) => set('specialty', e.target.value)}
                      placeholder="ex: vendedor especialista em material elétrico"
                    />
                  </div>

                  <div>
                    <label className={`block text-xs font-medium mb-1 ${labelCls}`}>
                      System prompt addon <span className={subtle}>(descreve o interlocutor)</span>
                    </label>
                    <textarea
                      rows={3}
                      className={inputCls}
                      value={draft.systemPromptAddon ?? ''}
                      onChange={(e) => set('systemPromptAddon', e.target.value)}
                      placeholder="ex: Atendendo vendedor. Linguagem técnica e direta."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={`block text-xs font-medium mb-1 ${labelCls}`}>
                        Memory access
                      </label>
                      <select
                        className={inputCls}
                        value={draft.memoryAccess ?? 'own'}
                        onChange={(e) => set('memoryAccess', e.target.value)}
                      >
                        <option value="own">own</option>
                        <option value="group">group</option>
                        <option value="all">all</option>
                      </select>
                    </div>
                    <div>
                      <label className={`block text-xs font-medium mb-1 ${labelCls}`}>
                        Modelo padrão
                      </label>
                      <input
                        type="text"
                        className={inputCls}
                        value={draft.defaultModel ?? ''}
                        onChange={(e) => set('defaultModel', e.target.value)}
                        placeholder="gpt-4o-mini"
                      />
                    </div>
                  </div>

                  <div>
                    <label className={`block text-xs font-medium mb-1 ${labelCls}`}>
                      Max tokens
                    </label>
                    <input
                      type="number"
                      min={100}
                      max={32000}
                      className={inputCls}
                      value={draft.maxTokens ?? 0}
                      onChange={(e) => set('maxTokens', parseInt(e.target.value, 10) || 0)}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-1">
                    {(
                      [
                        ['canCreateOrder', 'Criar pedido'],
                        ['canSeeCost', 'Ver custo'],
                        ['canConfig', 'Configurar'],
                      ] as const
                    ).map(([key, label]) => (
                      <label
                        key={key}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer border text-xs ${
                          isDark ? 'border-gray-700 hover:bg-gray-900' : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(draft[key])}
                          onChange={(e) => set(key, e.target.checked)}
                          className="accent-blue-500"
                        />
                        <span className={labelCls}>{label}</span>
                      </label>
                    ))}
                  </div>

                  <div className={`pt-2 flex items-center gap-3 ${subtle} text-xs`}>
                    {savedFlash && <span className="text-emerald-500 font-medium">{savedFlash}</span>}
                    {error && <span className="text-red-500">{error}</span>}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {!loading && !error && profiles.length > 0 && (
          <div className={`flex items-center justify-end gap-2 px-5 py-3 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <button
              onClick={onClose}
              className={`px-3 py-1.5 rounded-lg text-sm ${isDark ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'}`}
            >
              Fechar
            </button>
            <button
              onClick={save}
              disabled={saving || !selectedRole}
              className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function toDraft(p: ChatbotUserProfile): ChatbotUserProfileRequest {
  return {
    specialty: p.specialty ?? '',
    systemPromptAddon: p.systemPromptAddon ?? '',
    memoryAccess: p.memoryAccess ?? 'own',
    canCreateOrder: p.canCreateOrder ?? false,
    canSeeCost: p.canSeeCost ?? false,
    canConfig: p.canConfig ?? false,
    defaultModel: p.defaultModel ?? 'gpt-4o-mini',
    maxTokens: p.maxTokens ?? 2000,
    allowedTools: p.allowedTools ?? '',
  }
}
