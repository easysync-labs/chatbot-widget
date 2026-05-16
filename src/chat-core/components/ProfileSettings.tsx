import { useEffect, useState } from 'react'
import {
  ChatbotStoreProfileRequest,
  ChatbotStoreProfileResponse,
  ChatbotUserProfile,
  ChatbotUserProfileRequest,
  getStoreProfile,
  listUserProfiles,
  updateStoreProfile,
  updateUserProfile,
} from '../../services/api'

interface ProfileSettingsProps {
  baseUrl: string
  bearerToken: string
  onClose: () => void
  isDark: boolean
}

type Tab = 'store' | 'roles'

/**
 * Modal de configurações do chatbot. Duas abas:
 *  - "Loja"   : tudo que é específico do cliente (personalidade isomorfa) — nome,
 *               assistente, segmento, principais produtos, público, contexto livre,
 *               palavras-chave do domain guard.
 *  - "Perfis" : configuração por role do EsUser (vendedor, admin, caixa, …) —
 *               especialidade dentro da loja, system prompt addon, capacidades,
 *               modelo, max tokens.
 *
 * Tudo só ADMIN pode editar (PUT 403 caso contrário). O assistente lê os campos
 * em runtime — não precisa restart pra refletir.
 */
export function ProfileSettings({ baseUrl, bearerToken, onClose, isDark }: ProfileSettingsProps) {
  const [tab, setTab] = useState<Tab>('store')

  const cardBg = isDark ? 'bg-gray-800' : 'bg-white'
  const overlay = 'fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm'
  const subtle = isDark ? 'text-gray-400' : 'text-gray-500'
  const tabBase = `px-4 py-2 text-sm font-medium border-b-2 transition-colors`
  const tabActive = `${isDark ? 'text-white' : 'text-gray-900'} border-blue-500`
  const tabInactive = `${subtle} border-transparent ${isDark ? 'hover:text-gray-200' : 'hover:text-gray-700'}`

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
            <p className={`text-xs ${subtle}`}>Só ADMIN pode editar · não requer restart</p>
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

        <div className={`flex gap-1 px-5 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          <button onClick={() => setTab('store')} className={`${tabBase} ${tab === 'store' ? tabActive : tabInactive}`}>
            Loja
          </button>
          <button onClick={() => setTab('roles')} className={`${tabBase} ${tab === 'roles' ? tabActive : tabInactive}`}>
            Perfis de usuário
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden">
          {tab === 'store' ? (
            <StoreSettings baseUrl={baseUrl} bearerToken={bearerToken} isDark={isDark} onClose={onClose} />
          ) : (
            <RoleSettings baseUrl={baseUrl} bearerToken={bearerToken} isDark={isDark} onClose={onClose} />
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Aba "Loja" — config isomorfa (personalidade do chat por cliente)
// ─────────────────────────────────────────────────────────────────────────────

interface SectionProps {
  baseUrl: string
  bearerToken: string
  isDark: boolean
  onClose: () => void
}

function StoreSettings({ baseUrl, bearerToken, isDark, onClose }: SectionProps) {
  const [data, setData] = useState<ChatbotStoreProfileResponse | null>(null)
  const [draft, setDraft] = useState<ChatbotStoreProfileRequest>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState<string | null>(null)

  const labelCls = isDark ? 'text-gray-300' : 'text-gray-700'
  const subtle = isDark ? 'text-gray-400' : 'text-gray-500'
  const inputCls = `w-full text-sm px-3 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-400 ${
    isDark ? 'bg-gray-900 border-gray-700 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'
  }`

  useEffect(() => {
    setLoading(true)
    setError(null)
    getStoreProfile(baseUrl, bearerToken)
      .then((r) => {
        setData(r)
        setDraft(toStoreDraft(r))
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Erro carregando perfil da loja'))
      .finally(() => setLoading(false))
  }, [baseUrl, bearerToken])

  function set<K extends keyof ChatbotStoreProfileRequest>(k: K, v: ChatbotStoreProfileRequest[K]) {
    setDraft((prev) => ({ ...prev, [k]: v }))
  }

  async function save() {
    setSaving(true)
    setError(null)
    setSavedFlash(null)
    try {
      const updated = await updateStoreProfile(baseUrl, draft, bearerToken)
      setData(updated)
      setDraft(toStoreDraft(updated))
      setSavedFlash('Salvo!')
      setTimeout(() => setSavedFlash(null), 2000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro salvando')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className={`p-8 text-center text-sm ${subtle}`}>carregando perfil da loja...</div>
  }
  if (error && !data) {
    return (
      <div className="p-5">
        <div className="bg-red-50 border-l-4 border-red-400 px-4 py-3 text-sm text-red-700 rounded">{error}</div>
      </div>
    )
  }

  const keywordsValue = (draft.domainKeywords ?? []).join(', ')

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {data?.tradingNames && data.tradingNames.length > 0 && (
          <div className={`text-xs ${subtle}`}>
            <span className="font-medium">Filiais (DBA.EMPRESA):</span> {data.tradingNames.join(' · ')}
            {data.razaoSocial && <span className="ml-1">· razão social: {data.razaoSocial}</span>}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={`block text-xs font-medium mb-1 ${labelCls}`}>
              Nome da loja <span className={subtle}>(exibido pelo assistente)</span>
            </label>
            <input
              type="text"
              className={inputCls}
              value={draft.storeName ?? ''}
              onChange={(e) => set('storeName', e.target.value)}
              placeholder={data?.tradingNames?.[0] ?? 'Casa do Construtor'}
            />
          </div>
          <div>
            <label className={`block text-xs font-medium mb-1 ${labelCls}`}>
              Nome do assistente <span className={subtle}>(persona)</span>
            </label>
            <input
              type="text"
              className={inputCls}
              value={draft.assistantName ?? ''}
              onChange={(e) => set('assistantName', e.target.value)}
              placeholder="Bia, Léo, Assistente Virtual…"
            />
          </div>
        </div>

        <div>
          <label className={`block text-xs font-medium mb-1 ${labelCls}`}>
            Segmento de negócio <span className={subtle}>(usado no system prompt e na inferência de produtos)</span>
          </label>
          <input
            type="text"
            className={inputCls}
            value={draft.businessSegment ?? ''}
            onChange={(e) => set('businessSegment', e.target.value)}
            placeholder="ex.: distribuidora de peças automotivas, loja de material de construção, mercado de bairro…"
          />
        </div>

        <div>
          <label className={`block text-xs font-medium mb-1 ${labelCls}`}>
            Principais produtos
          </label>
          <textarea
            rows={2}
            className={inputCls}
            value={draft.mainProducts ?? ''}
            onChange={(e) => set('mainProducts', e.target.value)}
            placeholder="ex.: pneus, filtros, lubrificantes, baterias, peças de suspensão"
          />
        </div>

        <div>
          <label className={`block text-xs font-medium mb-1 ${labelCls}`}>
            Público-alvo
          </label>
          <input
            type="text"
            className={inputCls}
            value={draft.targetAudience ?? ''}
            onChange={(e) => set('targetAudience', e.target.value)}
            placeholder="ex.: oficinas mecânicas, frotas empresariais, consumidores finais"
          />
        </div>

        <div>
          <label className={`block text-xs font-medium mb-1 ${labelCls}`}>
            Contexto adicional <span className={subtle}>(livre — ex.: regiões, diferencial, marcas, regras especiais)</span>
          </label>
          <textarea
            rows={3}
            className={inputCls}
            value={draft.additionalContext ?? ''}
            onChange={(e) => set('additionalContext', e.target.value)}
            placeholder="ex.: A empresa atua no Norte do Brasil. Possui filiais em Boa Vista e Manaus. Frete grátis acima de R$ 500."
          />
        </div>

        <div>
          <label className={`block text-xs font-medium mb-1 ${labelCls}`}>
            Palavras-chave do domínio <span className={subtle}>(CSV — usadas no filtro do RAG)</span>
          </label>
          <input
            type="text"
            className={inputCls}
            value={keywordsValue}
            onChange={(e) =>
              set(
                'domainKeywords',
                e.target.value
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean),
              )
            }
            placeholder="pneu, freio, filtro, oleo, suspensao, bateria"
          />
        </div>

        {data?.promptPreview && (
          <details className={`text-xs ${subtle}`}>
            <summary className="cursor-pointer select-none">Preview do prompt do sistema</summary>
            <pre className={`mt-2 p-3 rounded border text-[11px] whitespace-pre-wrap leading-relaxed ${
              isDark ? 'bg-gray-900 border-gray-700' : 'bg-gray-50 border-gray-200'
            }`}>
              {data.promptPreview}
            </pre>
          </details>
        )}
      </div>

      <div className={`flex items-center justify-end gap-3 px-5 py-3 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
        {savedFlash && <span className="text-emerald-500 text-xs font-medium">{savedFlash}</span>}
        {error && <span className="text-red-500 text-xs">{error}</span>}
        <button
          onClick={onClose}
          className={`px-3 py-1.5 rounded-lg text-sm ${isDark ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'}`}
        >
          Fechar
        </button>
        <button
          onClick={save}
          disabled={saving}
          className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </div>
  )
}

function toStoreDraft(r: ChatbotStoreProfileResponse): ChatbotStoreProfileRequest {
  return {
    storeName: r.storeName ?? '',
    assistantName: r.assistantName ?? '',
    domainKeywords: r.domainKeywords ?? [],
    businessSegment: r.businessSegment ?? '',
    mainProducts: r.mainProducts ?? '',
    targetAudience: r.targetAudience ?? '',
    additionalContext: r.additionalContext ?? '',
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Aba "Perfis de usuário" — configuração por role (vendedor, admin, ...)
// ─────────────────────────────────────────────────────────────────────────────

function RoleSettings({ baseUrl, bearerToken, isDark, onClose }: SectionProps) {
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
          setDraft(toRoleDraft(ps[0]))
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Erro carregando perfis'))
      .finally(() => setLoading(false))
  }, [baseUrl, bearerToken])

  const current = profiles.find((p) => p.role === selectedRole)

  function selectRole(role: string) {
    setSelectedRole(role)
    const p = profiles.find((x) => x.role === role)
    if (p) setDraft(toRoleDraft(p))
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
      setDraft(toRoleDraft(updated))
      setSavedFlash('Salvo!')
      setTimeout(() => setSavedFlash(null), 2000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro salvando')
    } finally {
      setSaving(false)
    }
  }

  const labelCls = isDark ? 'text-gray-300' : 'text-gray-700'
  const subtle = isDark ? 'text-gray-400' : 'text-gray-500'
  const inputCls = `w-full text-sm px-3 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-400 ${
    isDark ? 'bg-gray-900 border-gray-700 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'
  }`

  if (loading) return <div className={`p-8 text-center text-sm ${subtle}`}>carregando perfis...</div>

  if (error && profiles.length === 0) {
    return (
      <div className="p-5">
        <div className="bg-red-50 border-l-4 border-red-400 px-4 py-3 text-sm text-red-700 rounded">{error}</div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 grid grid-cols-[180px_1fr] min-h-0 overflow-hidden">
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
                <div className={`text-[11px] truncate mt-0.5 ${subtle}`}>{p.specialty || 'sem especialidade'}</div>
              </button>
            )
          })}
        </div>

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
                  <label className={`block text-xs font-medium mb-1 ${labelCls}`}>Memory access</label>
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
                  <label className={`block text-xs font-medium mb-1 ${labelCls}`}>Modelo padrão</label>
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
                <label className={`block text-xs font-medium mb-1 ${labelCls}`}>Max tokens</label>
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
            </>
          )}
        </div>
      </div>

      <div className={`flex items-center justify-end gap-3 px-5 py-3 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
        {savedFlash && <span className="text-emerald-500 text-xs font-medium">{savedFlash}</span>}
        {error && <span className="text-red-500 text-xs">{error}</span>}
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
    </div>
  )
}

function toRoleDraft(p: ChatbotUserProfile): ChatbotUserProfileRequest {
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
