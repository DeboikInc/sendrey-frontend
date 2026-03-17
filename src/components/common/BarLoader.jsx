export default function BarLoader({ fullScreen = false }) {
  return (
    <div className={`flex items-center justify-center ${fullScreen ? 'fixed inset-0 bg-white dark:bg-black-100 z-50' : 'w-full h-full min-h-[200px]'}`}>
      <div className="relative w-10 h-10">
        {Array.from({ length: 12 }).map((_, i) => (
          <span
            key={i}
            className="absolute w-2 h-2 bg-primary rounded-full animate-fade-dot"
            style={{
              left: "50%",
              top: "50%",
              transform: `rotate(${i * 30}deg) translate(0, -16px)`,
              animationDelay: `${i * 0.1}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}