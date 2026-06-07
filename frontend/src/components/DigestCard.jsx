import ReactMarkdown from 'react-markdown'

const CARDS = {
  summary: {
    title: 'Plain English Summary',
    icon: '📖',
    border: 'border-blue-500/30',
    bg: 'bg-blue-500/5',
    iconBg: 'bg-blue-500/10',
  },
  contributions: {
    title: 'Key Contributions',
    icon: '✨',
    border: 'border-emerald-500/30',
    bg: 'bg-emerald-500/5',
    iconBg: 'bg-emerald-500/10',
  },
  limitations: {
    title: 'Limitations & Open Questions',
    icon: '⚠️',
    border: 'border-amber-500/30',
    bg: 'bg-amber-500/5',
    iconBg: 'bg-amber-500/10',
  },
  so_what: {
    title: 'So What?',
    icon: '🚀',
    border: 'border-purple-500/30',
    bg: 'bg-purple-500/5',
    iconBg: 'bg-purple-500/10',
  },
}

export default function DigestCard({ section, content }) {
  const c = CARDS[section]

  return (
    <div className={`rounded-xl border p-6 ${c.border} ${c.bg}`}>
      <div className="flex items-center gap-3 mb-4">
        <span className={`text-base p-2 rounded-lg leading-none ${c.iconBg}`}>
          {c.icon}
        </span>
        <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-400">
          {c.title}
        </h3>
      </div>
      <div className="prose prose-sm prose-invert max-w-none prose-p:text-gray-300 prose-li:text-gray-300 prose-ul:my-2 prose-li:my-0.5 prose-p:my-1">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    </div>
  )
}
