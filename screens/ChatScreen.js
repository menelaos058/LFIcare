// screens/ChatScreen.js
import * as ImagePicker from "expo-image-picker";
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import {
  ref as storageRef,
  uploadBytes
} from "firebase/storage";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import ParsedText from "react-native-parsed-text";
import ShareMenu from "react-native-share-menu";
import { auth, db, functions, storage } from "../firebaseConfig"; // <- ΠΡΟΣΟΧΗ: θέλουμε και functions

const EXACT_URL_REGEX = /^https?:\/\/[^\s]+$/i;

const guessExtFromMime = (mime = "") => {
  const m = mime.toLowerCase();
  if (m.includes("png")) return "png";
  if (m.includes("webp")) return "webp";
  if (m.includes("gif")) return "gif";
  if (m.includes("heic") || m.includes("heif")) return "heic";
  if (m.includes("jpeg") || m.includes("jpg")) return "jpg";
  if (m.includes("mp4")) return "mp4";
  if (m.includes("quicktime") || m.includes("mov")) return "mov";
  if (m.includes("mkv")) return "mkv";
  if (m.includes("avi")) return "avi";
  if (m.includes("pdf")) return "pdf";
  if (m.includes("plain")) return "txt";
  return "bin";
};

// --- Lightweight OG preview (best-effort) ---
async function fetchOg(url) {
  try {
    const res = await fetch(url, { method: "GET", headers: { Accept: "text/html" } });
    const html = await res.text();
    const get = (prop) => {
      const m = html.match(
        new RegExp(
          `<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']+)["']`,
          "i"
        )
      );
      return m?.[1];
    };
    const title = get("og:title") || (html.match(/<title>([^<]+)<\/title>/i)?.[1] ?? url);
    const desc = get("og:description") || "";
    const image = get("og:image") || null;
    return { title, desc, image };
  } catch {
    return { title: url, desc: "", image: null };
  }
}

function LinkPreviewCard({ url, onPress }) {
  const [data, setData] = useState(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    fetchOg(url).then((d) => mounted.current && setData(d));
    return () => { mounted.current = false; };
  }, [url]);
  return (
    <TouchableOpacity onPress={() => onPress(url)} style={styles.card}>
      {data?.image ? <Image source={{ uri: data.image }} style={styles.cardImage} /> : null}
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={styles.cardTitle}>{data?.title || url}</Text>
        {!!data?.desc && <Text numberOfLines={2} style={styles.cardDesc}>{data.desc}</Text>}
        <Text numberOfLines={1} style={styles.cardUrl}>{url}</Text>
      </View>
    </TouchableOpacity>
  );
}

/** Upload οποιουδήποτε uri (content://, file://) στο Storage. Επιστρέφει το storagePath που αποθηκεύουμε στο Firestore. */
async function uploadUriToStorage({ uri, mime, storagePath }) {
  const res = await fetch(uri);
  const blob = await res.blob();
  const ref = storageRef(storage, storagePath);
  await uploadBytes(ref, blob, { contentType: mime });
  return storagePath;
}

/** Καλεί την Cloud Function για να πάρει short-lived signed URL για ένα storagePath */
async function getSignedUrlFor(storagePath) {
  const callable = httpsCallable(functions, "chat_getSignedUrl");
  const { data } = await callable({ storagePath });
  return data?.url; // signed URL
}

/** Διαχείριση incoming share (text / image / video / generic file / multiple) */
async function handleIncomingShare({ chatId, myEmail, item, uid }) {
  if (!chatId || !myEmail || !item || !uid) return;

  // 1) Text (text/plain)
  if (item.mimeType?.startsWith("text/")) {
    const text = (item.data || "").trim();
    if (!text) return;
    const payload = EXACT_URL_REGEX.test(text) ? { link: text } : { text };
    await addDoc(collection(db, "chats", chatId, "messages"), {
      senderEmail: myEmail,
      ...payload,
      timestamp: serverTimestamp(),
    });
    return;
  }

  // 2) Image
  if (item.mimeType?.startsWith("image/") && item.data) {
    const uri = item.data;
    const mime = item.mimeType || "image/jpeg";
    const ext = guessExtFromMime(mime);
    const fileId = `${Date.now()}.${ext}`;
    const storagePath = `chat-media/${chatId}/${uid}/${fileId}`;

    await uploadUriToStorage({ uri, mime, storagePath });
    await addDoc(collection(db, "chats", chatId, "messages"), {
      senderEmail: myEmail,
      media: { type: "image", storagePath, name: fileId, mime },
      timestamp: serverTimestamp(),
    });
    return;
  }

  // 3) Video
  if (item.mimeType?.startsWith("video/") && item.data) {
    const uri = item.data;
    const mime = item.mimeType || "video/mp4";
    const ext = guessExtFromMime(mime);
    const fileId = `${Date.now()}.${ext}`;
    const storagePath = `chat-media/${chatId}/${uid}/${fileId}`;

    await uploadUriToStorage({ uri, mime, storagePath });
    await addDoc(collection(db, "chats", chatId, "messages"), {
      senderEmail: myEmail,
      media: { type: "video", storagePath, name: fileId, mime },
      timestamp: serverTimestamp(),
    });
    return;
  }

  // 4) Multiple items (Android SEND_MULTIPLE)
  if (Array.isArray(item.items) && item.items.length) {
    for (const sub of item.items) {
      await handleIncomingShare({ chatId, myEmail, item: sub, uid });
    }
    return;
  }

  // 5) Generic file (*/*)
  if (item.data) {
    const uri = item.data;
    const mime = item.mimeType || "application/octet-stream";
    const ext = guessExtFromMime(mime);
    const fileId = `${Date.now()}.${ext}`;
    const storagePath = `chat-media/${chatId}/${uid}/${fileId}`;

    await uploadUriToStorage({ uri, mime, storagePath });
    await addDoc(collection(db, "chats", chatId, "messages"), {
      senderEmail: myEmail,
      media: { type: "file", storagePath, name: fileId, mime },
      timestamp: serverTimestamp(),
    });
  }
}

export default function ChatScreen({ route }) {
  const { chatId, programTitle } = route?.params ?? {};
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [signedUrlCache, setSignedUrlCache] = useState({}); // { storagePath: url }

  const currentUser = auth.currentUser;
  const myEmail = useMemo(
    () => (currentUser?.email ? currentUser.email.toLowerCase() : null),
    [currentUser?.email]
  );
  const uid = currentUser?.uid || null;

  // subscribe to messages
  useEffect(() => {
    if (!chatId) return;
    const q = query(
      collection(db, "chats", chatId, "messages"),
      orderBy("timestamp", "asc")
    );
    const unsub = onSnapshot(
      q,
      (snap) => setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => {
        console.error("Messages subscribe error:", err);
        Alert.alert("Error", err.message);
      }
    );
    return () => unsub();
  }, [chatId]);

  // Share intents / extensions
  useEffect(() => {
    const run = (item) => {
      if (!item) return;
      if (!chatId || !myEmail || !uid) return;
      setLoading(true);
      handleIncomingShare({ chatId, myEmail, item, uid })
        .catch((e) => {
          console.error("Share handling failed:", e);
          Alert.alert("Share error", e?.message ?? "Failed to import shared content.");
        })
        .finally(() => setLoading(false));
    };

    ShareMenu.getInitialShare(run);
    const listener = ShareMenu.addNewShareListener(run);
    return () => {
      try { listener?.remove?.(); } catch {}
    };
  }, [chatId, myEmail, uid]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text) return;
    if (!chatId || !myEmail) {
      Alert.alert("Error", "Not authenticated or no chat selected.");
      return;
    }
    try {
      const payload = EXACT_URL_REGEX.test(text) ? { link: text } : { text };
      await addDoc(collection(db, "chats", chatId, "messages"), {
        senderEmail: myEmail,
        ...payload,
        timestamp: serverTimestamp(),
      });
      setInput("");
    } catch (error) {
      console.error("Message send failed:", error);
      Alert.alert("Error", error?.message ?? "Failed to send message.");
    }
  };

  // PICK image
  const pickImage = async () => {
    if (!chatId || !myEmail || !uid) {
      Alert.alert("Error", "Not authenticated or no chat selected.");
      return;
    }
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permission needed", "Please allow photo library access.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaType.Images,
        quality: 0.8,
        base64: false,
      });
      if (result.canceled || !result.assets?.[0]) return;

      setLoading(true);

      const asset = result.assets[0];
      if (!asset.uri) throw new Error("No asset uri from picker");

      const mime = asset.mimeType || "image/jpeg";
      const ext = guessExtFromMime(mime);
      const fileId = `${Date.now()}.${ext}`;
      const storagePath = `chat-media/${chatId}/${uid}/${fileId}`;

      await uploadUriToStorage({ uri: asset.uri, mime, storagePath });

      await addDoc(collection(db, "chats", chatId, "messages"), {
        senderEmail: myEmail,
        media: { type: "image", storagePath, name: fileId, mime },
        timestamp: serverTimestamp(),
      });
    } catch (error) {
      console.error("Image send failed:", error);
      Alert.alert("Error", error?.message ?? "Failed to send image.");
    } finally {
      setLoading(false);
    }
  };

  // PICK video
  const pickVideo = async () => {
    if (!chatId || !myEmail || !uid) {
      Alert.alert("Error", "Not authenticated or no chat selected.");
      return;
    }
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permission needed", "Please allow photo library access.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaType.Videos,
        quality: 1,
        base64: false,
      });
      if (result.canceled || !result.assets?.[0]) return;

      setLoading(true);

      const asset = result.assets[0];
      if (!asset.uri) throw new Error("No asset uri from picker");

      const mime = asset.mimeType || "video/mp4";
      const ext = guessExtFromMime(mime);
      const fileId = `${Date.now()}.${ext}`;
      const storagePath = `chat-media/${chatId}/${uid}/${fileId}`;

      await uploadUriToStorage({ uri: asset.uri, mime, storagePath });

      await addDoc(collection(db, "chats", chatId, "messages"), {
        senderEmail: myEmail,
        media: { type: "video", storagePath, name: fileId, mime },
        timestamp: serverTimestamp(),
      });
    } catch (error) {
      console.error("Video send failed:", error);
      Alert.alert("Error", error?.message ?? "Failed to send video.");
    } finally {
      setLoading(false);
    }
  };

  const onPressLink = async (url) => {
    try {
      const clean = (url ?? "").toString().trim().replace(/[)\].,]+$/g, "");
      if (!clean) return;
      if (/^https?:\/\//i.test(clean)) {
        await Linking.openURL(clean);
        return;
      }
      const ok = await Linking.canOpenURL(clean);
      if (ok) await Linking.openURL(clean);
      else Alert.alert("Cannot open link", clean);
    } catch (e) {
      console.error("openURL error", e);
      Alert.alert("Cannot open link", url ?? "");
    }
  };

  // cache signed URL per storagePath (λήγει — μπορείς να το ξαναζητήσεις με long-press)
  const useSignedUrl = (storagePath) => {
    const [url, setUrl] = useState(signedUrlCache[storagePath]);
    useEffect(() => {
      let alive = true;
      (async () => {
        try {
          if (!storagePath) return;
          const signed = await getSignedUrlFor(storagePath);
          if (alive) {
            setUrl(signed);
            setSignedUrlCache((m) => ({ ...m, [storagePath]: signed }));
          }
        } catch (e) {
          console.warn("Signed URL error:", e?.message);
        }
      })();
      return () => { alive = false; };
    }, [storagePath]);
    return url;
  };

  const openUrl = async (url) => {
    try { await Linking.openURL(url); }
    catch { Alert.alert("Cannot open", url); }
  };

  const renderMessage = ({ item }) => {
    const isMine =
      myEmail && typeof item.senderEmail === "string"
        ? item.senderEmail.toLowerCase() === myEmail
        : false;

    // media rendering
    let mediaNode = null;
    if (item.media?.storagePath && item.media?.type) {
      const signed = useSignedUrl(item.media.storagePath);
      if (item.media.type === "image" && signed) {
        mediaNode = <Image source={{ uri: signed }} style={styles.image} />;
      } else if (item.media.type === "video" && signed) {
        mediaNode = (
          <TouchableOpacity onPress={() => openUrl(signed)} style={styles.fileCard}>
            <Text style={styles.fileTitle}>🎬 Open video</Text>
            <Text numberOfLines={1} style={styles.fileUrl}>{signed}</Text>
          </TouchableOpacity>
        );
      } else if (item.media.type === "file" && signed) {
        mediaNode = (
          <TouchableOpacity onPress={() => openUrl(signed)} style={styles.fileCard}>
            <Text style={styles.fileTitle}>📎 {item.media.name || "Open file"}</Text>
            <Text numberOfLines={1} style={styles.fileUrl}>{signed}</Text>
          </TouchableOpacity>
        );
      }
    }

    return (
      <View style={[styles.messageContainer, isMine ? styles.myMessage : styles.otherMessage]}>
        {item.text ? (
          <ParsedText
            style={styles.messageText}
            parse={[{ type: "url", style: styles.linkText, onPress: onPressLink }]}
            selectable
          >
            {item.text}
          </ParsedText>
        ) : null}

        {item.link ? (
          <View style={{ marginBottom: 6, maxWidth: 280 }}>
            <LinkPreviewCard url={item.link} onPress={onPressLink} />
          </View>
        ) : null}

        {mediaNode}

        <Text style={styles.senderName}>{isMine ? "You" : item.senderEmail}</Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Text style={styles.headerTitle}>{programTitle || "Chat"}</Text>

      <FlatList
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 10 }}
        keyboardShouldPersistTaps="handled"
      />

      {loading && (
        <View style={{ padding: 8, alignItems: "center" }}>
          <ActivityIndicator size="large" color="#28a745" />
        </View>
      )}

      <View style={styles.inputContainer}>
        <TouchableOpacity onPress={pickImage} style={styles.imageButton}>
          <Text style={styles.imageButtonText}>📷</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={pickVideo} style={[styles.imageButton, { marginLeft: 6 }]}>
          <Text style={styles.imageButtonText}>🎥</Text>
        </TouchableOpacity>

        <TextInput
          style={styles.input}
          placeholder="Type a message or paste a link…"
          value={input}
          onChangeText={setInput}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <TouchableOpacity onPress={sendMessage} style={styles.sendButton}>
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  headerTitle: {
    fontSize: 18, fontWeight: "600", color: "#333", paddingVertical: 12,
    textAlign: "center", backgroundColor: "#fff", borderBottomWidth: 1, borderColor: "#ddd",
  },
  messageContainer: { padding: 10, borderRadius: 8, marginVertical: 5, maxWidth: "80%" },
  myMessage: { backgroundColor: "#d1e7dd", alignSelf: "flex-end" },
  otherMessage: { backgroundColor: "#fff", alignSelf: "flex-start" },
  messageText: { fontSize: 16, marginBottom: 5 },
  linkText: { color: "#007bff", textDecorationLine: "underline" },
  senderName: { fontSize: 12, color: "#555", marginTop: 3 },
  image: { width: 200, height: 200, borderRadius: 8, marginBottom: 5 },

  inputContainer: {
    flexDirection: "row", padding: 10, alignItems: "center",
    borderTopWidth: 1, borderColor: "#ddd", backgroundColor: "#fff",
  },
  input: {
    flex: 1, backgroundColor: "#f1f1f1", paddingVertical: 10, paddingHorizontal: 15,
    borderRadius: 20, marginHorizontal: 10, fontSize: 16,
  },
  sendButton: { backgroundColor: "#28a745", paddingVertical: 10, paddingHorizontal: 15, borderRadius: 20 },
  sendButtonText: { color: "#fff", fontWeight: "600" },
  imageButton: { backgroundColor: "#ddd", padding: 10, borderRadius: 25 },
  imageButtonText: { fontSize: 18 },

  // Link card
  card: {
    flexDirection: "row", backgroundColor: "#fff", borderRadius: 10,
    borderWidth: 1, borderColor: "#eee", overflow: "hidden", maxWidth: 280,
  },
  cardImage: { width: 80, height: 80 },
  cardTitle: { fontWeight: "600", marginHorizontal: 10, marginTop: 8 },
  cardDesc: { color: "#555", marginHorizontal: 10, marginTop: 2, fontSize: 12 },
  cardUrl: { color: "#777", marginHorizontal: 10, marginVertical: 8, fontSize: 12 },

  // file/video card
  fileCard: {
    backgroundColor: "#fff", borderRadius: 10, borderWidth: 1, borderColor: "#eee",
    padding: 10, marginBottom: 6, maxWidth: 280,
  },
  fileTitle: { fontWeight: "600", marginBottom: 4 },
  fileUrl: { fontSize: 12, color: "#777" },
});
