import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { BrutalButton } from "../components/brutal";
import { CompanionMascot } from "../components/CompanionMascot";
import { IconLeaf, IconSparkle } from "../components/HandDrawn";
import { PasswordField, PasswordChecklist, passwordMeetsPolicy } from "../components/PasswordField";
import { api } from "../lib/api";

export default function ResetPassword() {
  const { token } = useParams();
  const nav = useNavigate();
  const [status, setStatus] = useState({ loading: true, email: "", error: "" });
  const [form, setForm] = useState({ password: "", confirm: "" });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    api.get(`/auth/reset-password/${token}`)
      .then(({ data }) => alive && setStatus({ loading: false, email: data.email, error: "" }))
      .catch((err) => alive && setStatus({
        loading: false, email: "",
        error: err.response?.data?.message || "This reset link is invalid or has expired.",
      }));
    return () => { alive = false; };
  }, [token]);

  const submit = async (e) => {
    e.preventDefault();
    if (saving) return;
    const next = {};
    if (!passwordMeetsPolicy(form.password)) next.password = "Use at least 8 characters, including a letter and a number.";
    if (form.confirm !== form.password) next.confirm = "The passwords don't match.";
    setErrors(next);
    if (Object.keys(next).length) return;
    setSaving(true);
    try {
      const { data } = await api.post("/auth/reset-password", {
        token, new_password: form.password, confirm_password: form.confirm,
      });
      toast.success(data.message);
      nav("/login", { replace: true });
    } catch (err) {
      setErrors({ form: err.response?.data?.message || "We couldn't reset your password. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 paper-grain relative overflow-hidden" style={{ background: "transparent" }}>
      <div className="absolute top-8 left-8 opacity-40 floaty-1 pointer-events-none"><IconSparkle size={56} /></div>
      <div className="absolute bottom-16 right-14 opacity-40 floaty-2 pointer-events-none"><IconLeaf size={72} /></div>

      <div className="max-w-md w-full relative z-10">
        <div className="text-center mb-6">
          <div className="flex justify-center"><CompanionMascot state="idle" size={120} /></div>
          <h1 className="font-display text-4xl mt-2" style={{ color: "var(--cozy-primary-dark)" }}>Choose a new password</h1>
          {status.email && <p className="text-sm mt-1" style={{ color: "var(--cozy-muted)" }}>for {status.email}</p>}
        </div>

        <div className="bg-cozy-surface shadow-cozy-lg p-8" style={{ borderRadius: 28, border: "1px solid var(--cozy-border)" }}>
          {status.loading ? (
            <p className="text-center text-sm" role="status" style={{ color: "var(--cozy-muted)" }}>Checking your link...</p>
          ) : status.error ? (
            <div className="text-center space-y-4" data-testid="reset-invalid">
              <p className="text-sm font-semibold" role="alert" style={{ color: "var(--cozy-danger, #c0392b)" }}>{status.error}</p>
              <Link className="font-semibold text-cozy-primary-dark underline text-sm" to="/forgot-password">Request a new link</Link>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4" noValidate>
              <PasswordField
                id="reset-password"
                data-testid="reset-password"
                label="New password"
                autoComplete="new-password"
                value={form.password}
                onChange={(v) => setForm({ ...form, password: v })}
                error={errors.password}
              />
              <PasswordChecklist value={form.password} />
              <PasswordField
                id="reset-confirm"
                data-testid="reset-confirm"
                label="Confirm new password"
                autoComplete="new-password"
                value={form.confirm}
                onChange={(v) => setForm({ ...form, confirm: v })}
                error={errors.confirm}
              />
              {errors.form && <p role="alert" className="text-sm font-semibold" style={{ color: "var(--cozy-danger, #c0392b)" }}>{errors.form}</p>}
              <BrutalButton data-testid="reset-submit" type="submit" color="primary" size="lg" className="w-full" disabled={saving}>
                {saving ? "Saving..." : "Reset password"}
              </BrutalButton>
            </form>
          )}
          <p className="text-center mt-5 text-sm" style={{ color: "var(--cozy-muted)" }}>
            <Link className="font-semibold text-cozy-primary-dark underline" to="/login">Back to sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
