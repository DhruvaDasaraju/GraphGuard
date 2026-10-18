import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, ArrowUpRight, CheckCircle2 } from 'lucide-react';
import type { OwnerNode } from '../types/api';

export interface HoverMemberProps {
  members?: OwnerNode[];
  onSelectMember?: (ownerId: string) => void;
}

const DEFAULT_MEMBERS: OwnerNode[] = [
  { id: 'owner-1', name: 'Alice Kim', team: 'Platform Security', contact: 'alice@example.com' },
  { id: 'owner-2', name: 'Bob Patel', team: 'Payments Team', contact: 'bob@example.com' },
  { id: 'owner-3', name: 'Carol Wang', team: 'API Infrastructure', contact: 'carol@example.com' },
  { id: 'owner-4', name: 'David Osei', team: 'Identity & Auth', contact: 'david@example.com' },
  { id: 'owner-5', name: 'Eva Rossi', team: 'Data & Analytics', contact: 'eva@example.com' },
];

export function HoverMember({ members = DEFAULT_MEMBERS, onSelectMember }: HoverMemberProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const memberList = members.length > 0 ? members : DEFAULT_MEMBERS;

  return (
    <div
      onMouseMove={handleMouseMove}
      className="relative w-full bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs overflow-hidden text-left"
    >
      <div className="flex items-center justify-between pb-4 mb-2 border-b border-slate-100">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 block mb-1">
            Escalation Directory · Hover Interaction
          </span>
          <h3 className="text-xl font-bold text-slate-900">
            Security Incident Owners
          </h3>
        </div>
        <span className="text-xs font-medium text-slate-500">
          Hover to inspect contact card
        </span>
      </div>

      {/* Members List */}
      <div className="divide-y divide-slate-100 relative z-10">
        {memberList.map((member, idx) => {
          const isHovered = hoveredIdx === idx;
          const isAnyHovered = hoveredIdx !== null;

          return (
            <div
              key={member.id}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              onClick={() => onSelectMember && onSelectMember(member.id)}
              style={{
                opacity: isAnyHovered && !isHovered ? 0.35 : 1,
                transition: 'opacity 0.2s ease, transform 0.2s ease',
              }}
              className="py-4 sm:py-5 flex items-center justify-between cursor-pointer group hover:translate-x-1"
            >
              <div className="flex items-center gap-4">
                <span className="text-xs font-mono font-bold text-slate-400 group-hover:text-blue-600 transition-colors">
                  0{idx + 1}
                </span>
                <div>
                  <h4 className="text-lg sm:text-xl font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                    {member.name}
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {member.team}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="hidden sm:inline-block px-3 py-1 rounded-full bg-slate-50 border border-slate-200 text-xs font-mono text-slate-600 group-hover:border-blue-200 group-hover:bg-blue-50 group-hover:text-blue-700 transition-colors">
                  {member.contact}
                </span>
                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-xs">
                  <ArrowUpRight className="w-4 h-4" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Floating Hover Card (Follows cursor smoothly) */}
      <AnimatePresence>
        {hoveredIdx !== null && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{
              opacity: 1,
              scale: 1,
              x: mousePos.x + 20,
              y: mousePos.y - 70,
            }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{
              type: 'spring',
              stiffness: 350,
              damping: 25,
              mass: 0.5,
            }}
            className="pointer-events-none absolute top-0 left-0 z-30 hidden md:block w-64 p-4 rounded-2xl bg-slate-900 text-white shadow-xl border border-slate-800"
          >
            <div className="flex items-center gap-3 mb-2.5">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-base shadow-xs">
                {memberList[hoveredIdx].name[0]}
              </div>
              <div>
                <div className="font-bold text-sm text-white leading-tight">
                  {memberList[hoveredIdx].name}
                </div>
                <div className="text-[11px] text-blue-300 font-medium">
                  {memberList[hoveredIdx].team}
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800 space-y-1.5 text-xs text-slate-300 font-mono">
              <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                <Mail className="w-3.5 h-3.5 text-blue-400" />
                <span className="truncate">{memberList[hoveredIdx].contact}</span>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-400 text-[10px]">
                <CheckCircle2 className="w-3 h-3" />
                <span>Active on Incident Rotation</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
