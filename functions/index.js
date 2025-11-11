const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();
const storage = admin.storage();

/**
 * Callable: chat_getSignedUrl
 * data: { storagePath: string }
 * auth: required
 */
exports.chat_getSignedUrl = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Sign-in required.");
  }

  const { storagePath } = data || {};
  if (typeof storagePath !== "string" || !storagePath.startsWith("chat-media/")) {
    throw new functions.https.HttpsError("invalid-argument", "Invalid storagePath.");
  }

  // storagePath = chat-media/{chatId}/{uid}/{fileId}
  const parts = storagePath.split("/");
  const chatId = parts[1];
  if (!chatId) {
    throw new functions.https.HttpsError("invalid-argument", "Cannot parse chatId.");
  }

  // Έλεγχος συμμετοχής στο chat με βάση email (όπως στα rules)
  const chatSnap = await db.doc(`chats/${chatId}`).get();
  if (!chatSnap.exists) {
    throw new functions.https.HttpsError("not-found", "Chat not found.");
  }
  const chat = chatSnap.data();
  const email = context.auth.token.email;
  if (!email || !Array.isArray(chat.users) || !chat.users.includes(email)) {
    throw new functions.https.HttpsError("permission-denied", "Not a chat member.");
  }

  // Extra: το path πρέπει να ανήκει στο συγκεκριμένο chat
  if (!storagePath.startsWith(`chat-media/${chatId}/`)) {
    throw new functions.https.HttpsError("permission-denied", "Path not under this chat.");
  }

  const file = storage.bucket().file(storagePath);
  const [url] = await file.getSignedUrl({
    version: "v4",
    action: "read",
    expires: Date.now() + 5 * 60 * 1000 // 5 λεπτά
  });

  return { url };
});
