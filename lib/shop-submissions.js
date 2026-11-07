import { getSupabaseBrowserClient } from "./supabase-browser.js";

const BUCKET = "lumi-product-submissions";
const MAX_IMAGES = 6;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function validateProductSubmission(input, files = []) {
  const errors = {};
  const name = String(input?.productName ?? "").trim();
  const description = String(input?.description ?? "").trim();
  const price = Number(input?.price);
  const stock = Number(input?.stockQuantity);

  if (name.length < 2 || name.length > 120) errors.productName = "Product name must be 2–120 characters.";
  if (description.length < 10 || description.length > 3000) errors.description = "Description must be 10–3,000 characters.";
  if (!Number.isFinite(price) || price <= 0) errors.price = "Enter a price greater than zero.";
  if (!Number.isInteger(stock) || stock < 0) errors.stockQuantity = "Stock must be a whole number of zero or more.";
  if (files.length > MAX_IMAGES) errors.images = "You can upload up to 6 product photos.";

  for (const file of files) {
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      errors.images = "Use JPG, PNG, or WebP images only.";
      break;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      errors.images = "Each photo must be 10 MB or smaller.";
      break;
    }
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

function safeExtension(file) {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

async function requireSignedInUser(supabase) {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error("Please sign in before submitting a product.");
  return data.user;
}

export async function getActiveShopCategories() {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("shop_categories")
    .select("id,name,description")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function getMyProductSubmissions() {
  const supabase = getSupabaseBrowserClient();
  await requireSignedInUser(supabase);

  const { data, error } = await supabase
    .from("shop_product_submissions")
    .select("id,product_name,description,price,currency,stock_quantity,image_paths,delivery_notes,status,admin_note,created_at,updated_at")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function submitProductForReview(input, files = []) {
  const validation = validateProductSubmission(input, files);
  if (!validation.valid) {
    const error = new Error("Please correct the product details and try again.");
    error.validationErrors = validation.errors;
    throw error;
  }

  const supabase = getSupabaseBrowserClient();
  const user = await requireSignedInUser(supabase);
  const uploadedPaths = [];

  try {
    for (const file of files) {
      const path = `${user.id}/${crypto.randomUUID()}.${safeExtension(file)}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
        cacheControl: "3600",
        contentType: file.type,
        upsert: false,
      });
      if (error) throw error;
      uploadedPaths.push(path);
    }

    const { data, error } = await supabase
      .from("shop_product_submissions")
      .insert({
        seller_id: user.id,
        category_id: input.categoryId || null,
        product_name: String(input.productName).trim(),
        description: String(input.description).trim(),
        price: Number(input.price),
        currency: "ETB",
        stock_quantity: Number(input.stockQuantity),
        image_paths: uploadedPaths,
        delivery_notes: String(input.deliveryNotes ?? "").trim() || null,
        status: "pending",
      })
      .select("id,product_name,status,created_at")
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    if (uploadedPaths.length) {
      await supabase.storage.from(BUCKET).remove(uploadedPaths);
    }
    throw error;
  }
}
