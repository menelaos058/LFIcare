import * as logger from "firebase-functions/logger";
import { setGlobalOptions } from "firebase-functions/v2";
import { HttpsError, onRequest } from "firebase-functions/v2/https";

import * as admin from "firebase-admin";
import { GoogleAuth } from "google-auth-library";

setGlobalOptions({
  region: "europe-west1",
});

admin.initializeApp();

const PACKAGE_NAME = "com.men.lficare";
const PLAY_SERVICE_ACCOUNT =
  "play-developer-api@lficare-6cf8d.iam.gserviceaccount.com";

const db = admin.firestore();

type VerifyResult = {
  ok: boolean;
  isActive: boolean;
  expiryTime: string;
  productId: string;
  programId: string;
  chatId: string | null;
};

type ProgramDoc = {
  title?: string;
  description?: string;
  price?: number;
  teacherEmail?: string;
  productId?: string;
  accessDurationMonths?: number;
};

function setCorsHeaders(res: any) {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
}

function asNonEmptyString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpsError("invalid-argument", `Missing or invalid ${fieldName}.`);
  }
  return value.trim();
}

function normalizeEmailForCompare(value: string): string {
  return value.trim().toLowerCase();
}

function makeChatKey(params: {
  programId: string;
  studentEmail: string;
  teacherEmail: string;
}): string {
  const student = normalizeEmailForCompare(params.studentEmail);
  const teacher = normalizeEmailForCompare(params.teacherEmail);
  return `${params.programId}__${student}__${teacher}`;
}

async function requireUidAndEmailFromAuthHeader(req: any): Promise<{
  uid: string;
  email: string;
}> {
  const authHeader =
    req.get?.("authorization") ??
    req.headers?.authorization ??
    req.headers?.Authorization ??
    "";

  logger.info("verifyAndroidSubscription auth header", {
    hasAuthorization: !!authHeader,
    authorizationPrefix:
      typeof authHeader === "string" && authHeader.length > 20
        ? authHeader.slice(0, 20)
        : authHeader || null,
  });

  const match =
    typeof authHeader === "string"
      ? authHeader.match(/^Bearer\s+(.+)$/i)
      : null;

  if (!match?.[1]) {
    throw new HttpsError("unauthenticated", "Login Required.");
  }

  let decoded: admin.auth.DecodedIdToken;
  try {
    decoded = await admin.auth().verifyIdToken(match[1]);
  } catch (error: any) {
    logger.error("verifyIdToken failed", {
      message: error?.message ?? null,
      code: error?.code ?? null,
    });
    throw new HttpsError("unauthenticated", "Login Required.");
  }

  if (!decoded?.uid) {
    throw new HttpsError("unauthenticated", "Login Required.");
  }

  if (typeof decoded.email !== "string" || !decoded.email.trim()) {
    throw new HttpsError(
      "failed-precondition",
      "Authenticated email is missing."
    );
  }

  return {
    uid: decoded.uid,
    email: decoded.email.trim(),
  };
}

async function ensureChat(params: {
  programId: string;
  programTitle: string;
  studentEmail: string;
  teacherEmail: string;
}): Promise<string> {
  const { programId, programTitle, studentEmail, teacherEmail } = params;

  const studentEmailLC = normalizeEmailForCompare(studentEmail);
  const teacherEmailLC = normalizeEmailForCompare(teacherEmail);

  const chatsRef = db.collection("chats");
  const chatKey = makeChatKey({
    programId,
    studentEmail: studentEmailLC,
    teacherEmail: teacherEmailLC,
  });

  const deterministicRef = chatsRef.doc(chatKey);
  const deterministicSnap = await deterministicRef.get();

  if (deterministicSnap.exists) {
    return deterministicSnap.id;
  }

  const legacySnap = await chatsRef
    .where("programId", "==", programId)
    .limit(50)
    .get();

  const legacy = legacySnap.docs.find((d) => {
    const data = d.data() as {
      users?: string[];
      studentEmail?: string;
      teacherEmail?: string;
    };

    const users = Array.isArray(data.users) ? data.users : [];
    const normalizedUsers = users.map((u) =>
      normalizeEmailForCompare(String(u))
    );

    const legacyStudent = data.studentEmail
      ? normalizeEmailForCompare(String(data.studentEmail))
      : null;

    const legacyTeacher = data.teacherEmail
      ? normalizeEmailForCompare(String(data.teacherEmail))
      : null;

    const hasStudent =
      normalizedUsers.includes(studentEmailLC) || legacyStudent === studentEmailLC;

    const hasTeacher =
      normalizedUsers.includes(teacherEmailLC) || legacyTeacher === teacherEmailLC;

    return hasStudent && hasTeacher;
  });

  if (legacy) {
    const legacyData = legacy.data() ?? {};

    await deterministicRef.set(
      {
        ...legacyData,
        chatKey,
        users: [studentEmailLC, teacherEmailLC],
        studentEmail: studentEmailLC,
        teacherEmail: teacherEmailLC,
        programId,
        programTitle,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return deterministicRef.id;
  }

  await deterministicRef.set(
    {
      chatKey,
      users: [studentEmailLC, teacherEmailLC],
      studentEmail: studentEmailLC,
      teacherEmail: teacherEmailLC,
      programId,
      programTitle,
      lastMessage: "",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return deterministicRef.id;
}

export const verifyAndroidSubscription = onRequest(
  {
    region: "europe-west1",
    serviceAccount: PLAY_SERVICE_ACCOUNT,
  },
  async (req, res) => {
    setCorsHeaders(res);

    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    try {
      if (req.method !== "POST") {
        res.status(405).json({
          ok: false,
          error: "Method not allowed.",
        });
        return;
      }

      const { uid, email: authEmail } =
        await requireUidAndEmailFromAuthHeader(req);

      const purchaseToken = asNonEmptyString(
        req.body?.purchaseToken,
        "purchaseToken"
      );
      const productId = asNonEmptyString(req.body?.productId, "productId");
      const programId = asNonEmptyString(req.body?.programId, "programId");

      const programRef = db.doc(`programs/${programId}`);
      const programSnap = await programRef.get();

      if (!programSnap.exists) {
        throw new HttpsError("not-found", "Program not found.");
      }

      const programData = (programSnap.data() ?? {}) as ProgramDoc;

      const programTitle = asNonEmptyString(
        programData.title,
        "program.title"
      );
      const teacherEmail = asNonEmptyString(
        programData.teacherEmail,
        "program.teacherEmail"
      );

      const description =
        typeof programData.description === "string"
          ? programData.description
          : "";

      const price =
        typeof programData.price === "number" &&
        Number.isFinite(programData.price)
          ? programData.price
          : 0;

      logger.info("PROGRAM VS REQUEST PRODUCT CHECK", {
        firestoreProgramId: programId,
        firestoreProgramProductId: programData.productId ?? null,
        requestProductId: productId,
        uid,
        authEmail,
      });

      if (
        typeof programData.productId === "string" &&
        programData.productId.trim() &&
        programData.productId.trim() !== productId
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Program productId does not match purchased product."
        );
      }

      logger.info("verifyAndroidSubscription request", {
        uid,
        authEmail,
        productId,
        programId,
        packageName: PACKAGE_NAME,
        configuredServiceAccount: PLAY_SERVICE_ACCOUNT,
      });

      const googleAuth = new GoogleAuth({
        scopes: ["https://www.googleapis.com/auth/androidpublisher"],
      });

      const authClient = await googleAuth.getClient();

      logger.info("Google auth client acquired", {
        constructorName: authClient?.constructor?.name ?? null,
      });

      const tokenResult = await authClient.getAccessToken();
      const accessToken =
        typeof tokenResult === "string"
          ? tokenResult
          : tokenResult?.token ?? null;

      logger.info("Google Play access token acquired", {
        hasToken: !!accessToken,
      });

      if (!accessToken) {
        throw new Error("Failed to acquire Google Play access token.");
      }

      const playUrl =
        `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/` +
        `${PACKAGE_NAME}/purchases/subscriptionsv2/tokens/${purchaseToken}`;

      const gpRes = await fetch(playUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      });

      const gpJson = (await gpRes.json()) as any;

      logger.info("Google Play response meta", {
        status: gpRes.status,
        ok: gpRes.ok,
      });

      if (!gpRes.ok) {
        logger.error("Google Play verify raw error", gpJson);
        throw new Error(
          gpJson?.error?.message || "Google Play verification failed."
        );
      }

      const data = gpJson as any;
      const lineItems: any[] = Array.isArray(data?.lineItems)
        ? data.lineItems
        : [];

      const matched = lineItems.find((li) => li?.productId === productId);
      if (!matched) {
        throw new HttpsError(
          "permission-denied",
          "Token does not match this product."
        );
      }

      const expiryTime: string | undefined = matched?.expiryTime;
      if (!expiryTime) {
        throw new HttpsError(
          "failed-precondition",
          "No expiryTime found for subscription."
        );
      }

      const expiryMs = Date.parse(expiryTime);
      if (Number.isNaN(expiryMs)) {
        throw new HttpsError(
          "failed-precondition",
          "Invalid expiryTime format."
        );
      }

      const isActive = expiryMs > Date.now();

      const startIso =
        typeof matched?.startTime === "string" ? matched.startTime : undefined;

      const purchasedAt = startIso
        ? admin.firestore.Timestamp.fromDate(new Date(startIso))
        : admin.firestore.FieldValue.serverTimestamp();

      const expiresAt = admin.firestore.Timestamp.fromDate(
        new Date(expiryTime)
      );

      let chatId: string | null = null;

      if (isActive) {
        chatId = await ensureChat({
          programId,
          programTitle,
          studentEmail: authEmail,
          teacherEmail,
        });
      }

      const subRef = db.doc(`users/${uid}/subscriptions/${programId}`);

      await subRef.set(
        {
          uid,
          programId,
          programTitle,
          teacherEmail: normalizeEmailForCompare(teacherEmail),
          productId,
          price,
          description,
          platform: "android",
          packageName: PACKAGE_NAME,
          purchaseToken,
          purchasedAt,
          expiresAt,
          active: isActive,
          chatId,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      const result: VerifyResult = {
        ok: true,
        isActive,
        expiryTime,
        productId,
        programId,
        chatId,
      };

      res.status(200).json(result);
    } catch (e: any) {
      logger.error("verifyAndroidSubscription failed", {
        message: e?.message ?? null,
        code: e?.code ?? null,
        status: e?.response?.status ?? null,
        responseData: e?.response?.data ?? null,
        stack: e?.stack ?? null,
      });

      if (e instanceof HttpsError) {
        res.status(400).json({
          ok: false,
          error: e.message,
          code: e.code,
        });
        return;
      }

      res.status(500).json({
        ok: false,
        error: e?.message ?? "Verification failed",
        status: e?.response?.status ?? null,
        responseData: e?.response?.data ?? null,
      });
    }
  }
);