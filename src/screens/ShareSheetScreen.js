// screens/ShareSheetScreen.js
import { addDoc, collection, getDocs, orderBy, query, serverTimestamp, where } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { auth, db } from "../services/firebaseConfig";

const EXACT_URL_REGEX = /^https?:\/\/[^\s]+$/i;

export default function ShareSheetScreen({ route, navigation }) {
  const shared = route?.params?.shared || null; // { mimeType, data, items? }
  const [chats, setChats] = useState([]);
  const [sending, setSending] = useState(false);

  const myEmail = useMemo(() => auth.currentUser?.email?.toLowerCase() ?? null, [auth.currentUser?.email]);

  useEffect(() => {
    // Φέρε τα chats όπου συμμετέχει ο χρήστης
    if (!myEmail) return;
    (async () => {
      try {
        const q = query(
          collection(db, "chats"),
          where("users", "array-contains", myEmail),
          orderBy("programTitle", "asc")
        );
        const snap = await getDocs(q);
        setChats(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error("Load chats failed:", e);
        Alert.alert("Error", e?.message ?? "Failed to load chats.");
      }
    })();
  }, [myEmail]);

  const makePayloadsFromShared = () => {
    // Καλύπτουμε τα απλά cases: text url / text
    if (shared?.mimeType?.startsWith("text/")) {
      const text = (shared?.data || "").trim();
      if (!text) return [];
      if (EXACT_URL_REGEX.test(text)) return [{ link: text }];
      return [{ text }];
    }
    // Για images/videos/files που ήδη ανεβάζεις με storagePath στο ChatScreen,
    // εδώ απλώς στέλνουμε link/text (ή μπορείς να κάνεις upload εδώ αν θες).
    // Για απλότητα, αν είναι κάτι άλλο => στέλνουμε ένα placeholder link/text.
    return [{ text: "Shared content" }];
  };

  const sendToChat = async (chatId) => {
    if (!myEmail || !chatId || !shared) return;
    try {
      setSending(true);
      const payloads = makePayloadsFromShared();
      for (const p of payloads) {
        await addDoc(collection(db, "chats", chatId, "messages"), {
          senderEmail: myEmail,
          ...p,
          timestamp: serverTimestamp(),
        });
      }
      Alert.alert("OK", "Shared!");
      navigation.goBack();
    } catch (e) {
      console.error("Share send failed:", e);
      Alert.alert("Error", e?.message ?? "Failed to send.");
    } finally {
      setSending(false);
    }
  };

  const renderItem = ({ item }) => (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{item.programTitle || "Chat"}</Text>
        <Text style={styles.users} numberOfLines={1}>{(item.users || []).join(", ")}</Text>
      </View>
      <TouchableOpacity disabled={sending} style={styles.sendBtn} onPress={() => sendToChat(item.id)}>
        <Text style={styles.sendText}>{sending ? "..." : "Αποστολή"}</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Κοινοποίηση σε chat</Text>
      <FlatList
        data={chats}
        keyExtractor={(it) => it.id}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        contentContainerStyle={{ padding: 12 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor:"#fff" },
  header: { fontSize: 18, fontWeight: "600", padding: 12, borderBottomWidth: 1, borderColor: "#eee" },
  row: { flexDirection:"row", alignItems:"center", padding: 12, backgroundColor:"#f9f9f9", borderRadius: 12 },
  title: { fontWeight: "600", marginBottom: 4 },
  users: { fontSize: 12, color: "#666" },
  sendBtn: { paddingHorizontal:16, paddingVertical:8, backgroundColor:"#28a745", borderRadius: 20, marginLeft: 10 },
  sendText: { color:"#fff", fontWeight:"600" }
});
