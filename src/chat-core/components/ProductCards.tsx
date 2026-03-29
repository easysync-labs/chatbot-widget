import { ResponseItem } from '../../features/chat/types'

interface ProductCardsProps {
  items: ResponseItem[]
}

export function ProductCards({ items }: ProductCardsProps) {
  if (!items.length) return null

  return (
    <div className="chat-products mt-2 space-y-3">
      {items.map((group) => (
        <div key={group.item} className="chat-products-group">
          <p className="chat-products-label text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 px-1">
            {group.item}
          </p>
          <div className="chat-products-grid flex flex-col gap-1.5">
            {group.products.map((p) => {
              const description = p.fullDescription || p.shortDescription
              return (
                <div
                  key={`${p.productId}-${p.subProductId}`}
                  className="chat-product-card flex items-start gap-3 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                >
                  <div className="chat-product-icon flex-shrink-0 w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center mt-0.5">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                      />
                    </svg>
                  </div>
                  <div className="chat-product-info flex-1 min-w-0">
                    <p className="chat-product-desc text-sm font-medium text-gray-800 leading-snug truncate">
                      {description}
                    </p>
                    <div className="chat-product-meta flex items-center gap-2 mt-0.5 flex-wrap">
                      {p.subDescription && (
                        <span className="text-xs text-gray-500">{p.subDescription}</span>
                      )}
                      {p.manufacturer && (
                        <span className="text-xs text-blue-600 font-medium">{p.manufacturer}</span>
                      )}
                      <span className="text-xs text-gray-400">
                        #{p.productId}/{p.subProductId}
                      </span>
                    </div>
                  </div>
                  <div className="chat-product-score flex-shrink-0">
                    <span className="text-xs text-emerald-600 font-medium bg-emerald-50 px-1.5 py-0.5 rounded-md">
                      {Math.round(p.score * 100)}%
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
