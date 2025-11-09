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

// ακριβές URL μόνο (όταν ο χρήστης στείλει καθαρό URL στο input)
const EXACT_URL_REGEX = /^https?:\/\/[^\s]+$/i;

export default function ChatScreen({ route }) {
  const { chatId, programTitle } = route?.params ?? {};

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  // ΣΗΜ.: φρόντισε και τα emails στο chats/{chatId}.users να είναι lowercase
  const myEmail = useMemo(
    () => (auth.currentUser?.email ? auth.currentUser.email.toLowerCase() : null),
    [auth.currentUser?.email]
  );

  // === Real-time messages ===
  useEffect(() => {
    if (!chatId) return;
    const q = query(
      collection(db, "chats", chatId, "messages"),
      orderBy("timestamp", "asc")
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const msgs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setMessages(msgs);
      },
      (err) => {
        console.error("Messages subscribe error:", err);
        Alert.alert("Error", err.message);
      }
    );
    return () => unsubscribe();
  }, [chatId]);

  // === Share intent (optional, χωρίς static require) ===
  useEffect(() => {
    let listener;
    let ShareMenu;

    (async () => {
      try {
        // Θα πετύχει μόνο αν το πακέτο είναι εγκατεστημένο στο dev client
        const mod = await import("react-native-share-menu");
        ShareMenu = mod?.default;
        if (!ShareMenu) return;

        const onShareReceived = (item) => {
          try {
            if (!chatId || !myEmail) return;
            const data = (item?.data ?? "").toString().trim();

            if (EXACT_URL_REGEX.test(data)) {
              addDoc(collection(db, "chats", chatId, "messages"), {
                senderEmail: myEmail,
                link: data,
                timestamp: serverTimestamp(),
              }).catch(console.error);
              return;
            }

            if (data.length > 0) {
              addDoc(collection(db, "chats", chatId, "messages"), {
                senderEmail: myEmail,
                text: data,
                timestamp: serverTimestamp(),
              }).catch(console.error);
              return;
            }
          } catch (e) {
            console.error("onShareReceived error:", e);
          }
        };

        listener = ShareMenu.addNewShareListener?.(onShareReceived);
        ShareMenu.getInitialShare?.().then((initial) => {
          if (initial) onShareReceived(initial);
        });
      } catch {
        // Το module δεν υπάρχει → απλώς αγνοούμε το feature
      }
    })();

    return () => {
      try {
        listener?.remove?.();
      } catch {}
    };
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
      // 1) Άδεια
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permission needed", "Please allow photo library access.");
        return;
      }

      // 2) Χρήση νέου API (SDK 52+)
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: [ImagePicker.MediaType.Image],
        quality: 0.7,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        setLoading(true);
        const asset = result.assets[0];
        const uri = asset.uri;
        const mime = asset.mimeType || "image/jpeg";

        // 3) Upload στο Storage του ΙΔΙΟΥ app (storage import από firebaseConfig)
        const resp = await fetch(uri);
        const blob = await resp.blob();

        const fileName = `${Date.now()}.jpg`;
        const imgRef = storageRef(storage, `chat-images/${chatId}/${fileName}`);

        await uploadBytes(imgRef, blob, { contentType: mime });
        const url = await getDownloadURL(imgRef);

        await addDoc(collection(db, "chats", chatId, "messages"), {
          senderEmail: myEmail,
          image: url,
          timestamp: serverTimestamp(),
        });
      }
    } catch (error) {
      console.error("Image send failed:", error);
      const server =
        error?.customData?.serverResponse ||
        error?.serverResponse ||
        error?.message;
      if (server) console.log("Storage server response:", server);

      if (error?.code === "permission-denied") {
        Alert.alert(
          "No permission",
          "You do not have permission to send images in this chat. Έλεγξε ότι τα πεδία είναι senderEmail, image, timestamp."
        );
      } else {
        Alert.alert("Error", "Failed to send image.");
      }
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
          <Text
            style={[styles.messageText, styles.linkText]}
            onPress={() => onPressLink(item.link)}
            selectable
          >
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

      {loading && (
        <ActivityIndicator size="large" color="#28a745" style={{ marginVertical: 10 }} />
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
  messageContainer: {
    padding: 10,
    borderRadius: 8,
    marginVertical: 5,
    maxWidth: "80%",
  },
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
  imageButton: { backgroundColor: "#ddd", padding: 10, borderRadius: 25 },
  imageButtonText: { fontSize: 18 },
});
