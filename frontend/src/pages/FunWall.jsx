import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { api } from "../lib/api";
import { BrutalButton, BrutalCard, BrutalInput } from "../components/brutal";
import { Heart, MessageCircle, ImagePlus } from "lucide-react";
import { useAuthStore } from "../store";
import { toast } from "sonner";

const REACTS = ["😂", "❤️", "👏", "🔥"];

export default function FunWall() {
  const { user } = useAuthStore();
  const [posts, setPosts] = useState([]);
  const [content, setContent] = useState("");
  const [image, setImage] = useState("");
  const [commentText, setCommentText] = useState({});
  const fileRef = useRef();

  const load = async () => {
    const { data } = await api.get("/posts");
    setPosts(data);
  };

  useEffect(() => { load(); }, []);

  const onFile = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) { toast.error("Keep it under 2MB"); return; }
    const r = new FileReader();
    r.onload = () => setImage(r.result);
    r.readAsDataURL(f);
  };

  const post = async () => {
    if (!content.trim()) { toast.error("Say something, anything"); return; }
    await api.post("/posts", { content, image });
    toast.success("📣 Posted");
    setContent(""); setImage("");
    if (fileRef.current) fileRef.current.value = "";
    load();
  };

  const like = async (id) => {
    await api.post(`/posts/${id}/like`);
    load();
  };

  const react = async (id, emoji) => {
    await api.post(`/posts/${id}/react`, { emoji });
    load();
  };

  const comment = async (id) => {
    const txt = (commentText[id] || "").trim();
    if (!txt) return;
    await api.post(`/posts/${id}/comment`, { content: txt });
    setCommentText({ ...commentText, [id]: "" });
    load();
  };

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-8">
      <motion.div
        initial={{ rotate: 2, opacity: 0 }} animate={{ rotate: 1, opacity: 1 }}
        className="bg-brutal-green border-[4px] border-black shadow-brutal-lg p-6 mb-6 inline-block"
      >
        <h1 className="font-display font-black text-5xl uppercase leading-none">🎨 FUN WALL</h1>
        <p className="text-xs uppercase tracking-widest mt-2">memes. rants. vibes.</p>
      </motion.div>

      <BrutalCard color="white" className="mb-6" tilt={0} hover={false}>
        <textarea
          data-testid="post-content"
          placeholder="Got something to say, legend?"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
          className="w-full border-[3px] border-black px-4 py-3 bg-white focus:outline-none focus:ring-4 focus:ring-brutal-cyan font-medium rounded-[2px] resize-none"
        />
        {image && (
          <div className="mt-3 relative inline-block">
            <img src={image} alt="preview" className="max-h-40 border-[3px] border-black" />
            <button
              onClick={() => { setImage(""); if (fileRef.current) fileRef.current.value = ""; }}
              className="absolute -top-2 -right-2 bg-brutal-pink border-[3px] border-black w-7 h-7 font-black"
            >×</button>
          </div>
        )}
        <div className="flex gap-2 mt-3 flex-wrap">
          <label data-testid="post-image-btn" className="cursor-pointer bg-brutal-cyan border-[3px] border-black px-4 py-2 font-black uppercase text-xs shadow-brutal-sm inline-flex items-center gap-1">
            <ImagePlus className="w-4 h-4" /> ADD IMAGE
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
          </label>
          <BrutalButton data-testid="post-submit" color="yellow" onClick={post}>
            🚀 YEET IT
          </BrutalButton>
        </div>
      </BrutalCard>

      <div className="space-y-6" data-testid="posts-feed">
        {posts.map((p, i) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 20, rotate: i % 2 === 0 ? -1 : 1 }}
            animate={{ opacity: 1, y: 0, rotate: i % 2 === 0 ? -0.5 : 0.5 }}
            transition={{ delay: i * 0.05 }}
            data-testid={`post-${p.id}`}
            className="bg-white border-[4px] border-black shadow-brutal-lg p-5 rounded-[4px]"
          >
            <div className="flex items-center gap-3 mb-3">
              <img src={p.user_avatar} alt={p.user_name} className="w-10 h-10 border-[3px] border-black bg-brutal-yellow" />
              <div>
                <div className="font-black uppercase">{p.user_name}</div>
                <div className="text-[10px] font-bold uppercase text-gray-600">{new Date(p.created_at).toLocaleString()}</div>
              </div>
            </div>
            <div className="font-semibold text-lg mb-3">{p.content}</div>
            {p.image && <img src={p.image} alt="" className="w-full border-[3px] border-black rounded-[2px] mb-3" />}

            <div className="flex gap-2 items-center flex-wrap">
              <motion.button
                whileTap={{ scale: 0.9 }}
                data-testid={`like-${p.id}`}
                onClick={() => like(p.id)}
                className={`flex items-center gap-1 border-[3px] border-black px-3 py-1.5 shadow-brutal-sm font-black text-xs uppercase ${p.likes?.includes(user?.id) ? "bg-brutal-pink text-white" : "bg-white"}`}
              >
                <Heart className="w-4 h-4" fill={p.likes?.includes(user?.id) ? "white" : "none"} /> {p.likes?.length || 0}
              </motion.button>
              <div className="flex items-center gap-1 font-black text-xs uppercase">
                <MessageCircle className="w-4 h-4" /> {p.comments?.length || 0}
              </div>
              <div className="flex gap-1.5 ml-1" data-testid={`reactions-${p.id}`}>
                {REACTS.map((e) => {
                  const arr = p.reactions?.[e] || [];
                  const mine = arr.includes(user?.id);
                  return (
                    <button
                      key={e}
                      data-testid={`react-${p.id}-${e}`}
                      onClick={() => react(p.id, e)}
                      className={`border-[2px] border-black px-2 py-1 shadow-brutal-sm font-black text-xs ${mine ? "bg-brutal-yellow" : "bg-white"}`}
                    >
                      {e}{arr.length > 0 ? ` ${arr.length}` : ""}
                    </button>
                  );
                })}
              </div>
            </div>

            {p.comments?.length > 0 && (
              <div className="mt-3 space-y-2 border-t-[3px] border-black pt-3">
                {p.comments.map((c) => (
                  <div key={c.id} className="flex items-start gap-2">
                    <img src={c.user_avatar} alt={c.user_name} className="w-7 h-7 border-[2px] border-black bg-brutal-cyan" />
                    <div className="flex-1 bg-brutal-yellow/40 border-[2px] border-black px-2 py-1 rounded-[2px]">
                      <div className="font-black text-xs uppercase">{c.user_name}</div>
                      <div className="text-sm font-medium">{c.content}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-3 flex gap-2">
              <BrutalInput
                data-testid={`comment-input-${p.id}`}
                placeholder="Drop a comment..."
                value={commentText[p.id] || ""}
                onChange={(e) => setCommentText({ ...commentText, [p.id]: e.target.value })}
                onKeyDown={(e) => { if (e.key === "Enter") comment(p.id); }}
              />
              <BrutalButton data-testid={`comment-submit-${p.id}`} color="cyan" size="sm" onClick={() => comment(p.id)}>
                POST
              </BrutalButton>
            </div>
          </motion.div>
        ))}
        {posts.length === 0 && (
          <div className="text-center py-10 font-bold uppercase">No posts yet. Be the first legend.</div>
        )}
      </div>
    </div>
  );
}
