/*
 * Per-user browser storage (QA #6, QA #9, BUG-03).
 *
 * The ritual cards, wellness settings, notification scheduler and the 20-20-20
 * timer keep today's progress in localStorage under fixed key names. With those
 * names shared by every account, the next person to sign in on the same browser
 * inherited the previous user's "completed today" state and a half-finished
 * timer that awarded them points.
 *
 * installUserScopedStorage() transparently prefixes the keys listed below with
 * the signed-in user's id, so each account gets its own copy without touching
 * the ~160 call sites. Anything not listed (auth token, theme, org-level caches)
 * is untouched.
 */

const AUTH_KEY = "brutal-auth";
const MIGRATION_FLAG = "wg-user-storage-v1";

const SCOPED_KEYS = new Set([
  // Drink water
  "waterConsumed", "waterDate", "waterGoal", "wellness-water-settings",
  // Eye break
  "eyeBreakCompleted", "eyeBreakCompletedSlots", "eyeBreakDate", "eyeBreakGoal",
  "eyeBreakRewarded", "eyeBreakSchedule",
  // Move & reset
  "moveResetCompleted", "moveResetDate", "moveResetGoal", "moveResetSchedule",
  // Breathing
  "breathingCompleted", "breathingDate", "breathingGoal", "breathingRewarded", "breathingSchedule",
  // Personal preferences & reminder bookkeeping
  "notificationSettings", "wellness-appearance-settings", "wellnessNotificationTriggered",
  "wg-stay-on-track-dismissed",
  // Persisted zustand stores holding per-user state
  "brutal-timer", "wg-music",
]);

const SCOPED_PREFIXES = [
  "waterRewardedMilestones-",
  "eyeBreakRewardedMilestones-", "eyeBreakRewardConfigSignature-",
  "moveResetRewardedMilestones-",
  "breathingRewardedMilestones-", "breathingRewardConfigSignature-",
];

const isScoped = (key) =>
  typeof key === "string" && (SCOPED_KEYS.has(key) || SCOPED_PREFIXES.some((p) => key.startsWith(p)));

let raw = null; // original Storage methods, bound to window.localStorage

const readAuthUser = () => {
  try {
    const blob = raw.getItem(AUTH_KEY);
    return blob ? JSON.parse(blob)?.state?.user || null : null;
  } catch {
    return null;
  }
};

const scopedName = (key) => {
  const uid = readAuthUser()?.id;
  // Signed out: park writes in an anonymous bucket that no account ever reads.
  return `u:${uid || "anon"}:${key}`;
};

/**
 * Existing un-prefixed values belong to whoever was signed in when this version
 * first loads; move them into that user's namespace. If nobody is signed in we
 * can't know the owner, so they are discarded rather than handed to the next login.
 */
const migrateLegacyValues = () => {
  if (raw.getItem(MIGRATION_FLAG)) return;
  const owner = readAuthUser()?.id;
  const legacyKeys = [];
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const k = window.localStorage.key(i);
    if (isScoped(k)) legacyKeys.push(k);
  }
  legacyKeys.forEach((k) => {
    const value = raw.getItem(k);
    if (owner && value !== null && raw.getItem(`u:${owner}:${k}`) === null) {
      raw.setItem(`u:${owner}:${k}`, value);
    }
    raw.removeItem(k);
  });
  raw.setItem(MIGRATION_FLAG, "1");
};

export function installUserScopedStorage() {
  if (typeof window === "undefined" || !window.localStorage || raw) return;
  const ls = window.localStorage;
  const proto = Object.getPrototypeOf(ls);
  const original = { getItem: proto.getItem, setItem: proto.setItem, removeItem: proto.removeItem };
  raw = {
    getItem: original.getItem.bind(ls),
    setItem: original.setItem.bind(ls),
    removeItem: original.removeItem.bind(ls),
  };
  migrateLegacyValues();

  const wrap = (method) =>
    function patched(key, ...rest) {
      // sessionStorage and other Storage instances pass straight through
      if (this === ls && isScoped(key)) {
        return original[method].call(this, scopedName(key), ...rest);
      }
      return original[method].call(this, key, ...rest);
    };

  proto.getItem = wrap("getItem");
  proto.setItem = wrap("setItem");
  proto.removeItem = wrap("removeItem");
}

/** Strip the per-user prefix from a `storage` event key (cross-tab listeners). */
export const unscopedKey = (key) => (typeof key === "string" ? key.replace(/^u:[^:]+:/, "") : key);

/* ---------------------------------------------------------------------------
 * Business day (BUG-01): "today" is the organization's calendar day in its
 * configured timezone, not the browser's, so the client resets progress at the
 * same moment the server resets daily points.
 * ------------------------------------------------------------------------- */

export const businessTimezone = () => {
  const tz = readAuthUser()?.org_timezone;
  if (tz) return tz;
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
};

/**
 * A Date whose *local* fields (getFullYear, getHours, toDateString, …) read as
 * the current wall-clock time in the org's timezone. Use it wherever code asks
 * "what day/time is it" for daily resets and schedules.
 */
export const businessNow = () => {
  const tz = businessTimezone();
  try {
    return new Date(new Date().toLocaleString("en-US", { timeZone: tz }));
  } catch {
    return new Date();
  }
};
