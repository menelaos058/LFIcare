// screens/ProgramsScreen.js
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
import { auth, db } from "../firebaseConfig";

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

  const isAdmin = user?.role === "admin";
  const isLoggedIn = !!user?.uid;

  // ---- Load Programs (real-time)
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

  // ---- Real-time purchases (for "Purchased" state)
  const [purchasedIds, setPurchasedIds] = useState(new Set());
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

  // ---- Helper: find legacy purchase (random id) by programId
  async function findLegacyPurchaseDoc(uid, programId) {
    const qLegacy = query(
      collection(db, "users", uid, "purchases"),
      where("programId", "==", programId)
    );
    const snap = await getDocs(qLegacy);
    if (!snap.empty) return snap.docs[0];
    return null;
  }

  // ---- Prevent double-tap
  const [purchaseLock, setPurchaseLock] = useState(false);

  // ---- Purchase + Chat create
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
          Alert.alert("Error", "No authenticated email found. Please re-login.");
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

        // A) Early exit if appears purchased in state
        if (purchasedIds.has(item.id)) {
          Alert.alert("Already purchased", "Έχεις ήδη αγοράσει αυτό το πρόγραμμα.");
          return;
        }

        // B) Deterministic purchase id = programId
        const purchaseRef = doc(db, "users", user.uid, "purchases", item.id);
        const existsDet = await getDoc(purchaseRef);
        if (existsDet.exists()) {
          Alert.alert("Already purchased", "Έχεις ήδη αγοράσει αυτό το πρόγραμμα.");
          return;
        }

        // C) Legacy check (random id with same programId)
        const legacy = await findLegacyPurchaseDoc(user.uid, item.id);
        if (legacy) {
          const legacyData = legacy.data();
          await setDoc(purchaseRef, {
            programId: legacyData.programId ?? item.id,
            programTitle: legacyData.programTitle ?? item.title,
            teacherEmail: String(legacyData.teacherEmail ?? teacherEmail).toLowerCase(),
            price: Number(legacyData.price ?? priceNum),
            description: legacyData.description ?? (item.description ?? ""),
            createdAt: serverTimestamp(),
          });
          try {
            await deleteDoc(legacy.ref);
          } catch (_) {}
          Alert.alert("Purchase Synced", "Υπήρχε παλαιότερη αγορά — έγινε συγχρονισμός.");
        } else {
          // D) New purchase
          await setDoc(purchaseRef, {
            programId: item.id,
            programTitle: item.title,
            teacherEmail,
            price: priceNum,
            description: item.description ?? "",
            createdAt: serverTimestamp(),
          });
          Alert.alert("Purchase Successful", `You bought "${item.title}" for ${priceNum}€.`);
        }

        // ---- Create Chat (must match Firestore rules)
        try {
          const usersLC = [tokenEmail, teacherEmail]; // both lowercase
          await addDoc(collection(db, "chats"), {
            users: usersLC,                      // required & must include auth email
            programId: item.id,                  // must exist in /programs
            programTitle: item.title,
            lastMessage: "",
            createdAt: serverTimestamp(),        // == request.time
          });
          // Optional UX: Alert για chat
          // Alert.alert("Chat Created", "Δημιουργήθηκε συνομιλία με τον καθηγητή.");
        } catch (err) {
          console.error("Chat create failed:", err);
          // Μην μπλοκάρεις την αγορά αν αποτύχει το chat. Δώσε καθαρό μήνυμα.
          Alert.alert(
            "Chat creation warning",
            err?.code === "permission-denied"
              ? "Το chat μπλοκαρίστηκε από τα Firestore rules (users[], createdAt, programId). Θα μπορείς να το δημιουργήσεις αργότερα."
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

  // ---- Admin actions
  const deleteProgram = useCallback(
    async (id) => {
      if (!isAdmin) {
        Alert.alert("Access Denied", "Only admins can delete programs.");
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
      Alert.alert("Access Denied", "Only admins can edit programs.");
      return;
    }
    setEditingId(id);
    setEditingTitle(currentTitle);
  };

  const saveEdit = useCallback(async () => {
    if (!isAdmin) {
      Alert.alert("Access Denied", "Only admins can edit programs.");
      return;
    }
    if (!editingTitle.trim()) {
      Alert.alert("Validation Error", "Program title cannot be empty.");
      return;
    }
    try {
      await updateDoc(doc(db, "programs", editingId), {
        title: editingTitle.trim(),
      });
      setEditingId(null);
      setEditingTitle("");
    } catch (error) {
      Alert.alert("Error", "Failed to update program: " + error.message);
    }
  }, [isAdmin, editingId, editingTitle]);

  const cancelEdit = () => {
    setEditingId(null);
    setEditingTitle("");
  };

  const addProgram = useCallback(async () => {
    if (!isAdmin) {
      Alert.alert("Access Denied", "Only admins can add programs.");
      return;
    }
    if (!newTitle.trim() || !newPrice.trim() || !newTeacherEmail.trim()) {
      Alert.alert("Validation Error", "Title, price and teacher email are required.");
      return;
    }
    const priceNum = Number(newPrice);
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      Alert.alert("Validation Error", "Price must be a non-negative number.");
      return;
    }
    try {
      await addDoc(collection(db, "programs"), {
        title: newTitle.trim(),
        description: newDescription.trim(),
        price: priceNum,
        teacherEmail: newTeacherEmail.trim().toLowerCase(), // store lowercase
      });
      setNewTitle("");
      setNewDescription("");
      setNewPrice("");
      setNewTeacherEmail("");
      setShowAddForm(false);
    } catch (error) {
      Alert.alert("Error", "Failed to add program: " + error.message);
    }
  }, [isAdmin, newTitle, newDescription, newPrice, newTeacherEmail]);

  const renderItem = ({ item }) => {
    const isEditing = editingId === item.id;
    const isExpanded = expandedId === item.id;
    const isPurchased = purchasedIds.has(item.id);

    return (
      <View style={styles.item}>
        <View style={styles.itemHeader}>
          {isEditing ? (
            <TextInput
              style={styles.inputInline}
              value={editingTitle}
              onChangeText={setEditingTitle}
            />
          ) : (
            <Text style={styles.itemText}>{item.title}</Text>
          )}

          <View style={styles.headerButtons}>
            {!isAdmin && (
              <TouchableOpacity
                style={[
                  styles.priceButton,
                  isPurchased && { backgroundColor: "#6c757d" },
                ]}
                onPress={() => !isPurchased && handlePurchase(item)}
                disabled={isPurchased}
              >
                <Text style={styles.priceText}>
                  {isPurchased
                    ? "Purchased"
                    : Number.isFinite(Number(item.price))
                    ? `${item.price}€`
                    : "Buy"}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => toggleExpand(item.id)}>
              <Text style={styles.expandIcon}>
                {isExpanded ? "−" : "+"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {isExpanded && (
          <View style={styles.details}>
            <Text style={styles.description}>
              {item.description || "No description"}
            </Text>
            <Text style={styles.teacherText}>
              👨‍🏫 Teacher: {(item.teacherEmail || "N/A")}
            </Text>
          </View>
        )}

        {isAdmin && (
          <View style={styles.adminButtons}>
            {isEditing ? (
              <>
                <TouchableOpacity style={styles.saveButton} onPress={saveEdit}>
                  <Text style={styles.buttonText}>Save</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={cancelEdit}
                >
                  <Text style={styles.buttonText}>Cancel</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => startEditing(item.id, item.title)}
                >
                  <Text style={styles.buttonText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => deleteProgram(item.id)}
                >
                  <Text style={styles.buttonText}>Delete</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </View>
    );
  };

  const listEmpty = useMemo(
    () => <Text style={styles.noDataText}>No programs available.</Text>,
    []
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Programs</Text>
        {isAdmin && (
          <TouchableOpacity
            style={styles.addToggleButton}
            onPress={() => setShowAddForm((s) => !s)}
          >
            <Text style={styles.addToggleText}>{showAddForm ? "−" : "+"}</Text>
          </TouchableOpacity>
        )}
      </View>

      {showAddForm && isAdmin && (
        <View style={styles.addForm}>
          <TextInput
            style={styles.input}
            placeholder="Title"
            value={newTitle}
            onChangeText={setNewTitle}
          />
          <TextInput
            style={styles.input}
            placeholder="Description"
            value={newDescription}
            onChangeText={setNewDescription}
          />
          <TextInput
            style={styles.input}
            placeholder="Price (€)"
            value={newPrice}
            onChangeText={setNewPrice}
            keyboardType="numeric"
          />
          <TextInput
            style={styles.input}
            placeholder="Teacher email"
            value={newTeacherEmail}
            onChangeText={setNewTeacherEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TouchableOpacity style={styles.addButton} onPress={addProgram}>
            <Text style={styles.addButtonText}>Add Program</Text>
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
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#f5f5f5" },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  title: { fontSize: 28, fontWeight: "bold", color: "#28a745", flex: 1 },
  addToggleButton: {
    backgroundColor: "#28a745",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  addToggleText: { color: "#fff", fontSize: 22, fontWeight: "bold" },
  item: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  itemHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  itemText: { fontSize: 16, fontWeight: "600" },
  headerButtons: { flexDirection: "row", alignItems: "center", gap: 10 },
  expandIcon: { fontSize: 20, fontWeight: "bold", color: "#28a745", marginLeft: 10 },
  priceButton: {
    backgroundColor: "#28a745",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  priceText: { color: "#fff", fontWeight: "600" },
  details: { marginTop: 10 },
  description: { fontSize: 14, color: "#555" },
  teacherText: { fontSize: 14, color: "#007bff", marginTop: 4 },
  noDataText: { fontSize: 16, color: "#888", textAlign: "center", marginTop: 20 },
  input: {
    borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 10, marginBottom: 10, fontSize: 16,
  },
  inputInline: {
    borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 6, fontSize: 16, flex: 1, marginRight: 10,
  },
  adminButtons: { flexDirection: "row", marginTop: 10, gap: 6 },
  editButton: {
    backgroundColor: "#007bff", paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, marginRight: 6,
  },
  saveButton: {
    backgroundColor: "#28a745", paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, marginRight: 6,
  },
  cancelButton: {
    backgroundColor: "#6c757d", paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6,
  },
  deleteButton: {
    backgroundColor: "#dc3545", paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6,
  },
  addForm: {
    marginBottom: 20, backgroundColor: "#fff", padding: 15, borderRadius: 12, borderWidth: 1, borderColor: "#ddd",
  },
  addButton: { backgroundColor: "#28a745", padding: 12, borderRadius: 8, alignItems: "center" },
  addButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  buttonText: { color: "#fff", fontWeight: "600" },
});
