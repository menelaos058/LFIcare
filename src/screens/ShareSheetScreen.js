// src/screens/ShareSheetScreen.js
import {
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { auth, db } from "../services/firebaseConfig";
import { useResponsive } from "../theme/responsive";

const EXACT_URL_REGEX = /^https?:\/\/[^\s]+$/i;

export default function ShareSheetScreen({ route, navigation }) {
  const shared = route?.params?.shared || null; // { mimeType, data, items? }
  const [chats, setChats] = useState([]);
  const [sending, setSending] = useState(false);

  const { s, ms } = useResponsive();

  const myEmail = useMemo(
    () => auth.currentUser?.email?.toLowerCase() ?? null,
    [auth.currentUser?.email]
  );

  useEffect(() => {
    if (!myEmail) return;
    (async () => {
      try {
        const q = query(
          collection(db, "chats"),
          where("users", "array-contains", myEmail),
          orderBy("programTitle", "asc")
        );
        const snap = await getDocs(q);
        setChats(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error("Load chats failed:", e);
        Alert.alert("Error", e?.message ?? "Failed to load chats.");
      }
    })();
  }, [myEmail]);

  const makePayloadsFromShared = () => {
    if (shared?.mimeType?.startsWith("text/")) {
      const text = (shared?.data || "").trim();
      if (!text) return [];
      if (EXACT_URL_REGEX.test(text)) return [{ link: text }];
      return [{ text }];
    }
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
    <View
      style={[
        styles.row,
        {
          padding: s(12),
          borderRadius: s(12),
        },
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text
          style={[
            styles.title,
            { fontSize: ms(14), marginBottom: s(4) },
          ]}
        >
          {item.programTitle || "Chat"}
        </Text>
        <Text
          style={[
            styles.users,
            { fontSize: ms(12) },
          ]}
          numberOfLines={1}
        >
          {(item.users || []).join(", ")}
        </Text>
      </View>
      <TouchableOpacity
        disabled={sending}
        style={[
          styles.sendBtn,
          {
            paddingHorizontal: s(16),
            paddingVertical: s(8),
            borderRadius: s(20),
            marginLeft: s(10),
          },
        ]}
        onPress={() => sendToChat(item.id)}
      >
        <Text
          style={[
            styles.sendText,
            { fontSize: ms(13) },
          ]}
        >
          {sending ? "..." : "Αποστολή"}
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View
      style={[
        styles.container,
        { paddingBottom: s(8) },
      ]}
    >
      <Text
        style={[
          styles.header,
          {
            fontSize: ms(18),
            padding: s(12),
          },
        ]}
      >
        Κοινοποίηση σε chat
      </Text>
      <FlatList
        data={chats}
        keyExtractor={(it) => it.id}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={{ height: s(8) }} />}
        contentContainerStyle={{ padding: s(12) }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    fontWeight: "600",
    borderBottomWidth: 1,
    borderColor: "#eee",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9f9f9",
  },
  title: { fontWeight: "600" },
  users: { color: "#666" },
  sendBtn: { backgroundColor: "#28a745" },
  sendText: { color: "#fff", fontWeight: "600" },
});
