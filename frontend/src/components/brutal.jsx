import React from "react";
import { motion } from "framer-motion";

/* =========================================================
   COZY WELLNESS COMPONENT LIBRARY
   Dark-mode adaptive + backwards compatible
========================================================= */

const COLORS = {
  yellow:
    "bg-cozy-secondary text-cozy-text border border-cozy-border",

  cyan:
    "bg-cozy-surface text-cozy-text border border-cozy-border",

  pink:
    "bg-cozy-accent text-cozy-text border border-cozy-border",

  green:
    "bg-cozy-primary text-white border border-cozy-primary",

  white:
    "bg-cozy-surface text-cozy-text border border-cozy-border",

  black:
    "bg-cozy-text text-cozy-surface border border-cozy-text",

  primary:
    "bg-cozy-primary text-white border border-cozy-primary",

  secondary:
    "bg-cozy-secondary text-cozy-text border border-cozy-border",

  accent:
    "bg-cozy-accent text-cozy-text border border-cozy-border",
};

/* =========================================================
   COLOR TOKENS
========================================================= */

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

/* =========================================================
   BUTTON
========================================================= */

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
  const sizeCls =
    size === "lg"
      ? "px-7 py-4 text-base"
      : size === "sm"
        ? "px-3 py-2 text-xs"
        : "px-5 py-2.5 text-sm";

  return (
    <motion.button
      type={type}
      disabled={disabled}
      onClick={onClick}
      whileHover={disabled ? {} : { y: -2 }}
      whileTap={disabled ? {} : { scale: 0.97 }}
      transition={{
        type: "spring",
        stiffness: 400,
        damping: 20,
      }}
      className={`
        ${COLORS[color] || COLORS.primary}
        ${sizeCls}
        font-display
        font-semibold
        tracking-wide
        rounded-full
        shadow-cozy
        hover:shadow-cozy-lg
        transition-all
        duration-200
        disabled:opacity-50
        disabled:cursor-not-allowed
        brutal-btn
        ${className}
      `}
      style={{
        backgroundColor:
          color === "cyan"
            ? "var(--admin-cyan, #C8DFF0)"
            : undefined,
      }}
      {...rest}
    >
      {children}
    </motion.button>
  );
};

/* =========================================================
   CARD
========================================================= */

export const BrutalCard = ({
  children,
  color = "white",
  className = "",
  tilt = 0,
  hover = true,
  ...rest
}) => (
  <motion.div
    initial={{
      opacity: 0,
      y: 12,
    }}
    animate={{
      opacity: 1,
      y: 0,
    }}
    whileHover={
      hover
        ? {
            y: -3,
          }
        : {}
    }
    transition={{
      type: "spring",
      stiffness: 300,
      damping: 25,
    }}
    className={`
      ${COLORS[color] || COLORS.white}
      border
      border-cozy-border
      shadow-cozy
      hover:shadow-cozy-lg
      p-6
      transition-colors
      duration-200
      ${className}
    `}
    style={{
      borderRadius: 24,

      backgroundColor:
        color === "cyan"
          ? "var(--admin-cyan, #C8DFF0)"
          : undefined,

      rotate: tilt,
    }}
    {...rest}
  >
    {children}
  </motion.div>
);

/* =========================================================
   INPUT
========================================================= */

export const BrutalInput = React.forwardRef(
  ({ className = "", ...rest }, ref) => (
    <input
      ref={ref}
      className={`
        w-full
        border
        border-cozy-border
        px-4
        py-3
        bg-cozy-surface
        text-cozy-text
        placeholder:text-cozy-muted
        focus:outline-none
        focus:ring-2
        focus:ring-cozy-primary
        focus:border-cozy-primary
        font-medium
        transition-all
        duration-200
        ${className}
      `}
      style={{
        borderRadius: 16,
      }}
      {...rest}
    />
  )
);

BrutalInput.displayName = "BrutalInput";

/* =========================================================
   BADGE
========================================================= */

export const BrutalBadge = ({
  children,
  color = "primary",
  className = "",
}) => {
  const isPrimary =
    color === "green" || color === "primary";

  return (
    <span
      className={`
        inline-flex
        items-center
        px-3
        py-1
        font-semibold
        text-xs
        tracking-wide
        transition-colors
        duration-200
        ${className}
      `}
      style={{
        borderRadius: 999,

        backgroundColor:
          COLOR_HEX[color] || COLOR_HEX.primary,

        color: isPrimary
          ? "#fff"
          : "var(--cozy-text)",

        border:
          "1px solid var(--cozy-border)",
      }}
    >
      {children}
    </span>
  );
};

/* =========================================================
   TAG / FILTER BUTTON
   IMPORTANT:
   Dark-mode safe selected state
========================================================= */

export const BrutalTag = ({
  children,
  color = "primary",
  active = false,
  onClick,
  className = "",
  ...rest
}) => {
  const activeColor =
    COLOR_HEX[color] || COLOR_HEX.primary;

  const activeTextColor =
    color === "green" || color === "primary"
      ? "#ffffff"
      : "var(--cozy-text)";

  return (
    <motion.button
      type="button"
      whileTap={{
        scale: 0.95,
      }}
      onClick={onClick}
      className={`
        inline-flex
        items-center
        justify-center
        min-h-[38px]
        px-4
        py-2
        font-semibold
        text-xs
        tracking-wide
        rounded-full
        transition-all
        duration-200
        border
        whitespace-nowrap
        ${className}
      `}
      style={{
        backgroundColor: active
          ? activeColor
          : "var(--cozy-surface)",

        color: active
          ? activeTextColor
          : "var(--cozy-text)",

        borderColor: active
          ? activeColor
          : "var(--cozy-border)",

        boxShadow: active
          ? "var(--shadow-cozy)"
          : "none",
      }}
      {...rest}
    >
      {children}
    </motion.button>
  );
};