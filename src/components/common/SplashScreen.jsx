// components/common/SplashScreen.jsx
import Logo from "../../assets/Sendrey-Logo-Variants-09.png";

export default function SplashScreen() {
  return (
    <div className="fixed inset-0 bg-[#0A0A0A] flex flex-col items-center justify-between px-8 py-16 z-[99999]">
      <div />

      <div className="flex flex-col items-center gap-7 animate-fade-up">
        <img src={Logo} alt="Sendrey" className="w-36 h-36 object-contain" />
        <div className="text-center">
          <p className="text-sm text-white/40 mt-1.5 tracking-wide">Deliveries, done differently</p>
        </div>
        <div className="flex gap-1.5 mt-2">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse [animation-delay:200ms] opacity-60" />
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse [animation-delay:400ms] opacity-30" />
        </div>
      </div>

      <p className="text-xs text-white/20">Welcome</p>
    </div>
  );
}