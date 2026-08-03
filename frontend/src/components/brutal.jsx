import React from "react";
import { motion } from "framer-motion";

// Cozy Wellness component library (backwards-compatible names)
const COLORS = {
 yellow: "bg-cozy-secondary text-cozy-text",
 cyan: "text-cozy-text",
 pink: "bg-cozy-accent text-cozy-text",
 green: "bg-cozy-primary text-white",
 white: "bg-cozy-surface text-cozy-text",
 black: "text-white",
 primary: "bg-cozy-primary text-white",
 secondary: "bg-cozy-secondary text-cozy-text",
 accent: "bg-cozy-accent text-cozy-text",
};

const COLOR_HEX = {
 yellow: "#F7D9C4",
 cyan: "#C8DFF0",
 pink: "#F2B5A7",
 green: "#7FAE62",
 white: "var(--cozy-surface)",
 black: "var(--cozy-text)",
 primary: "#7FAE62",
 secondary: "#F7D9C4",
 accent: "#F2B5A7",
};

export const BrutalButton = ({
 children,
 color = "primary",
 className = "",
 size = "md",
 onClick,
 type = "button",
 disabled = false,
 ...rest
}) => {
 const sizeCls = size === "lg" ? "px-7 py-4 text-base" : size === "sm" ? "px-3 py-2 text-xs" : "px-5 py-2.5 text-sm";
 return (
 <motion.button
 type={type}
 disabled={disabled}
 onClick={onClick}
 whileHover={disabled ? {} : { y: -2 }}
 whileTap={disabled ? {} : { scale: 0.97 }}
 transition={{ type: "spring", stiffness: 400, damping: 20 }}
 className={`${COLORS[color] || COLORS.primary} ${sizeCls} font-display font-semibold tracking-wide rounded-full shadow-cozy hover:shadow-cozy-lg disabled:opacity-50 disabled:cursor-not-allowed brutal-btn ${className}`}
 style={{ backgroundColor: color === "cyan" ? "#C8DFF0" : undefined }}
 {...rest}
 >
 {children}
 </motion.button>
 );
};

export const BrutalCard = ({ children, color = "white", className = "", tilt = 0, hover = true, ...rest }) => (
 <motion.div
 initial={{ opacity: 0, y: 12 }}
 animate={{ opacity: 1, y: 0 }}
 whileHover={hover ? { y: -3 } : {}}
 transition={{ type: "spring", stiffness: 300, damping: 25 }}
 className={`${COLORS[color] || COLORS.white} border border-cozy-border shadow-cozy hover:shadow-cozy-lg p-6 ${className}`}
 style={{ borderRadius: 24, backgroundColor: color === "cyan" ? "#C8DFF0" : undefined }}
 {...rest}
 >
 {children}
 </motion.div>
);

export const BrutalInput = React.forwardRef(({ className = "", ...rest }, ref) => (
 <input
 ref={ref}
 className={`w-full border border-cozy-border px-4 py-3 bg-cozy-surface text-cozy-text placeholder:text-cozy-muted focus:outline-none font-medium ${className}`}
 style={{ borderRadius: 16 }}
 {...rest}
 />
));
BrutalInput.displayName = "BrutalInput";

export const BrutalBadge = ({ children, color = "primary", className = "" }) => (
 <span
 className={`inline-flex items-center px-3 py-1 font-semibold text-xs ${className}`}
 style={{
 borderRadius: 999,
 backgroundColor: COLOR_HEX[color] || COLOR_HEX.primary,
 color: color === "green" || color === "primary" ? "#fff" : "var(--cozy-text)",
 border: "1px solid var(--cozy-border)",
 }}
 >
 {children}
 </span>
);

export const BrutalTag = ({ children, color = "primary", active = false, onClick }) => (
 <motion.button
 whileTap={{ scale: 0.95 }}
 onClick={onClick}
 className="px-4 py-2 font-semibold text-xs tracking-wide transition-all"
 style={{
 borderRadius: 999,
 backgroundColor: active ? (COLOR_HEX[color] || COLOR_HEX.primary) : "var(--cozy-surface)",
 color: active && (color === "green" || color === "primary") ? "#fff" : "var(--cozy-text)",
 border: active ? "none" : "1px solid var(--cozy-border)",
 boxShadow: active ? "var(--shadow-cozy)" : "none",
 }}
 >
 {children}
 </motion.button>
);
