// src/screens/AdminScreen.js
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
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { db } from "../services/firebaseConfig";

export default function AdminScreen({ user }) {
  // ✅ Παίρνουμε user ως prop από App.js (όχι route.params)
  const isAdmin = user?.role === "admin";

  // --- Programs ---
  const [programTitle, setProgramTitle] = useState("");
  const [programDescription, setProgramDescription] = useState("");
  const [programPrice, setProgramPrice] = useState("");
  const [programTeacherEmail, setProgramTeacherEmail] = useState("");
  const [programDurationMonths, setProgramDurationMonths] = useState("5"); // default 5

  const [programs, setPrograms] = useState([]);
  const [editingProgramId, setEditingProgramId] = useState(null);

  // --- Teachers ---
  const [teacherName, setTeacherName] = useState("");
  const [teacherEmail, setTeacherEmail] = useState("");
  const [teacherPhone, setTeacherPhone] = useState("");
  const [teacherDescription, setTeacherDescription] = useState("");
  const [teachers, setTeachers] = useState([]);
  const [editingTeacherId, setEditingTeacherId] = useState(null);

  // --- Real-time data ---
  useEffect(() => {
    const unsubPrograms = onSnapshot(
      collection(db, "programs"),
      (snap) => setPrograms(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => Alert.alert("Error", err.message)
    );

    const unsubTeachers = onSnapshot(
      collection(db, "teachers"),
      (snap) => setTeachers(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => Alert.alert("Error", err.message)
    );

    return () => {
      unsubPrograms();
      unsubTeachers();
    };
  }, []);

  // --- Validators ---
  const validateEmail = (e) => /^\S+@\S+\.\S+$/.test((e || "").trim().toLowerCase());
  const validatePrice = (p) => {
    const n = Number(p);
    return Number.isFinite(n) && n >= 0;
  };
  const validateDurationMonths = (m) => {
    const n = Number(m);
    return Number.isFinite(n) && n > 0 && n <= 60; // έως 5 χρόνια
  };

  // --- Helpers ---
  const resetProgramForm = () => {
    setEditingProgramId(null);
    setProgramTitle("");
    setProgramDescription("");
    setProgramPrice("");
    setProgramTeacherEmail("");
    setProgramDurationMonths("5");
  };

  const resetTeacherForm = () => {
    setEditingTeacherId(null);
    setTeacherName("");
    setTeacherEmail("");
    setTeacherPhone("");
    setTeacherDescription("");
  };

  // --- Programs actions ---
  const addProgram = useCallback(async () => {
    if (!isAdmin) {
      Alert.alert("Access Denied", "Only admins can add programs.");
      return;
    }

    const title = programTitle.trim();
    const description = programDescription.trim();
    const teacherEmailLC = programTeacherEmail.trim().toLowerCase();
    const monthsNum = Number(programDurationMonths);
    const priceNum = Number(programPrice);

    if (!title || !description || !programTeacherEmail.trim() || !programPrice.trim() || !programDurationMonths.trim()) {
      Alert.alert("Error", "Please fill all program fields.");
      return;
    }
    if (!validatePrice(programPrice)) {
      Alert.alert("Validation Error", "Price must be a non-negative number.");
      return;
    }
    if (!validateEmail(teacherEmailLC)) {
      Alert.alert("Validation Error", "Please enter a valid teacher email.");
      return;
    }
    if (!validateDurationMonths(programDurationMonths)) {
      Alert.alert("Validation Error", "Duration must be a positive number of months (1-60).");
      return;
    }

    try {
      await addDoc(collection(db, "programs"), {
        title,
        description,
        price: priceNum,
        teacherEmail: teacherEmailLC,
        accessDurationMonths: monthsNum, // ✅ για τα rules
      });
      resetProgramForm();
    } catch (err) {
      Alert.alert("Error", "Failed to add program: " + (err?.message || String(err)));
    }
  }, [
    isAdmin,
    programTitle,
    programDescription,
    programPrice,
    programTeacherEmail,
    programDurationMonths,
  ]);

  const startEditProgram = (program) => {
    if (!isAdmin) {
      Alert.alert("Access Denied", "Only admins can edit programs.");
      return;
    }
    setEditingProgramId(program.id);
    setProgramTitle(String(program.title ?? ""));
    setProgramDescription(String(program.description ?? ""));
    setProgramPrice(String(program.price ?? ""));
    setProgramTeacherEmail(String(program.teacherEmail ?? ""));
    setProgramDurationMonths(String(program.accessDurationMonths ?? "5"));
  };

  const saveProgram = useCallback(async () => {
    if (!isAdmin) {
      Alert.alert("Access Denied", "Only admins can edit programs.");
      return;
    }
    if (!editingProgramId) {
      Alert.alert("Error", "No program selected for editing.");
      return;
    }

    const title = programTitle.trim();
    const description = programDescription.trim();
    const teacherEmailLC = programTeacherEmail.trim().toLowerCase();
    const monthsNum = Number(programDurationMonths);
    const priceNum = Number(programPrice);

    if (!title || !description || !programTeacherEmail.trim() || !programPrice.trim() || !programDurationMonths.trim()) {
      Alert.alert("Error", "Please fill all program fields.");
      return;
    }
    if (!validatePrice(programPrice)) {
      Alert.alert("Validation Error", "Price must be a non-negative number.");
      return;
    }
    if (!validateEmail(teacherEmailLC)) {
      Alert.alert("Validation Error", "Please enter a valid teacher email.");
      return;
    }
    if (!validateDurationMonths(programDurationMonths)) {
      Alert.alert("Validation Error", "Duration must be a positive number of months (1-60).");
      return;
    }

    try {
      await updateDoc(doc(db, "programs", editingProgramId), {
        title,
        description,
        price: priceNum,
        teacherEmail: teacherEmailLC,
        accessDurationMonths: monthsNum,
      });
      resetProgramForm();
    } catch (err) {
      Alert.alert("Error", "Failed to update program: " + (err?.message || String(err)));
    }
  }, [
    isAdmin,
    editingProgramId,
    programTitle,
    programDescription,
    programPrice,
    programTeacherEmail,
    programDurationMonths,
  ]);

  const deleteProgram = useCallback(
    async (id) => {
      if (!isAdmin) {
        Alert.alert("Access Denied", "Only admins can delete programs.");
        return;
      }
      try {
        await deleteDoc(doc(db, "programs", id));
      } catch (err) {
        Alert.alert("Error", "Failed to delete program: " + (err?.message || String(err)));
      }
    },
    [isAdmin]
  );

  // --- Teachers actions ---
  const addTeacher = useCallback(async () => {
    if (!isAdmin) {
      Alert.alert("Access Denied", "Only admins can add teachers.");
      return;
    }

    const name = teacherName.trim();
    const email = teacherEmail.trim().toLowerCase();
    const phone = teacherPhone.trim();
    const description = teacherDescription.trim();

    if (!name || !email || !phone || !description) {
      Alert.alert("Error", "Please fill all teacher fields.");
      return;
    }
    if (!validateEmail(email)) {
      Alert.alert("Validation Error", "Please enter a valid email.");
      return;
    }

    try {
      await addDoc(collection(db, "teachers"), {
        name,
        email,
        phone,
        description,
      });
      resetTeacherForm();
    } catch (err) {
      Alert.alert("Error", "Failed to add teacher: " + (err?.message || String(err)));
    }
  }, [isAdmin, teacherName, teacherEmail, teacherPhone, teacherDescription]);

  const startEditTeacher = (t) => {
    if (!isAdmin) {
      Alert.alert("Access Denied", "Only admins can edit teachers.");
      return;
    }
    setEditingTeacherId(t.id);
    setTeacherName(String(t.name ?? ""));
    setTeacherEmail(String(t.email ?? ""));
    setTeacherPhone(String(t.phone ?? ""));
    setTeacherDescription(String(t.description ?? ""));
  };

  const saveTeacher = useCallback(async () => {
    if (!isAdmin) {
      Alert.alert("Access Denied", "Only admins can edit teachers.");
      return;
    }
    if (!editingTeacherId) {
      Alert.alert("Error", "No teacher selected for editing.");
      return;
    }

    const name = teacherName.trim();
    const email = teacherEmail.trim().toLowerCase();
    const phone = teacherPhone.trim();
    const description = teacherDescription.trim();

    if (!name || !email || !phone || !description) {
      Alert.alert("Error", "Please fill all teacher fields.");
      return;
    }
    if (!validateEmail(email)) {
      Alert.alert("Validation Error", "Please enter a valid email.");
      return;
    }

    try {
      await updateDoc(doc(db, "teachers", editingTeacherId), {
        name,
        email,
        phone,
        description,
      });
      resetTeacherForm();
    } catch (err) {
      Alert.alert("Error", "Failed to update teacher: " + (err?.message || String(err)));
    }
  }, [isAdmin, editingTeacherId, teacherName, teacherEmail, teacherPhone, teacherDescription]);

  const deleteTeacher = useCallback(
    async (id) => {
      if (!isAdmin) {
        Alert.alert("Access Denied", "Only admins can delete teachers.");
        return;
      }
      try {
        await deleteDoc(doc(db, "teachers", id));
      } catch (err) {
        Alert.alert("Error", "Failed to delete teacher: " + (err?.message || String(err)));
      }
    },
    [isAdmin]
  );

  // --- Render helpers ---
  const programFormTitle = useMemo(
    () => (editingProgramId ? "Edit Program" : "Add Program"),
    [editingProgramId]
  );
  const teacherFormTitle = useMemo(
    () => (editingTeacherId ? "Edit Teacher" : "Add Teacher"),
    [editingTeacherId]
  );

  const ProgramRow = ({ item }) => (
    <View style={styles.itemRow}>
      <Text style={{ flex: 1 }}>
        {String(item.title ?? "")} · {String(item.description ?? "")} · {Number(item.price ?? 0)}€ ·{" "}
        {item.accessDurationMonths ?? 5} months
      </Text>
      <View style={styles.actions}>
        <TouchableOpacity onPress={() => startEditProgram(item)}>
          <Text style={styles.edit}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => deleteProgram(item.id)}>
          <Text style={styles.delete}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const TeacherRow = ({ item }) => (
    <View style={styles.itemRow}>
      <Text style={{ flex: 1 }}>
        {String(item.name ?? "")} · {String(item.email ?? "")} · {String(item.phone ?? "")} ·{" "}
        {String(item.description ?? "")}
      </Text>
      <View style={styles.actions}>
        <TouchableOpacity onPress={() => startEditTeacher(item)}>
          <Text style={styles.edit}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => deleteTeacher(item.id)}>
          <Text style={styles.delete}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // ✅ Προαιρετικό: Αν για κάποιο λόγο μπει μη-admin εδώ, δείξε μήνυμα αντί να “σκάει”
  if (!isAdmin) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Admin Panel</Text>
        <Text style={{ textAlign: "center", color: "#666" }}>
          Access Denied. This screen is for admins only.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Admin Panel</Text>

      {/* -------- Programs -------- */}
      <Text style={styles.sectionTitle}>{programFormTitle}</Text>

      <TextInput
        style={styles.input}
        placeholder="Program title"
        value={programTitle}
        onChangeText={setProgramTitle}
      />
      <TextInput
        style={styles.input}
        placeholder="Program description"
        value={programDescription}
        onChangeText={setProgramDescription}
      />
      <TextInput
        style={styles.input}
        placeholder="Program price (€)"
        value={programPrice}
        onChangeText={setProgramPrice}
        keyboardType="numeric"
      />
      <TextInput
        style={styles.input}
        placeholder="Teacher email"
        value={programTeacherEmail}
        onChangeText={setProgramTeacherEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <TextInput
        style={styles.input}
        placeholder="Duration (months) e.g. 5"
        value={programDurationMonths}
        onChangeText={setProgramDurationMonths}
        keyboardType="numeric"
      />

      <TouchableOpacity
        style={styles.button}
        onPress={editingProgramId ? saveProgram : addProgram}
      >
        <Text style={styles.buttonText}>
          {editingProgramId ? "Save Program" : "Add Program"}
        </Text>
      </TouchableOpacity>

      {editingProgramId ? (
        <TouchableOpacity
          style={[styles.button, { backgroundColor: "#6c757d" }]}
          onPress={resetProgramForm}
        >
          <Text style={styles.buttonText}>Cancel Edit</Text>
        </TouchableOpacity>
      ) : null}

      <Text style={styles.sectionTitle}>Programs List</Text>
      {programs.length === 0 ? (
        <Text style={styles.empty}>No programs yet.</Text>
      ) : (
        <FlatList
          data={programs}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ProgramRow item={item} />}
        />
      )}

      {/* -------- Teachers -------- */}
      <Text style={styles.sectionTitle}>{teacherFormTitle}</Text>

      <TextInput
        style={styles.input}
        placeholder="Teacher name"
        value={teacherName}
        onChangeText={setTeacherName}
      />
      <TextInput
        style={styles.input}
        placeholder="Teacher email"
        value={teacherEmail}
        onChangeText={setTeacherEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Teacher phone"
        value={teacherPhone}
        onChangeText={setTeacherPhone}
        keyboardType="phone-pad"
      />
      <TextInput
        style={styles.input}
        placeholder="Teacher description"
        value={teacherDescription}
        onChangeText={setTeacherDescription}
      />

      <TouchableOpacity
        style={styles.button}
        onPress={editingTeacherId ? saveTeacher : addTeacher}
      >
        <Text style={styles.buttonText}>
          {editingTeacherId ? "Save Teacher" : "Add Teacher"}
        </Text>
      </TouchableOpacity>

      {editingTeacherId ? (
        <TouchableOpacity
          style={[styles.button, { backgroundColor: "#6c757d" }]}
          onPress={resetTeacherForm}
        >
          <Text style={styles.buttonText}>Cancel Edit</Text>
        </TouchableOpacity>
      ) : null}

      <Text style={styles.sectionTitle}>Teachers List</Text>
      {teachers.length === 0 ? (
        <Text style={styles.empty}>No teachers yet.</Text>
      ) : (
        <FlatList
          data={teachers}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <TeacherRow item={item} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#fff" },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 20,
    marginBottom: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 5,
    padding: 10,
    marginBottom: 10,
  },
  button: {
    backgroundColor: "#007bff",
    padding: 12,
    borderRadius: 5,
    marginBottom: 10,
  },
  buttonText: { color: "#fff", textAlign: "center", fontWeight: "bold" },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    gap: 8,
  },
  actions: { flexDirection: "row", gap: 14 },
  edit: { color: "orange", marginRight: 10, fontWeight: "600" },
  delete: { color: "red", fontWeight: "600" },
  empty: { textAlign: "center", color: "#888", marginVertical: 10 },
});
