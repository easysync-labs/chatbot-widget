import { useMemo, useState } from 'react'
import { ChatbotResponseItem, ChatbotProduct } from '../../features/chat/types'

interface ProductCardsProps {
  /** Itens agrupados retornados pelo backend /api/chatbot/chat */
  items: ChatbotResponseItem[]
  /**
   * Callback de confirmação. Quando definido, cada grupo vira "1 escolha
   * obrigatória" (radio buttons) e mostra botão "Confirmar" no rodapé.
   * O handler recebe a lista das escolhas feitas (uma por grupo). Equivale
   * ao /select-product do legado, mas sem state machine: a confirmação é
   * apenas uma mensagem natural composta pro LLM.
   */
  onConfirmSelection?: (
    selections: Array<{ item: string; product: ChatbotProduct }>,
  ) => void
}

const fmt = (value?: number | null) =>
  value != null && value > 0
    ? value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : null

function pickDescription(p: ChatbotProduct): string {
  return p.fullDescription || p.shortDescription || p.subDescription || `#${p.productId}`
}

function PriceBlock({ p }: { p: ChatbotProduct }) {
  const eff = fmt(p.effectivePrice)
  const retail = fmt(p.retailPrice)
  const promoActive =
    p.retailPromotionPrice != null && p.retailPromotionPrice > 0
    && p.retailPrice != null && p.retailPromotionPrice !== p.retailPrice
  if (!eff) {
    return <span className="text-xs text-gray-400">preço sob consulta</span>
  }
  return (
    <span className="inline-flex flex-col items-end leading-tight">
      <span className="font-semibold text-emerald-700">{eff}</span>
      {promoActive && retail && (
        <span className="text-[10px] text-gray-400 line-through">{retail}</span>
      )}
    </span>
  )
}

function BrandChip({ brand }: { brand?: string }) {
  if (!brand || !brand.trim()) return null
  return (
    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-gray-800 text-white">
      {brand.trim()}
    </span>
  )
}

function ProductRow({
  p, groupId, selected, onSelect,
}: {
  p: ChatbotProduct
  groupId: string
  selected: boolean
  onSelect: () => void
}) {
  const desc = pickDescription(p)
  return (
    <li className="border-b border-gray-100 last:border-0">
      <label
        className={`group flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
          selected ? 'bg-blue-50' : 'hover:bg-gray-50'
        }`}
      >
        <input
          type="radio"
          name={groupId}
          value={p.sku}
          checked={selected}
          onChange={onSelect}
          className="flex-shrink-0 w-4 h-4 accent-blue-600"
          aria-label={`Selecionar ${desc}`}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <BrandChip brand={p.manufacturer} />
          </div>
          <div
            className={`text-sm leading-snug truncate ${selected ? 'font-semibold text-blue-700' : 'text-gray-800'}`}
            title={desc}
          >
            {desc}
          </div>
          <div className="text-[11px] text-gray-500 font-mono mt-0.5">SKU {p.sku}</div>
        </div>
        <div className="flex-shrink-0 text-right text-sm flex flex-col items-end gap-0.5">
          <PriceBlock p={p} />
          <span className="text-[11px] text-gray-400">#{p.productId}</span>
        </div>
      </label>
    </li>
  )
}

function ItemGroup({
  group, groupId, selectedSku, onSelect,
}: {
  group: ChatbotResponseItem
  groupId: string
  selectedSku: string | null
  onSelect: (product: ChatbotProduct) => void
}) {
  if (!group.products?.length) return null
  return (
    <div className="mb-3 last:mb-0">
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
        <span>{group.item}</span>
        <span className="text-[10px] normal-case font-medium px-1.5 py-0.5 rounded bg-gray-200 text-gray-600">
          1x
        </span>
      </div>
      <ul className="bg-white">
        {group.products.map((p) => (
          <ProductRow
            key={`${p.productId}-${p.subProductId}`}
            p={p}
            groupId={groupId}
            selected={selectedSku === p.sku}
            onSelect={() => onSelect(p)}
          />
        ))}
      </ul>
    </div>
  )
}

export function ProductCards({ items, onConfirmSelection }: ProductCardsProps) {
  // Estado de seleção: { itemName → ChatbotProduct escolhido }
  const [selections, setSelections] = useState<Record<string, ChatbotProduct>>({})

  // Recompute na mudança de items (mesmo bloco, mesmas opções).
  const itemKeys = useMemo(() => items.map((g, i) => `${g.item}-${i}`), [items])
  const interactive = Boolean(onConfirmSelection)
  const total = items.length
  const chosen = Object.keys(selections).length

  if (!items?.length) return null

  function handleSelect(itemName: string, product: ChatbotProduct) {
    setSelections((prev) => ({ ...prev, [itemName]: product }))
  }

  function handleConfirm() {
    if (!onConfirmSelection) return
    const list = items
      .map((g) => ({ item: g.item, product: selections[g.item] }))
      .filter((x): x is { item: string; product: ChatbotProduct } => Boolean(x.product))
    if (!list.length) return
    onConfirmSelection(list)
    setSelections({})  // limpa após enviar
  }

  return (
    <div className="chat-products mt-2 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      {items.map((g, i) => (
        <ItemGroup
          key={itemKeys[i]}
          group={g}
          groupId={itemKeys[i]}
          selectedSku={selections[g.item]?.sku ?? null}
          onSelect={(p) => handleSelect(g.item, p)}
        />
      ))}

      {interactive && (
        <div className="flex items-center justify-between px-3 py-2.5 bg-gray-50 border-t border-gray-200">
          <span className="text-xs text-gray-500">
            {chosen} de {total} selecionado{total > 1 ? 's' : ''}
          </span>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={chosen === 0}
            className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Confirmar seleção
          </button>
        </div>
      )}
    </div>
  )
}
