import React, { useState } from "react";
import { motion } from "framer-motion";
import { Shield, Building2, Globe, Clock, Save, Check, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const OrganizationSettings = () => {
  const navigate = useNavigate();

  const initialOrg = {
    name: "Wellness Garden Inc.",
    timezone: "UTC (Coordinated Universal Time)",
    programStatus: "Active",
    supportEmail: "hr@wellnessgarden.com",
  };

  const [org, setOrg] = useState(initialOrg);
  const [hasChanges, setHasChanges] = useState(false);

  const handleChange = (field, value) => {
    setOrg((prev) => {
      const updated = { ...prev, [field]: value };
      setHasChanges(JSON.stringify(updated) !== JSON.stringify(initialOrg));
      return updated;
    });
  };

  const handleSave = (e) => {
    e.preventDefault();
    console.log("Saving organization settings:", org);
    toast.success("Organization settings updated successfully!");
    setHasChanges(false);
  };

  return (
    <main className="max-w-3xl mx-auto px-4 md:px-6 py-8 md:py-12">
      {/* BACK BUTTON */}
      <button
        type="button"
        onClick={() => navigate("/settings")}
        className="flex items-center gap-2 text-xs font-black uppercase tracking-widest opacity-60 hover:opacity-100 mb-6 transition-opacity"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Settings
      </button>

      {/* HEADER */}
      <div className="flex items-center gap-4 mb-8">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
          style={{
            background: "var(--cozy-primary)",
            color: "white",
          }}
        >
          <Shield className="w-7 h-7" />
        </div>

        <div>
          <h1 className="font-display font-black text-2xl md:text-3xl text-cozy-text">
            Organization Settings
          </h1>
          <p className="text-xs md:text-sm opacity-60 mt-1 text-cozy-text">
            Manage company-wide parameters, program branding, and operational time zones.
          </p>
        </div>
      </div>

      {/* FORM */}
      <form onSubmit={handleSave} className="space-y-6">
        
        {/* ORGANIZATION DETAILS */}
        <div className="bg-cozy-surface p-6 shadow-cozy border border-cozy-border rounded-[20px] space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-cozy-text">Company Profile</h2>
              <p className="text-xs opacity-60">Primary organization identity details</p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-wider opacity-70 mb-2">
              Organization Name
            </label>
            <input
              type="text"
              value={org.name}
              onChange={(e) => handleChange("name", e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-cozy-bg border border-cozy-border font-bold text-sm text-cozy-text focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-wider opacity-70 mb-2">
              HR Support Email
            </label>
            <input
              type="email"
              value={org.supportEmail}
              onChange={(e) => handleChange("supportEmail", e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-cozy-bg border border-cozy-border font-bold text-sm text-cozy-text focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>
        </div>

        {/* REGIONAL & PROGRAM DEFAULTS */}
        <div className="bg-cozy-surface p-6 shadow-cozy border border-cozy-border rounded-[20px] space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-cozy-text">Localization & Operations</h2>
              <p className="text-xs opacity-60">Time zone and global program toggle</p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-wider opacity-70 mb-2">
              Default Timezone
            </label>
            <input
              type="text"
              value={org.timezone}
              onChange={(e) => handleChange("timezone", e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-cozy-bg border border-cozy-border font-bold text-sm text-cozy-text focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-wider opacity-70 mb-2">
              Wellness Program Status
            </label>
            <select
              value={org.programStatus}
              onChange={(e) => handleChange("programStatus", e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-cozy-bg border border-cozy-border font-bold text-sm text-cozy-text focus:outline-none focus:ring-2 focus:ring-black"
            >
              <option value="Active">Active</option>
              <option value="Paused">Paused</option>
              <option value="Maintenance">Maintenance Mode</option>
            </select>
          </div>
        </div>

        {/* SUBMIT BUTTON */}
        <div className="flex justify-end">
          <motion.button
            type="submit"
            disabled={!hasChanges}
            whileHover={hasChanges ? { scale: 1.02 } : {}}
            whileTap={hasChanges ? { scale: 0.98 } : {}}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all ${
              hasChanges
                ? "bg-black text-white shadow-brutal cursor-pointer"
                : "bg-cozy-surface text-cozy-text opacity-50 border border-cozy-border cursor-not-allowed shadow-none"
            }`}
          >
            {hasChanges ? (
              <>
                <Save className="w-4 h-4" />
                Save Organization Settings
              </>
            ) : (
              <>
                <Check className="w-4 h-4 text-emerald-600" />
                Saved
              </>
            )}
          </motion.button>
        </div>

      </form>
    </main>
  );
};

export default OrganizationSettings;