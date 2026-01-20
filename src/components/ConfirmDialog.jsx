import React from 'react'

export default function ConfirmDialog({ open, title, description, confirmLabel = 'OK', cancelLabel = 'Cancel', onConfirm, onCancel }) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel}></div>
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-lg mx-4 z-50 overflow-hidden">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">{description}</p>
          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 rounded-lg bg-white border border-gray-200 text-sm text-gray-700 hover:bg-gray-50"
            >
              {cancelLabel}
            </button>
            <button
              onClick={onConfirm}
              className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm hover:bg-red-700"
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
