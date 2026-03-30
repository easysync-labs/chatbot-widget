import { useState } from 'react'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { selectProductOption } from '../../features/chat/chatThunks'
import { PendingItemSelectionDto, OrderProductOptionDto } from '../../features/chat/types'

interface ProductOptionsProps {
  pendingSelections: PendingItemSelectionDto[]
}

export function ProductOptions({ pendingSelections }: ProductOptionsProps) {
  const dispatch = useAppDispatch()
  const isLoading = useAppSelector((s) => s.chat.status === 'loading')

  // Map itemIndex → chosen optionIndex (or null)
  const [chosen, setChosen] = useState<Record<number, number>>({})

  if (!pendingSelections.length) return null

  const selectedCount = Object.keys(chosen).length
  const canConfirm = selectedCount > 0 && !isLoading

  function handleConfirm() {
    const selections = Object.entries(chosen).map(([itemIndex, optionIndex]) => ({
      itemIndex: Number(itemIndex),
      optionIndex,
    }))

    const parts = pendingSelections
      .filter((p) => chosen[p.itemIndex] != null)
      .map((p) => {
        const opt = p.options.find((o) => o.index === chosen[p.itemIndex])
        return opt ? `${opt.productName} (${p.quantity}x)` : `Opção ${chosen[p.itemIndex]}`
      })

    dispatch(
      selectProductOption({
        selections,
        summary: parts.join(', '),
      })
    )
  }

  return (
    <div className="chat-product-options mt-2 space-y-3">
      {pendingSelections.map((pending) => (
        <div key={pending.itemIndex} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          {/* Group header */}
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-200">
            <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
              {pending.itemName}
            </span>
            <span className="text-xs text-gray-400 bg-gray-200 px-1.5 py-0.5 rounded-full">
              {pending.quantity}x
            </span>
          </div>

          {/* Options */}
          <div className="flex flex-col divide-y divide-gray-100">
            {pending.options.map((opt: OrderProductOptionDto) => {
              const isSelected = chosen[pending.itemIndex] === opt.index
              return (
                <button
                  key={`${opt.productId}-${opt.subProductId}`}
                  disabled={isLoading}
                  onClick={() =>
                    setChosen((prev) =>
                      prev[pending.itemIndex] === opt.index
                        ? { ...prev, [pending.itemIndex]: undefined as unknown as number }
                        : { ...prev, [pending.itemIndex]: opt.index }
                    )
                  }
                  className={`flex items-center gap-3 px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed ${
                    isSelected
                      ? 'bg-blue-50 border-l-2 border-l-blue-500'
                      : 'hover:bg-gray-50 border-l-2 border-l-transparent'
                  }`}
                >
                  {/* Radio indicator */}
                  <span
                    className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                      isSelected ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                    }`}
                  >
                    {isSelected && <span className="w-2 h-2 rounded-full bg-white" />}
                  </span>

                  <div className="flex-1 min-w-0">
                    {opt.manufacturer && (
                      <span className="inline-block text-xs font-bold text-white bg-gray-600 px-1.5 py-0.5 rounded mb-0.5 uppercase tracking-wide leading-none">
                        {opt.manufacturer}
                      </span>
                    )}
                    <p className={`text-sm leading-snug ${isSelected ? 'font-semibold text-blue-800' : 'font-medium text-gray-800'}`}>
                      {opt.productName}
                    </p>
                    {opt.subDescription && (
                      <p className="text-xs text-gray-500 mt-0.5">{opt.subDescription}</p>
                    )}
                  </div>

                  <span className="text-xs text-gray-400 flex-shrink-0">#{opt.productId}</span>
                </button>
              )
            })}
          </div>
        </div>
      ))}

      {/* Confirm button */}
      <button
        disabled={!canConfirm}
        onClick={handleConfirm}
        className="w-full py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white"
      >
        {isLoading
          ? 'Aguarde...'
          : selectedCount === pendingSelections.length
          ? 'Confirmar seleção'
          : `Confirmar ${selectedCount} de ${pendingSelections.length}`}
      </button>
    </div>
  )
}
