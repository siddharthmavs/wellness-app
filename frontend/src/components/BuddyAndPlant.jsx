import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "../lib/api";
import { BrutalButton, BrutalCard } from "./brutal";
import { toast } from "sonner";

export const BuddyCard = () => {
 const [data, setData] = useState(null);
 const [loading, setLoading] = useState(false);

 const load = async () => {
 const { data } = await api.get("/buddy/me");
 setData(data);
 };
 useEffect(() => { load(); }, []);

 const pair = async () => {
 setLoading(true);
 try {
 const { data } = await api.post("/buddy/pair");
 setData(data);
 toast.success(" Buddy assigned!");
 } catch { toast.error("No buddies available"); }
 finally { setLoading(false); }
 };

 const checkin = async () => {
 await api.post("/buddy/checkin");
 toast.success(" Checked in (+10 pts)");
 load();
 };

 return (
 <BrutalCard color="white" hover={false} data-testid="buddy-card">
 <h3 className="font-display font-black text-xl uppercase mb-3"> Buddy System</h3>
 {data?.buddy ? (
 <div>
 <div className="flex items-center gap-3 border-[3px] border-black p-3 bg-brutal-yellow/40">
 <img src={data.buddy.avatar} className="w-12 h-12 border-[2px] border-black" alt="" />
 <div>
 <div className="font-black uppercase">{data.buddy.name}</div>
 <div className="text-xs font-bold">{data.buddy.department}</div>
 </div>
 </div>
 <div className="text-xs font-bold mt-2">Check-ins: {data.pairing?.checkins?.length || 0}</div>
 <BrutalButton data-testid="buddy-checkin" color="green" onClick={checkin} className="mt-3"> WEEKLY CHECK-IN</BrutalButton>
 </div>
 ) : (
 <div>
 <p className="text-sm font-medium mb-3">No buddy yet. Get matched with a colleague for a 30-day journey.</p>
 <BrutalButton data-testid="buddy-pair" color="cyan" onClick={pair} disabled={loading}>
 {loading ? "Matching..." : " GET PAIRED"}
 </BrutalButton>
 </div>
 )}
 </BrutalCard>
 );
};

export const PlantCard = () => {
 const [plant, setPlant] = useState(null);
 const [board, setBoard] = useState([]);

 const load = async () => {
 const [me, lb] = await Promise.all([api.get("/plants/me"), api.get("/plants/leaderboard")]);
 setPlant(me.data);
 setBoard(lb.data.slice(0, 5));
 };
 useEffect(() => { load(); }, []);

 const optin = async () => {
 await api.post("/plants/optin");
 toast.success(" Welcome to plant club");
 load();
 };

 const checkin = async () => {
 const { data } = await api.post("/plants/checkin");
 if (data.already) toast("Already checked in today");
 else toast.success(` +3 pts · ${data.streak}d streak`);
 load();
 };

 return (
 <BrutalCard color="white" hover={false} data-testid="plant-card">
 <h3 className="font-display font-black text-xl uppercase mb-3"> Desk Plant Challenge</h3>
 {plant ? (
 <div>
 <div className="flex items-center gap-2 mb-3">
 <div className="bg-brutal-green border-[3px] border-black px-3 py-1 font-black text-sm"> {plant.streak}d streak</div>
 <div className="bg-brutal-yellow border-[3px] border-black px-3 py-1 font-black text-sm">{plant.checkins?.length || 0} check-ins</div>
 </div>
 <BrutalButton data-testid="plant-checkin" color="green" onClick={checkin}> STILL ALIVE!</BrutalButton>
 {board.length > 0 && (
 <div className="mt-4 border-t-[3px] border-black pt-3">
 <div className="text-xs font-black uppercase mb-2"> Plant Champs</div>
 {board.map((p, i) => (
 <div key={p.id} className="flex items-center gap-2 text-sm">
 <span className="font-black w-5">#{i + 1}</span>
 <img src={p.user_avatar} className="w-6 h-6 border-[2px] border-black" alt="" />
 <span className="font-bold flex-1 truncate">{p.user_name}</span>
 <span className="font-black"> {p.streak}</span>
 </div>
 ))}
 </div>
 )}
 </div>
 ) : (
 <div>
 <p className="text-sm font-medium mb-3">Keep a real (or virtual) desk plant alive. Check in daily for points.</p>
 <BrutalButton data-testid="plant-optin" color="green" onClick={optin}> OPT IN</BrutalButton>
 </div>
 )}
 </BrutalCard>
 );
};
