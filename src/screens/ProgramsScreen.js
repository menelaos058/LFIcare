// src/screens/ProgramsScreen.js
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Layout from "../components/Layout";
import { auth, db } from "../services/firebaseConfig";
import { useResponsive } from "../theme/responsive";

export default function ProgramsScreen({ user }) {
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);

  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [expandedId, setExpandedId] = useState(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newTeacherEmail, setNewTeacherEmail] = useState("");

  const [purchasedIds, setPurchasedIds] = useState(new Set());
  const [purchaseLock, setPurchaseLock] = useState(false);

  const { s, ms, isLargeScreen } = useResponsive();

  const isAdmin = user?.role === "admin";
  const isLoggedIn = !!user?.uid;

  // ---- Load programs ----
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "programs"),
      (snapshot) => {
        const arr = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setPrograms(arr);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        Alert.alert("Error", err.message);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // ---- Purchases (for "Purchased") ----
  useEffect(() => {
    if (!user?.uid) {
      setPurchasedIds(new Set());
      return;
    }
    const unsub = onSnapshot(
      collection(db, "users", user.uid, "purchases"),
      (snap) => {
        const ids = new Set();
        snap.forEach((d) => {
          const data = d.data();
          if (data?.programId) ids.add(data.programId);
          else ids.add(d.id);
        });
        setPurchasedIds(ids);
      },
      (err) => {
        console.error("onSnapshot(purchases) failed:", err);
      }
    );
    return () => unsub();
  }, [user?.uid]);

  const toggleExpand = (id) =>
    setExpandedId((prev) => (prev === id ? null : id));

  async function findLegacyPurchaseDoc(uid, programId) {
    const qLegacy = query(
      collection(db, "users", uid, "purchases"),
      where("programId", "==", programId)
    );
    const snap = await getDocs(qLegacy);
    if (!snap.empty) return snap.docs[0];
    return null;
  }

  // ---- Purchase + chat create ----
  const handlePurchase = useCallback(
    async (item) => {
      if (purchaseLock) return;
      setPurchaseLock(true);

      try {
        if (!isLoggedIn) {
          Alert.alert("Error", "You must be logged in to buy a program.");
          return;
        }
        const tokenEmailRaw = auth.currentUser?.email;
        const tokenEmail = tokenEmailRaw?.toLowerCase();
        if (!tokenEmail) {
          Alert.alert(
            "Error",
            "No authenticated email found. Please re-login."
          );
          return;
        }
        if (!item?.id) {
          Alert.alert("Error", "Invalid program (missing id).");
          return;
        }
        if (!item?.teacherEmail) {
          Alert.alert("Error", "This program has no assigned teacher.");
          return;
        }

        const teacherEmail = String(item.teacherEmail).toLowerCase();
        const priceNum = Number(item.price);
        if (!Number.isFinite(priceNum) || priceNum < 0) {
          Alert.alert("Error", "Invalid program price.");
          return;
        }

        if (purchasedIds.has(item.id)) {
          Alert.alert(
            "Already purchased",
            "Έχεις ήδη αγοράσει αυτό το πρόγραμμα."
          );
          return;
        }

        const purchaseRef = doc(
          db,
          "users",
          user.uid,
          "purchases",
          item.id
        );
        const existsDet = await getDoc(purchaseRef);
        if (existsDet.exists()) {
          Alert.alert(
            "Already purchased",
            "Έχεις ήδη αγοράσει αυτό το πρόγραμμα."
          );
          return;
        }

        const legacy = await findLegacyPurchaseDoc(user.uid, item.id);
        if (legacy) {
          const legacyData = legacy.data();
          await setDoc(purchaseRef, {
            programId: legacyData.programId ?? item.id,
            programTitle: legacyData.programTitle ?? item.title,
            teacherEmail: String(
              legacyData.teacherEmail ?? teacherEmail
            ).toLowerCase(),
            price: Number(legacyData.price ?? priceNum),
            description: legacyData.description ?? (item.description ?? ""),
            createdAt: serverTimestamp(),
          });
          try {
            await deleteDoc(legacy.ref);
          } catch (_) {}
          Alert.alert(
            "Purchase Synced",
            "Υπήρχε παλαιότερη αγορά — έγινε συγχρονισμός."
          );
        } else {
          await setDoc(purchaseRef, {
            programId: item.id,
            programTitle: item.title,
            teacherEmail,
            price: priceNum,
            description: item.description ?? "",
            createdAt: serverTimestamp(),
          });
          Alert.alert(
            "Purchase Successful",
            `You bought "${item.title}" for ${priceNum}€.`


          );
        }

        try {
          const usersLC = [tokenEmail, teacherEmail];
          await addDoc(collection(db, "chats"), {
            users: usersLC,
            programId: item.id,
            programTitle: item.title,
            lastMessage: "",
            createdAt: serverTimestamp(),
          });
        } catch (err) {
          console.error("Chat create failed:", err);
          Alert.alert(
            "Chat creation warning",
            err?.code === "permission-denied"
              ? "Το chat μπλοκαρίστηκε από τα Firestore rules (users[], createdAt, programId)."
              : err?.message || String(err)
          );
        }
      } catch (err) {
        console.error("Purchase write failed:", err);
        Alert.alert(
          "Purchase Failed",
          err?.code === "permission-denied"
            ? "Blocked by security rules. Έλεγξε ότι τα πεδία είναι σωστά και ότι το programId υπάρχει στο /programs."
            : err?.message || String(err)
        );
      } finally {
        setPurchaseLock(false);
      }
    },
    [purchaseLock, isLoggedIn, user?.uid, purchasedIds]
  );

  // ---- Admin actions ----
  const deleteProgram = useCallback(
    async (id) => {
      if (!isAdmin) {
        Alert.alert(
          "Access Denied",
          "Only admins can delete programs."
        );
        return;
      }
      try {
        await deleteDoc(doc(db, "programs", id));
      } catch (error) {
        Alert.alert("Error", "Failed to delete program: " + error.message);
      }
    },
    [isAdmin]
  );

  const startEditing = (id, currentTitle) => {
    if (!isAdmin) {
      Alert.alert(
        "Access Denied",
        "Only admins can edit programs."
      );
      return;
    }
    setEditingId(id);
    setEditingTitle(currentTitle);
  };

  const saveEdit = useCallback(async () => {
    if (!isAdmin) {
      Alert.alert(
        "Access Denied",
        "Only admins can edit programs."
      );
      return;
    }
    if (!editingTitle.trim()) {
      Alert.alert(
        "Validation Error",
        "Program title cannot be empty."
      );
      return;
    }
    try {
      await updateDoc(doc(db, "programs", editingId), {
        title: editingTitle.trim(),
      });
      setEditingId(null);
      setEditingTitle("");
    } catch (error) {
      Alert.alert(
        "Error",
        "Failed to update program: " + error.message
      );
    }
  }, [isAdmin, editingId, editingTitle]);

  const cancelEdit = () => {
    setEditingId(null);
    setEditingTitle("");
  };

  const addProgram = useCallback(async () => {
    if (!isAdmin) {
      Alert.alert(
        "Access Denied",
        "Only admins can add programs."
      );
      return;
    }
    if (!newTitle.trim() || !newPrice.trim() || !newTeacherEmail.trim()) {
      Alert.alert(
        "Validation Error",
        "Title, price and teacher email are required."
      );
      return;
    }
    const priceNum = Number(newPrice);
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      Alert.alert(
        "Validation Error",
        "Price must be a non-negative number."
      );
      return;
    }
    try {
      await addDoc(collection(db, "programs"), {
        title: newTitle.trim(),
        description: newDescription.trim(),
        price: priceNum,
        teacherEmail: newTeacherEmail.trim().toLowerCase(),
      });
      setNewTitle("");
      setNewDescription("");
      setNewPrice("");
      setNewTeacherEmail("");
      setShowAddForm(false);
    } catch (error) {
      Alert.alert(
        "Error",
        "Failed to add program: " + error.message
      );
    }
  }, [isAdmin, newTitle, newDescription, newPrice, newTeacherEmail]);

  const renderItem = ({ item }) => {
    const isEditing = editingId === item.id;
    const isExpanded = expandedId === item.id;
    const isPurchased = purchasedIds.has(item.id);

    return (
      <View
        style={[
          styles.item,
          {
            padding: s(15),
            borderRadius: s(12),
          },
        ]}
      >
        <View style={styles.itemHeader}>
          {isEditing ? (
            <TextInput
              style={[
                styles.inputInline,
                {
                  padding: s(6),
                  borderRadius: s(8),
                  fontSize: ms(16),
                },
              ]}
              value={editingTitle}
              onChangeText={setEditingTitle}
            />
          ) : (
            <Text
              style={[
                styles.itemText,
                { fontSize: ms(16) },
              ]}
            >
              {item.title}
            </Text>
          )}

          <View style={styles.headerButtons}>
            {!isAdmin && (
              <TouchableOpacity
                style={[
                  styles.priceButton,
                  !isPurchased
                    ? {
                        paddingVertical: s(6),
                        paddingHorizontal: s(12),
                        borderRadius: s(8),
                      }
                    : {},
                  isPurchased && { backgroundColor: "#6c757d" },
                ]}
                onPress={() => !isPurchased && handlePurchase(item)}
                disabled={isPurchased}
              >
                <Text
                  style={[
                    styles.priceText,
                    { fontSize: ms(13) },
                  ]}
                >
                  {isPurchased
                    ? "Purchased"
                    : Number.isFinite(Number(item.price))
                    ? `${item.price}€`
                    : "Buy"}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => toggleExpand(item.id)}>
              <Text
                style={[
                  styles.expandIcon,
                  { fontSize: ms(20) },
                ]}
              >
                {isExpanded ? "−" : "+"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {isExpanded && (
          <View
            style={[
              styles.details,
              { marginTop: s(10) },
            ]}
          >
            <Text
              style={[
                styles.description,
                { fontSize: ms(14) },
              ]}
            >
              {item.description || "No description"}
            </Text>
            <Text
              style={[
                styles.teacherText,
                { fontSize: ms(14), marginTop: s(4) },
              ]}
            >
              👨‍🏫 Teacher: {item.teacherEmail || "N/A"}
            </Text>
          </View>
        )}

        {isAdmin && (
          <View
            style={[
              styles.adminButtons,
              { marginTop: s(10) },
            ]}
          >
            {isEditing ? (
              <>
                <TouchableOpacity
                  style={[
                    styles.saveButton,
                    {
                      paddingVertical: s(6),
                      paddingHorizontal: s(12),
                      borderRadius: s(6),
                    },
                  ]}
                  onPress={saveEdit}
                >
                  <Text
                    style={[
                      styles.buttonText,
                      { fontSize: ms(13) },
                    ]}
                  >
                    Save
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.cancelButton,
                    {
                      paddingVertical: s(6),
                      paddingHorizontal: s(12),
                      borderRadius: s(6),
                    },
                  ]}
                  onPress={cancelEdit}
                >
                  <Text
                    style={[
                      styles.buttonText,
                      { fontSize: ms(13) },
                    ]}
                  >
                    Cancel
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={[
                    styles.editButton,
                    {
                      paddingVertical: s(6),
                      paddingHorizontal: s(12),
                      borderRadius: s(6),
                    },
                  ]}
                  onPress={() => startEditing(item.id, item.title)}
                >
                  <Text
                    style={[
                      styles.buttonText,
                      { fontSize: ms(13) },
                    ]}
                  >
                    Edit
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.deleteButton,
                    {
                      paddingVertical: s(6),
                      paddingHorizontal: s(12),
                      borderRadius: s(6),
                    },
                  ]}
                  onPress={() => deleteProgram(item.id)}
                >
                  <Text
                    style={[
                      styles.buttonText,
                      { fontSize: ms(13) },
                    ]}
                  >
                    Delete
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </View>
    );
  };

  const listEmpty = useMemo(
    () => (
      <Text style={styles.noDataText}>No programs available.</Text>
    ),
    []
  );

  return (
    <Layout>
      <View
        style={[
          styles.container,
          { padding: s(20) },
        ]}
      >
        <View style={styles.header}>
          <Text
            style={[
              styles.title,
              { fontSize: ms(28) },
            ]}
          >
            Programs
          </Text>
          {isAdmin && (
            <TouchableOpacity
              style={[
                styles.addToggleButton,
                {
                  paddingHorizontal: s(12),
                  paddingVertical: s(6),
                  borderRadius: s(20),
                },
              ]}
              onPress={() => setShowAddForm((s) => !s)}
            >
              <Text
                style={[
                  styles.addToggleText,
                  { fontSize: ms(22) },
                ]}
              >
                {showAddForm ? "−" : "+"}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {showAddForm && isAdmin && (
          <View
            style={[
              styles.addForm,
              {
                padding: s(15),
                borderRadius: s(12),
              },
            ]}
          >
            <TextInput
              style={[
                styles.input,
                {
                  padding: s(10),
                  borderRadius: s(8),
                  fontSize: ms(16),
                },
              ]}
              placeholder="Title"
              value={newTitle}
              onChangeText={setNewTitle}
            />
            <TextInput
              style={[
                styles.input,
                {
                  padding: s(10),
                  borderRadius: s(8),
                  fontSize: ms(16),
                },
              ]}
              placeholder="Description"
              value={newDescription}
              onChangeText={setNewDescription}
            />
            <TextInput
              style={[
                styles.input,
                {
                  padding: s(10),
                  borderRadius: s(8),
                  fontSize: ms(16),
                },
              ]}
              placeholder="Price (€)"
              value={newPrice}
              onChangeText={setNewPrice}
              keyboardType="numeric"
            />
            <TextInput
              style={[
                styles.input,
                {
                  padding: s(10),
                  borderRadius: s(8),
                  fontSize: ms(16),
                },
              ]}
              placeholder="Teacher email"
              value={newTeacherEmail}
              onChangeText={setNewTeacherEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={[
                styles.addButton,
                {
                  padding: s(12),
                  borderRadius: s(8),
                },
              ]}
              onPress={addProgram}
            >
              <Text
                style={[
                  styles.addButtonText,
                  { fontSize: ms(16) },
                ]}
              >
                Add Program
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {loading ? (
          <ActivityIndicator size="large" color="#28a745" />
        ) : (
          <FlatList
            data={programs}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={listEmpty}
            contentContainerStyle={{ paddingBottom: s(12) }}
          />
        )}
      </View>
    </Layout>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  title: {
    fontWeight: "bold",
    color: "#28a745",
    flex: 1,
  },
  addToggleButton: { backgroundColor: "#28a745" },
  addToggleText: { color: "#fff", fontWeight: "bold" },
  item: {
    backgroundColor: "#fff",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  itemText: { fontWeight: "600" },
  headerButtons: { flexDirection: "row", alignItems: "center", gap: 10 },
  expandIcon: { fontWeight: "bold", color: "#28a745", marginLeft: 10 },
  priceButton: {
    backgroundColor: "#28a745",
  },
  priceText: { color: "#fff", fontWeight: "600" },
  details: {},
  description: { color: "#555" },
  teacherText: { color: "#007bff" },
  noDataText: {
    fontSize: 16,
    color: "#888",
    textAlign: "center",
    marginTop: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    marginBottom: 10,
  },
  inputInline: {
    borderWidth: 1,
    borderColor: "#ccc",
    flex: 1,
    marginRight: 10,
  },
  adminButtons: { flexDirection: "row", gap: 6 },
  editButton: { backgroundColor: "#007bff" },
  saveButton: { backgroundColor: "#28a745" },
  cancelButton: { backgroundColor: "#6c757d" },
  deleteButton: { backgroundColor: "#dc3545" },
  addForm: {
    marginBottom: 20,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
  },
  addButton: {
    backgroundColor: "#28a745",
    alignItems: "center",
  },
  addButtonText: { color: "#fff", fontWeight: "600" },
  buttonText: { color: "#fff", fontWeight: "600", textAlign: "center" },
});
