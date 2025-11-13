// screens/TeachersScreen.js
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
import { db } from "../services/firebaseConfig";

export default function TeachersScreen({ user: initialUser }) {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);

  // add form state
  const [newTeacherName, setNewTeacherName] = useState("");
  const [newTeacherEmail, setNewTeacherEmail] = useState("");
  const [newTeacherPhone, setNewTeacherPhone] = useState("");
  const [newTeacherDescription, setNewTeacherDescription] = useState("");

  // edit state
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [editingEmail, setEditingEmail] = useState("");
  const [editingPhone, setEditingPhone] = useState("");
  const [editingDescription, setEditingDescription] = useState("");

  // UI state
  const [expandedId, setExpandedId] = useState(null);

  // Ποντάρουμε στον ρόλο που ήδη μας δίνει το App.js (live onSnapshot)
  const isAdmin = initialUser?.role === "admin";

  // Real-time teachers
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "teachers"),
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setTeachers(data);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        Alert.alert("Error", err.message);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const toggleExpand = (id) => setExpandedId(expandedId === id ? null : id);

  const validateTeacher = useCallback((t) => {
    if (!t.name.trim()) {
      Alert.alert("Validation Error", "Name is required.");
      return false;
    }
    const email = t.email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      Alert.alert("Validation Error", "Please enter a valid email.");
      return false;
    }
    if (t.phone && !/^\+?\d{7,15}$/.test(t.phone.trim())) {
      Alert.alert("Validation Error", "Please enter a valid phone number (7–15 digits).");
      return false;
    }
    return true;
  }, []);

  // Create
  const addTeacher = useCallback(async () => {
    if (!isAdmin) {
      Alert.alert("Access Denied", "Only admins can add teachers.");
      return;
    }
    const payload = {
      name: newTeacherName,
      email: newTeacherEmail.trim().toLowerCase(),
      phone: newTeacherPhone,
      description: newTeacherDescription,
    };
    if (!validateTeacher(payload)) return;

    try {
      // ΣΗΜΑΝΤΙΚΟ: μόνο τα whitelisted πεδία που επιτρέπουν οι rules
      await addDoc(collection(db, "teachers"), {
        name: payload.name.trim(),
        email: payload.email,
        phone: (payload.phone || "").trim(),
        description: (payload.description || "").trim(),
      });
      setNewTeacherName("");
      setNewTeacherEmail("");
      setNewTeacherPhone("");
      setNewTeacherDescription("");
      setExpandedId(null);
    } catch (error) {
      Alert.alert("Error", "Failed to add teacher: " + error.message);
    }
  }, [isAdmin, newTeacherName, newTeacherEmail, newTeacherPhone, newTeacherDescription, validateTeacher]);

  // Delete
  const deleteTeacher = useCallback(async (id) => {
    if (!isAdmin) {
      Alert.alert("Access Denied", "Only admins can delete teachers.");
      return;
    }
    try {
      await deleteDoc(doc(db, "teachers", id));
    } catch (error) {
      Alert.alert("Error", "Failed to delete teacher: " + error.message);
    }
  }, [isAdmin]);

  // Start Edit
  const startEditTeacher = (teacher) => {
    if (!isAdmin) {
      Alert.alert("Access Denied", "Only admins can edit teachers.");
      return;
    }
    setEditingId(teacher.id);
    setEditingName(teacher.name ?? "");
    setEditingEmail(teacher.email ?? "");
    setEditingPhone(teacher.phone ?? "");
    setEditingDescription(teacher.description ?? "");
  };

  // Save Edit
  const saveEditTeacher = useCallback(async () => {
    if (!isAdmin) {
      Alert.alert("Access Denied", "Only admins can edit teachers.");
      return;
    }
    const payload = {
      name: editingName,
      email: editingEmail.trim().toLowerCase(),
      phone: editingPhone,
      description: editingDescription,
    };
    if (!validateTeacher(payload)) return;

    try {
      // ΣΗΜΑΝΤΙΚΟ: μόνο τα πεδία που προβλέπουν οι rules
      await updateDoc(doc(db, "teachers", editingId), {
        name: payload.name.trim(),
        email: payload.email,
        phone: (payload.phone || "").trim(),
        description: (payload.description || "").trim(),
      });
      setEditingId(null);
      setEditingName("");
      setEditingEmail("");
      setEditingPhone("");
      setEditingDescription("");
    } catch (error) {
      Alert.alert("Error", "Failed to update teacher: " + error.message);
    }
  }, [isAdmin, editingId, editingName, editingEmail, editingPhone, editingDescription, validateTeacher]);

  const cancelEdit = () => {
    setEditingId(null);
    setEditingName("");
    setEditingEmail("");
    setEditingPhone("");
    setEditingDescription("");
  };

  const renderItem = ({ item }) => {
    const isEditing = editingId === item.id;
    const isExpanded = expandedId === item.id;

    return (
      <View style={styles.item}>
        {/* Header */}
        {isEditing ? (
          <>
            <TextInput
              style={styles.inputInline}
              value={editingName}
              placeholder="Name"
              onChangeText={setEditingName}
            />
            <TextInput
              style={styles.inputInline}
              value={editingEmail}
              placeholder="Email"
              onChangeText={setEditingEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <TextInput
              style={styles.inputInline}
              value={editingPhone}
              placeholder="Phone"
              onChangeText={setEditingPhone}
              keyboardType="phone-pad"
            />
          </>
        ) : (
          <View style={styles.headerRow}>
            <Text style={styles.itemText}>{item.name}</Text>
            <TouchableOpacity onPress={() => toggleExpand(item.id)}>
              <Text style={styles.expandIcon}>{isExpanded ? "−" : "+"}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Λεπτομέρειες */}
        {isExpanded && (
          <View style={styles.details}>
            <Text>Email: {item.email || "N/A"}</Text>
            <Text>Phone: {item.phone || "N/A"}</Text>
            <Text>Description: {item.description || "No description"}</Text>
          </View>
        )}

        {/* Admin κουμπιά */}
        {isAdmin && (
          <View style={styles.adminButtons}>
            {isEditing ? (
              <>
                <TouchableOpacity style={styles.saveButton} onPress={saveEditTeacher}>
                  <Text style={styles.buttonText}>Save</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelButton} onPress={cancelEdit}>
                  <Text style={styles.buttonText}>Cancel</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity style={styles.editButton} onPress={() => startEditTeacher(item)}>
                  <Text style={styles.buttonText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteButton} onPress={() => deleteTeacher(item.id)}>
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
    () => (
      <Text style={styles.noDataText}>
        {loading ? "" : "No teachers found."}
      </Text>
    ),
    [loading]
  );

  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>Teachers</Text>
        {isAdmin && (
          <TouchableOpacity
            style={styles.addButtonSmall}
            onPress={() => setExpandedId(expandedId === "new" ? null : "new")}
          >
            <Text style={styles.buttonText}>+</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Add new teacher form */}
      {expandedId === "new" && isAdmin && (
        <View style={styles.newForm}>
          <TextInput
            style={styles.input}
            placeholder="Name"
            value={newTeacherName}
            onChangeText={setNewTeacherName}
          />
          <TextInput
            style={styles.input}
            placeholder="Email"
            value={newTeacherEmail}
            onChangeText={setNewTeacherEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextInput
            style={styles.input}
            placeholder="Phone"
            value={newTeacherPhone}
            onChangeText={setNewTeacherPhone}
            keyboardType="phone-pad"
          />
          <TextInput
            style={styles.input}
            placeholder="Description"
            value={newTeacherDescription}
            onChangeText={setNewTeacherDescription}
          />
          <TouchableOpacity style={styles.addButton} onPress={addTeacher}>
            <Text style={styles.addButtonText}>Add Teacher</Text>
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <ActivityIndicator size="large" color="#28a745" />
      ) : (
        <FlatList
          data={teachers}
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
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  title: { fontSize: 28, fontWeight: "bold", color: "#28a745" },
  item: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  itemText: { fontSize: 16, fontWeight: "600" },
  expandIcon: { fontSize: 20, fontWeight: "bold", color: "#28a745" },
  details: { marginTop: 10 },
  adminButtons: { flexDirection: "row", marginTop: 10, gap: 6 },
  editButton: { backgroundColor: "#007bff", padding: 6, borderRadius: 6, marginRight: 6 },
  saveButton: { backgroundColor: "#28a745", padding: 6, borderRadius: 6, marginRight: 6 },
  cancelButton: { backgroundColor: "#6c757d", padding: 6, borderRadius: 6 },
  deleteButton: { backgroundColor: "#dc3545", padding: 6, borderRadius: 6 },
  buttonText: { color: "#fff", fontWeight: "600", textAlign: "center" },
  inputInline: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 6, fontSize: 16, flex: 1, marginRight: 10, marginTop: 8 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 10, marginBottom: 10, fontSize: 16 },
  addButton: { backgroundColor: "#28a745", padding: 12, borderRadius: 8, alignItems: "center", marginBottom: 10 },
  addButtonSmall: { backgroundColor: "#28a745", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  addButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  newForm: { backgroundColor: "#fff", padding: 15, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: "#ddd" },
});
