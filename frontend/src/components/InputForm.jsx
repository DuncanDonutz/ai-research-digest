import { useState } from 'react'

const EXAMPLE_URL = 'https://arxiv.org/abs/2408.06292'

export default function InputForm({ onURLSubmit, onTextSubmit, error, onClearError }) {
  const [mode, setMode] = useState('url')
  const [url, setUrl] = useState('')
  const [text, setText] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    if (mode === 'url') onURLSubmit(url.trim())
    else onTextSubmit(text.trim())
  }

  const canSubmit = mode === 'url' ? url.trim().length > 0 : text.trim().length > 0

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-10 text-center">
        <h2 className="text-3xl font-bold mb-3">Research Paper Digest</h2>
        <p className="text-gray-400">
          Drop in an arXiv URL or paste a paper abstract. Claude will break it
          down into plain English.
        </p>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-1 bg-gray-900 rounded-lg p-1 mb-6">
        {[
          { id: 'url', label: 'arXiv URL' },
          { id: 'text', label: 'Paste Text' },
        ].map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => { setMode(id); onClearError() }}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              mode === id
                ? 'bg-gray-700 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {mode === 'url' ? (
          <>
            <input
              type="text"
              value={url}
              onChange={e => { setUrl(e.target.value); onClearError() }}
              placeholder="https://arxiv.org/abs/2408.06292"
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
            <button
              type="button"
              onClick={() => { setUrl(EXAMPLE_URL); onClearError() }}
              className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              Try an example — "The AI Scientist" →
            </button>
          </>
        ) : (
          <textarea
            value={text}
            onChange={e => { setText(e.target.value); onClearError() }}
            placeholder="Paste a paper abstract or excerpt here..."
            rows={8}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors resize-none"
          />
        )}

        {error && (
          <div className="text-sm text-red-400 bg-red-950/50 border border-red-800/50 rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors"
        >
          Generate Digest
        </button>
      </form>
    </div>
  )
}
