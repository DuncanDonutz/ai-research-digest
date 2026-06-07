import DigestCard from './DigestCard'

const SECTIONS = ['summary', 'contributions', 'limitations', 'so_what']

export default function ResultView({ digest, title, onReset }) {
  return (
    <div>
      {title && (
        <div className="mb-8 pb-8 border-b border-gray-800">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">
            Paper
          </p>
          <h2 className="text-xl font-semibold text-white leading-snug">{title}</h2>
        </div>
      )}

      <div className="space-y-4">
        {SECTIONS.map(section => (
          <DigestCard key={section} section={section} content={digest[section]} />
        ))}
      </div>

      <div className="mt-10 text-center">
        <button
          onClick={onReset}
          className="text-sm text-gray-400 hover:text-white transition-colors"
        >
          ← Analyze another paper
        </button>
      </div>
    </div>
  )
}
