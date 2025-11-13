// screens/RegisterScreen.js
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  updateProfile,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { auth, db } from "../services/firebaseConfig";

export default function RegisterScreen({ navigation, setUser }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const validate = useCallback(() => {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedPhone = phone.trim();

    if (!trimmedName || !trimmedEmail || !password || !confirmPassword) {
      Alert.alert("Validation Error", "Please fill in all required fields.");
      return false;
    }
    if (password !== confirmPassword) {
      Alert.alert("Validation Error", "Passwords do not match.");
      return false;
    }
    if (password.length < 6) {
      Alert.alert("Validation Error", "Password must be at least 6 characters.");
      return false;
    }
    // Απλός έλεγχος email
    if (!/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
      Alert.alert("Validation Error", "Please enter a valid email.");
      return false;
    }
    // Phone: αποδέξου 10–15 ψηφία (διεθνές), χωρίς κενά/παύλες
    if (trimmedPhone && !/^\d{10,15}$/.test(trimmedPhone)) {
      Alert.alert("Validation Error", "Please enter a valid phone number (10–15 digits).");
      return false;
    }
    return true;
  }, [name, email, phone, password, confirmPassword]);

  const handleRegister = useCallback(async () => {
    if (!validate()) return;

    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPhone = phone.trim();

    setLoading(true);
    try {
      // 1) Auth: Δημιουργία λογαριασμού
      const { user } = await createUserWithEmailAndPassword(auth, trimmedEmail, password);

      // 2) Προαιρετικά: ορίσε display name
      await updateProfile(user, { displayName: trimmedName }).catch(() => {});

      // 3) Firestore: Δημιουργία /users/{uid} με whitelisted πεδία
      //    (ταιριάζει με αυστηρούς κανόνες που επιτρέπουν μόνο αυτά τα πεδία)
      await setDoc(doc(db, "users", user.uid), {
        name: trimmedName,
        email: user.email ?? trimmedEmail,
        phone: trimmedPhone,
        role: "user",                // default ρόλος
        createdAt: serverTimestamp() // == request.time στους rules
      });

      // 4) (Προαιρετικό αλλά καλό) Στείλε verification email
      try {
        await sendEmailVerification(user);
        Alert.alert(
          "Verify your email",
          "We sent you a verification link. Please check your inbox."
        );
      } catch {
        // αν αποτύχει, δεν μπλοκάρουμε τη ροή
      }

      // 5) Θέσε app state γρήγορα (το App.js με onSnapshot θα κρατά ρόλο up-to-date)
      setUser?.({ uid: user.uid, email: user.email ?? trimmedEmail, role: "user" });

      Alert.alert("Success", "Account created successfully!");
      navigation.navigate("Home");
    } catch (error) {
      console.error(error);
      let message = "Something went wrong.";
      if (error.code === "auth/email-already-in-use") message = "Email already in use.";
      else if (error.code === "auth/invalid-email") message = "Invalid email.";
      else if (error.code === "auth/weak-password") message = "Password should be at least 6 characters.";
      else if (error.code === "permission-denied")
        message = "Registration blocked by security rules. Please contact support.";
      Alert.alert("Registration Failed", message);
    } finally {
      setLoading(false);
    }
  }, [validate, name, email, phone, password, setUser, navigation]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Register</Text>

      <TextInput
        style={styles.input}
        placeholder="Full Name"
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
        editable={!loading}
      />

      <TextInput
        style={styles.input}
        placeholder="Phone (optional)"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        editable={!loading}
      />

      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        editable={!loading}
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        editable={!loading}
      />

      <TextInput
        style={styles.input}
        placeholder="Confirm Password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
        editable={!loading}
      />

      {loading ? (
        <ActivityIndicator size="large" color="#007bff" style={{ marginVertical: 20 }} />
      ) : (
        <TouchableOpacity style={styles.button} onPress={handleRegister} activeOpacity={0.85}>
          <Text style={styles.buttonText}>Register</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: "center", backgroundColor: "#f5f5f5" },
  title: { fontSize: 32, fontWeight: "bold", marginBottom: 40, textAlign: "center" },
  input: {
    backgroundColor: "#fff",
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 8,
    marginBottom: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  button: { backgroundColor: "#007bff", paddingVertical: 15, borderRadius: 8, alignItems: "center", marginTop: 10 },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 18 },
});
