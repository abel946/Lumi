"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "../../../lib/supabase-browser.js";

const card = { background:"#fff", border:"1px solid #f3d7e4", borderRadius:22, padding:22, boxShadow:"0 10px 28px #9f3d6810" };
const label = { color:"#987184", fontSize:13, fontWeight:700, marginBottom:9 };
const number = { color:"#922c60", fontSize:30, fontWeight:850, letterSpacing:"-.04em" };

export default function LumiAdminDashboard() {
  const router = useRouter();
  const [supabase,setSupabase] = useState(null);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState("");
  const [stats,setStats] = useState({orders:0,pendingOrders:0,products:0,pendingSubmissions:0,ads:0,revenue:0});
  const [recent,setRecent] = useState([]);

  const load = useCallback(async (client) => {
    setLoading(true); setError("");
    try {
      const [orders,products,submissions,ads,recentOrders] = await Promise.all([
        client.from("shop_orders").select("id,order_status,total_amount", {count:"exact"}),
        client.from("shop_products").select("id,is_active", {count:"exact"}),
        client.from("shop_product_submissions").select("id,status", {count:"exact"}),
        client.from("shop_advertisements").select("id,is_active", {count:"exact"}),
        client.from("shop_orders").select("id,order_number,delivery_name,total_amount,currency,order_status,created_at").order("created_at",{ascending:false}).limit(6)
      ]);
      const failure = [orders,products,submissions,ads,recentOrders].find(x=>x.error);
      if (failure) throw failure.error;
      const orderRows = orders.data || [];
      setStats({
        orders: orders.count ?? orderRows.length,
        pendingOrders: orderRows.filter(x=>["pending","confirmed","processing","out_for_delivery"].includes(x.order_status)).length,
        products: products.count ?? products.data?.length ?? 0,
        pendingSubmissions: (submissions.data||[]).filter(x=>x.status==="pending").length,
        ads: (ads.data||[]).filter(x=>x.is_active).length,
        revenue: orderRows.filter(x=>x.order_status!=="cancelled").reduce((sum,x)=>sum+Number(x.total_amount||0),0)
      });
      setRecent(recentOrders.data||[]);
    } catch(e) { setError(e.message || "Could not load the Lumi platform overview."); }
    finally { setLoading(false); }
  },[]);

  useEffect(()=>{
    let alive=true;
    try {
      const client=getSupabaseBrowserClient();
      setSupabase(client);
      (async()=>{
        const {data:{session}}=await client.auth.getSession();
        if(!session){router.replace("/admin");return;}
        const {data:allowed,error:roleError}=await client.rpc("is_lumi_admin");
        if(roleError||allowed!==true){await client.auth.signOut();router.replace("/admin");return;}
        if(alive) await load(client);
      })();
    } catch(e) { setError(e.message||"Lumi database connection is unavailable."); setLoading(false); }
    return ()=>{alive=false;};
  },[router,load]);

  async function logout(){ if(supabase) await supabase.auth.signOut(); router.replace("/admin"); }

  return <main style={{minHeight:"100vh",background:"linear-gradient(145deg,#fff7fb,#fff 52%,#fff3f8)",padding:"22px clamp(14px,4vw,48px)",fontFamily:"Arial,sans-serif",color:"#57364a"}}>
    <header style={{maxWidth:1180,margin:"0 auto 26px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:16,flexWrap:"wrap"}}>
      <div><div style={{fontSize:28,fontWeight:900,color:"#a92f69"}}>✿ lumi <span style={{fontSize:17}}>ሉሚ</span></div><div style={{color:"#987184",marginTop:5}}>CEO control centre · Platform overview</div></div>
      <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
        <button onClick={()=>load(supabase)} disabled={!supabase||loading} style={buttonStyle(false)}>{loading?"Refreshing…":"Refresh data"}</button>
        <button onClick={logout} style={buttonStyle(true)}>Sign out</button>
      </div>
    </header>
    <section style={{maxWidth:1180,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"end",justifyContent:"space-between",gap:12,marginBottom:18,flexWrap:"wrap"}}>
        <div><h1 style={{fontSize:26,margin:"0 0 6px",color:"#743052"}}>Platform dashboard</h1><p style={{margin:0,color:"#987184"}}>A single place to monitor Lumi marketplace operations and open each management area.</p></div>
        <a href="/admin/shop" style={{...buttonStyle(false),textDecoration:"none",display:"inline-flex",alignItems:"center"}}>Open shop management →</a>
      </div>
      {error&&<div role="alert" style={{padding:14,background:"#fff0f2",border:"1px solid #f5c3d0",borderRadius:14,color:"#a52650",marginBottom:18}}>{error}</div>}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:14,marginBottom:24}}>
        <Stat title="All orders" value={stats.orders} detail="Orders placed in Lumi"/>
        <Stat title="Active fulfilment" value={stats.pendingOrders} detail="Not yet delivered or cancelled"/>
        <Stat title="Shop products" value={stats.products} detail="Product listings"/>
        <Stat title="Seller reviews" value={stats.pendingSubmissions} detail="Waiting for CEO review"/>
        <Stat title="Live advertisements" value={stats.ads} detail="Currently active promotions"/>
        <Stat title="Order value" value={stats.revenue.toLocaleString("en-ET",{maximumFractionDigits:0})+" ETB"} detail="Non-cancelled order totals"/>
      </div>
      <h2 style={{fontSize:19,color:"#743052",margin:"0 0 14px"}}>Platform management</h2>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(230px,1fr))",gap:14,marginBottom:26}}>
        <ManagementCard title="Customer orders" description="Review buyer details, items, payment status and delivery progress." href="/admin/shop" action="Manage orders"/>
        <ManagementCard title="Seller applications" description="Review seller product submissions and approve or reject listings." href="/admin/shop" action="Review submissions"/>
        <ManagementCard title="Product catalogue" description="Manage the marketplace publishing workflow and approved listings." href="/admin/shop" action="Open product management"/>
        <ManagementCard title="Delivery settings" description="Configure delivery areas, cities and delivery fees." href="/admin/shop" action="Manage delivery"/>
        <ManagementCard title="Advertisements" description="Upload, activate, pause and remove customer-screen promotions." href="/admin/shop" action="Manage advertisements"/>
        <ManagementCard title="Shop settings" description="Set platform commission and default delivery fee." href="/admin/shop" action="Configure shop"/>
      </div>
      <section style={card}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,marginBottom:14,flexWrap:"wrap"}}>
          <div><h2 style={{fontSize:19,color:"#743052",margin:"0 0 5px"}}>Latest orders</h2><p style={{margin:0,color:"#987184",fontSize:13}}>Most recent customer purchases</p></div>
          <a href="/admin/shop" style={{color:"#a92f69",fontWeight:800,textDecoration:"none"}}>View all →</a>
        </div>
        {loading?<p style={{color:"#987184"}}>Loading platform data…</p>:recent.length===0?<p style={{color:"#987184"}}>No orders have been placed yet.</p>:<div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:14,minWidth:560}}><thead><tr>{["Order","Customer","Date","Amount","Status"].map(x=><th key={x} style={{textAlign:"left",padding:"11px 9px",color:"#987184",borderBottom:"1px solid #f2dce6"}}>{x}</th>)}</tr></thead><tbody>{recent.map(o=><tr key={o.id}>{[o.order_number||o.id.slice(0,8),o.delivery_name||"Customer",new Date(o.created_at).toLocaleDateString(),Number(o.total_amount||0).toLocaleString()+" "+(o.currency||"ETB"),String(o.order_status||"").replaceAll("_"," ")].map((v,i)=><td key={i} style={{padding:"13px 9px",borderBottom:"1px solid #faedf3",color:"#69465a"}}>{v}</td>)}</tr>)}</tbody></table></div>}
      </section>
      <footer style={{textAlign:"center",fontSize:12,color:"#ad8b9d",padding:"28px 0 12px"}}>Lumi CEO administration · Authorized access only</footer>
    </section>
  </main>;
}

function Stat({title,value,detail}){return <article style={card}><div style={label}>{title}</div><div style={number}>{value}</div><div style={{fontSize:12,color:"#ad8b9d",marginTop:7}}>{detail}</div></article>;}
function ManagementCard({title,description,href,action}){return <article style={{...card,display:"flex",flexDirection:"column",alignItems:"flex-start"}}><h3 style={{margin:"0 0 8px",fontSize:17,color:"#87375f"}}>{title}</h3><p style={{margin:"0 0 18px",lineHeight:1.55,fontSize:13,color:"#987184",flex:1}}>{description}</p><a href={href} style={{color:"#a92f69",fontWeight:800,fontSize:13,textDecoration:"none"}}>{action} →</a></article>;}
function buttonStyle(dark){return {border:dark?"1px solid #d9a1bc":"1px solid #e9c7d8",borderRadius:13,padding:"11px 16px",background:dark?"#fff":"linear-gradient(100deg,#d94b8a,#ef8db6)",color:dark?"#9b3266":"#fff",fontWeight:800,cursor:"pointer"};}
