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
import Layout from "../components/Layout";
import { auth, db } from "../services/firebaseConfig";
import { useResponsive } from "../theme/responsive";

function isSubscriptionActive(item) {
  const exp = item?.expiresAt?.toDate?.();
  return !!exp && exp.getTime() > Date.now() && item?.active !== false;
}

export default function MyProgramsScreen({ user, navigation }) {
  const [loading, setLoading] = useState(true);

  const [subscriptions, setSubscriptions] = useState([]);
  const [teacherPrograms, setTeacherPrograms] = useState([]);
  const [expandedProgramId, setExpandedProgramId] = useState(null);
  const [myChats, setMyChats] = useState([]);

  const { s, ms } = useResponsive();

  const me = useMemo(
    () => auth.currentUser?.email || user?.email || "",
    [user?.email]
  );
  const role = user?.role || "user";

  // --- Subscribe to my chats ---
  useEffect(() => {
    if (!me) {
      setMyChats([]);
      return;
    }

    const qChats = query(
      collection(db, "chats"),
      where("users", "array-contains", me)
    );

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

  // --- Student subscriptions ---
  useEffect(() => {
    if (!user?.uid) {
      setSubscriptions([]);
      return;
    }

    if (role === "teacher") return;

    const subsRef = collection(db, "users", user.uid, "subscriptions");

    const unsub = onSnapshot(
      subsRef,
      (snap) => {
        const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        setSubscriptions(arr);
        setLoading(false);
      },
      (err) => {
        console.error("Subscriptions error:", err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user?.uid, role]);

  // --- Teacher programs ---
  useEffect(() => {
    if (role !== "teacher") return;
    if (!me) return;

    const qProgs = query(
      collection(db, "programs"),
      where("teacherEmail", "==", me)
    );

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

  const chatsByProgramId = useMemo(() => {
    const map = new Map();

    for (const c of myChats) {
      const pid = c.programId;
      if (!pid) continue;
      if (!map.has(pid)) map.set(pid, []);
      map.get(pid).push(c);
    }

    return map;
  }, [myChats]);

 const openChat = useCallback(
  (chatId, programTitle, extra = {}) => {
    if (!chatId) {
      Alert.alert("Chat not ready", "This program has no chat yet.");
      return;
    }

    navigation.navigate("Chat", {
      chatId,
      programTitle: programTitle || "Chat",
      ...extra,
    });
  },
  [navigation]
);

  // -------- Student view --------
  const renderSubscriptionItem = ({ item }) => {
    const fallbackChats = chatsByProgramId.get(item.programId) || [];
    const fallbackChat = fallbackChats[0];
    const finalChatId = item.chatId || fallbackChat?.id || null;
    const active = isSubscriptionActive(item);

    return (
      <View
        style={[
          styles.card,
          {
            padding: s(14),
            borderRadius: s(14),
          },
        ]}
      >
        <Text
          style={[
            styles.cardTitle,
            { fontSize: ms(18), marginBottom: s(4) },
          ]}
        >
          {item.programTitle || "Untitled Program"}
        </Text>

        {item.description ? (
          <Text
            style={[
              styles.cardDesc,
              { fontSize: ms(14), marginBottom: s(4) },
            ]}
          >
            {item.description}
          </Text>
        ) : null}

        <Text
          style={[
            styles.meta,
            { fontSize: ms(13), marginTop: s(2) },
          ]}
        >
          👨‍🏫 {item.teacherEmail || "N/A"}
        </Text>

        <Text
          style={[
            styles.meta,
            { fontSize: ms(13), marginTop: s(4) },
          ]}
        >
          ⏳ Expires:{" "}
          {item.expiresAt?.toDate?.()
            ? item.expiresAt.toDate().toLocaleDateString()
            : "-"}
        </Text>

        <TouchableOpacity
          style={[
            styles.primaryBtn,
            !finalChatId && styles.disabledBtn,
            {
              paddingVertical: s(10),
              borderRadius: s(10),
              marginTop: s(10),
            },
          ]}
          onPress={() =>
              openChat(finalChatId, item.programTitle, {
              subscriptionId: item.id,
              isActive: active,
            })
          }
          disabled={!finalChatId}
        >
          <Text
            style={[
              styles.btnText,
              { fontSize: ms(14) },
            ]}
          >
            {finalChatId ? "💬 Open Chat" : "⏳ Waiting for chat…"}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  // -------- Teacher view --------
  const renderTeacherProgram = ({ item }) => {
    const isExpanded = expandedProgramId === item.id;
    const chatsForProgram = chatsByProgramId.get(item.id) || [];

    return (
      <View
        style={[
          styles.card,
          {
            padding: s(14),
            borderRadius: s(14),
          },
        ]}
      >
        <View style={styles.rowBetween}>
          <Text
            style={[
              styles.cardTitle,
              { fontSize: ms(18) },
            ]}
          >
            {item.title || "Untitled Program"}
          </Text>

          <TouchableOpacity
            onPress={() =>
              setExpandedProgramId(isExpanded ? null : item.id)
            }
          >
            <Text
              style={[
                styles.expandIcon,
                { fontSize: ms(22) },
              ]}
            >
              {isExpanded ? "−" : "+"}
            </Text>
          </TouchableOpacity>
        </View>

        <Text
          style={[
            styles.meta,
            { fontSize: ms(13), marginTop: s(4) },
          ]}
        >
          💶 {Number.isFinite(Number(item.price)) ? `${item.price}€` : "-"}
        </Text>

        {item.description ? (
          <Text
            style={[
              styles.cardDesc,
              { fontSize: ms(14), marginTop: s(6) },
            ]}
          >
            {item.description}
          </Text>
        ) : null}

        {isExpanded && (
          <View
            style={[
              styles.chatsBlock,
              { marginTop: s(12) },
            ]}
          >
            <Text
              style={[
                styles.blockTitle,
                { fontSize: ms(16), marginBottom: s(8) },
              ]}
            >
              Chats ({chatsForProgram.length})
            </Text>

            {chatsForProgram.length ? (
              chatsForProgram.map((c) => {
                const other = (c.users || []).find(
                  (u) => String(u) !== me
                );

                return (
                  <View
                    key={c.id}
                    style={[
                      styles.chatRow,
                      {
                        paddingVertical: s(8),
                      },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.chatTitle,
                          { fontSize: ms(15) },
                        ]}
                      >
                        {c.programTitle || "Chat"}
                      </Text>

                      <Text
                        style={[
                          styles.chatSub,
                          { fontSize: ms(13), marginTop: s(2) },
                        ]}
                        numberOfLines={1}
                      >
                        👤 {other || "unknown"} · {c.lastMessage || "No messages yet"}
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={[
                        styles.secondaryBtn,
                        {
                          paddingVertical: s(8),
                          paddingHorizontal: s(12),
                          borderRadius: s(8),
                        },
                      ]}
                      onPress={() => openChat(c.id, c.programTitle)}
                    >
                      <Text
                        style={[
                          styles.btnText,
                          { fontSize: ms(14) },
                        ]}
                      >
                        Open
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })
            ) : (
              <Text
                style={[
                  styles.emptyText,
                  { fontSize: ms(13), marginTop: s(6) },
                ]}
              >
                No chats for this program yet.
              </Text>
            )}
          </View>
        )}
      </View>
    );
  };

  if (!user) {
    return (
      <Layout>
        <View
          style={[
            styles.center,
            { padding: s(20) },
          ]}
        >
          <Text style={{ fontSize: ms(14) }}>
            Please log in to view this page.
          </Text>
        </View>
      </Layout>
    );
  }

  return (
    <Layout>
      <View
        style={[
          styles.container,
          {
            padding: s(20),
          },
        ]}
      >
        <Text
          style={[
            styles.title,
            {
              fontSize: ms(24),
              marginBottom: s(16),
            },
          ]}
        >
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
              contentContainerStyle={{ paddingBottom: s(12) }}
            />
          ) : (
            <Text
              style={[
                styles.emptyText,
                { fontSize: ms(14), marginTop: s(24) },
              ]}
            >
              You don't teach any programs yet.
            </Text>
          )
        ) : subscriptions.length ? (
          <FlatList
            data={subscriptions}
            keyExtractor={(i) => i.id}
            renderItem={renderSubscriptionItem}
            contentContainerStyle={{ paddingBottom: s(12) }}
          />
        ) : (
          <Text
            style={[
              styles.emptyText,
              { fontSize: ms(14), marginTop: s(24) },
            ]}
          >
            No active programs found.
          </Text>
        )}
      </View>
    </Layout>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  title: {
    fontWeight: "bold",
    color: "#28a745",
    alignSelf: "center",
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  card: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
    marginBottom: 12,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  cardTitle: { color: "#333", fontWeight: "bold" },
  cardDesc: { color: "#555" },
  meta: { color: "#007bff" },

  primaryBtn: {
    backgroundColor: "#28a745",
    alignItems: "center",
  },
  secondaryBtn: {
    backgroundColor: "#28a745",
    alignSelf: "center",
  },
  disabledBtn: { backgroundColor: "#a8d5b3" },
  btnText: { color: "#fff", fontWeight: "600" },

  expandIcon: { fontWeight: "bold", color: "#28a745" },

  chatsBlock: {},
  blockTitle: { fontWeight: "600", color: "#333" },

  chatRow: {
    flexDirection: "row",
    gap: 10,
    borderTopWidth: 1,
    borderColor: "#eee",
  },
  chatTitle: { color: "#333", fontWeight: "600" },
  chatSub: { color: "#666" },

  emptyText: { color: "#888", textAlign: "center" },
});