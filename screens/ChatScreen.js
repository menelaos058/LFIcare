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
  getStorage,
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
import { auth, db } from "../firebaseConfig";

const storage = getStorage();

// Προαιρετικό import για share από άλλες εφαρμογές.
// Αν δεν έχεις εγκαταστήσει το πακέτο, ο κώδικας δεν θα σκάσει.
let ShareMenu = null;
try {
  // yarn add react-native-share-menu
  // npx expo prebuild && npx expo run:android|ios
  ShareMenu = require("react-native-share-menu").default;
} catch (_) {
  // noop
}

const URL_REGEX = /^https?:\/\/[^\s]+$/i;

export default function ChatScreen({ route }) {
  const { chatId, programTitle } = route.params || {};

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const myEmail = useMemo(
    () => (auth.currentUser?.email ? auth.currentUser.email.toLowerCase() : null),
    [auth.currentUser?.email]
  );

  // === Real-time messages (ordered by "timestamp") ===
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

  // === Handle share-intent (αν είναι διαθέσιμο το react-native-share-menu) ===
  useEffect(() => {
    if (!ShareMenu) return;

    const onShareReceived = (item) => {
      // item: {mimeType, data, extraData}
      // data μπορεί να είναι url ή text ή file.
      try {
        if (!chatId || !myEmail) return;

        const data = (item?.data ?? "").toString().trim();

        // Αν είναι URL -> στέλνουμε ως link
        if (URL_REGEX.test(data)) {
          addDoc(collection(db, "chats", chatId, "messages"), {
            senderEmail: myEmail,
            link: data,
            timestamp: serverTimestamp(),
          }).catch(console.error);
          return;
        }

        // Αλλιώς αν είναι text -> ως text
        if (data.length > 0) {
          addDoc(collection(db, "chats", chatId, "messages"), {
            senderEmail: myEmail,
            text: data,
            timestamp: serverTimestamp(),
          }).catch(console.error);
          return;
        }

        // (Optional) Αν λάβεις file path (Android), μπορείς να το ανεβάσεις ως image
        // αν το mimeType ξεκινά με "image/"
        // Εδώ απλοποιούμε – τα περισσότερα share intents για link/text καλύπτονται παραπάνω.
      } catch (e) {
        console.error("onShareReceived error:", e);
      }
    };

    // Android: persistent listener
    const listener = ShareMenu.addNewShareListener(onShareReceived);

    // iOS: pull initial (αν άνοιξε από share extension)
    ShareMenu.getInitialShare?.().then((initial) => {
      if (initial) onShareReceived(initial);
    });

    return () => {
      try {
        listener?.remove?.();
      } catch (_) {}
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
      // Αν ο χρήστης έγραψε URL, στείλτο ως `link`
      if (URL_REGEX.test(text)) {
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
      if (error.code === "permission-denied") {
        Alert.alert(
          "No permission",
          "You do not have permission to write in this chat. Βεβαιώσου ότι είσαι participant και ότι γράφεις μόνο senderEmail, text/image/link, timestamp."
        );
      } else {
        Alert.alert("Error", error.message);
      }
    }
  };

  const pickImage = async () => {
    if (!chatId || !myEmail) {
      Alert.alert("Error", "Not authenticated or no chat selected.");
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        setLoading(true);
        const uri = result.assets[0].uri;

        const resp = await fetch(uri);
        const blob = await resp.blob();
        const imgRef = storageRef(storage, `chat-images/${chatId}/${Date.now()}.jpg`);
        await uploadBytes(imgRef, blob);
        const url = await getDownloadURL(imgRef);

        await addDoc(collection(db, "chats", chatId, "messages"), {
          senderEmail: myEmail,
          image: url,               // προσοχή: "image" (όχι imageUrl)
          timestamp: serverTimestamp(),
        });
      }
    } catch (error) {
      console.error("Image send failed:", error);
      if (error.code === "permission-denied") {
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
      const ok = await Linking.canOpenURL(url);
      if (ok) await Linking.openURL(url);
    } catch (e) {
      console.error("openURL error", e);
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
        {item.text ? <Text style={styles.messageText}>{item.text}</Text> : null}

        {item.link ? (
          <Text
            style={[styles.messageText, styles.linkText]}
            onPress={() => onPressLink(item.link)}
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
  linkText: { textDecorationLine: "underline" },
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
