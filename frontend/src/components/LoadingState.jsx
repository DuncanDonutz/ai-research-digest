export default function LoadingState({ status, title, isTyping }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-10 h-10 border-4 border-gray-700 border-t-blue-500 rounded-full animate-spin mb-8" />

      {title && (
        <p className="text-gray-200 font-medium mb-3 max-w-xl text-sm leading-relaxed">
          &ldquo;{title}&rdquo;
        </p>
      )}

      <p className="text-gray-400 text-sm flex items-center gap-2">
        {status || 'Starting...'}
        {isTyping && (
          <span className="inline-flex gap-1 ml-1">
            <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
            <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
            <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" />
          </span>
        )}
      </p>
    </div>
  )
}
