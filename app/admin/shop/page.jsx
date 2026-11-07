"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "../../../lib/supabase-browser.js";

const ORDER_STATES = ["pending", "confirmed", "processing", "out_for_delivery", "delivered", "cancelled"];
const money = (value, currency = "ETB") => new Intl.NumberFormat("en-ET", { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(value || 0));
const pretty = value => String(value || "").replaceAll("_", " ");

function withTimeout(promise, label, milliseconds = 15000) {
  let timer;
  return Promise.race([
    Promise.resolve(promise),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} is taking too long. Check your connection and press Refresh.`)), milliseconds);
    })
  ]).finally(() => clearTimeout(timer));
}

async function readQuery(label, query) {
  const result = await withTimeout(query, label);
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}

export default function LumiShopAdmin() {
  const router = useRouter();
  const [supabase, setSupabase] = useState(null);
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
  const [ads, setAds] = useState([]);
  const [adTitle, setAdTitle] = useState("");
  const [adTargetUrl, setAdTargetUrl] = useState("");
  const [adFile, setAdFile] = useState(null);
  const [adDuration, setAdDuration] = useState(10);

  const load = useCallback(async () => {
    if (!supabase) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const [pending, orderRows, zoneRows, settingRow, adRows] = await Promise.all([
        readQuery("Seller submissions", supabase.from("shop_product_submissions").select("*").order("created_at", { ascending: false })),
        readQuery("Customer orders", supabase.from("shop_orders").select("*,shop_order_items(id,product_name,quantity,unit_price,line_total)").order("created_at", { ascending: false })),
        readQuery("Delivery areas", supabase.from("delivery_zones").select("*").order("region").order("city")),
        readQuery("Shop settings", supabase.from("shop_settings").select("commission_rate,default_delivery_fee,currency").eq("id", true).maybeSingle()),
        readQuery("Advertisements", supabase.from("shop_advertisements").select("*").order("created_at", { ascending: false }))
      ]);
      const decorated = await Promise.all((pending || []).map(async row => {
        const urls = await Promise.all((row.image_paths || []).map(async path => {
          try {
            const { data, error: signedUrlError } = await withTimeout(
              supabase.storage.from("lumi-product-submissions").createSignedUrl(path, 3600),
              "Seller product photo",
              10000
            );
            if (signedUrlError) throw signedUrlError;
            return data?.signedUrl || "";
          } catch (photoError) {
            console.warn("Lumi seller photo preview unavailable:", photoError);
            return "";
          }
        }));
        return { ...row, previewUrls: urls.filter(Boolean) };
      }));
      setSubmissions(decorated); setOrders(orderRows || []); setZones(zoneRows || []); setAds(adRows || []);
      if (settingRow) setSettings(settingRow);
    } catch (e) {
      console.error("Lumi shop administration load failed:", e);
      setError(e.message || "Could not load shop management data. Press Refresh to try again.");
    } finally {
      setBusy(false);
      setReady(true);
    }
  }, [supabase]);

  useEffect(() => {
    try {
      setSupabase(getSupabaseBrowserClient());
    } catch (e) {
      setError(e.message || "Lumi Supabase connection is unavailable.");
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    (async () => {
      try {
        const sessionResult = await withTimeout(supabase.auth.getSession(), "Admin session check", 10000);
        const session = sessionResult.data?.session;
        if (!session) {
          if (alive) { setError("Your admin session has expired. Please sign in again."); setReady(true); }
          router.replace("/admin");
          return;
        }
        const roleResult = await withTimeout(supabase.rpc("is_lumi_admin"), "Admin permission check", 10000);
        if (roleResult.error) throw new Error(`Could not verify CEO access: ${roleResult.error.message}`);
        if (roleResult.data !== true) {
          await supabase.auth.signOut();
          router.replace("/admin");
          return;
        }
        if (alive) await load();
      } catch (authError) {
        console.error("Lumi shop administration access check failed:", authError);
        if (alive) {
          setError(authError.message || "Could not verify shop administration access. Press Refresh to try again.");
          setReady(true);
        }
      }
    })();
    return () => { alive = false; };
  }, [supabase, router, load]);

  async function reviewSubmission(row, approve) {
    setBusy(true); setError(""); setMessage("");
    try {
      const note = (reviewNotes[row.id] || "").trim() || null;
      if (approve) {
        const publishedUrls = [];
        for (const [index, path] of (row.image_paths || []).entries()) {
          const { data: fileData, error: downloadError } = await supabase.storage.from("lumi-product-submissions").download(path);
          if (downloadError) throw downloadError;
          const extension = path.split(".").pop()?.toLowerCase() || "jpg";
          const targetPath = `products/${row.id}/${index + 1}-${crypto.randomUUID()}.${extension}`;
          const { error: uploadError } = await supabase.storage.from("lumi-shop-products").upload(targetPath, fileData, {
            contentType: fileData.type || "image/jpeg", cacheControl: "3600", upsert: false
          });
          if (uploadError) throw uploadError;
          const { data: publicData } = supabase.storage.from("lumi-shop-products").getPublicUrl(targetPath);
          publishedUrls.push(publicData.publicUrl);
        }
        const { error: productError } = await supabase.from("shop_products").insert({
          category_id: row.category_id, name: row.product_name, description: row.description,
          price: row.price, currency: row.currency || "ETB", stock_quantity: row.stock_quantity,
          image_urls: publishedUrls, is_active: true
        });
        if (productError) throw productError;
      }
      const { data: { user } } = await supabase.auth.getUser();
      const { error: updateError } = await supabase.from("shop_product_submissions").update({
        status: approve ? "approved" : "rejected", admin_note: note,
        reviewed_by: user?.id || null, reviewed_at: new Date().toISOString()
      }).eq("id", row.id);
      if (updateError) throw updateError;
      setMessage(approve ? "Product approved and published with its photos." : "Submission rejected.");
      await load();
    } catch (e) { setError(e.message || "Could not review this submission."); }
    finally { setBusy(false); }
  }

  async function updateOrder(id, order_status) {
    setBusy(true); setError(""); setMessage("");
    try {
      if (order_status === "cancelled") {
        const { error: cancelError } = await supabase.rpc("admin_cancel_lumi_shop_order", { p_order_id: id });
        if (cancelError) throw cancelError;
      } else {
        const { error: updateError } = await supabase.from("shop_orders").update({ order_status, updated_at: new Date().toISOString() }).eq("id", id);
        if (updateError) throw updateError;
      }
      setMessage(order_status === "cancelled" ? "Order cancelled and stock returned to inventory." : "Order status updated."); await load();
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


  async function addAdvertisement(event) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      if (!adTitle.trim() || !adFile) throw new Error("Enter an ad title and choose an image or video.");
      const isVideo = adFile.type.startsWith("video/");
      const allowed = isVideo ? ["video/mp4","video/webm"] : ["image/jpeg","image/png","image/webp"];
      if (!allowed.includes(adFile.type)) throw new Error("Use MP4/WebM video or JPG/PNG/WebP image.");
      if (adFile.size > (isVideo ? 50 : 10) * 1024 * 1024) throw new Error(isVideo ? "Video must be 50 MB or smaller." : "Image must be 10 MB or smaller.");
      const path = "ads/" + crypto.randomUUID() + "-" + adFile.name.replace(/[^a-zA-Z0-9._-]/g,"-");
      const { error: uploadError } = await supabase.storage.from("lumi-advertisements").upload(path, adFile, { contentType: adFile.type, cacheControl: "3600", upsert: false });
      if (uploadError) throw uploadError;
      const { data: publicData } = supabase.storage.from("lumi-advertisements").getPublicUrl(path);
      const { data: { user } } = await supabase.auth.getUser();
      const { error: insertError } = await supabase.from("shop_advertisements").insert({
        title: adTitle.trim(), media_type: isVideo ? "video" : "image", media_path: path,
        media_url: publicData.publicUrl, target_url: adTargetUrl.trim() || null,
        duration_seconds: isVideo ? Math.min(10, Math.max(1, Number(adDuration) || 10)) : 10,
        is_active: true, created_by: user?.id || null
      });
      if (insertError) throw insertError;
      setAdTitle(""); setAdTargetUrl(""); setAdFile(null); setAdDuration(10);
      const picker = document.getElementById("lumi-ad-file"); if (picker) picker.value = "";
      setMessage("Advertisement uploaded and activated."); await load();
    } catch (e) { setError(e.message || "Could not upload advertisement."); }
    finally { setBusy(false); }
  }

  async function toggleAdvertisement(ad) {
    setBusy(true); setError(""); setMessage("");
    try {
      const { error: updateError } = await supabase.from("shop_advertisements").update({ is_active: !ad.is_active, updated_at: new Date().toISOString() }).eq("id", ad.id);
      if (updateError) throw updateError;
      setMessage(ad.is_active ? "Advertisement paused." : "Advertisement activated."); await load();
    } catch (e) { setError(e.message || "Could not update advertisement."); }
    finally { setBusy(false); }
  }

  async function deleteAdvertisement(ad) {
    if (!window.confirm("Delete this advertisement permanently?")) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const { error: deleteError } = await supabase.from("shop_advertisements").delete().eq("id", ad.id);
      if (deleteError) throw deleteError;
      if (ad.media_path) {
        const { error: storageError } = await supabase.storage.from("lumi-advertisements").remove([ad.media_path]);
        if (storageError) throw storageError;
      }
      setMessage("Advertisement deleted."); await load();
    } catch (e) { setError(e.message || "Could not delete advertisement."); }
    finally { setBusy(false); }
  }

  async function logout() { await supabase.auth.signOut(); router.replace("/admin"); }

  if (!ready) return <main className="lumi-admin"><div className="admin-card">Loading Lumi shop administration…</div></main>;

  return <main className="lumi-admin">
    <header className="admin-header"><div><div className="admin-brand">✿ lumi <span>ሉሚ</span></div><p>Women’s Shop · Administration</p></div><button className="admin-quiet" onClick={logout}>Sign out</button></header>
    <nav className="admin-tabs">
      {[["orders","Orders"],["submissions","Seller review"],["delivery","Delivery areas"],["settings","Shop settings"],["ads","Advertisements"]].map(([key,label]) => <button key={key} className={tab===key?"active":""} onClick={()=>setTab(key)}>{label}{key==="orders" && orders.length ? <i>{orders.length}</i> : null}{key==="submissions" && submissions.filter(s=>s.status==="pending").length ? <i>{submissions.filter(s=>s.status==="pending").length}</i> : null}</button>)}
    </nav>
    {error && <div className="admin-alert error">{error}</div>}{message && <div className="admin-alert success">{message}</div>}
    <div className="admin-toolbar"><span>{busy ? "Updating…" : "Shop management"}</span><button className="admin-quiet" onClick={load} disabled={busy}>Refresh</button></div>

    {tab==="orders" && <section className="admin-section"><div className="admin-section-title"><div><h1>Customer orders</h1><p>Review delivery details and move each order through fulfilment.</p></div><b>{orders.length} total</b></div>
      {!orders.length ? <div className="admin-empty">No customer orders yet.</div> : orders.map(order=><article className="admin-order" key={order.id}>
        <div className="admin-order-top"><div><b>{order.order_number}</b><small>{new Date(order.created_at).toLocaleString()}</small></div><strong>{money(order.total_amount,order.currency)}</strong></div>
        <div className="admin-customer"><b>{order.delivery_name}</b><span>{order.delivery_phone}</span><span>{order.delivery_address}</span></div>
        <div className="admin-items">{(order.shop_order_items||[]).map(item=><div key={item.id}><span>{item.product_name} × {item.quantity}</span><b>{money(item.line_total,order.currency)}</b></div>)}</div>
        <div className="admin-order-bottom"><div><small>Payment: {pretty(order.payment_status)}</small><small>Platform commission: {money(order.commission_amount,order.currency)}</small></div><label>Order status<select value={order.order_status} disabled={busy || order.order_status==="cancelled"} onChange={e=>updateOrder(order.id,e.target.value)}>{ORDER_STATES.filter(s=>s!=="cancelled").map(s=><option key={s} value={s}>{pretty(s)}</option>)}{order.order_status==="cancelled" && <option value="cancelled">cancelled</option>}</select></label>{!["cancelled","delivered"].includes(order.order_status) && <button className="admin-reject" disabled={busy} onClick={()=>{if(window.confirm("Cancel this order and restore its stock to inventory?")) updateOrder(order.id,"cancelled");}}>Cancel order</button>}</div>
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


    {tab==="ads" && <section className="admin-section">
      <div className="admin-section-title"><div><h1>Advertisements</h1><p>Upload short promotions shown at the top of the customer Buying screen.</p></div><b>{ads.length} total</b></div>
      <form className="admin-form ad-form" onSubmit={addAdvertisement}>
        <label>Ad title<input value={adTitle} onChange={e=>setAdTitle(e.target.value)} placeholder="Promotion title" maxLength={120} required /></label>
        <label>Click-through link (optional)<input type="url" value={adTargetUrl} onChange={e=>setAdTargetUrl(e.target.value)} placeholder="https://example.com" /></label>
        <label>Image or video<input id="lumi-ad-file" type="file" accept="video/mp4,video/webm,image/jpeg,image/png,image/webp" onChange={e=>setAdFile(e.target.files?.[0] || null)} required /><small>MP4/WebM up to 50 MB or JPG/PNG/WebP up to 10 MB.</small></label>
        {adFile?.type?.startsWith("video/") && <label>Video duration (seconds, max 10)<input type="number" min="1" max="10" value={adDuration} onChange={e=>setAdDuration(e.target.value)} required /></label>}
        <button className="admin-approve" disabled={busy || !adFile}>Upload & activate</button>
      </form>
      <div className="admin-info">Videos are capped at 10 seconds in the customer player. Keep promotions relevant and avoid placing ads over cycle-tracking screens.</div>
      {!ads.length ? <div className="admin-empty">No advertisements uploaded yet.</div> : ads.map(ad=><article className="admin-ad" key={ad.id}>
        <div className="admin-ad-preview">{ad.media_type==="video" ? <video src={ad.media_url} muted playsInline controls /> : <img src={ad.media_url} alt={ad.title} />}</div>
        <div className="admin-ad-detail"><b>{ad.title}</b><small>{ad.media_type.toUpperCase()} · {ad.duration_seconds}s · {new Date(ad.created_at).toLocaleDateString()}</small><small>{Number(ad.view_count||0).toLocaleString()} views · {Number(ad.click_count||0).toLocaleString()} clicks</small>{ad.target_url && <small>{ad.target_url}</small>}<span className={ad.is_active?"ad-live":"ad-paused"}>{ad.is_active?"Active":"Paused"}</span></div>
        <div className="admin-ad-actions"><button className={ad.is_active?"admin-quiet":"admin-approve"} disabled={busy} onClick={()=>toggleAdvertisement(ad)}>{ad.is_active?"Pause":"Activate"}</button><button className="admin-reject" disabled={busy} onClick={()=>deleteAdvertisement(ad)}>Delete</button></div>
      </article>)}
    </section>}
    {tab==="settings" && <section className="admin-section"><div className="admin-section-title"><div><h1>Shop settings</h1><p>Configure Lumi’s marketplace commission and default delivery fee.</p></div></div>
      <form className="admin-form settings-form" onSubmit={saveSettings}><label>Platform commission (%)<input type="number" min="0" max="100" step="0.01" value={settings.commission_rate} onChange={e=>setSettings(v=>({...v,commission_rate:e.target.value}))}/><small>Calculated internally on each order; not added to the customer’s bill.</small></label><label>Default delivery fee (ETB)<input type="number" min="0" step="0.01" value={settings.default_delivery_fee} onChange={e=>setSettings(v=>({...v,default_delivery_fee:e.target.value}))}/></label><button className="admin-approve" disabled={busy}>Save settings</button></form>
      <div className="admin-info">Online payments are intentionally not connected yet. Orders remain payment-pending until a payment provider is added later.</div>
    </section>}
    <footer className="admin-footer">Lumi · Women’s Shop Administration</footer>
  </main>;
}
