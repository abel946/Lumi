"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "../../../lib/supabase-browser.js";

const ORDER_STATES = ["pending", "confirmed", "processing", "out_for_delivery", "delivered", "cancelled"];
const money = (value, currency = "ETB") => new Intl.NumberFormat("en-ET", { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(value || 0));
const pretty = value => String(value || "").replaceAll("_", " ");

export default function LumiShopAdmin() {
  const router = useRouter();
  const [supabase] = useState(() => getSupabaseBrowserClient());
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState("orders");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submissions, setSubmissions] = useState([]);
  const [orders, setOrders] = useState([]);
  const [zones, setZones] = useState([]);
  const [settings, setSettings] = useState({ commission_rate: 10, default_delivery_fee: 0, currency: "ETB" });
  const [zoneForm, setZoneForm] = useState({ region: "", city: "", fee: "" });
  const [reviewNotes, setReviewNotes] = useState({});

  const load = useCallback(async () => {
    setBusy(true); setError("");
    try {
      const [{ data: pending, error: pErr }, { data: orderRows, error: oErr }, { data: zoneRows, error: zErr }, { data: settingRow, error: sErr }] = await Promise.all([
        supabase.from("shop_product_submissions").select("*").order("created_at", { ascending: false }),
        supabase.from("shop_orders").select("*,shop_order_items(id,product_name,quantity,unit_price,line_total)").order("created_at", { ascending: false }),
        supabase.from("delivery_zones").select("*").order("region").order("city"),
        supabase.from("shop_settings").select("commission_rate,default_delivery_fee,currency").eq("id", true).maybeSingle()
      ]);
      if (pErr) throw pErr; if (oErr) throw oErr; if (zErr) throw zErr; if (sErr) throw sErr;
      const decorated = await Promise.all((pending || []).map(async row => {
        const urls = await Promise.all((row.image_paths || []).map(async path => {
          const { data } = await supabase.storage.from("lumi-product-submissions").createSignedUrl(path, 3600);
          return data?.signedUrl || "";
        }));
        return { ...row, previewUrls: urls.filter(Boolean) };
      }));
      setSubmissions(decorated); setOrders(orderRows || []); setZones(zoneRows || []);
      if (settingRow) setSettings(settingRow);
    } catch (e) { setError(e.message || "Could not load shop management data."); }
    finally { setBusy(false); setReady(true); }
  }, [supabase]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { router.replace("/admin"); return; }
        const { data: allowed, error: roleError } = await supabase.rpc("is_lumi_admin");
        if (roleError || allowed !== true) { await supabase.auth.signOut(); router.replace("/admin"); return; }
        if (alive) await load();
      } catch { router.replace("/admin"); }
    })();
    return () => { alive = false; };
  }, [supabase, router, load]);

  async function reviewSubmission(row, approve) {
    setBusy(true); setError(""); setMessage("");
    try {
      const note = (reviewNotes[row.id] || "").trim() || null;
      if (approve) {
        const { error: productError } = await supabase.from("shop_products").insert({
          category_id: row.category_id, name: row.product_name, description: row.description,
          price: row.price, currency: row.currency || "ETB", stock_quantity: row.stock_quantity,
          image_urls: [], is_active: true
        });
        if (productError) throw productError;
      }
      const { data: { user } } = await supabase.auth.getUser();
      const { error: updateError } = await supabase.from("shop_product_submissions").update({
        status: approve ? "approved" : "rejected", admin_note: note,
        reviewed_by: user?.id || null, reviewed_at: new Date().toISOString()
      }).eq("id", row.id);
      if (updateError) throw updateError;
      setMessage(approve ? "Product approved and published. Add its photos in the product manager when available." : "Submission rejected.");
      await load();
    } catch (e) { setError(e.message || "Could not review this submission."); }
    finally { setBusy(false); }
  }

  async function updateOrder(id, order_status) {
    setBusy(true); setError(""); setMessage("");
    try {
      const { error: updateError } = await supabase.from("shop_orders").update({ order_status, updated_at: new Date().toISOString() }).eq("id", id);
      if (updateError) throw updateError;
      setMessage("Order status updated."); await load();
    } catch (e) { setError(e.message || "Could not update order."); }
    finally { setBusy(false); }
  }

  async function saveSettings(event) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const commission = Number(settings.commission_rate), fee = Number(settings.default_delivery_fee);
      if (!Number.isFinite(commission) || commission < 0 || commission > 100 || !Number.isFinite(fee) || fee < 0) throw new Error("Enter a commission between 0 and 100 and a non-negative delivery fee.");
      const { error: updateError } = await supabase.from("shop_settings").update({ commission_rate: commission, default_delivery_fee: fee, currency: "ETB", updated_at: new Date().toISOString() }).eq("id", true);
      if (updateError) throw updateError;
      setMessage("Shop settings saved."); await load();
    } catch (e) { setError(e.message || "Could not save settings."); }
    finally { setBusy(false); }
  }

  async function addZone(event) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      if (!zoneForm.region.trim() || !zoneForm.city.trim() || Number(zoneForm.fee) < 0 || zoneForm.fee === "") throw new Error("Enter a region, city and valid delivery fee.");
      const { error: insertError } = await supabase.from("delivery_zones").insert({ region: zoneForm.region.trim(), city: zoneForm.city.trim(), fee: Number(zoneForm.fee), currency: "ETB", is_active: true });
      if (insertError) throw insertError;
      setZoneForm({ region: "", city: "", fee: "" }); setMessage("Delivery area added."); await load();
    } catch (e) { setError(e.message || "Could not add delivery area."); }
    finally { setBusy(false); }
  }

  async function toggleZone(zone) {
    setBusy(true); setError(""); setMessage("");
    try {
      const { error: updateError } = await supabase.from("delivery_zones").update({ is_active: !zone.is_active }).eq("id", zone.id);
      if (updateError) throw updateError;
      setMessage("Delivery area updated."); await load();
    } catch (e) { setError(e.message || "Could not update delivery area."); }
    finally { setBusy(false); }
  }

  async function logout() { await supabase.auth.signOut(); router.replace("/admin"); }

  if (!ready) return <main className="lumi-admin"><div className="admin-card">Loading Lumi shop administration…</div></main>;

  return <main className="lumi-admin">
    <header className="admin-header"><div><div className="admin-brand">✿ lumi <span>ሉሚ</span></div><p>Women’s Shop · Administration</p></div><button className="admin-quiet" onClick={logout}>Sign out</button></header>
    <nav className="admin-tabs">
      {[["orders","Orders"],["submissions","Seller review"],["delivery","Delivery areas"],["settings","Shop settings"]].map(([key,label]) => <button key={key} className={tab===key?"active":""} onClick={()=>setTab(key)}>{label}{key==="orders" && orders.length ? <i>{orders.length}</i> : null}{key==="submissions" && submissions.filter(s=>s.status==="pending").length ? <i>{submissions.filter(s=>s.status==="pending").length}</i> : null}</button>)}
    </nav>
    {error && <div className="admin-alert error">{error}</div>}{message && <div className="admin-alert success">{message}</div>}
    <div className="admin-toolbar"><span>{busy ? "Updating…" : "Shop management"}</span><button className="admin-quiet" onClick={load} disabled={busy}>Refresh</button></div>

    {tab==="orders" && <section className="admin-section"><div className="admin-section-title"><div><h1>Customer orders</h1><p>Review delivery details and move each order through fulfilment.</p></div><b>{orders.length} total</b></div>
      {!orders.length ? <div className="admin-empty">No customer orders yet.</div> : orders.map(order=><article className="admin-order" key={order.id}>
        <div className="admin-order-top"><div><b>{order.order_number}</b><small>{new Date(order.created_at).toLocaleString()}</small></div><strong>{money(order.total_amount,order.currency)}</strong></div>
        <div className="admin-customer"><b>{order.delivery_name}</b><span>{order.delivery_phone}</span><span>{order.delivery_address}</span></div>
        <div className="admin-items">{(order.shop_order_items||[]).map(item=><div key={item.id}><span>{item.product_name} × {item.quantity}</span><b>{money(item.line_total,order.currency)}</b></div>)}</div>
        <div className="admin-order-bottom"><div><small>Payment: {pretty(order.payment_status)}</small><small>Platform commission: {money(order.commission_amount,order.currency)}</small></div><label>Order status<select value={order.order_status} disabled={busy} onChange={e=>updateOrder(order.id,e.target.value)}>{ORDER_STATES.map(s=><option key={s} value={s}>{pretty(s)}</option>)}</select></label></div>
      </article>)}
    </section>}

    {tab==="submissions" && <section className="admin-section"><div className="admin-section-title"><div><h1>Seller submissions</h1><p>Approve suitable listings to publish them in the customer shop.</p></div><b>{submissions.filter(s=>s.status==="pending").length} pending</b></div>
      {!submissions.length ? <div className="admin-empty">No seller submissions yet.</div> : submissions.map(row=><article className="admin-submission" key={row.id}>
        <div className="admin-submission-head"><div><h3>{row.product_name}</h3><small>{row.currency} {Number(row.price).toLocaleString()} · Stock {row.stock_quantity} · {pretty(row.status)}</small></div><span>{new Date(row.created_at).toLocaleDateString()}</span></div>
        {row.previewUrls.length>0 && <div className="admin-photos">{row.previewUrls.map((url,i)=><img key={i} src={url} alt={row.product_name+" photo "+(i+1)}/>)}</div>}
        <p>{row.description}</p>{row.delivery_notes && <small>Seller delivery note: {row.delivery_notes}</small>}
        {row.status==="pending" ? <><textarea value={reviewNotes[row.id]||""} onChange={e=>setReviewNotes(v=>({...v,[row.id]:e.target.value}))} placeholder="Optional note to seller" maxLength={1000}/><div className="admin-actions"><button disabled={busy} onClick={()=>reviewSubmission(row,false)} className="admin-reject">Reject</button><button disabled={busy} onClick={()=>reviewSubmission(row,true)} className="admin-approve">Approve & publish</button></div></> : row.admin_note && <div className="admin-note">Admin note: {row.admin_note}</div>}
      </article>)}
    </section>}

    {tab==="delivery" && <section className="admin-section"><div className="admin-section-title"><div><h1>Delivery areas</h1><p>Set delivery fees customers see at checkout.</p></div></div>
      <form className="admin-form" onSubmit={addZone}><label>Region<input value={zoneForm.region} onChange={e=>setZoneForm(v=>({...v,region:e.target.value}))} placeholder="Addis Ababa" required/></label><label>City / area<input value={zoneForm.city} onChange={e=>setZoneForm(v=>({...v,city:e.target.value}))} placeholder="Bole" required/></label><label>Fee (ETB)<input type="number" min="0" step="0.01" value={zoneForm.fee} onChange={e=>setZoneForm(v=>({...v,fee:e.target.value}))} required/></label><button className="admin-approve" disabled={busy}>Add delivery area</button></form>
      {!zones.length ? <div className="admin-empty">No delivery areas configured. The default fee will be used.</div> : zones.map(zone=><div className="admin-zone" key={zone.id}><div><b>{zone.city}</b><small>{zone.region} · {money(zone.fee,zone.currency)}</small></div><button className={zone.is_active?"admin-quiet":"admin-approve"} disabled={busy} onClick={()=>toggleZone(zone)}>{zone.is_active?"Active · Disable":"Disabled · Enable"}</button></div>)}
    </section>}

    {tab==="settings" && <section className="admin-section"><div className="admin-section-title"><div><h1>Shop settings</h1><p>Configure Lumi’s marketplace commission and default delivery fee.</p></div></div>
      <form className="admin-form settings-form" onSubmit={saveSettings}><label>Platform commission (%)<input type="number" min="0" max="100" step="0.01" value={settings.commission_rate} onChange={e=>setSettings(v=>({...v,commission_rate:e.target.value}))}/><small>Calculated internally on each order; not added to the customer’s bill.</small></label><label>Default delivery fee (ETB)<input type="number" min="0" step="0.01" value={settings.default_delivery_fee} onChange={e=>setSettings(v=>({...v,default_delivery_fee:e.target.value}))}/></label><button className="admin-approve" disabled={busy}>Save settings</button></form>
      <div className="admin-info">Online payments are intentionally not connected yet. Orders remain payment-pending until a payment provider is added later.</div>
    </section>}
    <footer className="admin-footer">Lumi · Women’s Shop Administration</footer>
  </main>;
}
