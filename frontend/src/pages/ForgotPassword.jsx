import React, { useState } from "react";
import { Link } from "react-router-dom";
import { MailCheck } from "lucide-react";
import { BrutalButton, BrutalInput } from "../components/brutal";
import { CompanionMascot } from "../components/CompanionMascot";
import { IconLeaf, IconSparkle } from "../components/HandDrawn";
import { api } from "../lib/api";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState("");
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (sending) return;
    setSending(true);
    setError("");
    try {
      const { data } = await api.post("/auth/forgot-password", { email: email.trim() });
      setSent(data.message);
    } catch (err) {
      setError(err.response?.data?.message || "We couldn't send the reset link. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 paper-grain relative overflow-hidden" style={{ background: "transparent" }}>
      <div className="absolute top-8 left-8 opacity-40 floaty-1 pointer-events-none"><IconSparkle size={56} /></div>
      <div className="absolute bottom-16 right-14 opacity-40 floaty-2 pointer-events-none"><IconLeaf size={72} /></div>

      <div className="max-w-md w-full relative z-10">
        <div className="text-center mb-6">
          <div className="flex justify-center"><CompanionMascot state="idle" size={120} /></div>
          <h1 className="font-display text-4xl mt-2" style={{ color: "var(--cozy-primary-dark)" }}>Forgot your password?</h1>
          <p className="text-sm mt-1" style={{ color: "var(--cozy-muted)" }}>
            Enter your work email and we'll send you a link to choose a new one.
          </p>
        </div>

        <div className="bg-cozy-surface shadow-cozy-lg p-8" style={{ borderRadius: 28, border: "1px solid var(--cozy-border)" }}>
          {sent ? (
            <div className="text-center space-y-3" role="status" data-testid="forgot-sent">
              <MailCheck className="mx-auto" size={40} style={{ color: "var(--cozy-primary-dark)" }} aria-hidden="true" />
              <p className="font-semibold" style={{ color: "var(--cozy-text)" }}>{sent}</p>
              <p className="text-sm" style={{ color: "var(--cozy-muted)" }}>
                The link expires in 60 minutes. Nothing arrived? Check your spam folder, or ask your
                organization admin for a reset link.
              </p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4" noValidate>
              <div>
                <label htmlFor="forgot-email" className="text-xs font-semibold uppercase tracking-wider block mb-1.5" style={{ color: "var(--cozy-muted)" }}>
                  Work email
                </label>
                <BrutalInput
                  id="forgot-email"
                  data-testid="forgot-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? "forgot-error" : undefined}
                />
                {error && <p id="forgot-error" role="alert" className="text-xs font-semibold mt-1" style={{ color: "var(--cozy-danger, #c0392b)" }}>{error}</p>}
              </div>
              <BrutalButton data-testid="forgot-submit" type="submit" color="primary" size="lg" className="w-full" disabled={sending || !email.trim()}>
                {sending ? "Sending..." : "Send reset link"}
              </BrutalButton>
            </form>
          )}
          <p className="text-center mt-5 text-sm" style={{ color: "var(--cozy-muted)" }}>
            Remembered it? <Link className="font-semibold text-cozy-primary-dark underline" to="/login">Back to sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
