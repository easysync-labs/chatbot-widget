import { ChatbotResponseItem, ChatbotProduct } from '../../features/chat/types'

interface ProductCardsProps {
  /** Itens agrupados retornados pelo backend /api/chatbot/chat */
  items: ChatbotResponseItem[]
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
  const promoActive = p.retailPromotionPrice != null && p.retailPromotionPrice > 0
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

function ProductRow({ p }: { p: ChatbotProduct }) {
  const desc = pickDescription(p)
  return (
    <li className="flex items-start justify-between gap-3 px-3 py-2 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-gray-800 leading-snug truncate" title={desc}>
          {desc}
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-500">
          <span className="font-mono">SKU {p.sku}</span>
          {p.manufacturer && <span>·</span>}
          {p.manufacturer && <span className="truncate">{p.manufacturer}</span>}
        </div>
      </div>
      <div className="flex-shrink-0 text-right text-sm">
        <PriceBlock p={p} />
      </div>
    </li>
  )
}

function ItemGroup({ group }: { group: ChatbotResponseItem }) {
  if (!group.products?.length) return null
  return (
    <div className="mb-3 last:mb-0">
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-3 py-1.5 bg-gray-50 border-b border-gray-200">
        {group.item}
      </div>
      <ul className="bg-white">
        {group.products.map((p) => (
          <ProductRow key={`${p.productId}-${p.subProductId}`} p={p} />
        ))}
      </ul>
    </div>
  )
}

export function ProductCards({ items }: ProductCardsProps) {
  if (!items?.length) return null
  return (
    <div className="chat-products mt-2 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      {items.map((g, i) => (
        <ItemGroup key={`${g.item}-${i}`} group={g} />
      ))}
    </div>
  )
}
