import { OrderItemDto } from '../../features/chat/types'

interface ProductCardsProps {
  items: OrderItemDto[]
  totalAmount?: number
}

const fmt = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export function ProductCards({ items, totalAmount }: ProductCardsProps) {
  if (!items.length) return null

  return (
    <div className="chat-products mt-2">
      <div className="chat-products-table overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-3 py-2">
                Produto
              </th>
              <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wide px-3 py-2">
                Qtd
              </th>
              <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-3 py-2">
                Unit.
              </th>
              <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-3 py-2">
                Subtotal
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr
                key={`${item.productId}-${idx}`}
                className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors"
              >
                <td className="px-3 py-2.5">
                  <span className="font-medium text-gray-800 leading-snug">{item.productName}</span>
                  <span className="block text-xs text-gray-400">#{item.productId}</span>
                </td>
                <td className="px-3 py-2.5 text-center text-gray-700 font-medium">{item.quantity}</td>
                <td className="px-3 py-2.5 text-right text-gray-600">{fmt(item.unitPrice)}</td>
                <td className="px-3 py-2.5 text-right font-semibold text-gray-800">{fmt(item.subtotal)}</td>
              </tr>
            ))}
          </tbody>
          {totalAmount != null && (
            <tfoot>
              <tr className="bg-emerald-50 border-t border-emerald-200">
                <td colSpan={3} className="px-3 py-2.5 text-sm font-semibold text-emerald-700">
                  Total
                </td>
                <td className="px-3 py-2.5 text-right text-sm font-bold text-emerald-700">
                  {fmt(totalAmount)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
