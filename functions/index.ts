// functions/src/index.ts (ή όπου έχεις το verifyAndroidSubscription)

import * as logger from "firebase-functions/logger";
import { setGlobalOptions } from "firebase-functions/v2";
import { HttpsError, onCall } from "firebase-functions/v2/https";

import * as admin from "firebase-admin";
import { GoogleAuth } from "google-auth-library";
import { google } from "googleapis";

setGlobalOptions({ region: "europe-west1" });

admin.initializeApp();

const PACKAGE_NAME = "com.men.lficare";

type VerifyResult = {
  ok: boolean;
  isActive: boolean;
  expiryTime: string;
  productId: string;
};

export const verifyAndroidSubscription = onCall(async (request): Promise<VerifyResult> => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Login required.");
  }
  const uid = request.auth.uid;

  const purchaseToken = request.data?.purchaseToken as string | undefined;
  const productId = request.data?.productId as string | undefined;

  if (!purchaseToken || !productId) {
    throw new HttpsError("invalid-argument", "Missing purchaseToken or productId.");
  }

  try {
    const auth = new GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/androidpublisher"],
    });
    const authClient = await auth.getClient();

    const androidpublisher = google.androidpublisher({
      version: "v3",
      auth: authClient as any,
    });

    // Subscriptions V2
    const res = await androidpublisher.purchases.subscriptionsv2.get({
      packageName: PACKAGE_NAME,
      token: purchaseToken,
    });

    const data = res.data;
    const lineItems = data.lineItems ?? [];
    const matched = lineItems.find((li) => li.productId === productId);

    if (!matched) {
      throw new HttpsError("permission-denied", "Token does not match this product.");
    }

    const expiryTime = matched.expiryTime;
    if (!expiryTime) {
      throw new HttpsError("failed-precondition", "No expiryTime found for subscription.");
    }

    const expiryMs = Date.parse(expiryTime);
    if (Number.isNaN(expiryMs)) {
      throw new HttpsError("failed-precondition", "Invalid expiryTime format.");
    }

    const nowMs = Date.now();
    const isActive = expiryMs > nowMs;

    // buyTimestamp: πάρε startTime αν υπάρχει, αλλιώς serverTimestamp
    const startIso = (matched as any)?.startTime as string | undefined;
    const purchasedAt = startIso
      ? admin.firestore.Timestamp.fromDate(new Date(startIso))
      : admin.firestore.FieldValue.serverTimestamp();

    // ✅ Ενιαίο field name με τα screens: expiresAt
    const expiresAt = admin.firestore.Timestamp.fromDate(new Date(expiryTime));

    // ✅ Επιλογή Α: γράφει στο /users/{uid}/subscriptions/{productId}
    // 1 doc ανά productId (pro/pro2) για απλό overwrite/renew.
    const docId = productId;
    const subRef = admin.firestore().doc(`users/${uid}/subscriptions/${docId}`);

    await subRef.set(
      {
        uid,
        productId,
        platform: "android",
        packageName: PACKAGE_NAME,

        purchasedAt,
        expiresAt,

        // προαιρετικά debug/trace:
        purchaseToken,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        active: isActive,
      },
      { merge: true }
    );

    // (Προαιρετικό) flag στο users/{uid} για γρήγορο check
    await admin.firestore().doc(`users/${uid}`).set(
      {
        premium: isActive,
        premiumUntil: expiresAt,
        premiumProductId: productId,
        premiumUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // ✅ Ενιαίο response shape (ταιριάζει με το subscriptionService.ts που πρότεινα)
    return { ok: true, isActive, expiryTime, productId };
  } catch (e: any) {
    logger.error("verifyAndroidSubscription failed", e);

    // Αν είναι ήδη HttpsError, κράτα το
    if (e instanceof HttpsError) throw e;

    throw new HttpsError("internal", e?.message ?? "Verification failed");
  }
});