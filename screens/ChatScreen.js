// screens/ChatScreen.js
import * as FileSystem from "expo-file-system";
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
  uploadString,
} from "firebase/storage";
import { useEffect, useMemo, useState } from "react";
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

export default function ChatScreen({ route }) {
  const { chatId, programTitle } = route?.params ?? {};
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const myEmail = useMemo(
    () => (auth.currentUser?.email ? auth.currentUser.email.toLowerCase() : null),
    [auth.currentUser?.email]
  );

  useEffect(() => {
    if (!chatId) return;
    const q = query(collection(db, "chats", chatId, "messages"), orderBy("timestamp", "asc"));
    return onSnapshot(
      q,
      (snap) => setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => {
        console.error("Messages subscribe error:", err);
        Alert.alert("Error", err.message);
      }
    );
  }, [chatId]);

  useEffect(() => {
    let listener;
    (async () => {
      try {
        const mod = await import("react-native-share-menu");
        const ShareMenu = mod?.default;
        if (!ShareMenu) return;

        const onShareReceived = async (item) => {
          try {
            if (!chatId || !myEmail) return;
            const mime = (item?.mimeType || "").toString();
            const data = (item?.data ?? "").toString().trim();

            if (EXACT_URL_REGEX.test(data)) {
              await addDoc(collection(db, "chats", chatId, "messages"), {
                senderEmail: myEmail,
                link: data,
                timestamp: serverTimestamp(),
              });
              return;
            }
            if (data && !mime.startsWith("image/")) {
              await addDoc(collection(db, "chats", chatId, "messages"), {
                senderEmail: myEmail,
                text: data,
                timestamp: serverTimestamp(),
              });
              return;
            }
            if (mime.startsWith("image/") && data) {
              const fileName = `${Date.now()}.jpg`;
              const imgRef = storageRef(storage, `chat-images/${chatId}/${fileName}`);

              // Προσπάθησε απευθείας blob upload (iOS συνήθως οκ)
              try {
                const resp = await fetch(data);
                const blob = await resp.blob();
                await uploadBytes(imgRef, blob, { contentType: mime });
              } catch {
                // Fallback: διάβασε base64 (αν το path είναι file://)
                const base64 = await FileSystem.readAsStringAsync(data, { encoding: FileSystem.EncodingType.Base64 });
                await uploadString(imgRef, base64, "base64", { contentType: mime });
              }

              const url = await getDownloadURL(imgRef);
              await addDoc(collection(db, "chats", chatId, "messages"), {
                senderEmail: myEmail,
                image: url,
                timestamp: serverTimestamp(),
              });
            }
          } catch (e) {
            console.error("onShareReceived error:", e);
            Alert.alert("Share failed", e?.message ?? "Could not process shared content.");
          }
        };

        listener = ShareMenu.addNewShareListener?.(onShareReceived);
        ShareMenu.getInitialShare?.().then((initial) => initial && onShareReceived(initial));
      } catch {}
    })();
    return () => { try { listener?.remove?.(); } catch {} };
  }, [chatId, myEmail]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text) return;
    if (!chatId || !myEmail) {
      Alert.alert("Error", "Not authenticated or no chat selected.");
      return;
    }
    try {
      if (EXACT_URL_REGEX.test(text)) {
        await addDoc(collection(db, "chats", chatId, "messages"), {
          senderEmail: myEmail,
          link: text,
          timestamp: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, "chats", chatId, "messages"), {
          senderEmail: myEmail,
          text,
          timestamp: serverTimestamp(),
        });
      }
      setInput("");
    } catch (error) {
      console.error("Message send failed:", error);
      if (error?.code === "permission-denied") {
        Alert.alert(
          "No permission",
          "You do not have permission to write in this chat. Βεβαιώσου ότι είσαι participant και ότι γράφεις μόνο senderEmail, text/image/link, timestamp."
        );
      } else {
        Alert.alert("Error", error?.message ?? "Failed to send message.");
      }
    }
  };

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

      // ✅ Ζήτησε base64 για μέγιστη συμβατότητα (Android/Hermes)
      const hasNewEnum = !!ImagePicker?.MediaType;
      const hasOldEnum = !!ImagePicker?.MediaTypeOptions;
      const result = await ImagePicker.launchImageLibraryAsync({
        base64: true,
        quality: 0.7,
        ...(hasNewEnum
          ? { mediaTypes: [ImagePicker.MediaType.Image] }
          : hasOldEnum
            ? { mediaTypes: ImagePicker.MediaTypeOptions.Images }
            : {}),
      });

      if (result.canceled || !result.assets?.[0]) return;

      setLoading(true);
      const asset = result.assets[0];
      const uri = asset.uri;
      const mime = asset.mimeType || "image/jpeg";
      const fileName = `${Date.now()}.jpg`;
      const imgRef = storageRef(storage, `chat-images/${chatId}/${fileName}`);

      if (asset.base64) {
        // ✅ κύρια οδός: ανέβασε το base64 κατευθείαν
        await uploadString(imgRef, asset.base64, "base64", { contentType: mime });
      } else {
        // Fallback: δοκίμασε blob → μετά base64 από file
        try {
          const resp = await fetch(uri);
          const blob = await resp.blob();
          await uploadBytes(imgRef, blob, { contentType: mime });
        } catch {
          const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
          await uploadString(imgRef, base64, "base64", { contentType: mime });
        }
      }

      const url = await getDownloadURL(imgRef);
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
      if (/^https?:\/\//i.test(clean)) { await Linking.openURL(clean); return; }
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
          <Text style={[styles.messageText, styles.linkText]} onPress={() => onPressLink(item.link)} selectable>
            {item.link}
          </Text>
        ) : null}

        {item.image ? <Image source={{ uri: item.image }} style={styles.image} /> : null}
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

      {loading && <ActivityIndicator size="large" color="#28a745" style={{ marginVertical: 10 }} />}

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
    fontSize: 18, fontWeight: "600", color: "#333",
    paddingVertical: 12, textAlign: "center",
    backgroundColor: "#fff", borderBottomWidth: 1, borderColor: "#ddd",
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
});
