import { useEffect, useRef } from 'react';
import { Terminal, Shield, ArrowUpRight, Code2, Cpu } from 'lucide-react';


interface Shockwave {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  speed: number;
  alpha: number;
}

export function HalftoneFooter() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    let animationFrameId: number;
    let width = 0;
    let height = 0;

    const mouse = { x: -9999, y: -9999, isHovering: false };
    const shockwaves: Shockwave[] = [];

    // Helper to read CSS variables from document
    const getThemeColors = () => {
      const isDark = document.documentElement.classList.contains('dark');
      return {
        bg: isDark ? '#070913' : '#f1f4fb',
        ink: isDark ? '#ffffff' : '#050505',
        warm: isDark ? '#00F0FF' : '#FFE600',
        accent: isDark ? '#FF0055' : '#008844',
      };
    };

    // Build lettermark mask data
    let textMask: Uint8ClampedArray | null = null;
    let maskWidth = 0;
    let maskHeight = 0;

    const createTextMask = (w: number, h: number) => {
      const offCanvas = document.createElement('canvas');
      offCanvas.width = w;
      offCanvas.height = h;
      const offCtx = offCanvas.getContext('2d');
      if (!offCtx) return;

      offCtx.fillStyle = '#000000';
      offCtx.fillRect(0, 0, w, h);

      offCtx.fillStyle = '#ffffff';
      offCtx.textAlign = 'center';
      offCtx.textBaseline = 'middle';

      // Responsive font sizing for the giant wordmark
      const fontSize = Math.max(28, Math.min(w * 0.12, 110));
      offCtx.font = `900 ${fontSize}px 'Space Grotesk', system-ui, sans-serif`;
      offCtx.fillText('GRAPHGUARD.IO', w / 2, h / 2);

      const imgData = offCtx.getImageData(0, 0, w, h);
      textMask = imgData.data;
      maskWidth = w;
      maskHeight = h;
    };

    const handleResize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.scale(dpr, dpr);

      createTextMask(Math.floor(width), Math.floor(height));
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
      mouse.isHovering = true;
    };

    const handleMouseLeave = () => {
      mouse.x = -9999;
      mouse.y = -9999;
      mouse.isHovering = false;
    };

    const handleClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      shockwaves.push({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        radius: 0,
        maxRadius: Math.max(width, height) * 0.7,
        speed: 9,
        alpha: 1.0,
      });
    };

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);
    canvas.addEventListener('click', handleClick);

    // Animation loop
    const render = () => {
      const colors = getThemeColors();
      ctx.clearRect(0, 0, width, height);

      // Canvas background
      ctx.fillStyle = colors.bg;
      ctx.fillRect(0, 0, width, height);

      // Update shockwaves
      for (let i = shockwaves.length - 1; i >= 0; i--) {
        const sw = shockwaves[i];
        sw.radius += sw.speed;
        sw.alpha = Math.max(0, 1.0 - sw.radius / sw.maxRadius);
        if (sw.radius >= sw.maxRadius) {
          shockwaves.splice(i, 1);
        }
      }

      const dotSpacing = Math.max(12, Math.floor(width / 64));
      const cols = Math.floor(width / dotSpacing);
      const rows = Math.floor(height / dotSpacing);
      const offsetX = (width - cols * dotSpacing) / 2;
      const offsetY = (height - rows * dotSpacing) / 2;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = offsetX + c * dotSpacing + dotSpacing / 2;
          const y = offsetY + r * dotSpacing + dotSpacing / 2;

          // Check mask intensity
          let isText = false;
          if (textMask && maskWidth > 0) {
            const px = Math.floor(x);
            const py = Math.floor(y);
            if (px >= 0 && px < maskWidth && py >= 0 && py < maskHeight) {
              const idx = (py * maskWidth + px) * 4;
              isText = textMask[idx] > 120;
            }
          }

          let baseRadius = isText ? 4.2 : 1.4;
          let dotColor = isText ? colors.ink : (document.documentElement.classList.contains('dark') ? '#222944' : '#c8d4ec');

          // Mouse proximity calculation
          const dx = x - mouse.x;
          const dy = y - mouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const maxDist = 140;

          if (dist < maxDist) {
            const factor = (1 - dist / maxDist);
            baseRadius += factor * (isText ? 5.5 : 3.8);
            dotColor = isText ? colors.warm : colors.accent;
          }

          // Shockwave ripple calculation
          for (const sw of shockwaves) {
            const swDist = Math.abs(Math.sqrt((x - sw.x) ** 2 + (y - sw.y) ** 2) - sw.radius);
            if (swDist < 35) {
              const swFactor = (1 - swDist / 35) * sw.alpha;
              baseRadius += swFactor * 6;
              dotColor = colors.warm;
            }
          }

          ctx.beginPath();
          ctx.arc(x, y, Math.max(0.8, baseRadius), 0, Math.PI * 2);
          ctx.fillStyle = dotColor;
          ctx.fill();
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
      canvas.removeEventListener('click', handleClick);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <footer className="mt-20 border-t-[3.5px] border-[#050505] bg-white dark:bg-[#090c1a] relative overflow-hidden">
      {/* Top Banner Bar */}
      <div className="border-b-[3px] border-[#050505] bg-[#FFE600] text-[#050505] px-4 py-2.5 flex flex-wrap items-center justify-between text-xs font-mono font-black uppercase tracking-wider">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4" />
          <span>GRAPHGUARD // TELEMETRY SHOWROOM ENGINE</span>
        </div>
        <div className="flex items-center gap-4 text-[11px]">
          <span className="hidden sm:inline">CLICK CANVAS FOR RIPPLE EFFECT</span>
          <span className="bg-[#050505] text-white px-2 py-0.5 border border-[#050505] shadow-[2px_2px_0px_#050505]">
            SYS_STATUS: ACTIVE
          </span>
        </div>
      </div>

      {/* Interactive Halftone Canvas Area */}
      <div className="relative w-full h-[220px] sm:h-[280px] bg-[#f1f4fb] dark:bg-[#070913] cursor-crosshair">
        <canvas
          ref={canvasRef}
          className="w-full h-full block"
          title="Interactive halftone particle wordmark. Hover and click for shockwaves."
        />
        <div className="absolute bottom-3 left-4 pointer-events-none text-[10px] font-mono font-bold uppercase tracking-widest text-[#050505]/40 dark:text-white/30">
          // INTERACTIVE HALFTONE GRID · RECEPTIVE TO CURSOR CONTACT
        </div>
      </div>

      {/* Footer Navigation & Copyright */}
      <div className="border-t-[3px] border-[#050505] px-6 py-8 bg-white dark:bg-[#0a0d1d]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 bg-[#00F0FF] border-[2px] border-[#050505] flex items-center justify-center font-black font-mono shadow-[2px_2px_0px_#050505]">
                G
              </span>
              <span className="font-display font-black text-xl tracking-tight text-[#050505] dark:text-white">
                GRAPHGUARD
              </span>
              <span className="text-[10px] font-mono font-black bg-[#00FF66] text-[#050505] px-1.5 py-0.5 border border-[#050505] shadow-[2px_2px_0px_#050505] -rotate-1">
                v0.1.0-STREET
              </span>
            </div>
            <p className="text-xs font-mono text-[#050505]/70 dark:text-white/70 max-w-md">
              Autonomous FalkorDB Graph-Native Security Intelligence & Multi-Hop Microservice Blast-Radius Triage Engine.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs font-mono font-bold">
            <a
              href="http://localhost:8000/docs"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f0f4fc] dark:bg-[#12172f] border-[2px] border-[#050505] text-[#050505] dark:text-white shadow-[2px_2px_0px_#050505] hover:bg-[#FFE600] hover:text-[#050505] transition-colors"
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>FASTAPI DOCS</span>
              <ArrowUpRight className="w-3 h-3" />
            </a>
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f0f4fc] dark:bg-[#12172f] border-[2px] border-[#050505] text-[#050505] dark:text-white shadow-[2px_2px_0px_#050505] hover:bg-[#00F0FF] hover:text-[#050505] transition-colors"
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>SOURCE // CORE</span>
              <ArrowUpRight className="w-3 h-3" />
            </a>
          </div>
        </div>

        <div className="max-w-7xl mx-auto mt-6 pt-4 border-t border-[#050505]/10 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between text-[11px] font-mono text-[#050505]/60 dark:text-white/50">
          <div>© 2026 GRAPHGUARD PROJECT. ALL RIGHTS RESERVED. ZERO-HALLUCINATION GUARANTEE.</div>
          <div className="mt-2 sm:mt-0 flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Shield className="w-3 h-3 text-[#00FF66]" />
              FALKORDB GRAPH NATIVE
            </span>
            <span>·</span>
            <span>CYBER-NEO SHOWROOM</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
