// lib/uploadImage.js
import * as FileSystem from "expo-file-system";
import { getDownloadURL, ref as storageRef, uploadString } from "firebase/storage";

/**
 * Ανεβάζει εικόνα από local file:// ή content:// σε Firebase Storage με base64.
 */
export async function uploadImageFromLocalUri(storage, { chatId, uri, mime = "image/jpeg" }) {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const fileName = `${Date.now()}.jpg`;
  const imgRef = storageRef(storage, `chat-images/${chatId}/${fileName}`);
  await uploadString(imgRef, base64, "base64", { contentType: mime });
  const url = await getDownloadURL(imgRef);
  return url;
}

/**
 * Κατεβάζει εικόνα από remote URL σε cache, τη διαβάζει ως base64 και την ανεβάζει.
 * ΔΕΝ χρησιμοποιεί Blob/ArrayBuffer → σταθερό σε Android/Hermes.
 */
export async function uploadImageFromRemoteUrl(storage, { chatId, url }) {
  // κατέβασέ την πρώτα τοπικά
  const fileName = `${Date.now()}.jpg`;
  const localPath = `${FileSystem.cacheDirectory}${fileName}`;
  const dl = await FileSystem.downloadAsync(url, localPath);

  // προσπάθησε να μαντέψεις mime από headers/extension
  let mime = "image/jpeg";
  const ct = dl?.headers?.["Content-Type"] || dl?.headers?.["content-type"];
  if (typeof ct === "string" && ct.startsWith("image/")) mime = ct;
  else if (/\.(png)$/i.test(url)) mime = "image/png";
  else if (/\.(webp)$/i.test(url)) mime = "image/webp";
  else if (/\.(gif)$/i.test(url)) mime = "image/gif";

  // διάβασε base64 και ανέβασε
  const base64 = await FileSystem.readAsStringAsync(localPath, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const imgRef = storageRef(storage, `chat-images/${chatId}/${fileName}`);
  await uploadString(imgRef, base64, "base64", { contentType: mime });
  const publicUrl = await getDownloadURL(imgRef);

  // καθάρισε cache (best effort)
  try { await FileSystem.deleteAsync(localPath, { idempotent: true }); } catch {}
  return publicUrl;
}
