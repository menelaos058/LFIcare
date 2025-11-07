// screens/HomeScreen.js
import { ScrollView, StyleSheet, Text, View } from "react-native";

export default function HomeScreen({ user }) {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Welcome to MyApp</Text>
        <Text style={styles.subtitle}>
          {user
            ? `Hello ${user.email || "there"} — explore your programs and chat with your teachers from the header.`
            : "Browse programs and teachers from the header. Log in to access your profile and purchases."}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#f5f5f5",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    maxWidth: 720,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 8,
    color: "#111827",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: "#4b5563",
    textAlign: "center",
  },
});
