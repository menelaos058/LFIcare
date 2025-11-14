// screens/HomeScreen.js
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";

export default function HomeScreen({ user }) {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const isWide = width >= 1024;

  const cardMaxWidth = isWide ? 900 : 720;

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { paddingHorizontal: isTablet ? 32 : 24 },
      ]}
    >
      <View style={[styles.card, { maxWidth: cardMaxWidth }]}>
        <Text
          style={[
            styles.title,
            { fontSize: isTablet ? 30 : 26 },
          ]}
        >
          Welcome to LFIcare
        </Text>
        <Text
          style={[
            styles.subtitle,
            { fontSize: isTablet ? 16 : 14 },
          ]}
        >
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
    paddingVertical: 24,
    backgroundColor: "#f5f5f5",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    width: "100%",
  },
  title: {
    fontWeight: "800",
    marginBottom: 8,
    color: "#111827",
    textAlign: "center",
  },
  subtitle: {
    color: "#4b5563",
    textAlign: "center",
  },
});
