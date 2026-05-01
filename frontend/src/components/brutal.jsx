import React from "react";
import { motion } from "framer-motion";

const COLORS = {
  yellow: "bg-brutal-yellow",
  cyan: "bg-brutal-cyan",
  pink: "bg-brutal-pink",
  green: "bg-brutal-green",
  white: "bg-white",
  black: "bg-black text-white",
};

export const BrutalButton = ({
  children,
  color = "yellow",
  className = "",
  size = "md",
  onClick,
  type = "button",
  disabled = false,
  ...rest
}) => {
  const sizeCls = size === "lg" ? "px-7 py-4 text-lg" : size === "sm" ? "px-3 py-2 text-xs" : "px-5 py-3 text-sm";
  return (
    <motion.button
      type={type}
      disabled={disabled}
      onClick={onClick}
      whileHover={disabled ? {} : { scale: 1.02, rotate: -1 }}
      whileTap={disabled ? {} : { scale: 0.95, x: 4, y: 4, boxShadow: "0px 0px 0px 0px rgba(0,0,0,1)" }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
      className={`${COLORS[color]} ${sizeCls} font-black uppercase tracking-wider border-[3px] border-black shadow-brutal rounded-[2px] disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      {...rest}
    >
      {children}
    </motion.button>
  );
};

export const BrutalCard = ({ children, color = "white", className = "", tilt = 0, hover = true, ...rest }) => (
  <motion.div
    initial={{ opacity: 0, y: 20, rotate: tilt - 1 }}
    animate={{ opacity: 1, y: 0, rotate: tilt }}
    whileHover={hover ? { scale: 1.01, rotate: tilt + 1, y: -2 } : {}}
    transition={{ type: "spring", stiffness: 300, damping: 20 }}
    className={`${COLORS[color]} border-[4px] border-black shadow-brutal-lg rounded-[4px] p-5 ${className}`}
    {...rest}
  >
    {children}
  </motion.div>
);

export const BrutalInput = React.forwardRef(({ className = "", ...rest }, ref) => (
  <input
    ref={ref}
    className={`w-full border-[3px] border-black px-4 py-3 bg-white focus:outline-none focus:ring-4 focus:ring-brutal-cyan focus:border-black font-medium rounded-[2px] ${className}`}
    {...rest}
  />
));
BrutalInput.displayName = "BrutalInput";

export const BrutalBadge = ({ children, color = "pink", className = "" }) => (
  <span
    className={`${COLORS[color]} inline-flex items-center border-[2px] border-black px-3 py-1 font-bold text-xs uppercase tracking-wider shadow-brutal-sm rounded-[2px] ${className}`}
  >
    {children}
  </span>
);

export const BrutalTag = ({ children, color = "yellow", active = false, onClick }) => (
  <motion.button
    whileTap={{ scale: 0.95 }}
    onClick={onClick}
    className={`${active ? COLORS[color] : "bg-white"} border-[3px] border-black px-4 py-2 font-black uppercase tracking-wider text-xs rounded-[2px] ${active ? "shadow-brutal" : ""}`}
  >
    {children}
  </motion.button>
);
