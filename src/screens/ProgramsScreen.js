import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  updateDoc,
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
import { db } from "../services/firebaseConfig";
import { useResponsive } from "../theme/responsive";

export default function ProgramsScreen({ user, navigation }) {
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
  const [newDurationMonths, setNewDurationMonths] = useState("5");
  const [newProductId, setNewProductId] = useState("pro");

  const [activeProgramIds, setActiveProgramIds] = useState(new Set());
  const [ownedProgramIds, setOwnedProgramIds] = useState(new Set());

  const { s, ms } = useResponsive();

  const isAdmin = user?.role === "admin";
  const isLoggedIn = !!user?.uid;

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

  useEffect(() => {
    if (!user?.uid) {
      setActiveProgramIds(new Set());
      setOwnedProgramIds(new Set());
      return;
    }

    const colRef = collection(db, "users", user.uid, "subscriptions");

    const unsub = onSnapshot(
      colRef,
      (snap) => {
        const activeIds = new Set();
        const ownedIds = new Set();
        const now = new Date();

        snap.forEach((d) => {
          const data = d.data();
          const exp = data?.expiresAt?.toDate?.();
          const active = !!exp && exp > now;
          const programId = data?.programId || d.id;

          if (programId) {
            ownedIds.add(programId);
          }

          if (active && programId) {
            activeIds.add(programId);
          }
        });

        setActiveProgramIds(activeIds);
        setOwnedProgramIds(ownedIds);
      },
      (err) => {
        console.error("onSnapshot(user subscriptions) failed:", err);
      }
    );

    return () => unsub();
  }, [user?.uid]);

  const toggleExpand = (id) =>
    setExpandedId((prev) => (prev === id ? null : id));

  const handlePurchase = useCallback(
    async (item) => {
      if (!isLoggedIn) {
        Alert.alert("Απαιτείται σύνδεση", "Κάνε login πριν την αγορά.");
        navigation.navigate("Login");
        return;
      }

      if (!item?.id) {
        Alert.alert("Σφάλμα", "Το πρόγραμμα δεν έχει έγκυρο id.");
        return;
      }

      const productId = item?.productId;
      if (productId !== "pro" && productId !== "pro2") {
        Alert.alert(
          "Λείπει productId",
          "Αυτό το πρόγραμμα δεν έχει συνδεθεί με subscription (productId: pro/pro2). Βάλε το στο Firestore στο /programs."
        );
        return;
      }

      if (activeProgramIds.has(item.id)) {
        Alert.alert(
          "Ενεργό",
          "Έχεις ήδη ενεργή συνδρομή για αυτό το πρόγραμμα."
        );
        return;
      }

      navigation.navigate("Paywall", {
        autoStart: true,
        productId,
        programId: item.id,
        title: item.title,
        returnTo: "MyPrograms",
        isRenewal: ownedProgramIds.has(item.id),
      });
    },
    [isLoggedIn, activeProgramIds, ownedProgramIds, navigation]
  );

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

    if (!editingId) {
      Alert.alert("Error", "No program selected for editing.");
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
      Alert.alert(
        "Validation Error",
        "Title, price and teacher email are required."
      );
      return;
    }

    const priceNum = Number(newPrice);
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      Alert.alert("Validation Error", "Price must be a non-negative number.");
      return;
    }

    const teacherEmailLC = newTeacherEmail.trim().toLowerCase();
    const monthsNum = Number(newDurationMonths);
    if (!Number.isFinite(monthsNum) || monthsNum <= 0 || monthsNum > 60) {
      Alert.alert(
        "Validation Error",
        "Duration must be between 1 and 60 months."
      );
      return;
    }

    if (newProductId !== "pro" && newProductId !== "pro2") {
      Alert.alert("Validation Error", "productId must be pro or pro2.");
      return;
    }

    try {
      await addDoc(collection(db, "programs"), {
        title: newTitle.trim(),
        description: newDescription.trim(),
        price: priceNum,
        teacherEmail: teacherEmailLC,
        accessDurationMonths: monthsNum,
        productId: newProductId,
      });

      setNewTitle("");
      setNewDescription("");
      setNewPrice("");
      setNewTeacherEmail("");
      setNewDurationMonths("5");
      setNewProductId("pro");
      setShowAddForm(false);
    } catch (error) {
      Alert.alert("Error", "Failed to add program: " + error.message);
    }
  }, [
    isAdmin,
    newTitle,
    newDescription,
    newPrice,
    newTeacherEmail,
    newDurationMonths,
    newProductId,
  ]);

  const getProgramActionState = useCallback(
    (item) => {
      const isActive = activeProgramIds.has(item.id);
      const hasOwnedBefore = ownedProgramIds.has(item.id);
      const isExpiredOwned = hasOwnedBefore && !isActive;
      const hasValidPrice = Number.isFinite(Number(item.price));
      const formattedPrice = hasValidPrice
        ? `${Number(item.price).toFixed(2)}€`
        : null;

      if (isActive) {
        return {
          label: "Active",
          sublabel: "Already purchased",
          disabled: true,
          buttonStyle: styles.purchaseButtonDisabled,
          textStyle: styles.purchaseButtonTextDisabled,
          badgeLabel: "Active Access",
          badgeStyle: styles.badgeActive,
          badgeTextStyle: styles.badgeTextActive,
        };
      }

      if (isExpiredOwned) {
        return {
          label: formattedPrice ? `Resubscribe ${formattedPrice}` : "Resubscribe",
          sublabel: "Access expired",
          disabled: false,
          buttonStyle: styles.purchaseButtonRenew,
          textStyle: styles.purchaseButtonText,
          badgeLabel: "Expired",
          badgeStyle: styles.badgeExpired,
          badgeTextStyle: styles.badgeTextExpired,
        };
      }

      return {
        label: formattedPrice ? `Subscribe ${formattedPrice}` : "Subscribe",
        sublabel: !isLoggedIn ? "Login required" : "One tap purchase",
        disabled: false,
        buttonStyle: styles.purchaseButtonBuy,
        textStyle: styles.purchaseButtonText,
        badgeLabel: "New",
        badgeStyle: styles.badgeNew,
        badgeTextStyle: styles.badgeTextNew,
      };
    },
    [activeProgramIds, ownedProgramIds, isLoggedIn]
  );

  const renderItem = ({ item }) => {
    const isEditing = editingId === item.id;
    const isExpanded = expandedId === item.id;
    const actionState = getProgramActionState(item);

    return (
      <View style={[styles.item, { padding: s(15), borderRadius: s(14) }]}>
        <View style={styles.itemHeader}>
          <View style={styles.titleArea}>
            {isEditing ? (
              <TextInput
                style={[
                  styles.inputInline,
                  { padding: s(8), borderRadius: s(8), fontSize: ms(16) },
                ]}
                value={editingTitle}
                onChangeText={setEditingTitle}
              />
            ) : (
              <>
                <Text style={[styles.itemText, { fontSize: ms(17) }]}>
                  {item.title}
                </Text>

                {!isAdmin && (
                  <View
                    style={[
                      styles.statusBadge,
                      actionState.badgeStyle,
                      { marginTop: s(6) },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        actionState.badgeTextStyle,
                        { fontSize: ms(11) },
                      ]}
                    >
                      {actionState.badgeLabel}
                    </Text>
                  </View>
                )}
              </>
            )}
          </View>

          <View style={styles.headerButtons}>
            {!isAdmin && (
              <View style={styles.purchaseArea}>
                <TouchableOpacity
                  style={[
                    styles.purchaseButton,
                    actionState.buttonStyle,
                    {
                      paddingVertical: s(10),
                      paddingHorizontal: s(14),
                      borderRadius: s(10),
                    },
                  ]}
                  onPress={() => handlePurchase(item)}
                  disabled={actionState.disabled}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.purchaseButtonText,
                      actionState.textStyle,
                      { fontSize: ms(13) },
                    ]}
                  >
                    {actionState.label}
                  </Text>
                </TouchableOpacity>

                <Text
                  style={[
                    styles.purchaseSubLabel,
                    { fontSize: ms(11), marginTop: s(4) },
                  ]}
                >
                  {actionState.sublabel}
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.expandButton, { width: s(34), height: s(34), borderRadius: s(17) }]}
              onPress={() => toggleExpand(item.id)}
              activeOpacity={0.8}
            >
              <Text style={[styles.expandIcon, { fontSize: ms(18) }]}>
                {isExpanded ? "−" : "+"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {isExpanded && (
          <View style={[styles.details, { marginTop: s(12) }]}>
            <Text style={[styles.description, { fontSize: ms(14) }]}>
              {item.description || "No description"}
            </Text>

            <Text
              style={[
                styles.teacherText,
                { fontSize: ms(14), marginTop: s(8) },
              ]}
            >
              👨‍🏫 Teacher: {item.teacherEmail || "N/A"}
            </Text>

            <Text
              style={[
                styles.metaText,
                { fontSize: ms(13), marginTop: s(8) },
              ]}
            >
              ⏳ Duration: {item.accessDurationMonths ?? 5} months
            </Text>

            <Text
              style={[
                styles.metaText,
                { fontSize: ms(13), marginTop: s(6) },
              ]}
            >
              🧾 ProductId: {item.productId ?? "— (missing)"}
            </Text>

            {!isAdmin && (
              <View style={[styles.infoBox, { marginTop: s(10), borderRadius: s(10), padding: s(10) }]}>
                <Text style={[styles.infoBoxText, { fontSize: ms(12) }]}>
                  {!isLoggedIn
                    ? "Κάνε login για να προχωρήσεις σε αγορά."
                    : actionState.badgeLabel === "Expired"
                    ? "Η προηγούμενη πρόσβασή σου έχει λήξει. Μπορείς να κάνεις renew."
                    : actionState.badgeLabel === "Active Access"
                    ? "Έχεις ήδη πρόσβαση σε αυτό το πρόγραμμα."
                    : "Πάτησε Buy για να ανοίξει το payment flow."}
                </Text>
              </View>
            )}
          </View>
        )}

        {isAdmin && (
          <View style={[styles.adminButtons, { marginTop: s(12) }]}>
            {isEditing ? (
              <>
                <TouchableOpacity
                  style={[
                    styles.saveButton,
                    {
                      paddingVertical: s(8),
                      paddingHorizontal: s(14),
                      borderRadius: s(8),
                    },
                  ]}
                  onPress={saveEdit}
                >
                  <Text style={[styles.buttonText, { fontSize: ms(13) }]}>
                    Save
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.cancelButton,
                    {
                      paddingVertical: s(8),
                      paddingHorizontal: s(14),
                      borderRadius: s(8),
                    },
                  ]}
                  onPress={cancelEdit}
                >
                  <Text style={[styles.buttonText, { fontSize: ms(13) }]}>
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
                      paddingVertical: s(8),
                      paddingHorizontal: s(14),
                      borderRadius: s(8),
                    },
                  ]}
                  onPress={() => startEditing(item.id, item.title)}
                >
                  <Text style={[styles.buttonText, { fontSize: ms(13) }]}>
                    Edit
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.deleteButton,
                    {
                      paddingVertical: s(8),
                      paddingHorizontal: s(14),
                      borderRadius: s(8),
                    },
                  ]}
                  onPress={() => deleteProgram(item.id)}
                >
                  <Text style={[styles.buttonText, { fontSize: ms(13) }]}>
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
    () => <Text style={styles.noDataText}>No programs available.</Text>,
    []
  );

  return (
    <Layout>
      <View style={[styles.container, { padding: s(20) }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { fontSize: ms(28) }]}>Programs</Text>

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
              onPress={() => setShowAddForm((v) => !v)}
            >
              <Text style={[styles.addToggleText, { fontSize: ms(22) }]}>
                {showAddForm ? "−" : "+"}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {showAddForm && isAdmin && (
          <View
            style={[styles.addForm, { padding: s(15), borderRadius: s(12) }]}
          >
            <TextInput
              style={[
                styles.input,
                { padding: s(10), borderRadius: s(8), fontSize: ms(16) },
              ]}
              placeholder="Title"
              value={newTitle}
              onChangeText={setNewTitle}
            />

            <TextInput
              style={[
                styles.input,
                { padding: s(10), borderRadius: s(8), fontSize: ms(16) },
              ]}
              placeholder="Description"
              value={newDescription}
              onChangeText={setNewDescription}
            />

            <TextInput
              style={[
                styles.input,
                { padding: s(10), borderRadius: s(8), fontSize: ms(16) },
              ]}
              placeholder="Price (€)"
              value={newPrice}
              onChangeText={setNewPrice}
              keyboardType="numeric"
            />

            <TextInput
              style={[
                styles.input,
                { padding: s(10), borderRadius: s(8), fontSize: ms(16) },
              ]}
              placeholder="Teacher email"
              value={newTeacherEmail}
              onChangeText={setNewTeacherEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <TextInput
              style={[
                styles.input,
                { padding: s(10), borderRadius: s(8), fontSize: ms(16) },
              ]}
              placeholder="Duration (months) e.g. 4/6"
              value={newDurationMonths}
              onChangeText={setNewDurationMonths}
              keyboardType="numeric"
            />

            <TextInput
              style={[
                styles.input,
                { padding: s(10), borderRadius: s(8), fontSize: ms(16) },
              ]}
              placeholder="ProductId (pro / pro2)"
              value={newProductId}
              onChangeText={setNewProductId}
              autoCapitalize="none"
            />

            <TouchableOpacity
              style={[styles.addButton, { padding: s(12), borderRadius: s(8) }]}
              onPress={addProgram}
            >
              <Text style={[styles.addButtonText, { fontSize: ms(16) }]}>
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
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </Layout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f7fb",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  title: {
    fontWeight: "bold",
    color: "#28a745",
    flex: 1,
  },
  addToggleButton: {
    backgroundColor: "#28a745",
  },
  addToggleText: {
    color: "#fff",
    fontWeight: "bold",
  },
  item: {
    backgroundColor: "#fff",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e3e7ee",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  titleArea: {
    flex: 1,
    paddingRight: 10,
  },
  itemText: {
    fontWeight: "700",
    color: "#182033",
  },
  headerButtons: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  purchaseArea: {
    alignItems: "flex-end",
    marginRight: 10,
  },
  purchaseButton: {
    minWidth: 116,
    alignItems: "center",
    justifyContent: "center",
  },
  purchaseButtonBuy: {
    backgroundColor: "#28a745",
  },
  purchaseButtonRenew: {
    backgroundColor: "#f59e0b",
  },
  purchaseButtonDisabled: {
    backgroundColor: "#94a3b8",
  },
  purchaseButtonText: {
    color: "#fff",
    fontWeight: "700",
  },
  purchaseButtonTextDisabled: {
    color: "#fff",
    fontWeight: "700",
  },
  purchaseSubLabel: {
    color: "#6b7280",
    fontWeight: "500",
  },
  expandButton: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  expandIcon: {
    fontWeight: "bold",
    color: "#28a745",
  },
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusBadgeText: {
    fontWeight: "700",
  },
  badgeNew: {
    backgroundColor: "#e8f7ec",
  },
  badgeTextNew: {
    color: "#1f8f3d",
  },
  badgeActive: {
    backgroundColor: "#e2e8f0",
  },
  badgeTextActive: {
    color: "#475569",
  },
  badgeExpired: {
    backgroundColor: "#fff4e5",
  },
  badgeTextExpired: {
    color: "#b45309",
  },
  details: {},
  description: {
    color: "#4b5563",
    lineHeight: 20,
  },
  teacherText: {
    color: "#2563eb",
    fontWeight: "600",
  },
  metaText: {
    color: "#6b7280",
  },
  infoBox: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  infoBoxText: {
    color: "#4b5563",
    lineHeight: 18,
  },
  noDataText: {
    fontSize: 16,
    color: "#888",
    textAlign: "center",
    marginTop: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    marginBottom: 10,
    backgroundColor: "#fff",
  },
  inputInline: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    flex: 1,
    marginRight: 10,
    backgroundColor: "#fff",
  },
  adminButtons: {
    flexDirection: "row",
    gap: 8,
  },
  editButton: {
    backgroundColor: "#2563eb",
  },
  saveButton: {
    backgroundColor: "#28a745",
  },
  cancelButton: {
    backgroundColor: "#6c757d",
  },
  deleteButton: {
    backgroundColor: "#dc3545",
  },
  addForm: {
    marginBottom: 20,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e3e7ee",
  },
  addButton: {
    backgroundColor: "#28a745",
    alignItems: "center",
  },
  addButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
    textAlign: "center",
  },
});