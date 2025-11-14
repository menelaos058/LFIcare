// src/screens/ProfileScreen.js
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updateEmail,
  updatePassword,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Layout from "../components/Layout";
import { auth, db } from "../services/firebaseConfig";
import { useResponsive } from "../theme/responsive";

export default function ProfileScreen({ user }) {
  const [loading, setLoading] = useState(false);
  const [initialEmail, setInitialEmail] = useState(user?.email || "");
  const [name, setName] = useState("");
  const [email, setEmail] = useState(user?.email || "");
  const [phone, setPhone] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const { s, ms, isLargeScreen } = useResponsive();

  useEffect(() => {
    if (!user) return;
    const run = async () => {
      setLoading(true);
      try {
        const ref = doc(db, "users", user.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          setName(data.name || "");
          setEmail(data.email || user.email || "");
          setInitialEmail(data.email || user.email || "");
          setPhone(data.phone || "");
        } else {
          setName("");
          setEmail(user.email || "");
          setInitialEmail(user.email || "");
          setPhone("");
        }
      } catch (err) {
        Alert.alert("Error", err.message || "Failed to load profile.");
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [user]);

  const validate = () => {
    if (!name.trim()) {
      Alert.alert("Error", "Name cannot be empty.");
      return false;
    }
    if (!email.trim()) {
      Alert.alert("Error", "Email cannot be empty.");
      return false;
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      Alert.alert("Error", "Please enter a valid email.");
      return false;
    }
    if (newPassword && newPassword.length < 6) {
      Alert.alert("Error", "New password must be at least 6 characters.");
      return false;
    }
    const sensitiveChange = email.trim() !== initialEmail || !!newPassword;
    if (sensitiveChange && !currentPassword) {
      Alert.alert(
        "Re-authentication required",
        "Please enter your current password to update email or password."
      );
      return false;
    }
    return true;
  };

  const handleSave = useCallback(async () => {
    if (!user) return;
    if (!validate()) return;

    setLoading(true);
    try {
      const userRef = doc(db, "users", user.uid);

      const emailChanged = email.trim() !== initialEmail;
      const passwordChanged = !!newPassword;
      if (emailChanged || passwordChanged) {
        const cred = EmailAuthProvider.credential(
          user.email || initialEmail,
          currentPassword
        );
        await reauthenticateWithCredential(auth.currentUser, cred);
      }

      if (emailChanged) {
        await updateEmail(auth.currentUser, email.trim());
      }
      if (passwordChanged) {
        await updatePassword(auth.currentUser, newPassword);
      }

      await updateDoc(userRef, {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        updatedAt: serverTimestamp(),
      });

      setInitialEmail(email.trim());
      setNewPassword("");
      setCurrentPassword("");

      Alert.alert("Success", "Profile updated successfully!");
    } catch (err) {
      console.error(err);
      let msg = err?.message || "Update failed. Please try again.";
      if (err?.code === "auth/requires-recent-login") {
        msg =
          "For security reasons you need to re-login. Please sign in again and retry.";
      }
      Alert.alert("Error", msg);
    } finally {
      setLoading(false);
    }
  }, [user, name, email, phone, newPassword, currentPassword, initialEmail]);

  if (!user) {
    return (
      <Layout>
        <View style={styles.centered}>
          <Text>Please log in to see your profile.</Text>
        </View>
      </Layout>
    );
  }

  return (
    <Layout>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.container,
            {
              padding: s(20),
              paddingBottom: s(40),
            },
          ]}
        >
          <View
            style={{
              alignSelf: "center",
              width: "100%",
              maxWidth: isLargeScreen ? 520 : 440,
            }}
          >
            <Text
              style={[
                styles.title,
                {
                  fontSize: ms(28),
                  marginBottom: s(20),
                },
              ]}
            >
              Profile
            </Text>

            <TextInput
              style={[
                styles.input,
                {
                  padding: s(12),
                  borderRadius: s(20),
                  marginVertical: s(8),
                  fontSize: ms(16),
                },
              ]}
              placeholder="Name"
              value={name}
              onChangeText={setName}
              editable={!loading}
            />
            <TextInput
              style={[
                styles.input,
                {
                  padding: s(12),
                  borderRadius: s(20),
                  marginVertical: s(8),
                  fontSize: ms(16),
                },
              ]}
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!loading}
            />
            <TextInput
              style={[
                styles.input,
                {
                  padding: s(12),
                  borderRadius: s(20),
                  marginVertical: s(8),
                  fontSize: ms(16),
                },
              ]}
              placeholder="Phone"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              editable={!loading}
            />

            <Text
              style={[
                styles.sectionLabel,
                {
                  marginTop: s(12),
                  marginBottom: s(4),
                  fontSize: ms(14),
                },
              ]}
            >
              Security
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  padding: s(12),
                  borderRadius: s(20),
                  marginVertical: s(8),
                  fontSize: ms(16),
                },
              ]}
              placeholder="Current Password (required for email/password change)"
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry
              editable={!loading}
            />
            <TextInput
              style={[
                styles.input,
                {
                  padding: s(12),
                  borderRadius: s(20),
                  marginVertical: s(8),
                  fontSize: ms(16),
                },
              ]}
              placeholder="New Password (optional)"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              editable={!loading}
            />

            {loading ? (
              <ActivityIndicator
                size="large"
                color="#28a745"
                style={{ marginTop: s(20) }}
              />
            ) : (
              <TouchableOpacity
                style={[
                  styles.button,
                  {
                    padding: s(14),
                    borderRadius: s(24),
                    marginTop: s(20),
                    marginBottom: s(40),
                  },
                ]}
                onPress={handleSave}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.buttonText,
                    { fontSize: ms(18) },
                  ]}
                >
                  Save
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Layout>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#f5f5f5",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontWeight: "bold",
    color: "#28a745",
    textAlign: "center",
  },
  sectionLabel: {
    color: "#666",
  },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
  },
  button: {
    backgroundColor: "#28a745",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
    textAlign: "center",
  },
});
