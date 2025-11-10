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
import {
  getDownloadURL,
  ref as storageRef,
  uploadBytes,
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
import { auth, db, storage } from "../firebaseConfig";

const EXACT_URL_REGEX = /^https?:\/\/[^\s]+$/i;

const guessExtFromMime = (mime) => {
  if (/png/i.test(mime)) return "png";
  if (/webp/i.test(mime)) return "webp";
  if (/gif/i.test(mime)) return "gif";
  if (/heic|heif/i.test(mime)) return "heic";
  return "jpg";
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
    const title =
      get("og:title") ||
      (html.match(/<title>([^<]+)<\/title>/i)?.[1] ?? url); // ✅ σωστό regex (όχι <\\/title>)
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
    return () => {
      mounted.current = false;
    };
  }, [url]);
  return (
    <TouchableOpacity onPress={() => onPress(url)} style={styles.card}>
      {data?.image ? <Image source={{ uri: data.image }} style={styles.cardImage} /> : null}
      <View style={{ flex: 1 }}>
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

export default function ChatScreen({ route }) {
  const { chatId, programTitle } = route?.params ?? {};
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const myEmail = useMemo(
    () =>
      auth.currentUser?.email ? auth.currentUser.email.toLowerCase() : null,
    [auth.currentUser?.email]
  );

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

  // ---- PICK & UPLOAD (Blob path: fetch(file://...).blob() + uploadBytes) ----
  const pickImage = async () => {
    if (!chatId || !myEmail) {
      Alert.alert("Error", "Not authenticated or no chat selected.");
      return;
    }
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permission needed", "Please allow photo library access.");
        return;
      }

      // Αφήνουμε τα default mediaTypes (εικόνες). Δεν χρησιμοποιούμε deprecated MediaTypeOptions.
      const result = await ImagePicker.launchImageLibraryAsync({
        quality: 0.7,
        base64: false, // <-- Απαραίτητο: αποφεύγουμε base64/data_url
      });
      if (result.canceled || !result.assets?.[0]) return;

      setLoading(true);

      const asset = result.assets[0];
      if (!asset.uri) throw new Error("No asset uri from picker");

      const mime = asset.mimeType || "image/jpeg";
      const ext = guessExtFromMime(mime);
      const fileName = `${Date.now()}.${ext}`;
      const path = `chat-images/${chatId}/${fileName}`;

      // Παίρνουμε Blob απ’ ευθείας από file://
      const res = await fetch(asset.uri);
      const blob = await res.blob();

      const ref = storageRef(storage, path);
      await uploadBytes(ref, blob, { contentType: mime });
      const url = await getDownloadURL(ref);

      await addDoc(collection(db, "chats", chatId, "messages"), {
        senderEmail: myEmail,
        image: url,
        timestamp: serverTimestamp(),
      });
    } catch (error) {
      console.error("Image send failed:", error);
      Alert.alert("Error", error?.message ?? "Failed to send image.");
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

  const renderMessage = ({ item }) => {
    const isMine =
      myEmail && typeof item.senderEmail === "string"
        ? item.senderEmail.toLowerCase() === myEmail
        : false;

    return (
      <View
        style={[
          styles.messageContainer,
          isMine ? styles.myMessage : styles.otherMessage,
        ]}
      >
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

        {item.image ? (
          <Image source={{ uri: item.image }} style={styles.image} />
        ) : null}
        <Text style={styles.senderName}>{isMine ? "You" : item.senderEmail}</Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
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
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    paddingVertical: 12,
    textAlign: "center",
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderColor: "#ddd",
  },
  messageContainer: { padding: 10, borderRadius: 8, marginVertical: 5, maxWidth: "80%" },
  myMessage: { backgroundColor: "#d1e7dd", alignSelf: "flex-end" },
  otherMessage: { backgroundColor: "#fff", alignSelf: "flex-start" },
  messageText: { fontSize: 16, marginBottom: 5 },
  linkText: { color: "#007bff", textDecorationLine: "underline" },
  senderName: { fontSize: 12, color: "#555", marginTop: 3 },
  image: { width: 200, height: 200, borderRadius: 8, marginBottom: 5 },
  inputContainer: {
    flexDirection: "row",
    padding: 10,
    alignItems: "center",
    borderTopWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#fff",
  },
  input: {
    flex: 1,
    backgroundColor: "#f1f1f1",
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 20,
    marginHorizontal: 10,
    fontSize: 16,
  },
  sendButton: {
    backgroundColor: "#28a745",
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 20,
  },
  sendButtonText: { color: "#fff", fontWeight: "600" },
  imageButton: { backgroundColor: "#ddd", padding: 10, borderRadius: 25, marginRight: 6 },
  imageButtonText: { fontSize: 18 },

  // Link card
  card: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#eee",
    overflow: "hidden",
  },
  cardImage: { width: 80, height: 80 },
  cardTitle: { fontWeight: "600", marginHorizontal: 10, marginTop: 8 },
  cardDesc: { color: "#555", marginHorizontal: 10, marginTop: 2, fontSize: 12 },
  cardUrl: { color: "#777", marginHorizontal: 10, marginVertical: 8, fontSize: 12 },
});
