import { useState } from 'react'
import InputForm from './components/InputForm'
import LoadingState from './components/LoadingState'
import ResultView from './components/ResultView'

export default function App() {
  const [phase, setPhase] = useState('idle') // 'idle' | 'loading' | 'result'
  const [mode, setMode] = useState('url') // 'url' | 'text' — lifted so it survives phase transitions
  const [statusMsg, setStatusMsg] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [title, setTitle] = useState(null)
  const [paperUrl, setPaperUrl] = useState(null)
  const [digest, setDigest] = useState(null)
  const [error, setError] = useState(null)

  async function submitDigest(endpoint, body) {
    setPhase('loading')
    setStatusMsg('')
    setIsTyping(false)
    setTitle(null)
    setPaperUrl(body.url ?? null)
    setDigest(null)
    setError(null)

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      // FastAPI returns 422 JSON (not SSE) when Pydantic validation fails
      if (!response.ok) {
        const err = await response.json()
        const raw = err.detail?.[0]?.msg ?? 'Invalid request.'
        setError(raw.replace(/^Value error, /, ''))
        setPhase('idle')
        return
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let receivedResult = false

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        // Buffer partial chunks — an SSE event may be split across multiple reads
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() // keep the incomplete trailing line

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          let event
          try {
            event = JSON.parse(line.slice(6))
          } catch {
            continue
          }

          switch (event.type) {
            case 'status':
              setStatusMsg(event.message)
              break
            case 'title':
              setTitle(event.text)
              break
            case 'chunk':
              // Each chunk means Claude is actively writing — triggers typing animation
              setIsTyping(true)
              break
            case 'result':
              setDigest(event.data)
              setIsTyping(false)
              receivedResult = true
              break
            case 'error':
              setError(event.message)
              setPhase('idle')
              return
            case 'done':
              setPhase('result')
              return
          }
        }
      }

      if (!receivedResult) {
        setError('Stream ended unexpectedly. Please try again.')
        setPhase('idle')
      }
    } catch {
      setError('Network error — is the backend running?')
      setPhase('idle')
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-lg font-semibold tracking-tight">
            <span className="text-blue-400">AI</span> Research Digest
          </h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        {phase === 'idle' && (
          <InputForm
            mode={mode}
            onModeChange={setMode}
            onURLSubmit={url => submitDigest('/digest/url', { url })}
            onTextSubmit={text => submitDigest('/digest/text', { text })}
            error={error}
            onClearError={() => setError(null)}
          />
        )}
        {phase === 'loading' && (
          <LoadingState status={statusMsg} title={title} isTyping={isTyping} />
        )}
        {phase === 'result' && (
          <ResultView
            digest={digest}
            title={title}
            paperUrl={paperUrl}
            onReset={() => { setPhase('idle'); setError(null) }}
          />
        )}
      </main>
    </div>
  )
}
