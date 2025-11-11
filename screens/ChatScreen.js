// screens/ChatScreen.js
import * as ImagePicker from "expo-image-picker";
import {
  addDoc,
  collection,
  endBefore,
  getDocs,
  limitToLast,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { ref as storageRef, uploadBytes } from "firebase/storage";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import ParsedText from "react-native-parsed-text";
import ShareMenu from "react-native-share-menu";
import { auth, db, functions, storage } from "../firebaseConfig";

const EXACT_URL_REGEX = /^https?:\/\/[^\s]+$/i;

// ---------- Tunables ----------
const PAGE_SIZE = 25;
const LIVE_LIMIT = 50;
// ------------------------------

const guessExtFromMime = (mime = "") => {
  const m = (mime || "").toLowerCase();
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

// ====== URL Utils / Previews ======
const YT_PATTERNS = [
  /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([\w-]{6,})/i,
  /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([\w-]{6,})/i,
  /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([\w-]{6,})/i,
];
const extractYouTubeId = (url) => {
  for (const re of YT_PATTERNS) {
    const m = (url || "").match(re);
    if (m?.[1]) return m[1];
  }
  return null;
};

// Lightweight OG fetch + YouTube fallback thumbnail
async function fetchOg(url) {
  try {
    const res = await fetch(url, { method: "GET", headers: { Accept: "text/html" } });
    const html = await res.text();
    const get = (prop) => {
      const m = html.match(
        new RegExp(
          `<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`,
          "i"
        )
      );
      return m?.[1];
    };
    const title =
      get("og:title") ||
      get("twitter:title") ||
      html.match(/<title>([^<]+)<\/title>/i)?.[1] ||
      url;

    let image = get("og:image") || get("twitter:image") || null;
    const desc = get("og:description") || get("twitter:description") || "";

    if (!image) {
      const vid = extractYouTubeId(url);
      if (vid) image = `https://img.youtube.com/vi/${vid}/hqdefault.jpg`;
    }
    return { title, desc, image };
  } catch {
    const vid = extractYouTubeId(url);
    if (vid) {
      return {
        title: "YouTube",
        desc: "",
        image: `https://img.youtube.com/vi/${vid}/hqdefault.jpg`,
      };
    }
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
      {data?.image ? (
        <Image source={{ uri: data.image }} style={styles.cardImageLarge} />
      ) : null}
      <View style={{ flex: 1, paddingHorizontal: 10, paddingVertical: 8 }}>
        <Text numberOfLines={1} style={styles.cardTitle}>
          {data?.title || url}
        </Text>
        {!!data?.desc && (
          <Text numberOfLines={2} style={styles.cardDesc}>
            {data.desc}
          </Text>
        )}
        <Text numberOfLines={1} style={styles.cardUrl}>
          {url}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

/** Upload οποιουδήποτε uri (content://, file://) στο Storage. Επιστρέφει storagePath. */
async function uploadUriToStorage({ uri, mime, storagePath }) {
  const res = await fetch(uri);
  const blob = await res.blob();
  const ref = storageRef(storage, storagePath);
  await uploadBytes(ref, blob, { contentType: mime });
  return storagePath;
}

/** Short-lived signed URL για ένα storagePath */
async function getSignedUrlFor(storagePath) {
  const callable = httpsCallable(functions, "chat_getSignedUrl");
  const { data } = await callable({ storagePath });
  return data?.url;
}

/** Incoming share (text/image/video/file/multiple) */
async function handleIncomingShare({ chatId, myEmail, item, uid }) {
  if (!chatId || !myEmail || !item || !uid) return;

  // 1) Text
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

  // 4) Multiple (Android SEND_MULTIPLE)
  if (Array.isArray(item.items) && item.items.length) {
    for (const sub of item.items) {
      await handleIncomingShare({ chatId, myEmail, item: sub, uid });
    }
    return;
  }

  // 5) Generic file
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

// ===== Helpers εμφάνισης =====
const dayKeyFromTs = (ts) => {
  if (!ts) return "unknown";
  const d = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
  return d.toISOString().slice(0, 10);
};
const dayLabel = (key) => {
  const d = new Date(key);
  if (isNaN(d.getTime())) return key;
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};
const timeLabel = (ts) => {
  if (!ts) return "";
  const d = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
};

const useSignedUrlCache = () => {
  const [cache, setCache] = useState({});
  const fetchAndCache = useCallback(async (storagePath) => {
    if (!storagePath) return null;
    if (cache[storagePath]) return cache[storagePath];
    const url = await getSignedUrlFor(storagePath);
    setCache((m) => ({ ...m, [storagePath]: url }));
    return url;
  }, [cache]);
  return { fetchAndCache };
};

const Avatar = ({ email }) => {
  const letter = (email || "?").slice(0, 1).toUpperCase();
  return (
    <View style={styles.avatar}>
      <Text style={styles.avatarText}>{letter}</Text>
    </View>
  );
};

const DaySeparator = ({ label }) => (
  <View style={styles.dayWrap}>
    <View style={styles.dayLine} />
    <Text style={styles.dayText}>{label}</Text>
    <View style={styles.dayLine} />
  </View>
);

function MessageBubble({ msg, myEmail, onPressLink, openUrl, fetchSigned }) {
  const isMine =
    myEmail && typeof msg.senderEmail === "string"
      ? msg.senderEmail.toLowerCase() === myEmail
      : false;

  const [signed, setSigned] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (msg?.media?.storagePath) {
          const url = await fetchSigned(msg.media.storagePath);
          if (alive) setSigned(url);
        } else setSigned(null);
      } catch (e) {
        console.warn("Signed URL error:", e?.message);
      }
    })();
    return () => { alive = false; };
  }, [msg?.media?.storagePath, fetchSigned]);

  const screenW = Dimensions.get("window").width;
  const imgSize = Math.min(380, Math.floor(screenW * 0.78));

  return (
    <View style={[styles.row, isMine ? styles.rowMine : styles.rowOther]}>
      {!isMine && <Avatar email={msg.senderEmail} />}

      <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther]}>
        {!!msg.text && (
          <ParsedText
            style={[styles.messageText, isMine && { color: "#fff" }]}
            parse={[{ type: "url", style: styles.linkText, onPress: onPressLink }]}
            selectable
          >
            {msg.text}
          </ParsedText>
        )}

        {!!msg.link && (
          <View style={{ marginTop: msg.text ? 8 : 0, maxWidth: 420 }}>
            <LinkPreviewCard url={msg.link} onPress={onPressLink} />
          </View>
        )}

        {msg.media?.type === "image" && signed && (
          <Image
            source={{ uri: signed }}
            style={{ width: imgSize, height: imgSize, borderRadius: 14, marginTop: 6 }}
          />
        )}

        {msg.media?.type === "video" && signed && (
          <TouchableOpacity onPress={() => openUrl(signed)} style={styles.fileCard}>
            <Text style={styles.fileTitle}>🎬 Open video</Text>
            <Text numberOfLines={1} style={styles.fileUrl}>{signed}</Text>
          </TouchableOpacity>
        )}

        {msg.media?.type === "file" && signed && (
          <TouchableOpacity onPress={() => openUrl(signed)} style={styles.fileCard}>
            <Text style={styles.fileTitle}>📎 {msg.media.name || "Open file"}</Text>
            <Text numberOfLines={1} style={styles.fileUrl}>{signed}</Text>
          </TouchableOpacity>
        )}

        <Text style={[styles.time, isMine ? styles.timeMine : styles.timeOther]}>
          {timeLabel(msg.timestamp)}
        </Text>
      </View>
    </View>
  );
}

export default function ChatScreen({ route }) {
  const { chatId, programTitle } = route?.params ?? {};
  const [messages, setMessages] = useState([]); // ascending
  const [hasMore, setHasMore] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const currentUser = auth.currentUser;
  const myEmail = useMemo(
    () => (currentUser?.email ? currentUser.email.toLowerCase() : null),
    [currentUser?.email]
  );
  const uid = currentUser?.uid || null;

  const { fetchAndCache } = useSignedUrlCache();
  const listRef = useRef(null);

  // ====== LIVE LISTENER (τελευταία LIVE_LIMIT σε ascending) ======
  useEffect(() => {
    if (!chatId) return;
    const liveQ = query(
      collection(db, "chats", chatId, "messages"),
      orderBy("timestamp", "asc"),
      limitToLast(LIVE_LIMIT)
    );
    const unsub = onSnapshot(
      liveQ,
      (snap) => {
        const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setMessages(arr);
        setHasMore(true);
      },
      (err) => {
        console.error("Messages subscribe error:", err);
        Alert.alert("Error", err.message);
      }
    );
    return () => unsub();
  }, [chatId]);

  // ====== Load older (asc + endBefore(oldest) + limitToLast) ======
  const loadOlder = useCallback(async () => {
    if (!chatId || loadingOlder || !hasMore || messages.length === 0) return;
    try {
      setLoadingOlder(true);
      const oldest = messages[0];
      const oldestTs = oldest?.timestamp;
      if (!oldestTs) { setLoadingOlder(false); return; }

      const olderQ = query(
        collection(db, "chats", chatId, "messages"),
        orderBy("timestamp", "asc"),
        endBefore(oldestTs),
        limitToLast(PAGE_SIZE)
      );
      const snap = await getDocs(olderQ);
      const got = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      if (got.length === 0) {
        setHasMore(false);
        setLoadingOlder(false);
        return;
      }
      setMessages((prev) => [...got, ...prev]);
    } catch (e) {
      console.error("Load older failed:", e);
    } finally {
      setLoadingOlder(false);
    }
  }, [chatId, messages, hasMore, loadingOlder]);

  // ------- Helpers -------
  const scrollToBottom = (animated = true) => {
    // inverted list -> bottom οπτικά = offset 0
    listRef.current?.scrollToOffset?.({ offset: 0, animated });
  };

  // Android Share
  useEffect(() => {
    const hasModule =
      Platform.OS === "android" &&
      ShareMenu &&
      typeof ShareMenu.getInitialShare === "function" &&
      typeof ShareMenu.addNewShareListener === "function";
    if (!hasModule) return;

    const run = (item) => {
      if (!item) return;
      if (!chatId || !myEmail || !uid) return;
      setLoading(true);
      handleIncomingShare({ chatId, myEmail, item, uid })
        .catch((e) => {
          console.error("Share handling failed:", e);
          Alert.alert("Share error", e?.message ?? "Failed to import shared content.");
        })
        .finally(() => {
          setLoading(false);
          setTimeout(() => scrollToBottom(true), 60);
        });
    };

    try {
      const maybePromise = ShareMenu.getInitialShare(run);
      if (maybePromise && typeof maybePromise.then === "function") {
        maybePromise.then(run).catch(() => {});
      }
    } catch {}

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
      setTimeout(() => scrollToBottom(true), 60);
    } catch (error) {
      console.error("Message send failed:", error);
      Alert.alert("Error", error?.message ?? "Failed to send message.");
    }
  };

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
        mediaTypes: ImagePicker.MediaTypeOptions.Images, // <-- FIX
        quality: 0.92,
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

      setTimeout(() => scrollToBottom(true), 60);
    } catch (error) {
      console.error("Image send failed:", error);
      Alert.alert("Error", error?.message ?? "Failed to send image.");
    } finally {
      setLoading(false);
    }
  };

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
        mediaTypes: ImagePicker.MediaTypeOptions.Videos, // <-- FIX
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

      setTimeout(() => scrollToBottom(true), 60);
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

  const openUrl = async (url) => {
    try { await Linking.openURL(url); }
    catch { Alert.alert("Cannot open", url); }
  };

  // Render data: κρατάμε asc στο state, αλλά στο render κάνουμε reverse
  // ώστε με inverted FlatList το «κάτω» να είναι πάντα το νεότερο.
  const renderData = useMemo(() => {
    // με separators ανά ημέρα
    const asc = messages;
    const out = [];
    let lastDay = null;
    for (let i = 0; i < asc.length; i++) {
      const m = asc[i];
      const k = dayKeyFromTs(m.timestamp || Date.now());
      if (k !== lastDay) {
        out.push({ type: "day", id: `day-${k}-${i}`, label: dayLabel(k) });
        lastDay = k;
      }
      out.push({ type: "msg", id: m.id, data: m });
    }
    // reverse για inverted
    return out.slice().reverse();
  }, [messages]);

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.topBar}>
        <Text numberOfLines={1} style={styles.topTitle}>{programTitle || "Chat"}</Text>
      </View>

      <FlatList
        ref={listRef}
        data={renderData}
        inverted
        keyExtractor={(item) => item.id}
        renderItem={({ item }) =>
          item.type === "day" ? (
            <DaySeparator label={item.label} />
          ) : (
            <MessageBubble
              msg={item.data}
              myEmail={myEmail}
              onPressLink={onPressLink}
              openUrl={openUrl}
              fetchSigned={fetchAndCache}
            />
          )
        }
        contentContainerStyle={{ padding: 12, paddingTop: 6 }}
        keyboardShouldPersistTaps="handled"
        maintainVisibleContentPosition={{ minIndexForVisible: 1 }}
        onEndReachedThreshold={0.15}
        onEndReached={() => {
          // inverted: onEndReached όταν φτάνουμε «πάνω» οπτικά -> φέρε παλιότερα
          loadOlder();
        }}
        ListFooterComponent={
          loadingOlder ? (
            <View style={{ paddingVertical: 8 }}>
              <ActivityIndicator />
            </View>
          ) : null
        }
      />

      {loading && (
        <View style={{ padding: 6, alignItems: "center" }}>
          <ActivityIndicator size="large" color="#22c55e" />
        </View>
      )}

      <View style={styles.inputBar}>
        <Pressable onPress={pickImage} style={({ pressed }) => [styles.circleBtn, pressed && { opacity: 0.7 }]}>
          <Text style={styles.circleBtnText}>📷</Text>
        </Pressable>

        <Pressable onPress={pickVideo} style={({ pressed }) => [styles.circleBtn, pressed && { opacity: 0.7 }]}>
          <Text style={styles.circleBtnText}>🎥</Text>
        </Pressable>

        <View style={styles.inputWrap}>
          <TextInput
            style={styles.input}
            placeholder="Message…"
            value={input}
            onChangeText={setInput}
            autoCapitalize="none"
            autoCorrect={false}
            multiline
            onFocus={() => setTimeout(() => scrollToBottom(true), 60)}
          />
        </View>

        <Pressable onPress={sendMessage} style={({ pressed }) => [styles.sendBtn, pressed && { opacity: 0.85 }]}>
          <Text style={styles.sendBtnText}>➤</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F6F7FB" },

  topBar: {
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#E5E7EB",
  },
  topTitle: { fontSize: 15, fontWeight: "700", color: "#111827" },

  row: { flexDirection: "row", marginVertical: 6, paddingHorizontal: 4 },
  rowMine: { justifyContent: "flex-end" },
  rowOther: { justifyContent: "flex-start" },

  avatar: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: "#CBD5E1",
    alignItems: "center", justifyContent: "center", marginRight: 8, marginTop: 2,
  },
  avatarText: { color: "#1F2937", fontWeight: "700" },

  bubble: {
    maxWidth: "82%",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 1 },
    }),
  },
  bubbleMine: {
    backgroundColor: "#3B82F6",
    borderTopRightRadius: 6,
    alignSelf: "flex-end",
  },
  bubbleOther: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 6,
    alignSelf: "flex-start",
  },

  messageText: { fontSize: 16, color: "#111827" },
  linkText: { textDecorationLine: "underline" },

  time: { fontSize: 11, marginTop: 6, alignSelf: "flex-end", opacity: 0.75 },
  timeMine: { color: "rgba(255,255,255,0.9)" },
  timeOther: { color: "#6B7280" },

  // Link card (με μεγάλη εικόνα πάνω)
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#eee",
    overflow: "hidden",
    maxWidth: 420,
    marginTop: 6,
  },
  cardImageLarge: { width: "100%", height: 200 },
  cardTitle: { fontWeight: "700", color: "#111827" },
  cardDesc: { color: "#4B5563", marginTop: 4, fontSize: 12 },
  cardUrl: { color: "#6B7280", marginTop: 6, fontSize: 12 },

  // file/video card
  fileCard: {
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#eee",
    padding: 10,
    marginTop: 6,
    maxWidth: 380,
  },
  fileTitle: { fontWeight: "600", marginBottom: 4, color: "#111827" },
  fileUrl: { fontSize: 12, color: "#6B7280" },

  // day separator
  dayWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginVertical: 10,
    paddingHorizontal: 8,
  },
  dayLine: { flex: 1, height: 1, backgroundColor: "#E5E7EB" },
  dayText: {
    fontSize: 12,
    color: "#6B7280",
    backgroundColor: "#E5E7EB",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },

  // input
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#fff",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: "#E5E7EB",
    gap: 8,
  },
  circleBtn: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "#F3F4F6", borderWidth: StyleSheet.hairlineWidth, borderColor: "#E5E7EB",
  },
  circleBtnText: { fontSize: 18 },

  inputWrap: {
    flex: 1,
    backgroundColor: "#F3F4F6",
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E5E7EB",
    maxHeight: 120,
  },
  input: { paddingHorizontal: 12, paddingVertical: 8, fontSize: 16 },

  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "#22C55E",
  },
  sendBtnText: { color: "#fff", fontSize: 18, fontWeight: "800", marginLeft: 2 },
});
