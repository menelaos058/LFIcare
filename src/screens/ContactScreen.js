// screens/ContactScreen.js
import { push, ref } from "firebase/database";
import { useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { database } from "../services/firebaseConfig";

export default function ContactScreen({ user }) {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!message.trim()) {
      Alert.alert("Error", "Message cannot be empty.");
      return;
    }

    setLoading(true);
    try {
      await push(ref(database, "contactMessages"), { uid: user?.uid || "guest", message, timestamp: Date.now() });
      setMessage("");
      Alert.alert("Success", "Message sent!");
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Contact Us</Text>
      <TextInput
        style={[styles.input, { height: 100 }]}
        placeholder="Your message..."
        value={message}
        onChangeText={setMessage}
        multiline
      />
      {loading ? (
        <ActivityIndicator size="large" color="#28a745" style={{ marginTop: 20 }} />
      ) : (
        <TouchableOpacity style={styles.button} onPress={handleSend}>
          <Text style={styles.buttonText}>Send Message</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#f5f5f5" },
  title: { fontSize: 28, fontWeight: "bold", color: "#28a745", marginBottom: 20, alignSelf: "center" },
  input: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#ddd",
    fontSize: 16,
    marginBottom: 20,
  },
  button: { backgroundColor: "#28a745", padding: 15, borderRadius: 25 },
  buttonText: { color: "#fff", fontSize: 18, fontWeight: "600", textAlign: "center" },
});
