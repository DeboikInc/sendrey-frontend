export default function BarLoader({ fullScreen = false, size = 'default' }) {
  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-black-100 z-50 flex items-center justify-center">
        <div className="relative w-10 h-10">
          {Array.from({ length: 12 }).map((_, i) => (
            <span key={i} className="absolute w-2 h-2 bg-primary rounded-full animate-fade-dot"
              style={{ left: "50%", top: "50%", transform: `rotate(${i * 30}deg) translate(0, -16px)`, animationDelay: `${i * 0.1}s` }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (size === 'small') {
    return (
      <div className="relative w-4 h-4 flex-shrink-0 inline-flex items-center justify-center">
        {Array.from({ length: 12 }).map((_, i) => (
          <span key={i} className="absolute w-[3px] h-[3px] bg-primary rounded-full animate-fade-dot"
            style={{ left: "50%", top: "50%", transform: `rotate(${i * 30}deg) translate(0, -8px)`, animationDelay: `${i * 0.1}s` }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center w-full h-full min-h-[200px]">
      <div className="relative w-10 h-10">
        {Array.from({ length: 12 }).map((_, i) => (
          <span key={i} className="absolute w-2 h-2 bg-primary rounded-full animate-fade-dot"
            style={{ left: "50%", top: "50%", transform: `rotate(${i * 30}deg) translate(0, -16px)`, animationDelay: `${i * 0.1}s` }}
          />
        ))}
      </div>
    </div>
  );
}