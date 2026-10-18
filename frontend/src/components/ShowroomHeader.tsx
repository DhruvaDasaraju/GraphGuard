import { useState, useEffect } from 'react';
import { Sun, Moon, ShieldAlert } from 'lucide-react';


interface ShowroomHeaderProps {
  activeTab: 'overview' | 'investigate' | 'atlas' | 'findings' | 'tickets';
  setActiveTab: (tab: 'overview' | 'investigate' | 'atlas' | 'findings' | 'tickets') => void;
  onQuickInvestigate?: () => void;
  isBackendHealthy: boolean;
}

export function ShowroomHeader({
  activeTab,
  setActiveTab,
  onQuickInvestigate,
  isBackendHealthy,
}: ShowroomHeaderProps) {
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return document.documentElement.classList.contains('dark');
    }
    return false;
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  const toggleTheme = () => {
    setIsDark((prev) => !prev);
  };

  const navItems = [
    { id: 'overview', label: '01 · OVERVIEW // TELEMETRY' },
    { id: 'atlas', label: '02 · ARCHITECTURE // MAP' },
    { id: 'investigate', label: '03 · INVESTIGATION // AGENT' },
    { id: 'findings', label: '04 · FINDINGS // BLAST-RADIUS' },
    { id: 'tickets', label: '05 · REMEDIATION // TICKETS' },
  ] as const;

  return (
    <header className="sticky top-0 z-50 border-b-[3.5px] border-[#050505] bg-white dark:bg-[#0c1020] shadow-[0px_4px_0px_#050505] transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-18 flex items-center justify-between gap-4">
        {/* Left: Square lettermark logo badge + Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#FFE600] text-[#050505] border-[2px] border-[#050505] shadow-[2px_2px_0px_#050505] flex items-center justify-center font-black font-mono text-xl select-none -rotate-1">
            G
          </div>
          <div className="cursor-pointer" onClick={() => setActiveTab('overview')}>
            <div className="flex items-center gap-2">
              <span className="font-display font-black text-xl tracking-tight text-[#050505] dark:text-white uppercase">
                GRAPHGUARD
              </span>
              <span className="text-[10px] font-mono font-black bg-[#00F0FF] text-[#050505] px-1.5 py-0.2 border border-[#050505] shadow-[1.5px_1.5px_0px_#050505] rotate-0.5">
                SHOWROOM
              </span>
            </div>
            <div className="text-[10px] font-mono text-[#050505]/60 dark:text-white/60 tracking-wider hidden sm:block">
              CYBERNETIC TOPOLOGY & BLAST-RADIUS
            </div>
          </div>
        </div>

        {/* Center: Monospaced anchor navigation links */}
        <nav className="hidden lg:flex items-center gap-1.5 overflow-x-auto py-1">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`px-3 py-1.5 text-xs font-mono font-black uppercase tracking-wider transition-all border-[2px] ${
                  isActive
                    ? 'bg-[#FFE600] text-[#050505] border-[#050505] shadow-[3px_3px_0px_#050505] -translate-y-0.5'
                    : 'bg-transparent text-[#050505]/80 dark:text-white/80 border-transparent hover:border-[#050505] hover:bg-[#f0f4fc] dark:hover:bg-[#151b34] hover:shadow-[2px_2px_0px_#050505]'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Right: Live telemetry status pill + Quick Action + Theme toggle */}
        <div className="flex items-center gap-3">
          {/* Live Telemetry Pill */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-[#00FF66] text-[#050505] border-[2px] border-[#050505] shadow-[2px_2px_0px_#050505] font-mono text-xs font-black uppercase tracking-wider -rotate-0.5">
            <span className="w-2 h-2 rounded-full bg-[#050505] animate-pulse" />
            <span>{isBackendHealthy ? 'FALKORDB: ACTIVE' : 'TELEMETRY: STANDBY'}</span>
          </div>

          {/* Quick Action Button */}
          {onQuickInvestigate && (
            <button
              onClick={onQuickInvestigate}
              className="hidden md:flex items-center gap-1.5 px-3.5 py-1.5 bg-[#FF0055] text-white border-[2px] border-[#050505] shadow-[3px_3px_0px_#050505] hover:shadow-[4px_4px_0px_#050505] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none font-mono font-black text-xs uppercase tracking-wider transition-all"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>TEST TRIAGE</span>
            </button>
          )}

          {/* Sun/Moon Theme Toggle */}
          <button
            onClick={toggleTheme}
            aria-label="Toggle light and dark theme"
            className="w-10 h-10 flex items-center justify-center bg-white dark:bg-[#11162d] text-[#050505] dark:text-[#FFE600] border-[2px] border-[#050505] shadow-[3px_3px_0px_#050505] hover:bg-[#f0f4fc] dark:hover:bg-[#1a2142] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
          >
            {isDark ? (
              <Sun className="w-5 h-5 text-[#FFE600] animate-spin-slow" />
            ) : (
              <Moon className="w-5 h-5 text-[#050505]" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Row */}
      <div className="lg:hidden border-t-[2px] border-[#050505] bg-[#edf2fc] dark:bg-[#080b18] px-3 py-1.5 flex items-center gap-2 overflow-x-auto no-scrollbar">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`shrink-0 px-2.5 py-1 text-[11px] font-mono font-black uppercase tracking-wider border-[1.5px] border-[#050505] ${
                isActive
                  ? 'bg-[#FFE600] text-[#050505] shadow-[2px_2px_0px_#050505]'
                  : 'bg-white dark:bg-[#131932] text-[#050505] dark:text-white'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </header>
  );
}
