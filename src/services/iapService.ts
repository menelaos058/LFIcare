// src/services/iapService.ts
import { auth } from "./firebaseConfig";

// Βάλε εδώ το Function URL που πήρες:
// https://verifyandroidpurchase-pqnxkfnusa-ew.a.run.app
const VERIFY_ANDROID_PURCHASE_URL =
  "https://verifyandroidpurchase-pqnxkfnusa-ew.a.run.app";

export async function verifyAndroidPurchaseHTTP(params: {
  productId: string;
  purchaseToken: string;
}) {
  const user = auth.currentUser;
  if (!user) throw new Error("Πρέπει να είσαι συνδεδεμένος/η.");

  const idToken = await user.getIdToken();

  const res = await fetch(VERIFY_ANDROID_PURCHASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      productId: params.productId,
      purchaseToken: params.purchaseToken,
    }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok || data?.ok !== true) {
    throw new Error(data?.error ?? `Verify failed (${res.status})`);
  }

  // data: { ok: true, active: boolean, expiresAt: string }
  return data as { ok: true; active: boolean; expiresAt: string };
}