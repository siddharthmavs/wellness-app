import React from "react";
import { motion } from "framer-motion";

export const Skeleton = ({ className = "h-12", count = 1 }) => (
  <div className="space-y-3" data-testid="skeleton">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className={`brutal-skeleton rounded-[2px] ${className}`} />
    ))}
  </div>
);

export const EmptyState = ({ title = "Nothing here yet", subtitle = "Be the first legend.", emoji = "👻" }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.9, rotate: -2 }}
    animate={{ opacity: 1, scale: 1, rotate: -1 }}
    className="border-[4px] border-black bg-white shadow-brutal-lg p-8 text-center max-w-md mx-auto"
    data-testid="empty-state"
  >
    <div className="text-7xl mb-3">{emoji}</div>
    <h3 className="font-display font-black uppercase text-2xl mb-1">{title}</h3>
    <p className="text-sm font-bold uppercase tracking-wider">{subtitle}</p>
    <svg viewBox="0 0 200 30" className="w-full max-w-xs mx-auto mt-4">
      <path d="M0,15 Q25,0 50,15 T100,15 T150,15 T200,15" fill="none" stroke="currentColor" strokeWidth="3" />
    </svg>
  </motion.div>
);
