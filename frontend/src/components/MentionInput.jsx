import React, { useEffect, useRef, useState } from "react";
import { api, resolveAvatar } from "../lib/api";

/**
 * MentionInput — textarea/input that suggests users when typing '@'.
 * Replaces matched '@partial' with '@FullName ' on select.
 */
export const MentionInput = ({
 value,
 onChange,
 placeholder,
 rows = 3,
 testid,
 asInput = false,
 className = "",
}) => {
 const [users, setUsers] = useState([]);
 const [open, setOpen] = useState(false);
 const [matches, setMatches] = useState([]);
 const [highlight, setHighlight] = useState(0);
 const ref = useRef();

 useEffect(() => {
 api.get("/users").then(({ data }) => setUsers(data)).catch(() => {});
 }, []);

 const update = (val) => {
 onChange(val);
 const cursor = ref.current?.selectionStart ?? val.length;
 const upToCursor = val.slice(0, cursor);
 const m = upToCursor.match(/@([\w]*)$/);
 if (m) {
 const partial = m[1].toLowerCase();
 const list = users
 .filter((u) => u.name.toLowerCase().includes(partial))
 .slice(0, 5);
 setMatches(list);
 setOpen(list.length > 0);
 setHighlight(0);
 } else {
 setOpen(false);
 }
 };

 const pick = (u) => {
 const cursor = ref.current?.selectionStart ?? value.length;
 const before = value.slice(0, cursor).replace(/@([\w]*)$/, `@${u.name.replace(/\s/g, "")} `);
 const after = value.slice(cursor);
 onChange(before + after);
 setOpen(false);
 setTimeout(() => ref.current?.focus(), 30);
 };

 const onKey = (e) => {
 if (!open) return;
 if (e.key === "ArrowDown") { e.preventDefault(); setHighlight((h) => (h + 1) % matches.length); }
 if (e.key === "ArrowUp") { e.preventDefault(); setHighlight((h) => (h - 1 + matches.length) % matches.length); }
 if (e.key === "Enter" || e.key === "Tab") {
 if (matches[highlight]) { e.preventDefault(); pick(matches[highlight]); }
 }
 if (e.key === "Escape") setOpen(false);
 };

 return (
 <div className="relative">
 {asInput ? (
 <input
 ref={ref}
 data-testid={testid}
 value={value}
 onChange={(e) => update(e.target.value)}
 onKeyDown={onKey}
 placeholder={placeholder}
 className={`w-full border-[3px] border-black px-4 py-3 bg-white focus:outline-none focus:ring-4 focus:ring-brutal-cyan font-medium rounded-[2px] ${className}`}
 />
 ) : (
 <textarea
 ref={ref}
 data-testid={testid}
 value={value}
 onChange={(e) => update(e.target.value)}
 onKeyDown={onKey}
 rows={rows}
 placeholder={placeholder}
 className={`w-full border-[3px] border-black px-4 py-3 bg-white focus:outline-none focus:ring-4 focus:ring-brutal-cyan font-medium rounded-[2px] resize-none ${className}`}
 />
 )}
 {open && (
 <div
 data-testid="mention-suggestions"
 className="absolute z-30 left-0 right-0 mt-1 bg-white border-[3px] border-black shadow-brutal max-h-56 overflow-y-auto"
 >
 {matches.map((u, i) => (
 <button
 key={u.id}
 type="button"
 data-testid={`mention-${u.id}`}
 onMouseDown={(e) => { e.preventDefault(); pick(u); }}
 className={`w-full text-left flex items-center gap-2 px-3 py-2 ${highlight === i ? "bg-brutal-yellow" : "bg-white"}`}
 >
 <img src={resolveAvatar(u.avatar)} alt="" className="w-6 h-6 border-[2px] border-black" />
 <span className="font-black uppercase text-sm">@{u.name}</span>
 <span className="text-xs ml-auto font-bold">{u.department}</span>
 </button>
 ))}
 </div>
 )}
 </div>
 );
};

export const renderMentions = (text) => {
 if (!text) return null;
 const parts = text.split(/(@\w+)/g);
 return parts.map((p, i) =>
 p.startsWith("@") ? (
 <span key={i} className="mention-pill">{p}</span>
 ) : (
 <span key={i}>{p}</span>
 )
 );
};
