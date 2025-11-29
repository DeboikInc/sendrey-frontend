export default function BarLoader() {
  return (
    <div className="flex items-center justify-center">
      <div className="relative w-12 h-12">
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
          ></span>
        ))}
      </div>
    </div>
  );
}
