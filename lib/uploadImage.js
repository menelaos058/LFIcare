// lib/uploadImage.js
// Native upload με @react-native-firebase/storage (ΧΩΡΙΣ firebase/storage)
import storageRN from "@react-native-firebase/storage";
import * as FileSystem from "expo-file-system";

// helpers
const guessExtFromMime = (mime = "") => {
  if (/png/i.test(mime)) return "png";
  if (/webp/i.test(mime)) return "webp";
  if (/gif/i.test(mime)) return "gif";
  if (/heic|heif/i.test(mime)) return "heic";
  return "jpg";
};

/**
 * Ανεβάζει εικόνα σε Storage από base64 string (ΔΕΝ χρησιμοποιεί Blob).
 * @param {Object} opts
 * @param {string} opts.chatId
 * @param {string} opts.base64      - raw base64 (χωρίς data URL prefix)
 * @param {string} [opts.mime]      - προαιρετικό content-type (default image/jpeg)
 * @returns {Promise<string>}       - public download URL
 */
export async function uploadBase64ToStorage({ chatId, base64, mime = "image/jpeg" }) {
  const ext = guessExtFromMime(mime);
  const fileName = `${Date.now()}.${ext}`;
  const path = `chat-images/${chatId}/${fileName}`;
  await storageRN().ref(path).putString(base64, "base64", { contentType: mime });
  return storageRN().ref(path).getDownloadURL();
}

/**
 * Ανεβάζει εικόνα σε Storage από τοπικό αρχείο (file://...) διαβάζοντάς το ως base64.
 * @param {Object} opts
 * @param {string} opts.chatId
 * @param {string} opts.fileUri     - π.χ. asset.uri από ImagePicker
 * @param {string} [opts.mime]      - προαιρετικό content-type (default image/jpeg)
 * @returns {Promise<string>}       - public download URL
 */
export async function uploadLocalFileToStorage({ chatId, fileUri, mime = "image/jpeg" }) {
  const base64 = await FileSystem.readAsStringAsync(fileUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return uploadBase64ToStorage({ chatId, base64, mime });
}

/**
 * Κατεβάζει εικόνα από URL → base64 → upload.
 * @param {Object} opts
 * @param {string} opts.chatId
 * @param {string} opts.imageUrl
 * @returns {Promise<string>}
 */
export async function uploadFromRemoteUrl({ chatId, imageUrl }) {
  const tmp = `${Date.now()}`;
  const localPath = `${FileSystem.cacheDirectory}${tmp}`;
  const dl = await FileSystem.downloadAsync(imageUrl, localPath);

  let mime = "image/jpeg";
  const ct = dl?.headers?.["Content-Type"] || dl?.headers?.["content-type"];
  if (typeof ct === "string" && /^image\//i.test(ct)) mime = ct;
  else if (/\.(png)(\?|#|$)/i.test(imageUrl)) mime = "image/png";
  else if (/\.(webp)(\?|#|$)/i.test(imageUrl)) mime = "image/webp";
  else if (/\.(gif)(\?|#|$)/i.test(imageUrl)) mime = "image/gif";

  const url = await uploadLocalFileToStorage({ chatId, fileUri: localPath, mime });

  try { await FileSystem.deleteAsync(localPath, { idempotent: true }); } catch {}

  return url;
}
