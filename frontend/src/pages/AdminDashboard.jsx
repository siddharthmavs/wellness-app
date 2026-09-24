import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api, resolveAvatar } from "../lib/api";
import { BrutalButton, BrutalCard, BrutalInput } from "../components/brutal";
import { toast } from "sonner";
import {
  Users,
  Trophy,
  Bell,
  BarChart3,
  MessageSquare,
  Trash2,
  Gift,
  Brain,
  Settings,
  Megaphone,
  Shuffle,
  Building2,
  Mail,
  UserPlus,
  Check,
  Clock,
  RotateCcw,
  X,
  Droplets,
  Eye,
  PersonStanding,
  Wind,
  Plus,
  Link2,
  KeyRound,
  UserX,
  UserCheck,
  Globe,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, LineChart, Line, Tooltip } from "recharts";

const TABS = [
 { id: "users", label: "PEOPLE & ACCESS", icon: Users, color: "yellow" },
 { id: "challenges", label: "CHALLENGES", icon: Trophy, color: "pink" },
 
 { id: "analytics", label: "ANALYTICS", icon: BarChart3, color: "green" },
 { id: "feedback", label: "FEEDBACK", icon: MessageSquare, color: "yellow" },
 { id: "rewards", label: "REWARDS", icon: Gift, color: "pink" },
 { id: "quizzes", label: "QUIZZES", icon: Brain, color: "cyan" },
 { id: "points", label: "POINTS", icon: Settings, color: "green" },
 { id: "teams", label: "GAME TEAMS", icon: Shuffle, color: "yellow" },
 { id: "announcements", label: "ANNOUNCEMENTS", icon: Megaphone, color: "pink" },
];

const PALETTE = ["#FFE600", "#00E5FF", "#FF4D6D", "#00C853"];

export default function AdminDashboard() {
  const [tab, setTab] = useState("users");

  return (
    <div className="admin-zone max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-5 sm:py-7 md:py-8">
      <style>{`
        .admin-zone {
          --admin-bg: #EAF3E2;
          --admin-surface: #F7FAF4;
          --admin-surface-strong: #FFFFFF;
          --admin-text: #3F4A3E;
          --admin-muted: #667260;
          --admin-border: #C9DDBD;
          --admin-primary: #7FAE62;
          --admin-primary-dark: #5F8748;
          --admin-pink: #B96F69;
          --admin-cyan: #6797AA;
          --admin-yellow: #B69A62;
          color: var(--admin-text);
        }
        .admin-zone .admin-header { background: var(--admin-primary); color: #fff; border: 3px solid var(--admin-primary-dark); box-shadow: 6px 6px 0 var(--admin-primary-dark); }
        .admin-zone .admin-tabs {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 10px;
          width: 100%;
          overflow: visible;
          padding-bottom: 2px;
        }
        .admin-zone .admin-tab {
          width: 100%;
          min-width: 0;
          min-height: 42px;
          padding: 9px 12px;
          border-radius: 999px;
          border: 1px solid var(--admin-border);
          background: var(--admin-surface);
          color: var(--admin-text);
          font-weight: 800;
          font-size: 11px;
          letter-spacing: .04em;
          white-space: nowrap;
          transition: .18s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          text-align: center;
        }
        .admin-zone .admin-tab svg {
          flex: 0 0 auto;
        }
        .admin-zone .admin-tab:hover { transform: translateY(-1px); border-color: var(--admin-primary); }
        .admin-zone .admin-tab.active { background: var(--admin-primary); color: #fff; border-color: var(--admin-primary-dark); box-shadow: 3px 3px 0 var(--admin-primary-dark); }
        .admin-zone input, .admin-zone textarea, .admin-zone select { color: var(--admin-text); }
        .admin-zone input::placeholder, .admin-zone textarea::placeholder { color: var(--admin-muted); opacity: .8; }
        html.dark .admin-zone {
          --admin-bg: #101710; --admin-surface: #182119; --admin-surface-strong: #202B21;
          --admin-text: #E8F0E5; --admin-muted: #AEBBA9; --admin-border: #3D4D3D;
          --admin-primary: #7FAE62; --admin-primary-dark: #547541; --admin-pink: #B96F69;
          --admin-cyan: #6797AA; --admin-yellow: #B69A62;
        }
        html.dark .admin-zone .bg-white { background: var(--admin-surface-strong) !important; color: var(--admin-text) !important; }
        html.dark .admin-zone .bg-brutal-yellow { background: #66582F !important; color: #F5F7F2 !important; }
        html.dark .admin-zone .bg-brutal-cyan { background: #315766 !important; color: #F5F7F2 !important; }
        html.dark .admin-zone .bg-brutal-pink { background: #6B3D3A !important; color: #FFF5F3 !important; }
        html.dark .admin-zone .bg-brutal-green { background: #36532D !important; color: #F2F7EF !important; }
        html.dark .admin-zone .border-black { border-color: #536353 !important; }
        html.dark .admin-zone .text-black { color: var(--admin-text) !important; }
        html.dark .admin-zone [style*="#3F4A3E"] { color: var(--admin-text) !important; border-color: var(--admin-border) !important; }
        html.dark .admin-zone [style*="#F7FAF4"] { background: var(--admin-surface) !important; color: var(--admin-text) !important; }
        html.dark .admin-zone [style*="#EAF3E2"] { background: #182119 !important; color: var(--admin-text) !important; }
        html.dark .admin-zone [style*="#C9DDBD"] { border-color: var(--admin-border) !important; }
        .admin-zone .admin-icon-box {
          width: 42px;
          height: 42px;
          flex: 0 0 42px;
          display: grid;
          place-items: center;
          border: 2px solid var(--admin-border);
          background: var(--admin-surface-strong);
          color: var(--admin-text);
          border-radius: 6px;
          box-shadow: 2px 2px 0 rgba(0,0,0,.16);
        }
        html.dark .admin-zone .admin-icon-box {
          background: #263126;
          color: #E8F0E5;
          border-color: #5A6A58;
          box-shadow: 2px 2px 0 rgba(0,0,0,.35);
        }
        @media (max-width: 900px) {
          .admin-zone .admin-tabs { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        }
        @media (max-width: 640px) {
          .admin-zone .admin-tabs { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .admin-zone .admin-header h1 { font-size: 2.25rem; }
          .admin-zone .admin-header { box-shadow: 4px 4px 0 var(--admin-primary-dark); }
        }
      `}</style>

      {/* =========================================================
          ADMIN HEADER + SECTION NAVIGATION
      ========================================================= */}
      <div className="sticky top-0 z-50 -mx-3 sm:-mx-4 md:-mx-6 px-3 sm:px-4 md:px-6 pt-2 pb-4 bg-[#EAF3E2]/95 dark:bg-[#101710]/95 backdrop-blur-md border-b border-[#C9DDBD] dark:border-[#3D4D3D]">
        <motion.div
          initial={{ rotate: -2, opacity: 0 }}
          animate={{ rotate: -1, opacity: 1 }}
          className="admin-header p-4 sm:p-5 md:p-6 mb-5 inline-block rounded-[14px] max-w-full"
          data-testid="admin-header"
        >
          <h1 className="font-display font-black text-4xl sm:text-5xl md:text-6xl uppercase leading-none">Admin Zone</h1>
          <p className="text-xs uppercase tracking-widest mt-2 text-white/90">control center · don't break stuff</p>
        </motion.div>

        <div className="admin-tabs" data-testid="admin-tabs">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                className={`admin-tab ${tab === t.id ? "active" : ""}`}
                onClick={() => setTab(t.id)}
                aria-selected={tab === t.id}
              >
                <Icon className="inline w-4 h-4 mr-1.5 -mt-0.5" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* =========================================================
          ACTIVE ADMIN SECTION
      ========================================================= */}
      <div className="pt-5 sm:pt-6">
        {tab === "users" && <UsersTab />}
        {tab === "challenges" && <ChallengesTab />}
        {tab === "analytics" && <AnalyticsTab />}
        {tab === "feedback" && <FeedbackTab />}
        {tab === "rewards" && <RewardsTab />}
        {tab === "quizzes" && <QuizzesTab />}
        {tab === "points" && <PointsTab />}
        {tab === "teams" && <TeamsTab />}
        {tab === "announcements" && <AnnouncementsTab />}
      </div>
    </div>
  );
}

const EMPTY_ORGANIZATION = {
  name: "",
  supportEmail: "",
  workEmailDomain: "",
  timezone: "Asia/Kolkata",
};

// Server shape <-> the camelCase shape this form uses.
const orgFromApi = (data = {}) => ({
  name: data.name || "",
  supportEmail: data.support_email || "",
  workEmailDomain: data.work_email_domain || "",
  timezone: data.timezone || "Asia/Kolkata",
});

const orgToApi = (org) => ({
  name: org.name.trim(),
  support_email: org.supportEmail.trim(),
  work_email_domain: org.workEmailDomain.trim().replace(/^@/, ""),
  timezone: org.timezone,
});

const TIMEZONES = (() => {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return ["Asia/Kolkata", "UTC", "Europe/London", "America/New_York", "America/Los_Angeles", "Asia/Singapore", "Australia/Sydney"];
  }
})();

const ROLE_LABELS = { employee: "Employee", team_lead: "Team Lead", admin: "Admin" };

const copyLink = async (link, what = "Invite") => {
  try {
    await navigator.clipboard.writeText(link);
    toast.success(`${what} link copied — share it with the employee.`);
  } catch {
    window.prompt(`Copy this ${what.toLowerCase()} link:`, link);
  }
};

/* =========================================================
   PEOPLE & ACCESS
   1. Organization & Invite
   2. Recent Invitations
   3. Users List
   Everything here is loaded from and saved to the backend. Nothing
   org-specific lives in localStorage, so admins of different
   organizations sharing a browser never see each other's data.
========================================================= */

const UsersTab = () => {
  const [users, setUsers] = useState([]);
  const [org, setOrg] = useState(EMPTY_ORGANIZATION);
  const [savedOrg, setSavedOrg] = useState(EMPTY_ORGANIZATION);
  const [invite, setInvite] = useState({
    name: "",
    email: "",
    role: "employee",
  });
  const [invitations, setInvitations] = useState([]);
  const [savingOrg, setSavingOrg] = useState(false);
  const [sendingInvite, setSendingInvite] = useState(false);
  const [busyInviteId, setBusyInviteId] = useState(null);

  const load = async () => {
    try {
      const { data } = await api.get("/admin/users");
      setUsers(data || []);
    } catch (error) {
      console.error("Failed to load users:", error);
      toast.error("Could not load users.");
    }
  };

  const loadOrganization = async () => {
    try {
      const { data } = await api.get("/admin/organization");
      setOrg(orgFromApi(data));
      setSavedOrg(orgFromApi(data));
    } catch (error) {
      console.error("Failed to load organization:", error);
      toast.error("Could not load organization settings.");
    }
  };

  const loadInvitations = async () => {
    try {
      const { data } = await api.get("/admin/invitations");
      setInvitations(data || []);
    } catch (error) {
      console.error("Failed to load invitations:", error);
      toast.error("Could not load invitations.");
    }
  };

  useEffect(() => {
    load();
    loadOrganization();
    loadInvitations();
  }, []);

  const setRole = async (user, role) => {
    try {
      await api.patch(`/admin/users/${user.id}`, { role });
      toast.success(`Role updated for ${user.name}`);
      load();
    } catch (error) {
      console.error("Failed to update role:", error);
      toast.error(error.response?.data?.message || "Could not update role.");
    }
  };

  const toggleStatus = async (user) => {
    const status = user.status === "deactivated" ? "active" : "deactivated";
    if (
      status === "deactivated" &&
      !window.confirm(`Deactivate ${user.name}? They will be signed out and can't sign in until reactivated.`)
    ) {
      return;
    }
    try {
      await api.patch(`/admin/users/${user.id}`, { status });
      toast.success(`${user.name} ${status === "active" ? "reactivated" : "deactivated"}.`);
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not update access.");
    }
  };

  const createResetLink = async (user) => {
    try {
      const { data } = await api.post(`/admin/users/${user.id}/password-reset-link`);
      await copyLink(data.reset_link, "Password reset");
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not create a reset link.");
    }
  };

  const removeUser = async (user) => {
    if (!window.confirm(`Remove ${user.name} from the organization?`)) return;

    try {
      await api.delete(`/admin/users/${user.id}`);
      toast.success(`${user.name} removed.`);
      load();
    } catch (error) {
      console.error("Failed to remove user:", error);
      toast.error(error.response?.data?.message || "Could not remove user.");
    }
  };

  const saveOrganization = async () => {
    if (!org.name.trim()) {
      toast.error("Organization name is required.");
      return;
    }

    if (!org.supportEmail.includes("@")) {
      toast.error("Enter a valid support email.");
      return;
    }

    if (!org.workEmailDomain.trim()) {
      toast.error("Work email domain is required.");
      return;
    }

    setSavingOrg(true);

    try {
      const { data } = await api.put("/admin/organization", orgToApi(org));
      setOrg(orgFromApi(data));
      setSavedOrg(orgFromApi(data));
      toast.success("Organization settings saved.");
    } catch (error) {
      // e.g. 409 "An organization with this name already exists."
      toast.error(error.response?.data?.message || "Could not save organization settings.");
    } finally {
      setSavingOrg(false);
    }
  };

  const sendInvitation = async () => {
    const name = invite.name.trim();
    const email = invite.email.trim().toLowerCase();
    const domain = savedOrg.workEmailDomain.trim().toLowerCase().replace(/^@/, "");

    if (!name) {
      toast.error("Please enter the employee's name.");
      return;
    }

    if (!email || !email.includes("@")) {
      toast.error("Please enter a valid work email address.");
      return;
    }

    if (domain && email.split("@")[1] !== domain) {
      toast.error(`Please use a ${domain} work email address.`);
      return;
    }

    setSendingInvite(true);

    try {
      const { data } = await api.post("/admin/invitations", { name, email, role: invite.role });
      setInvite({ name: "", email: "", role: "employee" });
      await loadInvitations();
      toast.success(`Invitation created for ${email}`);
      if (data.accept_link) copyLink(data.accept_link);
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not create the invitation.");
    } finally {
      setSendingInvite(false);
    }
  };

  const deleteInvitation = async (invitation) => {
    if (!window.confirm(`Cancel the invitation for ${invitation.name || invitation.email}?`)) {
      return;
    }
    setBusyInviteId(invitation.id);
    try {
      await api.delete(`/admin/invitations/${invitation.id}`);
      toast.success("Invitation cancelled.");
      loadInvitations();
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not cancel the invitation.");
    } finally {
      setBusyInviteId(null);
    }
  };

  const resendInvitation = async (invitation) => {
    setBusyInviteId(invitation.id);
    try {
      const { data } = await api.post(`/admin/invitations/${invitation.id}/resend`);
      loadInvitations();
      if (data.accept_link) copyLink(data.accept_link);
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not refresh the invitation.");
    } finally {
      setBusyInviteId(null);
    }
  };

  const hasOrgChanges = JSON.stringify(org) !== JSON.stringify(savedOrg);

  return (
    <div className="space-y-6" data-testid="users-tab">
      <div className="grid lg:grid-cols-2 gap-6">
        {/* ---------- 1. ORGANIZATION & INVITE ---------- */}
        {/* ORGANIZATION */}
        <BrutalCard color="white" hover={false}>
          <div className="flex items-center gap-3 mb-5">
            <div className="admin-icon-box">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-black text-xl uppercase">
                Organization
              </h3>
              <p className="text-xs font-bold uppercase opacity-70">
                Company identity and work-email access rules.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="font-black uppercase text-[10px] block mb-1">
                Organization Name
              </label>
              <BrutalInput
                value={org.name}
                onChange={(e) => setOrg({ ...org, name: e.target.value })}
              />
            </div>

            <div>
              <label className="font-black uppercase text-[10px] block mb-1">
                HR Support Email
              </label>
              <BrutalInput
                type="email"
                value={org.supportEmail}
                onChange={(e) => setOrg({ ...org, supportEmail: e.target.value })}
              />
            </div>

            <div>
              <label className="font-black uppercase text-[10px] block mb-1">
                Work Email Domain
              </label>
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5 shrink-0" />
                <BrutalInput
                  value={org.workEmailDomain}
                  onChange={(e) =>
                    setOrg({
                      ...org,
                      workEmailDomain: e.target.value.replace("@", ""),
                    })
                  }
                  placeholder="company.com"
                />
              </div>
              <p className="text-[10px] font-bold uppercase opacity-60 mt-1">
                Only this domain can be used for employee invitations.
              </p>
            </div>

            <div>
              <label className="font-black uppercase text-[10px] block mb-1" htmlFor="org-timezone">
                Business Timezone
              </label>
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 shrink-0" />
                <select
                  id="org-timezone"
                  data-testid="org-timezone"
                  value={org.timezone}
                  onChange={(e) => setOrg({ ...org, timezone: e.target.value })}
                  className="w-full border-[3px] border-black px-3 py-3 font-bold bg-white"
                >
                  {!TIMEZONES.includes(org.timezone) && <option value={org.timezone}>{org.timezone}</option>}
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>{tz}</option>
                  ))}
                </select>
              </div>
              <p className="text-[10px] font-bold uppercase opacity-60 mt-1">
                Daily points and rituals reset at midnight in this timezone.
              </p>
            </div>

            <BrutalButton
              color="black"
              onClick={saveOrganization}
              disabled={savingOrg || !hasOrgChanges}
              className="w-full"
            >
              {savingOrg ? "SAVING..." : hasOrgChanges ? "SAVE ORGANIZATION" : "SAVED"}
            </BrutalButton>
          </div>
        </BrutalCard>

        {/* INVITE */}
        <BrutalCard color="white" hover={false}>
          <div className="flex items-center gap-3 mb-5">
            <div className="admin-icon-box">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-black text-xl uppercase">
                Invite Employees
              </h3>
              <p className="text-xs font-bold uppercase opacity-70">
                Prepare a work-email invitation for a new member.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="font-black uppercase text-[10px] block mb-1">
                Full Name
              </label>
              <BrutalInput
                value={invite.name}
                onChange={(e) => setInvite({ ...invite, name: e.target.value })}
                placeholder="John Smith"
              />
            </div>

            <div>
              <label className="font-black uppercase text-[10px] block mb-1">
                Work Email
              </label>
              <BrutalInput
                type="email"
                value={invite.email}
                onChange={(e) => setInvite({ ...invite, email: e.target.value })}
                placeholder={`employee@${org.workEmailDomain}`}
              />
            </div>

            <div>
              <label className="font-black uppercase text-[10px] block mb-1">
                Role
              </label>
              <select
                value={invite.role}
                onChange={(e) => setInvite({ ...invite, role: e.target.value })}
                className="w-full border-[3px] border-black px-3 py-3 font-bold uppercase bg-white"
              >
                <option value="employee">Employee</option>
                <option value="team_lead">Team Lead</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <BrutalButton
              color="black"
              onClick={sendInvitation}
              disabled={sendingInvite}
              className="w-full"
            >
              <UserPlus className="inline w-4 h-4 mr-2" />
              {sendingInvite ? "CREATING..." : "CREATE INVITATION"}
            </BrutalButton>
            <p className="text-[10px] font-bold uppercase opacity-60">
              The invite link is copied for you to share with the employee.
            </p>
          </div>
        </BrutalCard>
      </div>


      {/* ---------- 2. RECENT INVITATIONS ---------- */}
      {/* INVITATIONS */}
      <BrutalCard color="white" hover={false}>
        <div className="flex items-center gap-3 mb-5">
          <div className="bg-brutal-yellow border-[3px] border-black p-2 shadow-brutal-sm">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-display font-black text-2xl uppercase">
              Recent Invitations
            </h3>
            <p className="text-xs font-bold uppercase opacity-60 mt-1">
              Track pending and accepted employee invitations.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {invitations.map((invitation) => (
            <motion.div
              key={invitation.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-[3px] border-black p-3 bg-white"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 border-[3px] border-black bg-brutal-green flex items-center justify-center font-display font-black shrink-0">
                  {(invitation.name || invitation.email).charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="font-black uppercase truncate">{invitation.name || invitation.email}</div>
                  <div className="text-xs font-bold truncate">{invitation.email}</div>
                  <div className="text-[10px] font-bold uppercase opacity-60">
                    {ROLE_LABELS[invitation.role] || invitation.role} ·{" "}
                    {invitation.invited_at ? new Date(invitation.invited_at).toLocaleDateString() : ""}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {invitation.status === "accepted" ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1.5 border-[2px] border-black bg-brutal-green text-xs font-black uppercase">
                    <Check className="w-3 h-3" /> Accepted
                  </span>
                ) : invitation.status === "cancelled" ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1.5 border-[2px] border-black bg-white text-xs font-black uppercase opacity-60">
                    <X className="w-3 h-3" /> Cancelled
                  </span>
                ) : (
                  <>
                    <span
                      className={`inline-flex items-center gap-1 px-3 py-1.5 border-[2px] border-black text-xs font-black uppercase ${
                        invitation.status === "expired" ? "bg-brutal-pink" : "bg-brutal-yellow"
                      }`}
                    >
                      <Clock className="w-3 h-3" /> {invitation.status === "expired" ? "Expired" : "Pending"}
                    </span>
                    {invitation.accept_link && invitation.status === "pending" && (
                      <button
                        type="button"
                        onClick={() => copyLink(invitation.accept_link)}
                        title="Copy invite link"
                        aria-label={`Copy invite link for ${invitation.email}`}
                        className="border-[3px] border-black bg-white p-2 shadow-brutal-sm"
                      >
                        <Link2 className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => resendInvitation(invitation)}
                      disabled={busyInviteId === invitation.id}
                      title="Refresh invite link"
                      aria-label={`Refresh invite link for ${invitation.email}`}
                      className="border-[3px] border-black bg-white p-2 shadow-brutal-sm disabled:opacity-50"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteInvitation(invitation)}
                      disabled={busyInviteId === invitation.id}
                      title="Cancel invitation"
                      aria-label={`Cancel invitation for ${invitation.email}`}
                      className="border-[3px] border-black bg-brutal-pink p-2 shadow-brutal-sm disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          ))}

          {invitations.length === 0 && (
            <div className="border-[3px] border-black p-6 text-center font-bold uppercase text-sm">
              No invitations yet.
            </div>
          )}
        </div>
      </BrutalCard>

      {/* ---------- 3. USERS LIST ---------- */}
      {/* PEOPLE */}
      <BrutalCard color="white" hover={false}>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
          <div>
            <h2 className="font-display font-black text-2xl uppercase">
              People ({users.length})
            </h2>
            <p className="text-xs font-bold uppercase opacity-60 mt-1">
              Manage members, roles, and access to the organization.
            </p>
          </div>
          <div className="bg-brutal-yellow border-[3px] border-black px-3 py-2 text-[10px] font-black uppercase">
            Organization Access
          </div>
        </div>

        <div className="space-y-2">
          {users.map((user) => (
            <div
              key={user.id}
              className="flex flex-col md:flex-row md:items-center gap-3 border-[3px] border-black p-3 bg-white shadow-brutal-sm"
            >
              <img
                src={resolveAvatar(user.avatar)}
                className="w-10 h-10 border-[2px] border-black object-cover"
                alt=""
              />

              <div className="flex-1 min-w-0">
                <div className="font-black uppercase truncate flex items-center gap-2">
                  {user.name}
                  {user.status === "deactivated" && (
                    <span className="text-[9px] px-1.5 py-0.5 border-[2px] border-black bg-brutal-pink">DEACTIVATED</span>
                  )}
                </div>
                <div className="text-xs font-bold truncate">
                  {user.email} · {user.department || "General"} · {user.points ?? 0} pts
                  {user.created_at ? ` · joined ${new Date(user.created_at).toLocaleDateString()}` : ""}
                </div>
              </div>

              <select
                data-testid={`role-${user.id}`}
                value={user.role || "employee"}
                onChange={(e) => setRole(user, e.target.value)}
                className="border-[3px] border-black px-2 py-2 font-black text-xs uppercase bg-white"
              >
                <option value="employee">Employee</option>
                <option value="team_lead">Team Lead</option>
                <option value="admin">Admin</option>
              </select>

              <button
                data-testid={`reset-${user.id}`}
                type="button"
                onClick={() => createResetLink(user)}
                title="Copy a password reset link"
                aria-label={`Copy a password reset link for ${user.name}`}
                className="bg-white border-[3px] border-black p-2 shadow-brutal-sm"
              >
                <KeyRound className="w-4 h-4" />
              </button>

              <button
                data-testid={`status-${user.id}`}
                type="button"
                onClick={() => toggleStatus(user)}
                title={user.status === "deactivated" ? "Reactivate user" : "Deactivate user"}
                aria-label={`${user.status === "deactivated" ? "Reactivate" : "Deactivate"} ${user.name}`}
                className="bg-white border-[3px] border-black p-2 shadow-brutal-sm"
              >
                {user.status === "deactivated" ? <UserCheck className="w-4 h-4" /> : <UserX className="w-4 h-4" />}
              </button>

              <button
                data-testid={`delete-${user.id}`}
                type="button"
                onClick={() => removeUser(user)}
                title="Remove user"
                aria-label={`Remove ${user.name}`}
                className="bg-brutal-pink border-[3px] border-black p-2 shadow-brutal-sm"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}

          {users.length === 0 && (
            <div className="border-[3px] border-black p-6 text-center font-bold uppercase text-sm">
              No organization members found.
            </div>
          )}
        </div>
      </BrutalCard>
    </div>
  );
};

/* =========================================================
   CHALLENGES
========================================================= */

const ChallengesTab = () => {
 const [items, setItems] = useState([]);
 const [form, setForm] = useState({ title: "", reward: 30, target: 3, type: "water", scope: "daily" });
 const load = async () => { const { data } = await api.get("/admin/challenges"); setItems(data); };
 useEffect(() => { load(); }, []);
 const create = async () => {
 if (!form.title) { toast.error("title plz"); return; }
 await api.post("/admin/challenges", form);
 toast.success(" Challenge created");
 setForm({ title: "", reward: 30, target: 3, type: "water", scope: "daily" });
 load();
 };
 const del = async (id) => { await api.delete(`/admin/challenges/${id}`); load(); };
 return (
 <div className="grid md:grid-cols-2 gap-6" data-testid="challenges-tab">
 <BrutalCard color="yellow" hover={false}>
 <h3 className="font-display font-black text-2xl uppercase mb-3"> New Challenge</h3>
 <div className="space-y-3">
 <BrutalInput data-testid="ch-title" placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
 <div className="grid grid-cols-2 gap-3">
 <BrutalInput type="number" placeholder="Reward" value={form.reward} onChange={(e) => setForm({ ...form, reward: +e.target.value })} />
 <BrutalInput type="number" placeholder="Target" value={form.target} onChange={(e) => setForm({ ...form, target: +e.target.value })} />
 </div>
 <select className="w-full border-[3px] border-black px-3 py-3 font-bold uppercase" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
 <option value="water">Water</option>
 <option value="eye_care">Eye Care</option>
 <option value="move_reset">Move & Reset</option>
 <option value="breathing">Breathing</option>
 <option value="mood">Mood</option>
 </select>
 <select className="w-full border-[3px] border-black px-3 py-3 font-bold uppercase" value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })}>
 <option value="daily">Daily</option>
 <option value="weekly">Weekly</option>
 </select>
 <BrutalButton data-testid="ch-create" color="green" onClick={create} className="w-full">CREATE </BrutalButton>
 </div>
 </BrutalCard>

 <BrutalCard color="white" hover={false}>
 <h3 className="font-display font-black text-2xl uppercase mb-3"> Custom Challenges</h3>
 <div className="space-y-2">
 {items.map((c) => (
 <div key={c.id} className="border-[3px] border-black p-3 flex items-center justify-between">
 <div>
 <div className="font-black uppercase text-sm">{c.title}</div>
 <div className="text-xs font-bold">{c.scope} · {c.type} · target {c.target} · reward +{c.reward}</div>
 </div>
 <button onClick={() => del(c.id)} className="bg-brutal-pink border-[2px] border-black p-1.5"><Trash2 className="w-4 h-4" /></button>
 </div>
 ))}
 {items.length === 0 && <div className="text-sm font-bold uppercase">No custom challenges yet.</div>}
 </div>
 </BrutalCard>
 </div>
 );
};



/* =========================================================
   ANALYTICS
========================================================= */

const AnalyticsTab = () => {
 const [data, setData] = useState(null);
 useEffect(() => { api.get("/admin/analytics").then(({ data }) => setData(data)); }, []);
 if (!data) return <div className="font-bold uppercase">Loading...</div>;
 return (
 <div className="space-y-6" data-testid="analytics-tab">
 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
 {[
 { label: "Users", val: data.total_users, c: "yellow" },
 { label: "DAU", val: data.dau, c: "cyan" },
 { label: "WAU", val: data.wau, c: "pink" },
 { label: "MAU", val: data.mau, c: "green" },
 ].map((s, i) => (
 <motion.div
 key={s.label}
 initial={{ rotate: i % 2 ? -2 : 2, opacity: 0 }}
 animate={{ rotate: i % 2 ? -1 : 1, opacity: 1 }}
 className={`bg-brutal-${s.c} border-[4px] border-black shadow-brutal-lg p-4`}
 >
 <div className="font-display font-black text-5xl">{s.val}</div>
 <div className="text-xs font-black uppercase">{s.label}</div>
 </motion.div>
 ))}
 </div>

 <div className="grid md:grid-cols-2 gap-6">
 <BrutalCard color="white" hover={false}>
 <h3 className="font-display font-black uppercase text-xl mb-3"> 7-day Activity Trend</h3>
 <ResponsiveContainer width="100%" height={220}>
 <LineChart data={data.trend}>
 <XAxis dataKey="day" tick={{ fill: "#000", fontWeight: 900, fontSize: 10 }} />
 <YAxis tick={{ fill: "#000", fontWeight: 900, fontSize: 10 }} />
 <Tooltip contentStyle={{ border: "3px solid #000", borderRadius: 0, fontWeight: 900 }} />
 <Line type="monotone" dataKey="count" stroke="#000" strokeWidth={4} dot={{ fill: "#FFE600", stroke: "#000", strokeWidth: 3, r: 6 }} />
 </LineChart>
 </ResponsiveContainer>
 </BrutalCard>

 <BrutalCard color="white" hover={false}>
 <h3 className="font-display font-black uppercase text-xl mb-3"> Mood Spread (week)</h3>
 <ResponsiveContainer width="100%" height={220}>
 <BarChart data={data.mood_chart}>
 <XAxis dataKey="label" tick={{ fill: "#000", fontWeight: 900, fontSize: 10 }} />
 <YAxis tick={{ fill: "#000", fontWeight: 900, fontSize: 10 }} />
 <Tooltip contentStyle={{ border: "3px solid #000", borderRadius: 0, fontWeight: 900 }} />
 <Bar dataKey="count" stroke="#000" strokeWidth={3}>
 {data.mood_chart.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
 </Bar>
 </BarChart>
 </ResponsiveContainer>
 </BrutalCard>
 </div>

 <BrutalCard color="yellow" hover={false}>
 <h3 className="font-display font-black uppercase text-xl mb-3"> Content Counts</h3>
 <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
 {Object.entries(data.counts).map(([k, v]) => (
 <div key={k} className="bg-white border-[3px] border-black p-3 text-center">
 <div className="font-display font-black text-3xl">{v}</div>
 <div className="text-xs font-black uppercase">{k.replace("_", " ")}</div>
 </div>
 ))}
 </div>
 </BrutalCard>
 </div>
 );
};

/* =========================================================
   FEEDBACK
========================================================= */

const FeedbackTab = () => {
 const [items, setItems] = useState([]);
 useEffect(() => { api.get("/feedback").then(({ data }) => setItems(data)).catch(() => {}); }, []);
 return (
 <BrutalCard color="white" hover={false} data-testid="feedback-tab">
 <h3 className="font-display font-black text-2xl uppercase mb-3"> Feedback Inbox ({items.length})</h3>
 <div className="space-y-2">
 {items.map((f) => (
 <div key={f.id} className="border-[3px] border-black p-3 bg-white">
 <div className="flex items-center gap-2 mb-1">
 <span className="bg-brutal-pink text-white border-[2px] border-black px-2 py-0.5 font-black text-xs">{f.category}</span>
 <span className="font-black text-sm">{f.user_name}</span>
 <span className="text-xs ml-auto font-bold">{new Date(f.created_at).toLocaleString()}</span>
 </div>
 <div className="text-sm font-medium">{f.message}</div>
 </div>
 ))}
 {items.length === 0 && <div className="text-sm font-bold uppercase">No feedback yet.</div>}
 </div>
 </BrutalCard>
 );
};

/* =========================================================
   REWARDS
========================================================= */

const RewardsTab = () => {
 const [users, setUsers] = useState([]);
 const [rewards, setRewards] = useState([]);
 const [form, setForm] = useState({ user_id: "", type: "coupon", points: 0, message: "", code: "" });

 const load = async () => {
 const [u, r] = await Promise.all([api.get("/admin/users"), api.get("/admin/rewards")]);
 setUsers(u.data);
 setRewards(r.data);
 };
 useEffect(() => { load(); }, []);

 const issue = async () => {
 if (!form.user_id || !form.message) { toast.error("Pick user + add message"); return; }
 await api.post("/admin/rewards", form);
 toast.success(" Reward issued!");
 setForm({ user_id: "", type: "coupon", points: 0, message: "", code: "" });
 load();
 };

 return (
 <div className="grid md:grid-cols-2 gap-6" data-testid="rewards-tab">
 <BrutalCard color="pink" hover={false}>
 <h3 className="font-display font-black text-2xl uppercase mb-3 text-white"> Issue Surprise Reward</h3>
 <div className="space-y-3">
 <div>
 <label className="font-black uppercase text-xs text-white block mb-1">Recipient</label>
 <select
 data-testid="reward-user"
 value={form.user_id}
 onChange={(e) => setForm({ ...form, user_id: e.target.value })}
 className="w-full border-[3px] border-black px-3 py-3 font-bold uppercase bg-white"
 >
 <option value="">— pick a legend —</option>
 {users.map((u) => <option key={u.id} value={u.id}>{u.name} · {u.department}</option>)}
 </select>
 </div>
 <div>
 <label className="font-black uppercase text-xs text-white block mb-1">Type</label>
 <select
 data-testid="reward-type"
 value={form.type}
 onChange={(e) => setForm({ ...form, type: e.target.value })}
 className="w-full border-[3px] border-black px-3 py-3 font-bold uppercase bg-white"
 >
 <option value="coupon"> Coupon</option>
 <option value="points"> Bonus Points</option>
 <option value="shoutout"> Shoutout</option>
 </select>
 </div>
 {form.type === "points" && (
 <BrutalInput type="number" placeholder="Points to grant" value={form.points} onChange={(e) => setForm({ ...form, points: +e.target.value })} />
 )}
 {form.type === "coupon" && (
 <BrutalInput placeholder="Coupon code (e.g. PIZZA50)" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
 )}
 <BrutalInput data-testid="reward-message" placeholder="Reason / message" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
 <BrutalButton data-testid="reward-issue" color="green" onClick={issue} className="w-full"> ISSUE</BrutalButton>
 </div>
 </BrutalCard>

 <BrutalCard color="white" hover={false}>
 <h3 className="font-display font-black text-2xl uppercase mb-3"> Recently Issued</h3>
 <div className="space-y-2 max-h-[600px] overflow-y-auto">
 {rewards.map((r) => (
 <div key={r.id} className="border-[3px] border-black p-3 bg-white">
 <div className="flex items-center gap-2 mb-1 flex-wrap">
 <span className="bg-brutal-yellow border-[2px] border-black px-2 py-0.5 font-black text-[10px] uppercase">{r.type}</span>
 <span className="font-black text-sm">→ {r.user_name}</span>
 {r.claimed && <span className="bg-brutal-green border-[2px] border-black px-2 py-0.5 font-black text-[10px] uppercase"> claimed</span>}
 <span className="text-[10px] font-bold ml-auto">{new Date(r.created_at).toLocaleDateString()}</span>
 </div>
 <div className="text-sm font-medium">{r.message}</div>
 {r.code && <div className="text-xs font-mono font-black mt-1">CODE: {r.code}</div>}
 </div>
 ))}
 {rewards.length === 0 && <div className="text-sm font-bold uppercase">No rewards issued yet.</div>}
 </div>
 </BrutalCard>
 </div>
 );
};

const DEPTS = ["Engineering", "Design", "Marketing", "HR", "Product", "Management", "General", "QA"];

/* =========================================================
   QUIZZES
========================================================= */

const QuizzesTab = () => {
 const [items, setItems] = useState([]);
 const [form, setForm] = useState({ department: "Engineering", title: "", questions: [{ q: "", options: ["", "", ""], answer: 0 }] });

 const load = async () => { const { data } = await api.get("/admin/quizzes"); setItems(data); };
 useEffect(() => { load(); }, []);

 const addQ = () => setForm({ ...form, questions: [...form.questions, { q: "", options: ["", "", ""], answer: 0 }] });
 const setQ = (i, field, val) => {
 const qs = [...form.questions]; qs[i] = { ...qs[i], [field]: val };
 setForm({ ...form, questions: qs });
 };
 const setOpt = (i, j, val) => {
 const qs = [...form.questions]; const opts = [...qs[i].options]; opts[j] = val; qs[i].options = opts;
 setForm({ ...form, questions: qs });
 };
 const create = async () => {
 if (!form.questions.every(q => q.q && q.options.every(o => o))) { toast.error("Fill all fields"); return; }
 await api.post("/admin/quizzes", form);
 toast.success(" Quiz created");
 setForm({ department: "Engineering", title: "", questions: [{ q: "", options: ["", "", ""], answer: 0 }] });
 load();
 };
 const del = async (id) => { await api.delete(`/admin/quizzes/${id}`); load(); };

 return (
 <div className="grid lg:grid-cols-2 gap-6" data-testid="quizzes-tab">
 <BrutalCard color="cyan" hover={false}>
 <h3 className="font-display font-black text-2xl uppercase mb-3"> New Custom Quiz</h3>
 <select value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} className="w-full border-[3px] border-black px-3 py-3 font-bold uppercase mb-2">
 {DEPTS.map(d => <option key={d} value={d}>{d}</option>)}
 </select>
 <BrutalInput data-testid="quiz-title" placeholder="Quiz title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mb-3" />
 <div className="space-y-3 max-h-[400px] overflow-y-auto">
 {form.questions.map((q, i) => (
 <div key={i} className="border-[3px] border-black p-3 bg-white">
 <div className="text-xs font-black uppercase mb-1">Q{i + 1}</div>
 <BrutalInput placeholder="Question text" value={q.q} onChange={(e) => setQ(i, "q", e.target.value)} className="mb-2" />
 {q.options.map((o, j) => (
 <div key={j} className="flex items-center gap-2 mb-1">
 <input type="radio" checked={q.answer === j} onChange={() => setQ(i, "answer", j)} className="w-5 h-5" />
 <BrutalInput placeholder={`Option ${String.fromCharCode(65 + j)}`} value={o} onChange={(e) => setOpt(i, j, e.target.value)} />
 </div>
 ))}
 </div>
 ))}
 </div>
 <div className="flex gap-2 mt-3">
 <BrutalButton color="white" onClick={addQ}>+ Q</BrutalButton>
 <BrutalButton data-testid="quiz-create" color="green" onClick={create}> CREATE</BrutalButton>
 </div>
 </BrutalCard>
 <BrutalCard color="white" hover={false}>
 <h3 className="font-display font-black text-2xl uppercase mb-3"> Custom Quizzes</h3>
 <div className="space-y-2">
 {items.map((q) => (
 <div key={q.id} className="border-[3px] border-black p-3 flex items-center justify-between">
 <div>
 <div className="font-black uppercase">{q.title}</div>
 <div className="text-xs font-bold">{q.department} · {q.questions.length} Qs</div>
 </div>
 <button data-testid={`quiz-delete-${q.id}`} onClick={() => del(q.id)} className="bg-brutal-pink border-[2px] border-black p-1.5"><Trash2 className="w-4 h-4" /></button>
 </div>
 ))}
 {items.length === 0 && <div className="text-sm font-bold uppercase">No custom quizzes. Hardcoded ones still active.</div>}
 </div>
 </BrutalCard>
 </div>
 );
};

const DEFAULT_REWARD_CONFIG = {
  water: {
    rewardGoal: 2000,
    unit: "ml",
    milestones: [
      { threshold: 50, xp: 10 },
      { threshold: 75, xp: 20 },
      { threshold: 100, xp: 50 },
    ],
  },
  eyeBreak: {
    rewardGoal: 3,
    unit: "breaks",
    milestones: [
      { threshold: 1, xp: 10 },
      { threshold: 2, xp: 20 },
      { threshold: 3, xp: 50 },
    ],
  },
  moveReset: {
    rewardGoal: 3,
    unit: "sessions",
    milestones: [
      { threshold: 1, xp: 10 },
      { threshold: 2, xp: 20 },
      { threshold: 3, xp: 50 },
    ],
  },
  breathing: {
    rewardGoal: 3,
    unit: "sessions",
    milestones: [
      { threshold: 1, xp: 5 },
      { threshold: 2, xp: 10 },
      { threshold: 3, xp: 20 },
    ],
  },
};

const REWARD_ACTIVITY_META = {
  water: {
    title: "Water Hydration",
    description: "Daily hydration goal used for reward calculation.",
    icon: Droplets,
    max: null,
  },
  eyeBreak: {
    title: "Eye Break",
    description: "Daily eye-break goal used for reward calculation.",
    icon: Eye,
    max: 5,
  },
  moveReset: {
    title: "Move & Reset",
    description: "Daily movement goal used for reward calculation.",
    icon: PersonStanding,
    max: 5,
  },
  breathing: {
    title: "Breathing",
    description: "Daily breathing goal used for reward calculation.",
    icon: Wind,
    max: 5,
  },
};

const cloneRewardConfig = (value) => JSON.parse(JSON.stringify(value));

const isCountBasedRewardActivity = (activity) =>
  ["eyeBreak", "moveReset", "breathing"].includes(activity);

const buildCountMilestones = (goal, existingMilestones = []) => {
  const numericGoal = Number(goal);
  if (!Number.isFinite(numericGoal) || numericGoal < 1) return [];

  return Array.from({ length: Math.floor(numericGoal) }, (_, index) => ({
    threshold: index + 1,
    xp: existingMilestones[index]?.xp ?? 0,
  }));
};

const normalizeRewardConfig = (saved) => {
  const normalized = cloneRewardConfig(DEFAULT_REWARD_CONFIG);

  Object.keys(normalized).forEach((activity) => {
    if (!saved?.[activity]) return;

    const source = saved[activity];

    if (source.rewardGoal !== undefined) {
      normalized[activity].rewardGoal = Number(source.rewardGoal);
    }

    if (source.unit !== undefined) {
      normalized[activity].unit = String(source.unit);
    }

    if (Array.isArray(source.milestones)) {
      if (isCountBasedRewardActivity(activity)) {
        // Eye Break, Move & Reset, and Breathing use completed-count thresholds.
        // Keep the saved XP values, but always expose one milestone for each
        // whole-number step from 1 through the selected daily goal.
        normalized[activity].milestones = buildCountMilestones(
          normalized[activity].rewardGoal,
          source.milestones
        );
      } else {
        normalized[activity].milestones = source.milestones.map((milestone) => ({
          threshold: Number(milestone.threshold),
          xp: Number(milestone.xp),
        }));
      }
    }
  });

  return normalized;
};

const WELLNESS_POINT_KEYS = [
  "water",
  "hydration",
  "eye",
  "eye_care",
  "eyebreak",
  "stand",
  "move",
  "movement",
  "move_reset",
  "breath",
  "breathing",
];

const isWellnessActivityPointKey = (key) => {
  const normalized = key.toLowerCase().replace(/\s+/g, "_");
  return WELLNESS_POINT_KEYS.some((part) => normalized.includes(part));
};

/* =========================================================
   POINTS & GAMES
========================================================= */

const PointsTab = () => {
  const [config, setConfig] = useState({});
  const [game, setGame] = useState({});
  const [users, setUsers] = useState([]);
  const [log, setLog] = useState([]);
  const [adj, setAdj] = useState({ user_id: "", points: 10, reason: "" });
  const [rewardConfig, setRewardConfig] = useState(() => {
    try {
      return normalizeRewardConfig(
        JSON.parse(localStorage.getItem("wellness-reward-config") || "null")
      );
    } catch {
      return cloneRewardConfig(DEFAULT_REWARD_CONFIG);
    }
  });
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [rewardDraft, setRewardDraft] = useState(null);
  const [savingPoints, setSavingPoints] = useState(false);
  const [savingGame, setSavingGame] = useState(false);
  const [savingRewards, setSavingRewards] = useState(false);

  const load = async () => {
    try {
      const [pc, gc, u, l] = await Promise.all([
        api.get("/admin/points-config"),
        api.get("/admin/game-config"),
        api.get("/admin/users"),
        api.get("/admin/points/log"),
      ]);

      const pointsData = pc.data || {};
      const serverRewards =
        pointsData.reward_config ||
        pointsData.rewardConfig ||
        pointsData.wellness_rewards ||
        pointsData.wellnessRewards;

      setConfig(pointsData);
      setGame(gc.data || {});
      setUsers(u.data || []);
      setLog(l.data || []);

      if (serverRewards) {
        const normalizedServerRewards = normalizeRewardConfig(serverRewards);
        setRewardConfig(normalizedServerRewards);
        localStorage.setItem("wellness-reward-config", JSON.stringify(normalizedServerRewards));
      } else {
        try {
          const localRewards = JSON.parse(localStorage.getItem("wellness-reward-config") || "null");
          if (localRewards) {
            setRewardConfig(normalizeRewardConfig(localRewards));
          }
        } catch {
          // Keep defaults when no local reward configuration exists.
        }
      }
    } catch (error) {
      console.error("Failed to load points settings:", error);
      toast.error("Could not load points settings.");
    }
  };

  useEffect(() => {
    load();

    const handleRewardsUpdated = (event) => {
      if (event.detail) {
        setRewardConfig(normalizeRewardConfig(event.detail));
      }
    };

    window.addEventListener("wellnessRewardsUpdated", handleRewardsUpdated);
    return () => window.removeEventListener("wellnessRewardsUpdated", handleRewardsUpdated);
  }, []);

  const savePoints = async () => {
    try {
      setSavingPoints(true);
      const pointsPayload = {
        ...config,
        reward_config: normalizeRewardConfig(rewardConfig),
      };
      await api.put("/admin/points-config", pointsPayload);
      setConfig(pointsPayload);
      toast.success("Point configuration saved.");
    } catch (error) {
      console.error("Failed to save point configuration:", error);
      toast.error("Could not save point configuration.");
    } finally {
      setSavingPoints(false);
    }
  };

  const saveGame = async () => {
    try {
      setSavingGame(true);
      await api.put("/admin/game-config", game);
      toast.success("Gamification settings saved.");
    } catch (error) {
      console.error("Failed to save gamification settings:", error);
      toast.error("Could not save gamification settings.");
    } finally {
      setSavingGame(false);
    }
  };

  const openRewardEditor = (activity) => {
    setSelectedActivity(activity);
    setRewardDraft(cloneRewardConfig(rewardConfig[activity]));
  };

  const closeRewardEditor = () => {
    setSelectedActivity(null);
    setRewardDraft(null);
  };

  const updateDraftGoal = (value) => {
    if (!selectedActivity || !rewardDraft) return;
    const meta = REWARD_ACTIVITY_META[selectedActivity];
    let nextValue = value === "" ? "" : Number(value);

    if (meta.max !== null && nextValue !== "" && nextValue > meta.max) {
      nextValue = meta.max;
      toast.error(`${meta.title} reward goal cannot exceed ${meta.max}.`);
    }

    if (isCountBasedRewardActivity(selectedActivity) && nextValue !== "") {
      nextValue = Math.max(1, Math.floor(nextValue));
      setRewardDraft({
        ...rewardDraft,
        rewardGoal: nextValue,
        milestones: buildCountMilestones(nextValue, rewardDraft.milestones),
      });
      return;
    }

    setRewardDraft({ ...rewardDraft, rewardGoal: nextValue });
  };

  const updateDraftMilestone = (index, field, value) => {
    if (!rewardDraft) return;

    const milestones = [...rewardDraft.milestones];
    milestones[index] = {
      ...milestones[index],
      [field]: value === "" ? "" : Number(value),
    };

    setRewardDraft({ ...rewardDraft, milestones });
  };

  const addDraftMilestone = () => {
    if (!rewardDraft || isCountBasedRewardActivity(selectedActivity)) return;
    setRewardDraft({
      ...rewardDraft,
      milestones: [...rewardDraft.milestones, { threshold: "", xp: "" }],
    });
  };

  const removeDraftMilestone = (index) => {
    if (!rewardDraft || rewardDraft.milestones.length <= 1) return;
    setRewardDraft({
      ...rewardDraft,
      milestones: rewardDraft.milestones.filter((_, i) => i !== index),
    });
  };

  const saveRewardActivity = async () => {
    if (!selectedActivity || !rewardDraft) return;

    const meta = REWARD_ACTIVITY_META[selectedActivity];
    const rawGoal = String(rewardDraft.rewardGoal ?? "").trim();
    const goal = Number(rawGoal);

    if (rawGoal === "" || !Number.isFinite(goal) || goal < 1) {
      toast.error("Reward goal must be at least 1.");
      return;
    }

    if (meta.max !== null && goal > meta.max) {
      toast.error(`${meta.title} reward goal cannot exceed ${meta.max}.`);
      return;
    }

    if (!rewardDraft.milestones.length) {
      toast.error("Add at least one XP milestone.");
      return;
    }

    const thresholds = rewardDraft.milestones.map((item) => Number(item.threshold));
    const duplicate = new Set(thresholds).size !== thresholds.length;
    const increasing = thresholds.every(
      (value, index) => index === 0 || value > thresholds[index - 1]
    );

    if (rewardDraft.milestones.some((item) => String(item.threshold ?? "").trim() === "")) {
      toast.error("Every threshold must have a value.");
      return;
    }

    if (isCountBasedRewardActivity(selectedActivity)) {
      const expectedThresholds = Array.from({ length: goal }, (_, index) => index + 1);
      const matchesGoal =
        thresholds.length === expectedThresholds.length &&
        thresholds.every((value, index) => value === expectedThresholds[index]);

      if (!matchesGoal) {
        toast.error(`Thresholds must run from 1 to ${goal}.`);
        return;
      }
    } else {
      if (thresholds.some((value) => !Number.isFinite(value) || value < 1 || value > 100)) {
        toast.error("Thresholds must be between 1% and 100%.");
        return;
      }

      if (duplicate || !increasing) {
        toast.error("XP thresholds must be unique and in increasing order.");
        return;
      }
    }

    if (rewardDraft.milestones.some((item) => {
      const rawXp = String(item.xp ?? "").trim();
      return rawXp === "" || !Number.isFinite(Number(rawXp)) || Number(rawXp) < 0;
    })) {
      toast.error("XP must be 0 or greater.");
      return;
    }

    const updated = {
      ...rewardConfig,
      [selectedActivity]: {
        ...rewardDraft,
        rewardGoal: goal,
        milestones: rewardDraft.milestones.map((item) => ({
          threshold: Number(item.threshold),
          xp: Number(item.xp),
        })),
      },
    };

    try {
      setSavingRewards(true);
      const formatted = normalizeRewardConfig(updated);
      const updatedConfig = { ...config, reward_config: formatted };

      await api.put("/admin/points-config", updatedConfig);

      setRewardConfig(formatted);
      setConfig(updatedConfig);
      localStorage.setItem("wellness-reward-config", JSON.stringify(formatted));
      window.dispatchEvent(new CustomEvent("wellnessRewardsUpdated", { detail: formatted }));

      closeRewardEditor();
      toast.success(`${meta.title} reward rules saved.`);
    } catch (error) {
      console.error("Failed to save reward activity:", error);
      toast.error("Could not save reward rules.");
    } finally {
      setSavingRewards(false);
    }
  };

  const saveRewards = async () => {
    const formatted = normalizeRewardConfig(rewardConfig);

    for (const [activity, value] of Object.entries(formatted)) {
      const meta = REWARD_ACTIVITY_META[activity];
      if (meta.max !== null && value.rewardGoal > meta.max) {
        toast.error(`${meta.title} reward goal cannot exceed ${meta.max}.`);
        return;
      }
    }

    try {
      setSavingRewards(true);

      localStorage.setItem("wellness-reward-config", JSON.stringify(formatted));
      window.dispatchEvent(
        new CustomEvent("wellnessRewardsUpdated", { detail: formatted })
      );

      // Persist reward rules in the backend as part of the admin points configuration.
      const updatedConfig = { ...config, reward_config: formatted };
      await api.put("/admin/points-config", updatedConfig);
      setConfig(updatedConfig);

      toast.success("Reward rules saved.");
    } catch (error) {
      console.error("Failed to save reward rules:", error);
      toast.error("Could not save reward rules.");
    } finally {
      setSavingRewards(false);
    }
  };

  const resetRewards = () => {
    const defaults = cloneRewardConfig(DEFAULT_REWARD_CONFIG);
    setRewardConfig(defaults);
    localStorage.setItem("wellness-reward-config", JSON.stringify(defaults));
    window.dispatchEvent(
      new CustomEvent("wellnessRewardsUpdated", { detail: defaults })
    );
    toast.info("Reward defaults restored.");
  };

  const award = async () => {
    if (!adj.user_id || !adj.reason) {
      toast.error("Pick a user and enter a reason.");
      return;
    }

    try {
      await api.post("/admin/points/award", adj);
      toast.success(`${adj.points > 0 ? "+" : ""}${adj.points} points awarded.`);
      setAdj({ user_id: "", points: 10, reason: "" });
      load();
    } catch (error) {
      console.error("Failed to adjust points:", error);
      toast.error("Could not adjust user points.");
    }
  };

  const pointFields = Object.entries(config).filter(
    ([key, value]) =>
      key !== "reward_config" &&
      typeof value === "number" &&
      !isWellnessActivityPointKey(key)
  );

  return (
    <div className="space-y-6" data-testid="points-tab">
      {/* POINT CONFIGURATION */}
      <BrutalCard color="green" hover={false}>
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="font-display font-black text-2xl uppercase">
              Point Configuration
            </h3>
            <p className="text-xs font-bold uppercase opacity-70 mt-1">
              Configure general point values. Wellness activity rewards are managed separately below.
            </p>
          </div>
        </div>

        {pointFields.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {pointFields.map(([key, value]) => (
              <div key={key}>
                <label className="font-bold uppercase text-[10px] block mb-1">
                  {key.replace(/_/g, " ")}
                </label>
                <input
                  type="number"
                  value={value}
                  data-testid={`pts-${key}`}
                  onChange={(e) =>
                    setConfig({ ...config, [key]: Number(e.target.value) })
                  }
                  className="w-full border-[3px] border-black px-2 py-2 font-bold bg-white"
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="border-[3px] border-black bg-white p-4 text-sm font-bold uppercase">
            No general point allocation fields are configured.
          </div>
        )}

        <BrutalButton
          data-testid="save-points-config"
          color="black"
          onClick={savePoints}
          disabled={savingPoints}
          className="mt-4"
        >
          {savingPoints ? "SAVING..." : "SAVE POINTS"}
        </BrutalButton>
      </BrutalCard>

      {/* WELLNESS REWARD RULES */}
      <BrutalCard color="cyan" hover={false}>
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-5">
          <div>
            <h3 className="font-display font-black text-2xl uppercase">
              Wellness Reward Rules
            </h3>
            <p className="text-xs font-bold uppercase opacity-70 mt-1">
              Admin controls the reward goal and XP milestones. Employees cannot change these rules.
            </p>
          </div>
          <div className="bg-black text-white border-[3px] border-black px-3 py-2 text-[10px] font-black uppercase">
            Admin Controlled
          </div>
        </div>

        <div className="space-y-3">
          {Object.entries(REWARD_ACTIVITY_META).map(([activity, meta]) => {
            const Icon = meta.icon;
            const current = rewardConfig[activity];

            return (
              <button
                key={activity}
                type="button"
                onClick={() => openRewardEditor(activity)}
                className="w-full text-left border-[3px] border-black bg-white p-4 shadow-brutal-sm hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-brutal-yellow border-[3px] border-black p-2 shrink-0">
                    <Icon className="w-5 h-5" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="font-display font-black text-lg uppercase">
                      {meta.title}
                    </div>
                    <div className="text-xs font-bold uppercase opacity-60">
                      Goal: {current.rewardGoal} {current.unit} · {current.milestones.length} XP milestones
                    </div>
                  </div>

                  <div className="text-[10px] font-black uppercase border-[2px] border-black px-2 py-1 bg-brutal-green shrink-0">
                    Edit
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row gap-2 mt-5">
          <BrutalButton
            data-testid="save-reward-config"
            color="black"
            onClick={saveRewards}
            disabled={savingRewards}
          >
            {savingRewards ? "SAVING..." : "SAVE REWARD RULES"}
          </BrutalButton>
          <BrutalButton color="white" onClick={resetRewards} disabled={savingRewards}>
            RESET DEFAULTS
          </BrutalButton>
        </div>
      </BrutalCard>

      {/* GAMIFICATION */}
      <BrutalCard color="yellow" hover={false}>
        <h3 className="font-display font-black text-2xl uppercase mb-3">
          Gamification Settings
        </h3>

        <div className="grid md:grid-cols-3 gap-3">
          <div>
            <label className="font-bold uppercase text-xs">Level threshold</label>
            <BrutalInput
              type="number"
              value={game.level_threshold || 200}
              onChange={(e) => setGame({ ...game, level_threshold: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="font-bold uppercase text-xs">Streak gap hours</label>
            <BrutalInput
              type="number"
              value={game.streak_gap_hours || 36}
              onChange={(e) => setGame({ ...game, streak_gap_hours: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="font-bold uppercase text-xs">Wellness score per action</label>
            <BrutalInput
              type="number"
              value={game.wellness_score_increment || 2}
              onChange={(e) => setGame({ ...game, wellness_score_increment: Number(e.target.value) })}
            />
          </div>
        </div>

        <BrutalButton color="black" onClick={saveGame} disabled={savingGame} className="mt-4">
          {savingGame ? "SAVING..." : "SAVE GAMIFICATION"}
        </BrutalButton>

        <hr className="my-5 border-[2px] border-black" />

        <h4 className="font-display font-black text-xl uppercase mb-2">
          Manual Point Adjustment
        </h4>
        <p className="text-xs font-bold uppercase opacity-60 mb-3">
          Add or remove points from an individual employee.
        </p>

        <div className="grid md:grid-cols-3 gap-2">
          <select
            value={adj.user_id}
            onChange={(e) => setAdj({ ...adj, user_id: e.target.value })}
            className="w-full border-[3px] border-black px-3 py-2 font-bold uppercase bg-white"
          >
            <option value="">— pick user —</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name} · {user.points ?? 0}pts
              </option>
            ))}
          </select>

          <BrutalInput
            type="number"
            value={adj.points}
            onChange={(e) => setAdj({ ...adj, points: Number(e.target.value) })}
            placeholder="Points (+/-)"
          />

          <BrutalInput
            value={adj.reason}
            onChange={(e) => setAdj({ ...adj, reason: e.target.value })}
            placeholder="Reason"
          />
        </div>

        <BrutalButton data-testid="award-points" color="pink" onClick={award} className="mt-3">
          AWARD POINTS
        </BrutalButton>

        {log.length > 0 && (
          <div className="mt-5">
            <div className="text-xs font-black uppercase mb-2">Audit Log</div>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {log.slice(0, 10).map((entry) => (
                <div
                  key={entry.id}
                  className="text-xs bg-white border-[2px] border-black p-2 flex justify-between gap-3"
                >
                  <span className="font-bold">
                    {entry.points > 0 ? "+" : ""}{entry.points} {entry.user_id ? "user" : "team"} · {entry.reason}
                  </span>
                  <span className="text-[10px] shrink-0">
                    {new Date(entry.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </BrutalCard>
 
      {/* REWARD EDITOR MODAL */}
      {selectedActivity && rewardDraft && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60"
          onClick={closeRewardEditor}
        >
          <div
            className="bg-white border-[3px] border-[#3F4A3E] shadow-[8px_8px_0_#7FAE62] max-w-2xl w-full max-h-[90vh] rounded-[18px] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 p-5 md:p-6 pb-4 shrink-0 bg-white">
              <div>
                <div className="text-[10px] font-black uppercase opacity-60 mb-1">
                  Admin Reward Configuration
                </div>
                <h3 className="font-display font-black text-2xl uppercase">
                  {REWARD_ACTIVITY_META[selectedActivity].title}
                </h3>
                <p className="text-xs font-bold uppercase opacity-60 mt-1">
                  {REWARD_ACTIVITY_META[selectedActivity].description}
                </p>
              </div>
              <button
                type="button"
                onClick={closeRewardEditor}
                className="border-[3px] border-black bg-white p-2 shadow-brutal-sm"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-5 md:px-6 pb-5">
            <div className="border-[2px] border-[#A9C99A] bg-[#AFCF9D] p-4 mb-5 rounded-[10px]">
              <label className="font-black uppercase text-[10px] block mb-1">
                Admin Reward Goal
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max={REWARD_ACTIVITY_META[selectedActivity].max ?? undefined}
                  step="1"
                  value={rewardDraft.rewardGoal}
                  onChange={(e) => updateDraftGoal(e.target.value)}
                  className="flex-1 border-[3px] border-black px-3 py-3 font-black bg-white"
                />
                <div className="border-[3px] border-black bg-white px-3 py-3 font-black uppercase text-xs">
                  {rewardDraft.unit}
                </div>
              </div>
              <p className="text-[10px] font-bold uppercase mt-2">
                {REWARD_ACTIVITY_META[selectedActivity].max !== null
                  ? `Maximum daily goal: ${REWARD_ACTIVITY_META[selectedActivity].max} ${rewardDraft.unit}`
                  : "No maximum daily goal"}
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <h4 className="font-display font-black text-lg uppercase">XP Milestones</h4>
                  <p className="text-[10px] font-bold uppercase opacity-60">
                    {isCountBasedRewardActivity(selectedActivity)
                      ? `Choose XP for each completed ${rewardDraft.unit}. Thresholds 1 through ${rewardDraft.rewardGoal} are automatic.`
                      : "Award XP at a percentage of the admin reward goal."}
                  </p>
                </div>
                {!isCountBasedRewardActivity(selectedActivity) && (
                  <button
                    type="button"
                    onClick={addDraftMilestone}
                    className="border-[3px] border-black bg-brutal-green px-3 py-2 font-black text-xs uppercase shadow-brutal-sm flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" /> Add
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {rewardDraft.milestones.map((milestone, index) => (
                  <div
                    key={index}
                    className={isCountBasedRewardActivity(selectedActivity)
                      ? "grid grid-cols-[1fr_1.4fr] items-end gap-3 border-[1px] border-[#C9DDBD] p-2 bg-[#F7FAF4] rounded-[8px]"
                      : "grid grid-cols-[1fr_auto_1fr_auto] items-end gap-2 border-[1px] border-[#C9DDBD] p-2 bg-[#F7FAF4] rounded-[8px]"}
                  >
                    <div>
                      <label className="font-black uppercase text-[9px] block mb-1">
                        {isCountBasedRewardActivity(selectedActivity) ? "Threshold" : "Threshold %"}
                      </label>
                      {isCountBasedRewardActivity(selectedActivity) ? (
                        <div className="w-full border-[2px] border-black px-2 py-2 font-black bg-[#EAF3E2]">
                          {milestone.threshold} {rewardDraft.unit}
                        </div>
                      ) : (
                        <>
                          <input
                            type="number"
                            min="1"
                            max="100"
                            value={milestone.threshold}
                            onChange={(e) => updateDraftMilestone(index, "threshold", e.target.value)}
                            className="w-full border-[2px] border-black px-2 py-2 font-black bg-white"
                          />
                        </>
                      )}
                    </div>
                    {!isCountBasedRewardActivity(selectedActivity) && (
                      <span className="font-black text-sm pb-2">%</span>
                    )}
                    <div>
                      <label className="font-black uppercase text-[9px] block mb-1">XP Reward</label>
                      <input
                        type="number"
                        min="0"
                        value={milestone.xp}
                        onChange={(e) => updateDraftMilestone(index, "xp", e.target.value)}
                        className="w-full border-[2px] border-black px-2 py-2 font-black bg-white"
                      />
                    </div>
                    {!isCountBasedRewardActivity(selectedActivity) && (
                      <button
                        type="button"
                        onClick={() => removeDraftMilestone(index)}
                        disabled={rewardDraft.milestones.length === 1}
                        className="border-[2px] border-black bg-brutal-pink p-2 disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Remove milestone"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 p-5 md:px-6 md:py-4 border-t-[2px] border-[#C9DDBD] bg-white shrink-0 sticky bottom-0 z-10">
              <button
                type="button"
                onClick={saveRewardActivity}
                disabled={savingRewards}
                className="flex-1 min-h-[50px] rounded-[12px] border-[2px] border-[#3F4A3E] bg-[#3F4A3E] px-5 py-3 font-black uppercase text-sm tracking-wide shadow-[3px_3px_0_#7FAE62] disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ color: "#FFFFFF" }}
              >
                {savingRewards ? "SAVING..." : "SAVE ACTIVITY"}
              </button>
              <button
                type="button"
                onClick={closeRewardEditor}
                disabled={savingRewards}
                className="flex-1 min-h-[50px] rounded-[12px] border-[2px] border-[#C9DDBD] bg-[#F7FAF4] px-5 py-3 font-black uppercase text-sm tracking-wide text-[#3F4A3E] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* =========================================================
   GAME TEAMS
========================================================= */

const TeamsTab = () => {
 const [teams, setTeams] = useState([]);
 const [users, setUsers] = useState([]);
 const [form, setForm] = useState({ name: "", color: "yellow" });
 const [shuffleN, setShuffleN] = useState(4);
 const [selectedTeam, setSelectedTeam] = useState(null);
 const [memberPicks, setMemberPicks] = useState([]);

 const load = async () => {
 const [t, u] = await Promise.all([api.get("/admin/game-teams"), api.get("/admin/users")]);
 setTeams(t.data); setUsers(u.data);
 };
 useEffect(() => { load(); }, []);

 const create = async () => {
 if (!form.name) { toast.error("Name plz"); return; }
 await api.post("/admin/game-teams", form);
 toast.success(" Team created");
 setForm({ name: "", color: "yellow" });
 load();
 };
 const shuffle = async () => {
 if (!window.confirm(`Auto-shuffle into ${shuffleN} teams? This replaces existing auto-shuffled teams.`)) return;
 await api.post("/admin/game-teams/shuffle", { num_teams: shuffleN, name_prefix: "Squad" });
 toast.success(" Shuffled!");
 load();
 };
 const del = async (id) => {
 if (!window.confirm("Delete team?")) return;
 await api.delete(`/admin/game-teams/${id}`);
 load();
 };
 const openMembers = (t) => { setSelectedTeam(t); setMemberPicks(t.members || []); };
 const saveMembers = async () => {
 await api.put(`/admin/game-teams/${selectedTeam.id}/members`, { user_ids: memberPicks });
 toast.success(" Updated");
 setSelectedTeam(null);
 load();
 };
 const award = async (tid, pts) => {
 const reason = window.prompt(`Reason for ${pts > 0 ? "+" : ""}${pts} pts?`);
 if (!reason) return;
 await api.post("/admin/points/award", { team_id: tid, points: pts, reason });
 toast.success(` ${pts > 0 ? "+" : ""}${pts} team pts`);
 load();
 };

 return (
 <div className="space-y-6" data-testid="teams-tab">
 <div className="grid md:grid-cols-2 gap-6">
 <BrutalCard color="yellow" hover={false}>
 <h3 className="font-display font-black text-2xl uppercase mb-3"> Create Team</h3>
 <BrutalInput data-testid="team-name" placeholder="Team name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mb-2" />
 <select value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="w-full border-[3px] border-black px-3 py-2 font-bold uppercase mb-3 bg-white">
 <option value="yellow">Yellow</option>
 <option value="cyan">Cyan</option>
 <option value="pink">Pink</option>
 <option value="green">Green</option>
 </select>
 <BrutalButton data-testid="team-create" color="green" onClick={create}> CREATE</BrutalButton>
 </BrutalCard>
 <BrutalCard color="pink" hover={false}>
 <h3 className="font-display font-black text-2xl uppercase mb-3 text-white"> Auto-Shuffle</h3>
 <p className="text-white text-sm mb-3 font-bold">Randomly distribute all users into N teams (fair distribution).</p>
 <div className="flex gap-2 items-end">
 <div className="flex-1">
 <label className="font-bold uppercase text-xs text-white">Teams (2-8)</label>
 <BrutalInput type="number" min="2" max="8" value={shuffleN} onChange={(e) => setShuffleN(+e.target.value)} />
 </div>
 <BrutalButton data-testid="team-shuffle" color="black" onClick={shuffle}> SHUFFLE</BrutalButton>
 </div>
 </BrutalCard>
 </div>

 <BrutalCard color="white" hover={false}>
 <h3 className="font-display font-black text-2xl uppercase mb-3"> Teams ({teams.length})</h3>
 <div className="space-y-3">
 {teams.map((t) => (
 <div key={t.id} className={`border-[4px] border-black bg-brutal-${t.color} p-4`}>
 <div className="flex items-center gap-3 mb-2 flex-wrap">
 <div className="font-display font-black text-xl uppercase flex-1">{t.name}</div>
 <div className="font-display font-black text-2xl"> {t.team_points}</div>
 <button onClick={() => award(t.id, 50)} className="bg-white border-[3px] border-black px-2 py-1 font-black text-xs">+50</button>
 <button onClick={() => award(t.id, -10)} className="bg-white border-[3px] border-black px-2 py-1 font-black text-xs">-10</button>
 <button data-testid={`team-members-${t.id}`} onClick={() => openMembers(t)} className="bg-black text-white border-[3px] border-black px-2 py-1 font-black text-xs"> {t.members?.length || 0}</button>
 <button onClick={() => del(t.id)} className="bg-brutal-pink border-[3px] border-black p-1.5"><Trash2 className="w-3 h-3" /></button>
 </div>
 <div className="flex flex-wrap gap-1">
 {(t.member_details || []).map((m) => (
 <span key={m.id} className="bg-white border-[2px] border-black px-1.5 py-0.5 font-black text-[10px]">{m.name}</span>
 ))}
 </div>
 </div>
 ))}
 {teams.length === 0 && <div className="text-sm font-bold uppercase">No teams. Create or shuffle.</div>}
 </div>
 </BrutalCard>

 {selectedTeam && (
 <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setSelectedTeam(null)}>
 <div className="bg-white border-[4px] border-black shadow-brutal-xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
 <h3 className="font-display font-black text-2xl uppercase mb-3">Members of {selectedTeam.name}</h3>
 <div className="grid grid-cols-2 gap-2 mb-4 max-h-96 overflow-y-auto">
 {users.map((u) => (
 <label key={u.id} className="flex items-center gap-2 border-[3px] border-black p-2 cursor-pointer">
 <input
 type="checkbox"
 checked={memberPicks.includes(u.id)}
 onChange={() => setMemberPicks(memberPicks.includes(u.id) ? memberPicks.filter(x => x !== u.id) : [...memberPicks, u.id])}
 className="w-4 h-4"
 />
 <img src={u.avatar} alt="" className="w-7 h-7 border-[2px] border-black" />
 <span className="font-black uppercase text-xs">{u.name}</span>
 </label>
 ))}
 </div>
 <div className="flex gap-2">
 <BrutalButton color="green" onClick={saveMembers}> SAVE</BrutalButton>
 <BrutalButton color="white" onClick={() => setSelectedTeam(null)}>CANCEL</BrutalButton>
 </div>
 </div>
 </div>
 )}
 </div>
 );
};

/* =========================================================
   ANNOUNCEMENTS
========================================================= */

const AnnouncementsTab = () => {
 const [form, setForm] = useState({ title: "", message: "", target: "all", target_user_ids: [], kind: "info" });
 const [users, setUsers] = useState([]);
 const [history, setHistory] = useState([]);

 const load = async () => {
 const [u, h] = await Promise.all([api.get("/admin/users"), api.get("/admin/announcements")]);
 setUsers(u.data); setHistory(h.data);
 };
 useEffect(() => { load(); }, []);

 const send = async () => {
 if (!form.title || !form.message) { toast.error("Title + message needed"); return; }
 if (form.target === "specific" && form.target_user_ids.length === 0) { toast.error("Pick at least 1 user"); return; }
 const body = { ...form, target: form.target === "specific" ? "specific" : "all" };
 await api.post("/admin/announcements", body);
 toast.success(` Sent to ${form.target === "all" ? "everyone" : form.target_user_ids.length + " users"}`);
 setForm({ title: "", message: "", target: "all", target_user_ids: [], kind: "info" });
 load();
 };

 const togglePick = (uid) => {
 setForm({ ...form, target_user_ids: form.target_user_ids.includes(uid) ? form.target_user_ids.filter(x => x !== uid) : [...form.target_user_ids, uid] });
 };

 return (
 <div className="grid lg:grid-cols-2 gap-6" data-testid="announcements-tab">
 <BrutalCard color="pink" hover={false}>
 <h3 className="font-display font-black text-2xl uppercase mb-3 text-white"> Send Announcement</h3>
 <BrutalInput data-testid="ann-title" placeholder="Title (e.g. Team update)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mb-3" />
 <textarea
 data-testid="ann-message"
 placeholder="Message..."
 value={form.message}
 onChange={(e) => setForm({ ...form, message: e.target.value })}
 rows={4}
 className="w-full border-[3px] border-black px-3 py-2 font-medium resize-none mb-3"
 />
 <div className="grid grid-cols-2 gap-2 mb-3">
 <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} className="border-[3px] border-black px-2 py-2 font-bold uppercase bg-white">
 <option value="info">Info</option>
 <option value="alert">Alert</option>
 <option value="party">Party</option>
 </select>
 <select data-testid="ann-target" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} className="border-[3px] border-black px-2 py-2 font-bold uppercase bg-white">
 <option value="all"> Everyone</option>
 <option value="specific"> Specific users</option>
 </select>
 </div>
 {form.target === "specific" && (
 <div className="border-[3px] border-black p-2 mb-3 max-h-40 overflow-y-auto bg-white">
 {users.map(u => (
 <label key={u.id} className="flex items-center gap-2 py-1 cursor-pointer text-black">
 <input type="checkbox" checked={form.target_user_ids.includes(u.id)} onChange={() => togglePick(u.id)} className="w-4 h-4" />
 <span className="font-black text-xs">{u.name}</span>
 </label>
 ))}
 </div>
 )}
 <BrutalButton data-testid="ann-send" color="green" onClick={send} className="w-full"> BLAST</BrutalButton>
 </BrutalCard>

 <BrutalCard color="white" hover={false}>
 <h3 className="font-display font-black text-2xl uppercase mb-3"> History ({history.length})</h3>
 <div className="space-y-2 max-h-[600px] overflow-y-auto">
 {history.map((a) => (
 <div key={a.id} className="border-[3px] border-black p-3 bg-white">
 <div className="flex items-center gap-2 mb-1">
 <span className={`border-[2px] border-black px-1.5 py-0.5 font-black text-[10px] uppercase ${a.kind === "alert" ? "bg-brutal-pink text-white" : a.kind === "party" ? "bg-brutal-yellow" : "bg-brutal-cyan"}`}>{a.kind}</span>
 <span className="font-black text-sm">{a.title}</span>
 <span className="text-[10px] ml-auto font-bold">{a.recipients?.length || 0} ppl · {a.read_by?.length || 0}</span>
 </div>
 <div className="text-sm font-medium">{a.message}</div>
 <div className="text-[10px] font-bold mt-1">{new Date(a.created_at).toLocaleString()}</div>
 </div>
 ))}
 {history.length === 0 && <div className="text-sm font-bold uppercase">No announcements yet.</div>}
 </div>
 </BrutalCard>
 </div>
 );
};

