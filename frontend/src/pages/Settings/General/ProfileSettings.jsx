import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  UserRound,
  Camera,
  Trash2,
  Sparkles,
  Shuffle,
  Lock,
  KeyRound,
  Bell,
  ChevronRight,
  Sun,
  Moon,
} from "lucide-react";
import { api, resolveAvatar } from "../../../lib/api";
import { useAuthStore, useThemeStore } from "../../../store";
import { BrutalInput } from "../../../components/brutal";
import { PasswordField, PasswordChecklist, passwordMeetsPolicy } from "../../../components/PasswordField";

/* =========================================================
   CONSTANTS (mirrors the server's validation; server is the authority)
========================================================= */

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const SEED_RE = /^[A-Za-z0-9 _.-]{1,40}$/;
const FALLBACK_PRESETS = {
  styles: ["bottts-neutral", "adventurer", "avataaars", "fun-emoji", "lorelei", "notionists", "big-smile", "thumbs"],
  backgrounds: ["FFE600", "00E5FF", "FF4D6D", "00C853", "c0aede", "d1d4f9", "ffd5dc", "ffdfbf", "b6e3f4"],
};
const SEED_WORDS = ["Maple", "Fern", "Willow", "Pebble", "Sunny", "Clover", "Juniper", "Basil", "Moss", "Poppy", "Sage", "River"];
const LIMITS = { first_name: 50, last_name: 50, nickname: 30, job_title: 80, department: 60, bio: 280 };
const LANGUAGES = [{ value: "en", label: "English" }];
const ROLE_LABELS = { admin: "Admin", team_lead: "Team lead", employee: "Employee" };

const dicebear = (style, seed, background) =>
  `https://api.dicebear.com/7.x/${style}/svg?seed=${encodeURIComponent(seed)}&backgroundColor=${background}`;

const browserTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
};

const TIMEZONES = (() => {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return [browserTimezone()];
  }
})();

const formFromUser = (user, theme) => ({
  first_name: user?.first_name || "",
  last_name: user?.last_name || "",
  nickname: user?.nickname || "",
  job_title: user?.job_title || "",
  department: user?.department || "",
  bio: user?.bio || "",
  birthday: user?.birthday || "",
  work_anniversary: user?.work_anniversary || "",
  language: user?.language || "en",
  timezone: user?.timezone || browserTimezone(),
  theme,
});

const PROFILE_FIELDS = ["first_name", "last_name", "nickname", "job_title", "department", "bio",
  "birthday", "work_anniversary", "language", "timezone"];

const errorMessage = (err, fallback) =>
  err?.response?.data?.message || err?.response?.data?.detail || fallback;

function validateProfile(form) {
  const errors = {};
  if (!form.first_name.trim()) errors.first_name = "First name is required.";
  Object.entries(LIMITS).forEach(([field, max]) => {
    if ((form[field] || "").trim().length > max) errors[field] = `Keep this to ${max} characters or fewer.`;
  });
  const today = new Date().toISOString().slice(0, 10);
  if (form.birthday && form.birthday > today) errors.birthday = "Birthday can't be in the future.";
  return errors;
}

/* =========================================================
   SMALL LAYOUT PIECES
========================================================= */

const labelClass = "text-xs font-semibold uppercase tracking-wider block mb-1.5";
const mutedStyle = { color: "var(--cozy-muted)" };
const errorStyle = { color: "var(--cozy-danger, #c0392b)" };

const Card = ({ title, description, icon: Icon, children, ...rest }) => (
  <section
    className="p-5 md:p-6 shadow-cozy"
    style={{ background: "var(--cozy-surface)", border: "1px solid var(--cozy-border)", borderRadius: 20 }}
    {...rest}
  >
    <div className="flex items-start gap-3 mb-5">
      <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
        style={{ background: "var(--cozy-primary)", color: "#fff" }}>
        <Icon className="w-5 h-5" strokeWidth={2.5} aria-hidden="true" />
      </div>
      <div>
        <h2 className="font-bold text-base" style={{ color: "var(--cozy-text)" }}>{title}</h2>
        {description && <p className="text-xs mt-0.5" style={mutedStyle}>{description}</p>}
      </div>
    </div>
    {children}
  </section>
);

const Field = ({ id, label, error, hint, children }) => (
  <div>
    <label htmlFor={id} className={labelClass} style={mutedStyle}>{label}</label>
    {children}
    {error ? (
      <p id={`${id}-error`} role="alert" className="text-xs font-semibold mt-1" style={errorStyle}>{error}</p>
    ) : hint ? (
      <p id={`${id}-hint`} className="text-xs mt-1" style={mutedStyle}>{hint}</p>
    ) : null}
  </div>
);

const ReadOnly = ({ label, value }) => (
  <div>
    <dt className={labelClass} style={mutedStyle}>{label}</dt>
    <dd className="flex items-center gap-2 px-4 py-3 text-sm font-semibold"
      style={{ background: "var(--cozy-bg)", borderRadius: 14, color: "var(--cozy-text)" }}>
      <Lock className="w-3.5 h-3.5 shrink-0 opacity-50" aria-hidden="true" />
      <span className="truncate">{value || "—"}</span>
    </dd>
  </div>
);

const selectClass = "w-full border border-cozy-border px-4 py-3 bg-cozy-surface text-cozy-text rounded-2xl";

/* =========================================================
   PAGE
========================================================= */

export default function ProfileSettings() {
  const navigate = useNavigate();
  const { user, setUser, setAuth } = useAuthStore();
  const { theme, setTheme } = useThemeStore();

  const [baseline, setBaseline] = useState(() => formFromUser(user, theme));
  const [form, setForm] = useState(baseline);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  // null | {kind:"upload", file, preview} | {kind:"remove"} | {kind:"preset", style, seed, background}
  const [avatarDraft, setAvatarDraft] = useState(null);
  const [avatarError, setAvatarError] = useState("");
  const [presets, setPresets] = useState(FALLBACK_PRESETS);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [preset, setPreset] = useState(() => ({
    style: FALLBACK_PRESETS.styles[1],
    seed: (user?.first_name || "Garden").replace(/[^A-Za-z0-9 _.-]/g, "").slice(0, 40) || "Garden",
    background: FALLBACK_PRESETS.backgrounds[4],
  }));
  const fileRef = useRef(null);

  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwErrors, setPwErrors] = useState({});
  const [pwSaving, setPwSaving] = useState(false);

  /* ---------- load fresh account data (org name, timezone...) ---------- */
  useEffect(() => {
    let alive = true;
    api.get("/auth/me").then(({ data }) => {
      if (!alive) return;
      setUser(data);
    }).catch(() => {});
    api.get("/avatar-presets").then(({ data }) => alive && data?.styles && setPresets(data)).catch(() => {});
    return () => { alive = false; };
  }, [setUser]);

  // Re-seed the form when the stored profile changes and there are no local edits.
  const dirtyFields = useMemo(
    () => Object.keys(form).filter((k) => (form[k] ?? "") !== (baseline[k] ?? "")),
    [form, baseline],
  );
  const dirty = dirtyFields.length > 0 || avatarDraft !== null;

  useEffect(() => {
    if (dirty || saving) return;
    const fresh = formFromUser(user, theme);
    setBaseline(fresh);
    setForm(fresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, theme]);

  // Release object URLs for discarded upload previews.
  useEffect(() => () => {
    if (avatarDraft?.kind === "upload") URL.revokeObjectURL(avatarDraft.preview);
  }, [avatarDraft]);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  const describe = (field) => (errors[field] ? `pf-${field}-error` : undefined);

  /* ---------- avatar ---------- */
  const defaultAvatar = dicebear(FALLBACK_PRESETS.styles[0], user?.name || user?.id || "", FALLBACK_PRESETS.backgrounds[0]);
  const avatarPreview =
    avatarDraft?.kind === "upload" ? avatarDraft.preview
      : avatarDraft?.kind === "remove" ? defaultAvatar
        : avatarDraft?.kind === "preset" ? dicebear(avatarDraft.style, avatarDraft.seed, avatarDraft.background)
          : resolveAvatar(user?.avatar);

  const onFileChosen = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!IMAGE_TYPES.includes(file.type)) {
      setAvatarError("Please choose a PNG, JPG, WebP or GIF image.");
      return;
    }
    if (file.size === 0) {
      setAvatarError("That file is empty.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setAvatarError(`That image is ${(file.size / 1024 / 1024).toFixed(1)} MB. Images must be 5 MB or smaller.`);
      return;
    }
    setAvatarError("");
    setPickerOpen(false);
    setAvatarDraft({ kind: "upload", file, preview: URL.createObjectURL(file) });
  };

  const choosePreset = (next) => {
    const merged = { ...preset, ...next };
    setPreset(merged);
    if (SEED_RE.test(merged.seed.trim())) {
      setAvatarError("");
      setAvatarDraft({ kind: "preset", ...merged, seed: merged.seed.trim() });
    } else {
      setAvatarError("Avatar names can use letters, numbers, spaces, dots, dashes and underscores (up to 40).");
    }
  };

  const shuffleSeed = () => {
    const word = SEED_WORDS[Math.floor(Math.random() * SEED_WORDS.length)];
    choosePreset({ seed: `${word} ${Math.floor(Math.random() * 900 + 100)}` });
  };

  const saveAvatar = async () => {
    if (!avatarDraft) return null;
    if (avatarDraft.kind === "upload") {
      const fd = new FormData();
      fd.append("file", avatarDraft.file);
      const { data } = await api.post("/users/me/avatar", fd, { headers: { "Content-Type": "multipart/form-data" } });
      return data;
    }
    if (avatarDraft.kind === "remove") return (await api.delete("/users/me/avatar")).data;
    const { style, seed, background } = avatarDraft;
    return (await api.put("/users/me/avatar/preset", { style, seed, background })).data;
  };

  /* ---------- save / cancel ---------- */
  const save = async (e) => {
    e.preventDefault();
    if (saving || !dirty) return;
    const found = validateProfile(form);
    setErrors(found);
    setFormError("");
    if (Object.keys(found).length) {
      document.getElementById(`pf-${Object.keys(found)[0]}`)?.focus();
      return;
    }

    setSaving(true);
    let nextUser = { ...user };
    let avatarSaved = false;
    try {
      const avatar = await saveAvatar();
      if (avatar) {
        nextUser = { ...nextUser, ...avatar };
        avatarSaved = true;
      }

      const payload = {};
      PROFILE_FIELDS.forEach((field) => {
        if (dirtyFields.includes(field)) payload[field] = typeof form[field] === "string" ? form[field].trim() : form[field];
      });
      if (Object.keys(payload).length) {
        const { data } = await api.patch("/users/me", payload);
        nextUser = { ...nextUser, ...data };
      }

      if (dirtyFields.includes("theme")) {
        await api.put("/settings", { theme: form.theme });
        setTheme(form.theme);
      }
    } catch (err) {
      // Keep what the server did accept, and say exactly what didn't save.
      if (avatarSaved) {
        setUser(nextUser);
        setAvatarDraft(null);
      }
      const msg = errorMessage(err, "Something went wrong while saving.");
      setFormError(avatarSaved ? `Your photo was updated, but the rest wasn't saved: ${msg}` : msg);
      toast.error("Profile not saved");
      setSaving(false);
      return;
    }

    setUser(nextUser);
    const fresh = formFromUser(nextUser, form.theme);
    setBaseline(fresh);
    setForm(fresh);
    setAvatarDraft(null);
    setPickerOpen(false);
    setSaving(false);
    toast.success("Profile saved");
  };

  const cancel = () => {
    setForm(baseline);
    setErrors({});
    setFormError("");
    setAvatarDraft(null);
    setAvatarError("");
    setPickerOpen(false);
  };

  /* ---------- password ---------- */
  const changePassword = async (e) => {
    e.preventDefault();
    if (pwSaving) return;
    const found = {};
    if (!pw.current) found.current = "Enter your current password.";
    if (!passwordMeetsPolicy(pw.next)) found.next = "Use at least 8 characters, including a letter and a number.";
    else if (pw.next === pw.current) found.next = "Choose a password that's different from your current one.";
    if (pw.confirm !== pw.next) found.confirm = "The passwords don't match.";
    setPwErrors(found);
    if (Object.keys(found).length) return;

    setPwSaving(true);
    try {
      const { data } = await api.post("/users/me/password", {
        current_password: pw.current, new_password: pw.next, confirm_password: pw.confirm,
      });
      setAuth(data.token, user); // this session continues; every other session was signed out
      setPw({ current: "", next: "", confirm: "" });
      setPwErrors({});
      toast.success("Password updated. You've been signed out on other devices.");
    } catch (err) {
      const msg = errorMessage(err, "We couldn't update your password.");
      setPwErrors(/current password/i.test(msg) ? { current: msg } : { form: msg });
    } finally {
      setPwSaving(false);
    }
  };

  if (!user) return null;

  const memberSince = user.created_at ? new Date(user.created_at).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) : "";

  return (
    <main className="max-w-4xl mx-auto px-4 md:px-6 py-8 md:py-12" data-testid="profile-settings">
      {/* HEADER */}
      <div className="flex items-center gap-4 mb-8">
        <button
          type="button"
          onClick={() => navigate("/settings")}
          className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 transition hover:scale-105"
          style={{ background: "var(--cozy-surface)", color: "var(--cozy-text)", border: "1px solid var(--cozy-border)" }}
          aria-label="Back to Settings"
          title="Back to Settings"
        >
          <ArrowLeft className="w-5 h-5" strokeWidth={2.5} />
        </button>
        <div>
          <h1 className="settings-page-title font-display font-black text-3xl md:text-4xl" style={{ color: "var(--cozy-text)" }}>
            Profile Settings
          </h1>
          <p className="settings-page-description text-sm mt-1" style={{ color: "var(--cozy-text)", opacity: 0.6 }}>
            Manage your profile, photo, password and preferences.
          </p>
        </div>
      </div>

      <form onSubmit={save} noValidate className="space-y-6" aria-describedby={formError ? "pf-form-error" : undefined}>
        {/* PHOTO */}
        <Card title="Profile photo" description="PNG, JPG, WebP or GIF up to 5 MB — or pick an avatar." icon={Camera}>
          <div className="flex flex-col sm:flex-row sm:items-center gap-5">
            <div className="relative shrink-0 self-center">
              <img
                src={avatarPreview}
                alt="Profile photo preview"
                data-testid="avatar-preview"
                className="w-28 h-28 object-cover"
                style={{ borderRadius: 28, border: "3px solid var(--cozy-border)", background: "var(--cozy-bg)" }}
              />
              {avatarDraft && (
                <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full"
                  style={{ background: "var(--cozy-accent)", color: "var(--cozy-text)" }}>
                  Unsaved
                </span>
              )}
            </div>
            <div className="flex-1 space-y-3">
              <div className="flex flex-wrap gap-2">
                <button type="button" className="profile-btn" onClick={() => fileRef.current?.click()} data-testid="avatar-upload">
                  <Camera className="w-4 h-4" aria-hidden="true" />
                  {user.avatar_source === "upload" || avatarDraft?.kind === "upload" ? "Replace photo" : "Upload photo"}
                </button>
                <button type="button" className="profile-btn" aria-expanded={pickerOpen} aria-controls="avatar-picker"
                  onClick={() => setPickerOpen((o) => !o)} data-testid="avatar-choose">
                  <Sparkles className="w-4 h-4" aria-hidden="true" /> Choose avatar
                </button>
                <button type="button" className="profile-btn profile-btn-ghost" data-testid="avatar-remove"
                  onClick={() => { setAvatarDraft({ kind: "remove" }); setAvatarError(""); setPickerOpen(false); }}
                  disabled={avatarDraft?.kind === "remove" || (!avatarDraft && user.avatar_source === "default")}>
                  <Trash2 className="w-4 h-4" aria-hidden="true" /> Remove
                </button>
                {avatarDraft && (
                  <button type="button" className="profile-btn profile-btn-ghost" onClick={() => { setAvatarDraft(null); setAvatarError(""); }}>
                    Undo
                  </button>
                )}
              </div>
              <input ref={fileRef} type="file" accept={IMAGE_TYPES.join(",")} className="hidden" onChange={onFileChosen}
                data-testid="avatar-file-input" aria-label="Upload profile photo" />
              {avatarError && <p role="alert" className="text-xs font-semibold" style={errorStyle}>{avatarError}</p>}
              {avatarDraft && !avatarError && (
                <p className="text-xs" style={mutedStyle}>Preview only — press Save changes to keep it.</p>
              )}
            </div>
          </div>

          {pickerOpen && (
            <div id="avatar-picker" className="mt-5 pt-5 space-y-4" style={{ borderTop: "1px solid var(--cozy-border)" }}>
              <div role="radiogroup" aria-label="Avatar style" className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                {presets.styles.map((style) => {
                  const selected = avatarDraft?.kind === "preset" && avatarDraft.style === style;
                  return (
                    <button key={style} type="button" role="radio" aria-checked={selected} aria-label={style.replace(/-/g, " ")}
                      onClick={() => choosePreset({ style })}
                      className="p-1 transition"
                      style={{ borderRadius: 16, border: `3px solid ${selected ? "var(--cozy-primary)" : "transparent"}` }}>
                      <img src={dicebear(style, preset.seed.trim() || "Garden", preset.background)} alt="" className="w-full aspect-square" style={{ borderRadius: 12 }} />
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[180px]">
                  <label htmlFor="avatar-seed" className={labelClass} style={mutedStyle}>Avatar name</label>
                  <BrutalInput id="avatar-seed" value={preset.seed} maxLength={40} onChange={(e) => choosePreset({ seed: e.target.value })} />
                </div>
                <button type="button" className="profile-btn" onClick={shuffleSeed}>
                  <Shuffle className="w-4 h-4" aria-hidden="true" /> Shuffle
                </button>
              </div>
              <div role="radiogroup" aria-label="Avatar background" className="flex flex-wrap gap-2">
                {presets.backgrounds.map((bg) => (
                  <button key={bg} type="button" role="radio" aria-checked={preset.background === bg} aria-label={`Background #${bg}`}
                    onClick={() => choosePreset({ background: bg })}
                    className="w-8 h-8 rounded-full"
                    style={{ background: `#${bg}`, border: `3px solid ${preset.background === bg ? "var(--cozy-text)" : "var(--cozy-border)"}` }} />
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* PERSONAL */}
        <Card title="Personal information" description="How you appear to your teammates." icon={UserRound}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field id="pf-first_name" label="First name" error={errors.first_name}>
              <BrutalInput id="pf-first_name" data-testid="pf-first-name" required value={form.first_name} onChange={set("first_name")}
                maxLength={LIMITS.first_name} autoComplete="given-name" aria-invalid={errors.first_name ? true : undefined} aria-describedby={describe("first_name")} />
            </Field>
            <Field id="pf-last_name" label="Last name" error={errors.last_name}>
              <BrutalInput id="pf-last_name" value={form.last_name} onChange={set("last_name")} maxLength={LIMITS.last_name}
                autoComplete="family-name" aria-invalid={errors.last_name ? true : undefined} aria-describedby={describe("last_name")} />
            </Field>
            <Field id="pf-nickname" label="Nickname / preferred name" error={errors.nickname} hint="Shown in the navigation bar instead of your first name.">
              <BrutalInput id="pf-nickname" data-testid="pf-nickname" value={form.nickname} onChange={set("nickname")} maxLength={LIMITS.nickname}
                autoComplete="nickname" aria-invalid={errors.nickname ? true : undefined} aria-describedby={errors.nickname ? "pf-nickname-error" : "pf-nickname-hint"} />
            </Field>
            <Field id="pf-job_title" label="Job title" error={errors.job_title}>
              <BrutalInput id="pf-job_title" value={form.job_title} onChange={set("job_title")} maxLength={LIMITS.job_title}
                placeholder="e.g. Software Engineer" autoComplete="organization-title" aria-describedby={describe("job_title")} />
            </Field>
            <Field id="pf-department" label="Department" error={errors.department}>
              <BrutalInput id="pf-department" value={form.department} onChange={set("department")} maxLength={LIMITS.department} aria-describedby={describe("department")} />
            </Field>
            <Field id="pf-birthday" label="Birthday" error={errors.birthday}>
              <BrutalInput id="pf-birthday" type="date" value={form.birthday} onChange={set("birthday")} max={new Date().toISOString().slice(0, 10)}
                aria-invalid={errors.birthday ? true : undefined} aria-describedby={describe("birthday")} />
            </Field>
            <Field id="pf-work_anniversary" label="Work anniversary">
              <BrutalInput id="pf-work_anniversary" type="date" value={form.work_anniversary} onChange={set("work_anniversary")} />
            </Field>
          </div>
          <div className="mt-4">
            <Field id="pf-bio" label={`Bio (${form.bio.length}/${LIMITS.bio})`} error={errors.bio}>
              <textarea id="pf-bio" value={form.bio} onChange={set("bio")} rows={3} maxLength={LIMITS.bio}
                className="w-full border border-cozy-border px-4 py-3 bg-cozy-surface text-cozy-text resize-none rounded-2xl"
                placeholder="A little about you..." aria-describedby={describe("bio")} />
            </Field>
          </div>
        </Card>

        {/* ACCOUNT (read-only) */}
        <Card title="Account" description="Managed by your organization's admin." icon={Lock}>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="pf-account">
            <ReadOnly label="Email" value={user.email} />
            <ReadOnly label="Organization" value={user.org_name} />
            <ReadOnly label="Role" value={ROLE_LABELS[user.role] || user.role} />
            <ReadOnly label="Member since" value={memberSince} />
          </dl>
        </Card>

        {/* PREFERENCES */}
        <Card title="Preferences" description="Display, language and time settings." icon={Sun}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <fieldset>
              <legend className={labelClass} style={mutedStyle}>Theme</legend>
              <div className="flex gap-2">
                {[{ value: "light", label: "Light", Icon: Sun }, { value: "dark", label: "Dark", Icon: Moon }].map(({ value, label, Icon }) => (
                  <label key={value} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 cursor-pointer text-sm font-semibold rounded-2xl"
                    style={{
                      border: `2px solid ${form.theme === value ? "var(--cozy-primary)" : "var(--cozy-border)"}`,
                      color: "var(--cozy-text)",
                    }}>
                    <input type="radio" name="pf-theme" value={value} checked={form.theme === value} onChange={set("theme")} className="sr-only" />
                    <Icon className="w-4 h-4" aria-hidden="true" /> {label}
                  </label>
                ))}
              </div>
            </fieldset>
            <Field id="pf-language" label="Language" hint="More languages are coming soon.">
              <select id="pf-language" value={form.language} onChange={set("language")} className={selectClass} aria-describedby="pf-language-hint">
                {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </Field>
            <Field id="pf-timezone" label="Your timezone"
              hint={`Daily points reset at midnight in your organization's timezone (${user.org_timezone || "set by your admin"}).`}>
              <select id="pf-timezone" value={form.timezone} onChange={set("timezone")} className={selectClass} aria-describedby="pf-timezone-hint">
                {(TIMEZONES.includes(form.timezone) ? TIMEZONES : [form.timezone, ...TIMEZONES]).map((tz) => (
                  <option key={tz} value={tz}>{tz.replace(/_/g, " ")}</option>
                ))}
              </select>
            </Field>
            <div>
              <span className={labelClass} style={mutedStyle}>Notifications</span>
              <button type="button" onClick={() => navigate("/settings/notifications")}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-2xl text-left"
                style={{ border: "1px solid var(--cozy-border)", color: "var(--cozy-text)" }}>
                <Bell className="w-4 h-4" aria-hidden="true" />
                <span className="flex-1">Reminders, sounds and push</span>
                <ChevronRight className="w-4 h-4 opacity-50" aria-hidden="true" />
              </button>
            </div>
          </div>
        </Card>

        {formError && (
          <p id="pf-form-error" role="alert" className="text-sm font-semibold px-4 py-3 rounded-2xl" style={{ ...errorStyle, background: "var(--cozy-bg)" }}>
            {formError}
          </p>
        )}

        <div className="profile-savebar flex flex-wrap items-center justify-end gap-3 sticky bottom-4 p-3 shadow-cozy-lg"
          style={{ background: "var(--cozy-surface)", border: "1px solid var(--cozy-border)", borderRadius: 20 }}>
          <span className="mr-auto text-xs font-semibold" style={mutedStyle} aria-live="polite">
            {dirty ? "You have unsaved changes." : "All changes saved."}
          </span>
          <button type="button" className="profile-btn profile-btn-ghost" onClick={cancel} disabled={!dirty || saving} data-testid="pf-cancel">
            Cancel
          </button>
          <button type="submit" className="profile-btn profile-btn-primary" disabled={!dirty || saving} data-testid="pf-save">
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </form>

      {/* PASSWORD — its own form so it never mixes with profile saves */}
      <div className="mt-6">
        <Card title="Change password" description="You'll stay signed in here; other devices will be signed out." icon={KeyRound}>
          <form onSubmit={changePassword} noValidate className="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="pf-password-form">
            <div className="md:col-span-2 md:w-1/2 md:pr-2">
              <PasswordField id="pw-current" label="Current password" autoComplete="current-password"
                value={pw.current} onChange={(v) => setPw({ ...pw, current: v })} error={pwErrors.current} />
            </div>
            <PasswordField id="pw-new" label="New password" autoComplete="new-password"
              value={pw.next} onChange={(v) => setPw({ ...pw, next: v })} error={pwErrors.next} />
            <PasswordField id="pw-confirm" label="Confirm new password" autoComplete="new-password"
              value={pw.confirm} onChange={(v) => setPw({ ...pw, confirm: v })} error={pwErrors.confirm} />
            <div className="md:col-span-2"><PasswordChecklist value={pw.next} /></div>
            {pwErrors.form && <p role="alert" className="md:col-span-2 text-sm font-semibold" style={errorStyle}>{pwErrors.form}</p>}
            <div className="md:col-span-2 flex justify-end">
              <button type="submit" className="profile-btn profile-btn-primary" disabled={pwSaving || !pw.current || !pw.next || !pw.confirm} data-testid="pw-submit">
                {pwSaving ? "Updating..." : "Update password"}
              </button>
            </div>
          </form>
        </Card>
      </div>
    </main>
  );
}
