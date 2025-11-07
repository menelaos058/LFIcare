// screens/MyProgramsScreen.js
import {
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { auth, db } from "../firebaseConfig";

export default function MyProgramsScreen({ user, navigation }) {
  const [loading, setLoading] = useState(true);

  // Student data
  const [purchases, setPurchases] = useState([]);

  // Teacher data
  const [teacherPrograms, setTeacherPrograms] = useState([]);
  const [expandedProgramId, setExpandedProgramId] = useState(null);

  // Common: chats the current user participates in
  const [myChats, setMyChats] = useState([]);

  const me = useMemo(
    () => (auth.currentUser?.email || user?.email || "").toLowerCase(),
    [user?.email]
  );
  const role = user?.role || "user";

  // --- Subscribe to my chats (common) ---
  useEffect(() => {
    if (!me) return;
    const qChats = query(collection(db, "chats"), where("users", "array-contains", me));
    const unsub = onSnapshot(
      qChats,
      (snap) => {
        setMyChats(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error("Chats subscription error:", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [me]);

  // --- Student: subscribe to purchases ---
  useEffect(() => {
    if (!user?.uid) return;
    if (role === "teacher") return; // δάσκαλος δεν έχει purchases view εδώ
    const purchasesRef = collection(db, "users", user.uid, "purchases");
    const unsub = onSnapshot(
      purchasesRef,
      (snap) => {
        const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setPurchases(arr);
        setLoading(false);
      },
      (err) => {
        console.error("Purchases error:", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [user?.uid, role]);

  // --- Teacher: subscribe to programs he teaches ---
  useEffect(() => {
    if (role !== "teacher") return;
    if (!me) return;
    const qProgs = query(collection(db, "programs"), where("teacherEmail", "==", me));
    const unsub = onSnapshot(
      qProgs,
      (snap) => {
        const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setTeacherPrograms(arr);
        setLoading(false);
      },
      (err) => {
        console.error("Teacher programs error:", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [role, me]);

  // --- Helpers ---
  const chatsByProgramId = useMemo(() => {
    const map = new Map();
    for (const c of myChats) {
      const pid = c.programId;
      if (!pid) continue;
      if (!map.has(pid)) map.set(pid, []);
      map.get(pid).push(c);
    }
    return map; // Map(programId -> [chats])
  }, [myChats]);

  const openChat = useCallback(
    (chat) => {
      navigation.navigate("Chat", {
        chatId: chat.id,
        programTitle: chat.programTitle || "Chat",
      });
    },
    [navigation]
  );

  // -------------------------------
  // Student view (purchases + open chat if exists)
  // -------------------------------
  const renderPurchaseItem = ({ item }) => {
    const chatsForProgram = chatsByProgramId.get(item.programId) || [];
    // για μαθητή, συνήθως υπάρχει 1 chat με τον teacher για κάθε πρόγραμμα
    const existingChat = chatsForProgram[0];

    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{item.programTitle}</Text>
        {item.description ? <Text style={styles.cardDesc}>{item.description}</Text> : null}
        <Text style={styles.meta}>👨‍🏫 {item.teacherEmail}</Text>

        <TouchableOpacity
          style={[styles.primaryBtn, !existingChat && styles.disabledBtn]}
          onPress={() =>
            existingChat
              ? openChat(existingChat)
              : Alert.alert("Chat not ready", "This purchase has no chat yet.")
          }
          disabled={!existingChat}
        >
          <Text style={styles.btnText}>
            {existingChat ? "💬 Open Chat" : "⏳ Waiting for chat…"}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  // -------------------------------
  // Teacher view (programs he teaches -> expand -> list chats per program)
  // -------------------------------
  const renderTeacherProgram = ({ item }) => {
    const isExpanded = expandedProgramId === item.id;
    const chatsForProgram = chatsByProgramId.get(item.id) || [];

    return (
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.cardTitle}>{item.title || "Untitled Program"}</Text>
          <TouchableOpacity onPress={() => setExpandedProgramId(isExpanded ? null : item.id)}>
            <Text style={styles.expandIcon}>{isExpanded ? "−" : "+"}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.meta}>💶 {Number.isFinite(Number(item.price)) ? `${item.price}€` : "-"}</Text>
        {item.description ? <Text style={styles.cardDesc}>{item.description}</Text> : null}

        {isExpanded && (
          <View style={styles.chatsBlock}>
            <Text style={styles.blockTitle}>Chats ({chatsForProgram.length})</Text>
            {chatsForProgram.length ? (
              chatsForProgram.map((c) => {
                // βρες τον "άλλον" συμμετέχοντα (μαθητή)
                const other = (c.users || []).find((u) => u?.toLowerCase() !== me);
                return (
                  <View key={c.id} style={styles.chatRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.chatTitle}>{c.programTitle || "Chat"}</Text>
                      <Text style={styles.chatSub} numberOfLines={1}>
                        👤 {other || "unknown"} · {c.lastMessage || "No messages yet"}
                      </Text>
                    </View>
                    <TouchableOpacity style={styles.secondaryBtn} onPress={() => openChat(c)}>
                      <Text style={styles.btnText}>Open</Text>
                    </TouchableOpacity>
                  </View>
                );
              })
            ) : (
              <Text style={styles.emptyText}>No chats for this program yet.</Text>
            )}
          </View>
        )}
      </View>
    );
  };

  if (!user) {
    return (
      <View style={styles.center}>
        <Text>Please log in to view this page.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {role === "teacher" ? "My Programs (Teacher)" : "My Programs"}
      </Text>

      {loading ? (
        <ActivityIndicator size="large" color="#28a745" />
      ) : role === "teacher" ? (
        teacherPrograms.length ? (
          <FlatList
            data={teacherPrograms}
            keyExtractor={(i) => i.id}
            renderItem={renderTeacherProgram}
          />
        ) : (
          <Text style={styles.emptyText}>You don't teach any programs yet.</Text>
        )
      ) : purchases.length ? (
        <FlatList
          data={purchases}
          keyExtractor={(i) => i.id}
          renderItem={renderPurchaseItem}
        />
      ) : (
        <Text style={styles.emptyText}>No programs found.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#f5f5f5" },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#28a745",
    marginBottom: 16,
    alignSelf: "center",
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  card: {
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },

  cardTitle: { fontSize: 18, fontWeight: "bold", color: "#333" },
  cardDesc: { fontSize: 14, color: "#555", marginTop: 6 },
  meta: { fontSize: 13, color: "#007bff", marginTop: 6 },

  primaryBtn: {
    backgroundColor: "#28a745",
    padding: 10,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 10,
  },
  secondaryBtn: {
    backgroundColor: "#28a745",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignSelf: "center",
  },
  disabledBtn: { backgroundColor: "#a8d5b3" },
  btnText: { color: "#fff", fontWeight: "600" },

  expandIcon: { fontSize: 22, fontWeight: "bold", color: "#28a745", marginLeft: 10 },

  chatsBlock: { marginTop: 12 },
  blockTitle: { fontSize: 16, fontWeight: "600", marginBottom: 8, color: "#333" },

  chatRow: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderColor: "#eee",
  },
  chatTitle: { fontSize: 15, fontWeight: "600", color: "#333" },
  chatSub: { fontSize: 13, color: "#666", marginTop: 2 },

  emptyText: { color: "#888", textAlign: "center", marginTop: 24 },
});
