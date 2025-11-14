// src/screens/LoginScreen.js
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
import Layout from "../components/Layout";
import { auth, db } from "../services/firebaseConfig";
import { useResponsive } from "../theme/responsive";

export default function LoginScreen({ navigation, setUser }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const { s, ms, isLargeScreen } = useResponsive();

  const handleLogin = useCallback(async () => {
    const trimmedEmail = email.trim();

    if (!trimmedEmail || !password) {
      Alert.alert("Validation Error", "Please enter both email and password.");
      return;
    }

    try {
      setLoading(true);

      const { user } = await signInWithEmailAndPassword(
        auth,
        trimmedEmail,
        password
      );
      const uid = user.uid;

      const userRef = doc(db, "users", uid);
      const snap = await getDoc(userRef);

      if (!snap.exists()) {
        await setDoc(userRef, {
          email: user.email ?? trimmedEmail,
          role: "user",
          createdAt: serverTimestamp(),
        });
      }

      const updatedSnap = snap.exists() ? snap : await getDoc(userRef);
      const role =
        updatedSnap.exists() && typeof updatedSnap.data().role === "string"
          ? updatedSnap.data().role
          : "user";

      setUser?.({
        uid,
        email: user.email ?? trimmedEmail,
        role,
      });

      Alert.alert(
        "Login Successful",
        `Welcome back, ${user.email ?? trimmedEmail}`
      );

      setEmail("");
      setPassword("");

      if (role === "admin") navigation.navigate("Admin");
      else navigation.navigate("Home");
    } catch (error) {
      console.error(error);
      let message = "An error occurred. Please try again.";
      if (error.code === "auth/user-not-found")
        message = "No user found with this email.";
      else if (error.code === "auth/wrong-password")
        message = "Incorrect password.";
      else if (error.code === "auth/invalid-email")
        message = "Invalid email format.";
      else if (error.code === "auth/too-many-requests")
        message = "Too many attempts. Please try again later.";
      Alert.alert("Login Failed", message);
    } finally {
      setLoading(false);
    }
  }, [email, password, navigation, setUser]);

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
        <View
          style={[
            styles.card,
            {
              padding: s(20),
              borderRadius: s(12),
              maxWidth: isLargeScreen ? 420 : 380,
            },
          ]}
        >
          <Text
            style={[
              styles.title,
              {
                fontSize: ms(32),
                marginBottom: s(24),
              },
            ]}
          >
            Login
          </Text>

          <TextInput
            style={[
              styles.input,
              {
                paddingVertical: s(12),
                paddingHorizontal: s(15),
                borderRadius: s(8),
                marginBottom: s(15),
                fontSize: ms(16),
              },
            ]}
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
          />

          <TextInput
            style={[
              styles.input,
              {
                paddingVertical: s(12),
                paddingHorizontal: s(15),
                borderRadius: s(8),
                marginBottom: s(15),
                fontSize: ms(16),
              },
            ]}
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            editable={!loading}
          />

          {loading ? (
            <ActivityIndicator
              size="large"
              color="#007bff"
              style={{ marginVertical: s(20) }}
            />
          ) : (
            <TouchableOpacity
              style={[
                styles.button,
                {
                  paddingVertical: s(14),
                  borderRadius: s(8),
                  marginTop: s(10),
                },
              ]}
              onPress={handleLogin}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.buttonText,
                  { fontSize: ms(18) },
                ]}
              >
                Log In
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Layout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f5f5f5",
  },
  card: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
    width: "100%",
  },
  title: {
    fontWeight: "bold",
    textAlign: "center",
  },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
  },
  button: {
    backgroundColor: "#007bff",
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontWeight: "600" },
});
