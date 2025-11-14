// src/screens/RegisterScreen.js
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
import Layout from "../components/Layout";
import { auth, db } from "../services/firebaseConfig";
import { useResponsive } from "../theme/responsive";

export default function RegisterScreen({ navigation, setUser }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const { s, ms, isLargeScreen } = useResponsive();

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
    if (!/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
      Alert.alert("Validation Error", "Please enter a valid email.");
      return false;
    }
    if (trimmedPhone && !/^\d{10,15}$/.test(trimmedPhone)) {
      Alert.alert(
        "Validation Error",
        "Please enter a valid phone number (10–15 digits)."
      );
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
      const { user } = await createUserWithEmailAndPassword(
        auth,
        trimmedEmail,
        password
      );

      await updateProfile(user, { displayName: trimmedName }).catch(() => {});

      await setDoc(doc(db, "users", user.uid), {
        name: trimmedName,
        email: user.email ?? trimmedEmail,
        phone: trimmedPhone,
        role: "user",
        createdAt: serverTimestamp(),
      });

      try {
        await sendEmailVerification(user);
        Alert.alert(
          "Verify your email",
          "We sent you a verification link. Please check your inbox."
        );
      } catch {
        // ignore
      }

      setUser?.({
        uid: user.uid,
        email: user.email ?? trimmedEmail,
        role: "user",
      });

      Alert.alert("Success", "Account created successfully!");
      navigation.navigate("Home");
    } catch (error) {
      console.error(error);
      let message = "Something went wrong.";
      if (error.code === "auth/email-already-in-use")
        message = "Email already in use.";
      else if (error.code === "auth/invalid-email")
        message = "Invalid email.";
      else if (error.code === "auth/weak-password")
        message = "Password should be at least 6 characters.";
      else if (error.code === "permission-denied")
        message =
          "Registration blocked by security rules. Please contact support.";
      Alert.alert("Registration Failed", message);
    } finally {
      setLoading(false);
    }
  }, [validate, name, email, phone, password, setUser, navigation]);

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
          style={{
            width: "100%",
            maxWidth: isLargeScreen ? 480 : 400,
            alignSelf: "center",
          }}
        >
          <Text
            style={[
              styles.title,
              {
                fontSize: ms(32),
                marginBottom: s(28),
              },
            ]}
          >
            Register
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
            placeholder="Full Name"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
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
            placeholder="Phone (optional)"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
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
            placeholder="Confirm Password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
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
              onPress={handleRegister}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.buttonText,
                  { fontSize: ms(18) },
                ]}
              >
                Register
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
    justifyContent: "center",
    backgroundColor: "#f5f5f5",
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
