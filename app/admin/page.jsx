"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "../../lib/supabase-browser.js";

function usernameEmail(name) {
  const normalized = name.trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,32}$/.test(normalized)) {
    throw new Error("Use 3–32 characters: letters, numbers, dot, underscore or hyphen.");
  }
  return normalized + "@admin.lumi.local";
}

export default function AdminLoginPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const email = usernameEmail(name);
      const supabase = getSupabaseBrowserClient();
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw new Error("Name or password is incorrect.");
      const { data: allowed, error: roleError } = await supabase.rpc("is_lumi_admin");
      if (roleError || allowed !== true) {
        await supabase.auth.signOut();
        throw new Error("This account does not have Lumi administrator access.");
      }
      router.replace("/admin/dashboard");
      router.refresh();
    } catch (err) {
      setError(err.message || "Unable to sign in. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{minHeight:"100vh",display:"grid",placeItems:"center",padding:24,background:"linear-gradient(145deg,#fff5fa,#fce3ef 55%,#fff9fc)",fontFamily:"Arial,sans-serif"}}>
      <section style={{width:"min(100%,420px)",padding:32,borderRadius:28,background:"#fff",boxShadow:"0 18px 60px #b94c7a22",border:"1px solid #f7d7e5"}}>
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{fontSize:38,color:"#d94b8a"}}>✿</div>
          <div style={{fontSize:30,fontWeight:800,letterSpacing:".02em",color:"#a92f69"}}>lumi <span style={{fontSize:19}}>ሉሚ</span></div>
          <p style={{margin:"8px 0 0",color:"#8b6578"}}>Administrator sign in</p>
        </div>
        <form onSubmit={submit}>
          <label htmlFor="admin-name" style={{display:"block",fontSize:14,fontWeight:700,color:"#68475a",marginBottom:8}}>Admin name</label>
          <input id="admin-name" autoComplete="username" required minLength={3} maxLength={32} value={name} onChange={e=>setName(e.target.value)} placeholder="Enter your admin name" style={{width:"100%",boxSizing:"border-box",padding:"15px 16px",border:"1px solid #edc9da",borderRadius:14,fontSize:16,marginBottom:18,outlineColor:"#d94b8a"}} />
          <label htmlFor="admin-password" style={{display:"block",fontSize:14,fontWeight:700,color:"#68475a",marginBottom:8}}>Password</label>
          <input id="admin-password" type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter your password" style={{width:"100%",boxSizing:"border-box",padding:"15px 16px",border:"1px solid #edc9da",borderRadius:14,fontSize:16,marginBottom:18,outlineColor:"#d94b8a"}} />
          {error && <p role="alert" style={{color:"#b4235a",fontSize:14,margin:"0 0 14px"}}>{error}</p>}
          <button disabled={busy} type="submit" style={{width:"100%",padding:16,border:0,borderRadius:14,background:"linear-gradient(100deg,#d94b8a,#f18bb5)",color:"#fff",fontWeight:800,fontSize:16,opacity:busy?.7:1,cursor:busy?"wait":"pointer"}}>{busy?"Signing in…":"Sign in"}</button>
        </form>
        <p style={{fontSize:12,lineHeight:1.5,color:"#987b8b",textAlign:"center",margin:"18px 0 0"}}>Authorized Lumi administrators only.</p>
      </section>
    </main>
  );
}
