import React, { useState } from "react";
import { Eye, EyeOff, Check, Circle } from "lucide-react";
import { BrutalInput } from "./brutal";

// Mirrors password_problem() in backend/server.py — the server stays the authority.
export const PASSWORD_RULES = [
  { id: "length", label: "At least 8 characters", test: (pw) => pw.length >= 8 && pw.length <= 128 },
  { id: "letter", label: "A letter", test: (pw) => /[A-Za-z]/.test(pw) },
  { id: "number", label: "A number", test: (pw) => /\d/.test(pw) },
];

export const passwordMeetsPolicy = (pw) => PASSWORD_RULES.every((rule) => rule.test(pw || ""));

const labelStyle = { color: "var(--cozy-muted)" };
const errorStyle = { color: "var(--cozy-danger, #c0392b)" };

export function PasswordField({ id, label, value, onChange, error, hint, ...rest }) {
  const [show, setShow] = useState(false);
  const describedBy = [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(" ") || undefined;

  return (
    <div>
      <label htmlFor={id} className="text-xs font-semibold uppercase tracking-wider block mb-1.5" style={labelStyle}>
        {label}
      </label>
      <div className="relative">
        <BrutalInput
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className="pr-12 w-full"
          {...rest}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide password" : "Show password"}
          aria-pressed={show}
          title={show ? "Hide password" : "Show password"}
          className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center p-1.5 rounded-md transition-opacity hover:opacity-70"
          style={{ color: "var(--cozy-muted)", background: "transparent" }}
        >
          {show ? <EyeOff size={20} strokeWidth={2} /> : <Eye size={20} strokeWidth={2} />}
        </button>
      </div>
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs mt-1" style={labelStyle}>{hint}</p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs font-semibold mt-1" style={errorStyle}>{error}</p>
      )}
    </div>
  );
}

export function PasswordChecklist({ value }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-label="Password requirements">
      {PASSWORD_RULES.map((rule) => {
        const ok = rule.test(value || "");
        const Icon = ok ? Check : Circle;
        return (
          <li
            key={rule.id}
            className="flex items-center gap-1 font-semibold"
            style={{ color: ok ? "var(--cozy-primary-dark)" : "var(--cozy-muted)" }}
          >
            <Icon size={12} strokeWidth={3} aria-hidden="true" />
            <span>{rule.label}</span>
            <span className="sr-only">{ok ? "(met)" : "(not met yet)"}</span>
          </li>
        );
      })}
    </ul>
  );
}
