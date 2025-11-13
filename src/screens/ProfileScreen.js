// screens/ProfileScreen.js
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
import { auth, db } from "../services/firebaseConfig";

export default function ProfileScreen({ user }) {
  const [loading, setLoading] = useState(false);
  const [initialEmail, setInitialEmail] = useState(user?.email || "");
  const [name, setName] = useState("");
  const [email, setEmail] = useState(user?.email || "");
  const [phone, setPhone] = useState("");
  const [currentPassword, setCurrentPassword] = useState(""); // για reauth
  const [newPassword, setNewPassword] = useState("");

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
          // Αν δεν υπάρχει user doc, κράτα τα του auth
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
    // Απλός έλεγχος email
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      Alert.alert("Error", "Please enter a valid email.");
      return false;
    }
    if (newPassword && newPassword.length < 6) {
      Alert.alert("Error", "New password must be at least 6 characters.");
      return false;
    }
    // Αν αλλάζει email ή password, απαιτούμε current password για reauth
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

      // 1) Αν αλλάζει email ή password -> reauth
      const emailChanged = email.trim() !== initialEmail;
      const passwordChanged = !!newPassword;
      if (emailChanged || passwordChanged) {
        const cred = EmailAuthProvider.credential(
          user.email || initialEmail,
          currentPassword
        );
        await reauthenticateWithCredential(auth.currentUser, cred);
      }

      // 2) Ενημέρωση στο Auth (ευαίσθητες αλλαγές)
      if (emailChanged) {
        await updateEmail(auth.currentUser, email.trim());
      }
      if (passwordChanged) {
        await updatePassword(auth.currentUser, newPassword);
      }

      // 3) Ενημέρωση Firestore mirror (μην αλλάζεις role κ.λπ.)
      await updateDoc(userRef, {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        updatedAt: serverTimestamp(),
      });

      // 4) Το App.js ακούει live το /users/{uid} για role, ενώ το email από Auth
      //    θα συγχρονιστεί με την επόμενη auth state αλλαγή.
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
      <View style={styles.centered}>
        <Text>Please log in to see your profile.</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Profile</Text>

        <TextInput
          style={styles.input}
          placeholder="Name"
          value={name}
          onChangeText={setName}
          editable={!loading}
        />
        <TextInput
          style={styles.input}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          editable={!loading}
        />
        <TextInput
          style={styles.input}
          placeholder="Phone"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          editable={!loading}
        />

        {/* Τα παρακάτω χρειάζονται μόνο για ευαίσθητες αλλαγές */}
        <Text style={styles.sectionLabel}>Security</Text>
        <TextInput
          style={styles.input}
          placeholder="Current Password (required for email/password change)"
          value={currentPassword}
          onChangeText={setCurrentPassword}
          secureTextEntry
          editable={!loading}
        />
        <TextInput
          style={styles.input}
          placeholder="New Password (optional)"
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
          editable={!loading}
        />

        {loading ? (
          <ActivityIndicator size="large" color="#28a745" style={{ marginTop: 20 }} />
        ) : (
          <TouchableOpacity style={styles.button} onPress={handleSave} activeOpacity={0.85}>
            <Text style={styles.buttonText}>Save</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 40,
    backgroundColor: "#f5f5f5",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 20,
    color: "#28a745",
    alignSelf: "center",
  },
  sectionLabel: {
    marginTop: 12,
    marginBottom: 4,
    fontSize: 14,
    color: "#666",
  },
  input: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 25,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    fontSize: 16,
  },
  button: {
    backgroundColor: "#28a745",
    padding: 15,
    borderRadius: 25,
    marginTop: 20,
    marginBottom: 40,
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
  },
});
