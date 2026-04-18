// src/services/subscriptionService.ts
import { httpsCallable } from "firebase/functions";
import { functions } from "./firebaseConfig"; // ή "../services/firebaseConfig" ανάλογα το path σου

type VerifyResponse = {
  ok: boolean;
  isActive: boolean;
  expiryTime: string;
  productId: string;
};

export async function verifyAndroidSubscription(
  purchaseToken: string,
  productId: string
): Promise<VerifyResponse> {
  const fn = httpsCallable(functions, "verifyAndroidSubscription");
  const result = await fn({ purchaseToken, productId });
  return result.data as VerifyResponse;
}