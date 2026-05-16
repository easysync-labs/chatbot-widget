import { ChatbotResponseItem, ChatbotProduct } from '../../features/chat/types'

interface ProductCardsProps {
  /** Itens agrupados retornados pelo backend /api/chatbot/chat */
  items: ChatbotResponseItem[]
  /**
   * Callback de seleção. Quando definido, cada linha vira clicável (com
   * número 1, 2, 3... no estilo do legado) e dispara o handler — geralmente
   * envia uma mensagem follow-up ao chat tipo "Quero a opção N: descrição".
   */
  onSelect?: (product: ChatbotProduct, itemName: string, index: number) => void
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

function ProductRow({
  p, itemName, index, onSelect,
}: {
  p: ChatbotProduct
  itemName: string
  index: number
  onSelect?: (product: ChatbotProduct, itemName: string, index: number) => void
}) {
  const desc = pickDescription(p)
  const clickable = Boolean(onSelect)

  const indexBadge = (
    <span
      className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
        clickable
          ? 'bg-blue-100 text-blue-700 group-hover:bg-blue-500 group-hover:text-white'
          : 'bg-gray-100 text-gray-600'
      } transition-colors`}
      aria-hidden="true"
    >
      {index}
    </span>
  )

  const body = (
    <>
      {indexBadge}
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
    </>
  )

  if (!clickable) {
    return (
      <li className="flex items-center gap-3 px-3 py-2 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
        {body}
      </li>
    )
  }

  return (
    <li className="border-b border-gray-100 last:border-0">
      <button
        type="button"
        onClick={() => onSelect!(p, itemName, index)}
        className="group w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-blue-50 focus:bg-blue-50 focus:outline-none transition-colors cursor-pointer"
        aria-label={`Selecionar opção ${index}: ${desc}`}
      >
        {body}
      </button>
    </li>
  )
}

function ItemGroup({
  group, onSelect,
}: {
  group: ChatbotResponseItem
  onSelect?: (product: ChatbotProduct, itemName: string, index: number) => void
}) {
  if (!group.products?.length) return null
  return (
    <div className="mb-3 last:mb-0">
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-3 py-1.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
        <span>{group.item}</span>
        {onSelect && (
          <span className="text-[10px] text-gray-400 normal-case font-normal">
            clique no número ou digite "quero o N"
          </span>
        )}
      </div>
      <ul className="bg-white">
        {group.products.map((p, idx) => (
          <ProductRow
            key={`${p.productId}-${p.subProductId}`}
            p={p}
            itemName={group.item}
            index={idx + 1}
            onSelect={onSelect}
          />
        ))}
      </ul>
    </div>
  )
}

export function ProductCards({ items, onSelect }: ProductCardsProps) {
  if (!items?.length) return null
  return (
    <div className="chat-products mt-2 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      {items.map((g, i) => (
        <ItemGroup key={`${g.item}-${i}`} group={g} onSelect={onSelect} />
      ))}
    </div>
  )
}

