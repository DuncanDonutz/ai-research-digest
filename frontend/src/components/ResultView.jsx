import DigestCard from './DigestCard'

const SECTIONS = ['summary', 'contributions', 'limitations', 'so_what']

export default function ResultView({ digest, title, paperUrl, onReset }) {
  return (
    <div>
      {title && (
        <div className="mb-8 pb-8 border-b border-gray-800">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">
            Paper
          </p>
          {paperUrl ? (
            <a
              href={paperUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xl font-semibold text-blue-400 hover:text-blue-300 transition-colors inline-flex items-start gap-1.5"
            >
              {title}
              <span className="text-sm mt-1 flex-shrink-0">↗</span>
            </a>
          ) : (
            <h2 className="text-xl font-semibold text-white leading-snug">{title}</h2>
          )}
        </div>
      )}

      <div className="space-y-4">
        {SECTIONS.map(section => (
          <DigestCard
            key={section}
            section={section}
            content={digest[section]}
            confidence={digest.confidence?.[section]}
          />
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
