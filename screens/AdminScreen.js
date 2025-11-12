// screens/AdminScreen.js
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
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { db } from "../firebaseConfig";

export default function AdminScreen({ route }) {
  // Αν έρθει user από route (προαιρετικά), τον ελέγχουμε. Το App.js ήδη κρύβει το screen για μη-admin.
  const user = route?.params?.user;

  // --- Programs ---
  const [programTitle, setProgramTitle] = useState("");
  const [programDescription, setProgramDescription] = useState("");
  const [programPrice, setProgramPrice] = useState("");
  const [programTeacherEmail, setProgramTeacherEmail] = useState("");
  const [programs, setPrograms] = useState([]);
  const [editingProgramId, setEditingProgramId] = useState(null);

  // --- Teachers ---
  const [teacherName, setTeacherName] = useState("");
  const [teacherEmail, setTeacherEmail] = useState("");
  const [teacherPhone, setTeacherPhone] = useState("");
  const [teacherDescription, setTeacherDescription] = useState("");
  const [teachers, setTeachers] = useState([]);
  const [editingTeacherId, setEditingTeacherId] = useState(null);

  const isAdmin = user?.role === "admin" || true; // safety: το screen εμφανίζεται μόνο σε admin από App.js

  // --- Real-time data ---
  useEffect(() => {
    const unsubPrograms = onSnapshot(
      collection(db, "programs"),
      (snap) => {
        setPrograms(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (err) => Alert.alert("Error", err.message)
    );
    const unsubTeachers = onSnapshot(
      collection(db, "teachers"),
      (snap) => {
        setTeachers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (err) => Alert.alert("Error", err.message)
    );
    return () => {
      unsubPrograms();
      unsubTeachers();
    };
  }, []);

  // --- Validators ---
  const validateEmail = (e) => /^\S+@\S+\.\S+$/.test(e.trim().toLowerCase());
  const validatePrice = (p) => {
    const n = Number(p);
    return Number.isFinite(n) && n >= 0;
  };

  // --- Programs actions ---
  const addProgram = useCallback(async () => {
    if (!isAdmin) {
      Alert.alert("Access Denied", "Only admins can add programs.");
      return;
    }
    const title = programTitle.trim();
    const description = programDescription.trim();
    const teacherEmail = programTeacherEmail.trim().toLowerCase();
    if (!title || !description || !programPrice || !teacherEmail) {
      Alert.alert("Error", "Please fill all program fields.");
      return;
    }
    if (!validatePrice(programPrice)) {
      Alert.alert("Validation Error", "Price must be a non-negative number.");
      return;
    }
    if (!validateEmail(teacherEmail)) {
      Alert.alert("Validation Error", "Please enter a valid teacher email.");
      return;
    }
    try {
      await addDoc(collection(db, "programs"), {
        title,
        description,
        price: Number(programPrice),
        teacherEmail, // ΑΠΑΡΑΙΤΗΤΟ από rules
      });
      resetProgramForm();
    } catch (err) {
      Alert.alert("Error", "Failed to add program: " + err.message);
    }
  }, [isAdmin, programTitle, programDescription, programPrice, programTeacherEmail]);

  const startEditProgram = (program) => {
    if (!isAdmin) {
      Alert.alert("Access Denied", "Only admins can edit programs.");
      return;
    }
    setEditingProgramId(program.id);
    setProgramTitle(program.title ?? "");
    setProgramDescription(program.description ?? "");
    setProgramPrice(String(program.price ?? ""));
    setProgramTeacherEmail(program.teacherEmail ?? "");
  };

  const saveProgram = useCallback(async () => {
    if (!isAdmin) {
      Alert.alert("Access Denied", "Only admins can edit programs.");
      return;
    }
    const title = programTitle.trim();
    const description = programDescription.trim();
    const teacherEmail = programTeacherEmail.trim().toLowerCase();
    if (!title || !description || !programPrice || !teacherEmail) {
      Alert.alert("Error", "Please fill all program fields.");
      return;
    }
    if (!validatePrice(programPrice)) {
      Alert.alert("Validation Error", "Price must be a non-negative number.");
      return;
    }
    if (!validateEmail(teacherEmail)) {
      Alert.alert("Validation Error", "Please enter a valid teacher email.");
      return;
    }

    try {
      await updateDoc(doc(db, "programs", editingProgramId), {
        title,
        description,
        price: Number(programPrice),
        teacherEmail, // οι rules επιτρέπουν ενημέρωση μόνο αυτών των πεδίων
      });
      resetProgramForm();
    } catch (err) {
      Alert.alert("Error", "Failed to update program: " + err.message);
    }
  }, [isAdmin, editingProgramId, programTitle, programDescription, programPrice, programTeacherEmail]);

  const deleteProgram = useCallback(async (id) => {
    if (!isAdmin) {
      Alert.alert("Access Denied", "Only admins can delete programs.");
      return;
    }
    try {
      await deleteDoc(doc(db, "programs", id));
    } catch (err) {
      Alert.alert("Error", "Failed to delete program: " + err.message);
    }
  }, [isAdmin]);

  const resetProgramForm = () => {
    setEditingProgramId(null);
    setProgramTitle("");
    setProgramDescription("");
    setProgramPrice("");
    setProgramTeacherEmail("");
  };

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
      Alert.alert("Error", "Failed to add teacher: " + err.message);
    }
  }, [isAdmin, teacherName, teacherEmail, teacherPhone, teacherDescription]);

  const startEditTeacher = (t) => {
    if (!isAdmin) {
      Alert.alert("Access Denied", "Only admins can edit teachers.");
      return;
    }
    setEditingTeacherId(t.id);
    setTeacherName(t.name ?? "");
    setTeacherEmail(t.email ?? "");
    setTeacherPhone(t.phone ?? "");
    setTeacherDescription(t.description ?? "");
  };

  const saveTeacher = useCallback(async () => {
    if (!isAdmin) {
      Alert.alert("Access Denied", "Only admins can edit teachers.");
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
      Alert.alert("Error", "Failed to update teacher: " + err.message);
    }
  }, [isAdmin, editingTeacherId, teacherName, teacherEmail, teacherPhone, teacherDescription]);

  const deleteTeacher = useCallback(async (id) => {
    if (!isAdmin) {
      Alert.alert("Access Denied", "Only admins can delete teachers.");
      return;
    }
    try {
      await deleteDoc(doc(db, "teachers", id));
    } catch (err) {
      Alert.alert("Error", "Failed to delete teacher: " + err.message);
    }
  }, [isAdmin]);

  const resetTeacherForm = () => {
    setEditingTeacherId(null);
    setTeacherName("");
    setTeacherEmail("");
    setTeacherPhone("");
    setTeacherDescription("");
  };

  const ProgramActions = ({ item }) => (
    <View style={styles.itemRow}>
      <Text>
        {item.title} · {item.description} · {Number(item.price)}€
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

  const TeacherActions = ({ item }) => (
    <View style={styles.itemRow}>
      <Text>
        {item.name} · {item.email} · {item.phone} · {item.description}
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

  const programFormTitle = useMemo(
    () => (editingProgramId ? "Edit Program" : "Add Program"),
    [editingProgramId]
  );
  const teacherFormTitle = useMemo(
    () => (editingTeacherId ? "Edit Teacher" : "Add Teacher"),
    [editingTeacherId]
  );

  
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#fff" },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 20, textAlign: "center" },
  sectionTitle: { fontSize: 18, fontWeight: "bold", marginTop: 20, marginBottom: 10 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 5, padding: 10, marginBottom: 10 },
  button: { backgroundColor: "#007bff", padding: 12, borderRadius: 5, marginBottom: 20 },
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
