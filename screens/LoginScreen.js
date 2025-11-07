// screens/LoginScreen.js
import { signInWithEmailAndPassword } from "firebase/auth";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
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
import { auth, db } from "../firebaseConfig";

export default function LoginScreen({ navigation, setUser }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = useCallback(async () => {
    const trimmedEmail = email.trim();

    if (!trimmedEmail || !password) {
      Alert.alert("Validation Error", "Please enter both email and password.");
      return;
    }

    try {
      setLoading(true);

      // 1) Auth sign-in
      const { user } = await signInWithEmailAndPassword(auth, trimmedEmail, password);
      const uid = user.uid;

      // 2) Ensure /users/{uid} exists (aligns with Firestore rules)
      const userRef = doc(db, "users", uid);
      const snap = await getDoc(userRef);

      if (!snap.exists()) {
        // Δημιούργησε ελάχιστο user doc με role 'user'
        await setDoc(userRef, {
          email: user.email ?? trimmedEmail,
          role: "user",
          createdAt: serverTimestamp(),
        });
      }

      // 3) Διαβάσε τον ρόλο (ξανά, σε περίπτωση που υπήρχε ήδη διαφορετικός)
      const updatedSnap = snap.exists() ? snap : await getDoc(userRef);
      const role =
        updatedSnap.exists() && typeof updatedSnap.data().role === "string"
          ? updatedSnap.data().role
          : "user";

      // 4) Το App.js ήδη συγχρονίζει role με onSnapshot, αλλά
      //    θέτουμε και άμεσα το state για αίσθηση “snappy” UI.
      setUser?.({
        uid,
        email: user.email ?? trimmedEmail,
        role,
      });

      Alert.alert("Login Successful", `Welcome back, ${user.email ?? trimmedEmail}`);

      // 5) Καθάρισε φόρμα & πλοήγησε
      setEmail("");
      setPassword("");

      if (role === "admin") navigation.navigate("Admin");
      else navigation.navigate("Home");
    } catch (error) {
      console.error(error);
      let message = "An error occurred. Please try again.";
      if (error.code === "auth/user-not-found") message = "No user found with this email.";
      else if (error.code === "auth/wrong-password") message = "Incorrect password.";
      else if (error.code === "auth/invalid-email") message = "Invalid email format.";
      else if (error.code === "auth/too-many-requests")
        message = "Too many attempts. Please try again later.";
      Alert.alert("Login Failed", message);
    } finally {
      setLoading(false);
    }
  }, [email, password, navigation, setUser]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Login</Text>

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

      {loading ? (
        <ActivityIndicator size="large" color="#007bff" style={{ marginVertical: 20 }} />
      ) : (
        <TouchableOpacity style={styles.button} onPress={handleLogin} activeOpacity={0.8}>
          <Text style={styles.buttonText}>Log In</Text>
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
  button: {
    backgroundColor: "#007bff",
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 10,
  },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 18 },
});
