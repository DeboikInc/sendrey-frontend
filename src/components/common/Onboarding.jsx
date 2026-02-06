import Header from "./Header";

export default function Onboarding({ darkMode, toggleDarkMode, children }) {
  return (
    <div className="h-[100dvh] flex flex-col bg-white dark:bg-black-100">
      <Header title="ErrandPro" darkMode={darkMode} toggleDarkMode={toggleDarkMode} />

      <div className="flex-1 overflow-hidden">
        <div className="mx-auto max-w-4xl h-full grid grid-cols-1 lg:grid-cols-[340px_minmax(1,1fr)_360px] bg-gray-100 dark:bg-black-200 overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}