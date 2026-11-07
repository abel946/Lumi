import test from "node:test";
import assert from "node:assert/strict";
import { validateProductSubmission } from "./shop-submissions.js";

const validInput = {
  productName: "Habesha cotton scarf",
  description: "Handwoven cotton scarf made in Ethiopia.",
  price: "850",
  stockQuantity: "4",
  deliveryNotes: "Can deliver within Addis Ababa.",
};

test("accepts a valid product submission", () => {
  const result = validateProductSubmission(validInput, []);
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, {});
});

test("rejects invalid price and stock quantity", () => {
  const result = validateProductSubmission({ ...validInput, price: "0", stockQuantity: "1.5" }, []);
  assert.equal(result.valid, false);
  assert.ok(result.errors.price);
  assert.ok(result.errors.stockQuantity);
});

test("rejects more than six images and unsupported image types", () => {
  const tooMany = Array.from({ length: 7 }, () => ({ type: "image/jpeg", size: 100 }));
  assert.ok(validateProductSubmission(validInput, tooMany).errors.images);

  const unsupported = [{ type: "image/gif", size: 100 }];
  assert.ok(validateProductSubmission(validInput, unsupported).errors.images);
});

test("rejects an image larger than 10 MB", () => {
  const oversized = [{ type: "image/jpeg", size: 10 * 1024 * 1024 + 1 }];
  assert.ok(validateProductSubmission(validInput, oversized).errors.images);
});
