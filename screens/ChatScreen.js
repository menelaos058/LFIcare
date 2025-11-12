// screens/ChatScreen.js
import Constants from "expo-constants";
import * as FileSystem from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library";
import {
  addDoc,
  collection,
  endBefore,
  getDocs,
  limitToLast,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import {
  getDownloadURL,
  ref as storageRef,
  uploadBytes,
} from "firebase/storage";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import ImageViewing from "react-native-image-viewing";
import ParsedText from "react-native-parsed-text";
import { auth, db, functions, storage } from "../firebaseConfig";

/* ========================= Config ========================= */
const EXACT_URL_REGEX = /^https?:\/\/[^\s]+$/i;
const PAGE_SIZE = 25;
const LIVE_LIMIT = 50;

/* ========================= Utils ========================= */
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

// --- Link preview helpers (OG + YouTube thumbnail fallback) ---
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
    if (vid) return { title: "YouTube", desc: "", image: `https://img.youtube.com/vi/${vid}/hqdefault.jpg` };
    return { title: url, desc: "", image: null };
  }
}
const LinkPreviewCard = React.memo(({ url, onPress }) => {
  const [data, setData] = useState(null);
  useEffect(() => {
    let alive = true;
    fetchOg(url).then((d) => alive && setData(d));
    return () => { alive = false; };
  }, [url]);
  return (
    <TouchableOpacity onPress={() => onPress(url)} style={styles.card}>
      {data?.image ? <Image source={{ uri: data.image }} style={styles.cardImageLarge} /> : null}
      <View style={{ flex: 1, paddingHorizontal: 10, paddingVertical: 8 }}>
        <Text numberOfLines={1} style={styles.cardTitle}>{data?.title || url}</Text>
        {!!data?.desc && <Text numberOfLines={2} style={styles.cardDesc}>{data.desc}</Text>}
        <Text numberOfLines={1} style={styles.cardUrl}>{url}</Text>
      </View>
    </TouchableOpacity>
  );
});

// Storage upload
async function uploadUriToStorage({ uri, mime, storagePath }) {
  const res = await fetch(uri);
  const blob = await res.blob();
  const ref = storageRef(storage, storagePath);
  await uploadBytes(ref, blob, { contentType: mime });
  return storagePath;
}

// Signed URL (Cloud Function) ή fallback σε getDownloadURL (και τα δύο με retries)
async function getSignedOrDownloadURL(storagePath, tries = 5, delayMs = 240) {
  const ref = storageRef(storage, storagePath);

  for (let i = 0; i < tries; i++) {
    // 1) Cloud Function (signed URL)
    try {
      const callable = httpsCallable(functions, "chat_getSignedUrl");
      const { data } = await callable({ storagePath });
      if (data?.url) return data.url;
      throw new Error("no-url");
    } catch (e) {
      const transientMsg = String(e?.message || "").toLowerCase();
      const shouldRetryCF = transientMsg.includes("not-found") || transientMsg.includes("no-url");
      if (!shouldRetryCF) {
        // αν είναι άλλο error, προχώρα σε fallback χωρίς να σταματήσεις το loop
      }
    }

    // 2) Fallback: Storage getDownloadURL (απαιτεί να περνάς τους κανόνες σου — που περνάς ως μέλος chat)
    try {
      const url = await getDownloadURL(ref);
      if (url) return url;
    } catch {
      // πιθανό race αμέσως μετά το upload -> retry
    }

    if (i < tries - 1) {
      await new Promise((r) => setTimeout(r, delayMs * Math.pow(1.7, i)));
    }
  }

  return null; // τελική αποτυχία, σιωπηλά δεν εμφανίζουμε media
}

/* ========================= Share (Android) ========================= */
const isExpoGo = Constants?.appOwnership === "expo";
function getShareMenu() {
  if (Platform.OS !== "android" || isExpoGo) return null;
  try {
    const mod = require("react-native-share-menu");
    const hasAny =
      typeof mod?.getInitialShare === "function" ||
      typeof mod?.getSharedText === "function" ||
      typeof mod?.addNewShareListener === "function" ||
      typeof mod?.addListener === "function" ||
      typeof mod?.addShareListener === "function";
    return hasAny ? mod : null;
  } catch {
    return null;
  }
}
async function handleIncomingShare({ chatId, myEmail, item, uid }) {
  if (!chatId || !myEmail || !item || !uid) return;
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
  if (item.mimeType?.startsWith("image/") && item.data) {
    const mime = item.mimeType || "image/jpeg";
    const ext = guessExtFromMime(mime);
    const fileId = `${Date.now()}.${ext}`;
    const storagePath = `chat-media/${chatId}/${uid}/${fileId}`;
    await uploadUriToStorage({ uri: item.data, mime, storagePath });
    await addDoc(collection(db, "chats", chatId, "messages"), {
      senderEmail: myEmail,
      media: { type: "image", storagePath, name: fileId, mime },
      timestamp: serverTimestamp(),
    });
    return;
  }
  if (item.mimeType?.startsWith("video/") && item.data) {
    const mime = item.mimeType || "video/mp4";
    const ext = guessExtFromMime(mime);
    const fileId = `${Date.now()}.${ext}`;
    const storagePath = `chat-media/${chatId}/${uid}/${fileId}`;
    await uploadUriToStorage({ uri: item.data, mime, storagePath });
    await addDoc(collection(db, "chats", chatId, "messages"), {
      senderEmail: myEmail,
      media: { type: "video", storagePath, name: fileId, mime },
      timestamp: serverTimestamp(),
    });
    return;
  }
  if (Array.isArray(item.items) && item.items.length) {
    for (const sub of item.items) {
      await handleIncomingShare({ chatId, myEmail, item: sub, uid });
    }
    return;
  }
  if (item.data) {
    const mime = item.mimeType || "application/octet-stream";
    const ext = guessExtFromMime(mime);
    const fileId = `${Date.now()}.${ext}`;
    const storagePath = `chat-media/${chatId}/${uid}/${fileId}`;
    await uploadUriToStorage({ uri: item.data, mime, storagePath });
    await addDoc(collection(db, "chats", chatId, "messages"), {
      senderEmail: myEmail,
      media: { type: "file", storagePath, name: fileId, mime },
      timestamp: serverTimestamp(),
    });
  }
}

/* ========================= Formatting ========================= */
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

/* ========================= Small hooks/components ========================= */
const useSignedUrlCache = () => {
  const [cache, setCache] = useState({});
  const fetchAndCache = useCallback(async (storagePath) => {
    if (!storagePath) return null;
    if (cache[storagePath]) return cache[storagePath];
    const url = await getSignedOrDownloadURL(storagePath);
    if (url) setCache((m) => ({ ...m, [storagePath]: url }));
    return url || null;
  }, [cache]);
  return { fetchAndCache };
};

const Avatar = React.memo(({ email }) => {
  const letter = (email || "?").slice(0, 1).toUpperCase();
  return (
    <View style={styles.avatar}>
      <Text style={styles.avatarText}>{letter}</Text>
    </View>
  );
});

const DaySeparator = React.memo(({ label }) => (
  <View style={styles.dayWrap}>
    <View style={styles.dayLine} />
    <Text style={styles.dayText}>{label}</Text>
    <View style={styles.dayLine} />
  </View>
));

const MessageBubble = React.memo(function MessageBubble({
  msg,
  myEmail,
  onPressLink,
  openUrl,
  fetchSigned,
  onPressImage,
}) {
  const isMine =
    myEmail && typeof msg.senderEmail === "string"
      ? msg.senderEmail.toLowerCase() === myEmail
      : false;

  const [signed, setSigned] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!msg?.media?.storagePath) {
        if (alive) setSigned(null);
        return;
      }
      const url = await fetchSigned(msg.media.storagePath);
      if (alive) setSigned(url); // μπορεί να είναι null αν όλα αποτύχουν
    })();
    return () => { alive = false; };
  }, [msg?.media?.storagePath, fetchSigned]);

  const screenW = Dimensions.get("window").width;
  const imgSize = Math.min(420, Math.floor(screenW * 0.80));

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
          <View style={{ marginTop: msg.text ? 8 : 0, maxWidth: 440 }}>
            <LinkPreviewCard url={msg.link} onPress={onPressLink} />
          </View>
        )}

        {msg.media?.type === "image" && signed && (
          <Pressable
            onPress={() => onPressImage(signed)}
            style={{ marginTop: 6, borderRadius: 14, overflow: "hidden" }}
          >
            <Image
              source={{ uri: signed }}
              style={{ width: imgSize, height: imgSize, borderRadius: 14 }}
            />
          </Pressable>
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
}, (a, b) =>
  a.msg?.id === b.msg?.id &&
  a.msg?.text === b.msg?.text &&
  a.msg?.link === b.msg?.link &&
  a.msg?.media?.storagePath === b.msg?.media?.storagePath &&
  a.msg?.timestamp?.seconds === b.msg?.timestamp?.seconds &&
  a.myEmail === b.myEmail
);

/* ========================= Main Screen ========================= */
export default function ChatScreen({ route }) {
  const { chatId, programTitle } = route?.params ?? {};
  const [messages, setMessages] = useState([]); // ascending
  const [hasMore, setHasMore] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  // Full-screen viewer state
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerImage, setViewerImage] = useState(null);
  const [saving, setSaving] = useState(false);

  const currentUser = auth.currentUser;
  const myEmail = useMemo(
    () => (currentUser?.email ? currentUser.email.toLowerCase() : null),
    [currentUser?.email]
  );
  const uid = currentUser?.uid || null;

  const { fetchAndCache } = useSignedUrlCache();
  const listRef = useRef(null);
  const firstLiveBatch = useRef(true);
  const loadOlderDebounce = useRef(0);

  // Live listener (τελευταία LIVE_LIMIT asc)
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

        // Στο πρώτο batch μπαίνουμε τέρμα κάτω
        if (firstLiveBatch.current) {
          firstLiveBatch.current = false;
          setTimeout(() => {
            listRef.current?.scrollToOffset?.({ offset: 0, animated: false });
          }, 30);
        }
      },
      (err) => {
        console.error("Messages subscribe error:", err);
        Alert.alert("Error", err.message);
      }
    );
    return () => {
      firstLiveBatch.current = true;
      unsub();
    };
  }, [chatId]);

  // Φόρτωση παλαιότερων (asc + endBefore(oldest) + limitToLast)
  const loadOlder = useCallback(async () => {
    const now = Date.now();
    if (now - loadOlderDebounce.current < 400) return; // debounce
    loadOlderDebounce.current = now;

    if (!chatId || loadingOlder || !hasMore || messages.length === 0) return;
    try {
      setLoadingOlder(true);
      const oldestTs = messages[0]?.timestamp;
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
      } else {
        setMessages((prev) => [...got, ...prev]);
      }
    } catch (e) {
      console.error("Load older failed:", e);
    } finally {
      setLoadingOlder(false);
    }
  }, [chatId, messages, hasMore, loadingOlder]);

  const scrollToBottom = (animated = true) => {
    listRef.current?.scrollToOffset?.({ offset: 0, animated });
  };

  // Android share integration (σιωπηλό όταν δεν υπάρχει)
  useEffect(() => {
    const ShareMenu = getShareMenu();
    if (!ShareMenu) return;

    const run = (item) => {
      if (!item || !chatId || !myEmail || !uid) return;
      setLoading(true);
      handleIncomingShare({ chatId, myEmail, item, uid })
        .finally(() => {
          setLoading(false);
          setTimeout(() => scrollToBottom(true), 60);
        });
    };

    try {
      if (typeof ShareMenu.getInitialShare === "function") {
        const maybe = ShareMenu.getInitialShare(run);
        if (maybe?.then) maybe.then(run).catch(() => {});
      } else if (typeof ShareMenu.getSharedText === "function") {
        ShareMenu.getSharedText().then((text) => {
          if (text) run({ mimeType: "text/plain", data: String(text) });
        }).catch(() => {});
      }
    } catch {}

    let remove;
    try {
      if (typeof ShareMenu.addNewShareListener === "function") {
        const sub = ShareMenu.addNewShareListener(run);
        remove = () => sub?.remove?.();
      } else if (typeof ShareMenu.addListener === "function") {
        const sub = ShareMenu.addListener("ShareReceived", run);
        remove = () => sub?.remove?.();
      } else if (typeof ShareMenu.addShareListener === "function") {
        const sub = ShareMenu.addShareListener(run);
        remove = () => sub?.remove?.();
      }
    } catch {}

    return () => { try { remove?.(); } catch {} };
  }, [chatId, myEmail, uid]);

  /* ----------------- Senders ----------------- */
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
      setTimeout(() => scrollToBottom(true), 50);
    } catch (error) {
      Alert.alert("Error", error?.message ?? "Failed to send message.");
    }
  };

  // ΠΑΝΤΑ χρήση του νέου API
  const Media = useMemo(() => {
    const M = ImagePicker.MediaType;
    if (M && typeof M.Images === "string") return M;
    return { Images: "images", Videos: "videos", All: "all" };
  }, []);

  const pickImage = async () => {
    if (!chatId || !myEmail || !uid) return Alert.alert("Error", "Not authenticated or no chat selected.");
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return Alert.alert("Permission needed", "Please allow photo library access.");

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: Media.Images,
        quality: 0.95,
        base64: false,
        selectionLimit: 1,
      });
      if (result.canceled || !result.assets?.[0]) return;

      setLoading(true);
      const asset = result.assets[0];
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

      setTimeout(() => scrollToBottom(true), 50);
    } catch (error) {
      Alert.alert("Error", error?.message ?? "Failed to send image.");
    } finally {
      setLoading(false);
    }
  };

  const pickVideo = async () => {
    if (!chatId || !myEmail || !uid) return Alert.alert("Error", "Not authenticated or no chat selected.");
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return Alert.alert("Permission needed", "Please allow photo library access.");

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: Media.Videos,
        quality: 1,
        base64: false,
        selectionLimit: 1,
      });
      if (result.canceled || !result.assets?.[0]) return;

      setLoading(true);
      const asset = result.assets[0];
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

      setTimeout(() => scrollToBottom(true), 50);
    } catch (error) {
      Alert.alert("Error", error?.message ?? "Failed to send video.");
    } finally {
      setLoading(false);
    }
  };

  /* ----------------- Full-screen viewer ----------------- */
  const openViewer = useCallback((url) => {
    setViewerImage(url);
    setViewerVisible(true);
  }, []);

  const saveCurrentImage = useCallback(async () => {
    if (!viewerImage) return;
    try {
      setSaving(true);
      // άδεια για write σε gallery
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Please allow media library access to save the image.");
        setSaving(false);
        return;
      }
      // κατέβασμα σε προσωρινό φάκελο
      const filename = `chat-${Date.now()}.jpg`;
      const dest = FileSystem.cacheDirectory + filename;
      const { uri } = await FileSystem.downloadAsync(viewerImage, dest);
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert("Saved", "Image saved to your gallery.");
    } catch (e) {
      Alert.alert("Save failed", e?.message ?? "Could not save image.");
    } finally {
      setSaving(false);
    }
  }, [viewerImage]);

  /* ----------------- Render model ----------------- */
  const renderData = useMemo(() => {
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
    return out.slice().reverse();
  }, [messages]);

  const keyExtractor = useCallback((item) => item.id, []);
  const renderItem = useCallback(
    ({ item }) =>
      item.type === "day" ? (
        <DaySeparator label={item.label} />
      ) : (
        <MessageBubble
          msg={item.data}
          myEmail={myEmail}
          onPressLink={(url) => {
            const clean = (url ?? "").toString().trim().replace(/[)\].,]+$/g, "");
            if (!clean) return;
            /^https?:\/\//i.test(clean)
              ? Linking.openURL(clean).catch(() => Alert.alert("Cannot open link", clean))
              : Linking.canOpenURL(clean)
                  .then((ok) => (ok ? Linking.openURL(clean) : Alert.alert("Cannot open link", clean)))
                  .catch(() => Alert.alert("Cannot open link", clean));
          }}
          openUrl={(u) => Linking.openURL(u).catch(() => Alert.alert("Cannot open", u))}
          fetchSigned={fetchAndCache}
          onPressImage={openViewer}
        />
      ),
    [myEmail, fetchAndCache, openViewer]
  );

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.topBar}>
        <Text numberOfLines={1} style={styles.topTitle}>{programTitle || "Chat"}</Text>
      </View>

      <FlatList
        ref={listRef}
        data={renderData}
        inverted
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 12, paddingTop: 6 }}
        keyboardShouldPersistTaps="handled"
        maintainVisibleContentPosition={{ minIndexForVisible: 1 }}
        onEndReachedThreshold={0.12}
        onEndReached={loadOlder}
        ListFooterComponent={loadingOlder ? <View style={{ paddingVertical: 8 }}><ActivityIndicator /></View> : null}
        // perf tuning (βοηθά και με το warning του VirtualizedList)
        initialNumToRender={18}
        maxToRenderPerBatch={12}
        windowSize={7}
        removeClippedSubviews
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
            onFocus={() => setTimeout(() => listRef.current?.scrollToOffset?.({ offset: 0, animated: true }), 40)}
          />
        </View>

        <Pressable onPress={sendMessage} style={({ pressed }) => [styles.sendBtn, pressed && { opacity: 0.85 }]}>
          <Text style={styles.sendBtnText}>➤</Text>
        </Pressable>
      </View>

      {/* Full-screen viewer with Save button */}
      <ImageViewing
        images={viewerImage ? [{ uri: viewerImage }] : []}
        imageIndex={0}
        visible={viewerVisible}
        onRequestClose={() => setViewerVisible(false)}
        FooterComponent={() => (
          <View style={styles.viewerFooter}>
            <Pressable onPress={saveCurrentImage} style={styles.saveBtn}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save</Text>}
            </Pressable>
          </View>
        )}
      />
    </KeyboardAvoidingView>
  );
}

/* ========================= Styles ========================= */
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
  bubbleMine: { backgroundColor: "#3B82F6", borderTopRightRadius: 6, alignSelf: "flex-end" },
  bubbleOther: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 6, alignSelf: "flex-start" },

  messageText: { fontSize: 16, color: "#111827" },
  linkText: { textDecorationLine: "underline" },

  time: { fontSize: 11, marginTop: 6, alignSelf: "flex-end", opacity: 0.75 },
  timeMine: { color: "rgba(255,255,255,0.9)" },
  timeOther: { color: "#6B7280" },

  // Link card
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#eee",
    overflow: "hidden",
    maxWidth: 440,
    marginTop: 6,
  },
  cardImageLarge: { width: "100%", height: 220 },
  cardTitle: { fontWeight: "700", color: "#111827" },
  cardDesc: { color: "#4B5563", marginTop: 4, fontSize: 12 },
  cardUrl: { color: "#6B7280", marginTop: 6, fontSize: 12 },

  // file/video card
  fileCard: {
    backgroundColor: "#fff",
    borderRadius: 10, borderWidth: 1, borderColor: "#eee",
    padding: 10, marginTop: 6, maxWidth: 420,
  },
  fileTitle: { fontWeight: "600", marginBottom: 4, color: "#111827" },
  fileUrl: { fontSize: 12, color: "#6B7280" },

  // day separator
  dayWrap: {
    flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 10, paddingHorizontal: 8,
  },
  dayLine: { flex: 1, height: 1, backgroundColor: "#E5E7EB" },
  dayText: {
    fontSize: 12, color: "#6B7280", backgroundColor: "#E5E7EB",
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999,
  },

  // input
  inputBar: {
    flexDirection: "row", alignItems: "flex-end",
    paddingHorizontal: 10, paddingVertical: 8, backgroundColor: "#fff",
    borderTopWidth: StyleSheet.hairlineWidth, borderColor: "#E5E7EB", gap: 8,
  },
  circleBtn: {
    width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center",
    backgroundColor: "#F3F4F6", borderWidth: StyleSheet.hairlineWidth, borderColor: "#E5E7EB",
  },
  circleBtnText: { fontSize: 18 },

  inputWrap: {
    flex: 1, backgroundColor: "#F3F4F6", borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth, borderColor: "#E5E7EB", maxHeight: 120,
  },
  input: { paddingHorizontal: 12, paddingVertical: 8, fontSize: 16 },

  sendBtn: {
    width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center",
    backgroundColor: "#22C55E",
  },
  sendBtnText: { color: "#fff", fontSize: 18, fontWeight: "800", marginLeft: 2 },

  // viewer footer
  viewerFooter: {
    paddingBottom: 24,
    paddingTop: 8,
    alignItems: "center",
  },
  saveBtn: {
    backgroundColor: "#111827",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
  },
  saveBtnText: { color: "#fff", fontWeight: "700" },
});
