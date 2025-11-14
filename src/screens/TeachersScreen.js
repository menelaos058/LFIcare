// src/screens/TeachersScreen.js
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

export default function TeachersScreen({ user: initialUser }) {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [newTeacherName, setNewTeacherName] = useState("");
  const [newTeacherEmail, setNewTeacherEmail] = useState("");
  const [newTeacherPhone, setNewTeacherPhone] = useState("");
  const [newTeacherDescription, setNewTeacherDescription] = useState("");

  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [editingEmail, setEditingEmail] = useState("");
  const [editingPhone, setEditingPhone] = useState("");
  const [editingDescription, setEditingDescription] = useState("");

  const [expandedId, setExpandedId] = useState(null);

  const { s, ms, isLargeScreen } = useResponsive();

  const isAdmin = initialUser?.role === "admin";

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

  const toggleExpand = (id) =>
    setExpandedId(expandedId === id ? null : id);

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
      Alert.alert(
        "Validation Error",
        "Please enter a valid phone number (7–15 digits)."
      );
      return false;
    }
    return true;
  }, []);

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
      Alert.alert(
        "Error",
        "Failed to add teacher: " + error.message
      );
    }
  }, [
    isAdmin,
    newTeacherName,
    newTeacherEmail,
    newTeacherPhone,
    newTeacherDescription,
    validateTeacher,
  ]);

  const deleteTeacher = useCallback(
    async (id) => {
      if (!isAdmin) {
        Alert.alert(
          "Access Denied",
          "Only admins can delete teachers."
        );
        return;
      }
      try {
        await deleteDoc(doc(db, "teachers", id));
      } catch (error) {
        Alert.alert(
          "Error",
          "Failed to delete teacher: " + error.message
        );
      }
    },
    [isAdmin]
  );

  const startEditTeacher = (teacher) => {
    if (!isAdmin) {
      Alert.alert(
        "Access Denied",
        "Only admins can edit teachers."
      );
      return;
    }
    setEditingId(teacher.id);
    setEditingName(teacher.name ?? "");
    setEditingEmail(teacher.email ?? "");
    setEditingPhone(teacher.phone ?? "");
    setEditingDescription(teacher.description ?? "");
  };

  const saveEditTeacher = useCallback(async () => {
    if (!isAdmin) {
      Alert.alert(
        "Access Denied",
        "Only admins can edit teachers."
      );
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
      Alert.alert(
        "Error",
        "Failed to update teacher: " + error.message
      );
    }
  }, [
    isAdmin,
    editingId,
    editingName,
    editingEmail,
    editingPhone,
    editingDescription,
    validateTeacher,
  ]);

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
      <View
        style={[
          styles.item,
          {
            padding: s(15),
            borderRadius: s(12),
          },
        ]}
      >
        {isEditing ? (
          <>
            <TextInput
              style={[
                styles.inputInline,
                {
                  padding: s(6),
                  borderRadius: s(8),
                  fontSize: ms(16),
                  marginTop: s(8),
                },
              ]}
              value={editingName}
              placeholder="Name"
              onChangeText={setEditingName}
            />
            <TextInput
              style={[
                styles.inputInline,
                {
                  padding: s(6),
                  borderRadius: s(8),
                  fontSize: ms(16),
                  marginTop: s(8),
                },
              ]}
              value={editingEmail}
              placeholder="Email"
              onChangeText={setEditingEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <TextInput
              style={[
                styles.inputInline,
                {
                  padding: s(6),
                  borderRadius: s(8),
                  fontSize: ms(16),
                  marginTop: s(8),
                },
              ]}
              value={editingPhone}
              placeholder="Phone"
              onChangeText={setEditingPhone}
              keyboardType="phone-pad"
            />
          </>
        ) : (
          <View style={styles.headerRow}>
            <Text
              style={[
                styles.itemText,
                { fontSize: ms(16) },
              ]}
            >
              {item.name}
            </Text>
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
        )}

        {isExpanded && (
          <View
            style={[
              styles.details,
              { marginTop: s(10) },
            ]}
          >
            <Text style={{ fontSize: ms(14) }}>
              Email: {item.email || "N/A"}
            </Text>
            <Text style={{ fontSize: ms(14), marginTop: s(4) }}>
              Phone: {item.phone || "N/A"}
            </Text>
            <Text style={{ fontSize: ms(14), marginTop: s(4) }}>
              Description: {item.description || "No description"}
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
                      padding: s(6),
                      borderRadius: s(6),
                    },
                  ]}
                  onPress={saveEditTeacher}
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
                      padding: s(6),
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
                      padding: s(6),
                      borderRadius: s(6),
                    },
                  ]}
                  onPress={() => startEditTeacher(item)}
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
                      padding: s(6),
                      borderRadius: s(6),
                    },
                  ]}
                  onPress={() => deleteTeacher(item.id)}
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
      <Text style={styles.noDataText}>
        {loading ? "" : "No teachers found."}
      </Text>
    ),
    [loading]
  );

  return (
    <Layout>
      <View
        style={[
          styles.container,
          { padding: s(20) },
        ]}
      >
        <View style={styles.titleRow}>
          <Text
            style={[
              styles.title,
              { fontSize: ms(28) },
            ]}
          >
            Teachers
          </Text>
          {isAdmin && (
            <TouchableOpacity
              style={[
                styles.addButtonSmall,
                {
                  paddingHorizontal: s(12),
                  paddingVertical: s(6),
                  borderRadius: s(6),
                },
              ]}
              onPress={() =>
                setExpandedId(expandedId === "new" ? null : "new")
              }
            >
              <Text
                style={[
                  styles.buttonText,
                  { fontSize: ms(18) },
                ]}
              >
                +
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {expandedId === "new" && isAdmin && (
          <View
            style={[
              styles.newForm,
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
              placeholder="Name"
              value={newTeacherName}
              onChangeText={setNewTeacherName}
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
              placeholder="Email"
              value={newTeacherEmail}
              onChangeText={setNewTeacherEmail}
              autoCapitalize="none"
              keyboardType="email-address"
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
              placeholder="Phone"
              value={newTeacherPhone}
              onChangeText={setNewTeacherPhone}
              keyboardType="phone-pad"
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
              value={newTeacherDescription}
              onChangeText={setNewTeacherDescription}
            />
            <TouchableOpacity
              style={[
                styles.addButton,
                {
                  padding: s(12),
                  borderRadius: s(8),
                },
              ]}
              onPress={addTeacher}
            >
              <Text
                style={[
                  styles.addButtonText,
                  { fontSize: ms(16) },
                ]}
              >
                Add Teacher
              </Text>
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
            contentContainerStyle={{ paddingBottom: s(12) }}
          />
        )}
      </View>
    </Layout>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  title: { fontWeight: "bold", color: "#28a745" },
  item: {
    backgroundColor: "#fff",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  itemText: { fontWeight: "600" },
  expandIcon: { fontWeight: "bold", color: "#28a745" },
  details: {},
  adminButtons: { flexDirection: "row", gap: 6 },
  editButton: { backgroundColor: "#007bff" },
  saveButton: { backgroundColor: "#28a745" },
  cancelButton: { backgroundColor: "#6c757d" },
  deleteButton: { backgroundColor: "#dc3545" },
  buttonText: { color: "#fff", fontWeight: "600", textAlign: "center" },
  inputInline: {
    borderWidth: 1,
    borderColor: "#ccc",
    flex: 1,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    marginBottom: 10,
  },
  addButton: {
    backgroundColor: "#28a745",
    alignItems: "center",
    marginBottom: 10,
  },
  addButtonSmall: { backgroundColor: "#28a745" },
  addButtonText: { color: "#fff", fontWeight: "600" },
  newForm: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
    marginBottom: 10,
  },
  noDataText: {
    fontSize: 16,
    color: "#888",
    textAlign: "center",
    marginTop: 20,
  },
});
