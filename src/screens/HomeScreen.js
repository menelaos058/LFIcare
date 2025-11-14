// src/screens/HomeScreen.js
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Layout from "../components/Layout";
import { useResponsive } from "../theme/responsive";

export default function HomeScreen({ user }) {
  const { s, ms, isLargeScreen } = useResponsive();

  return (
    <Layout>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          {
            padding: s(24),
          },
        ]}
      >
        <View
          style={[
            styles.card,
            {
              padding: s(24),
              borderRadius: s(16),
              maxWidth: isLargeScreen ? 720 : 600,
            },
          ]}
        >
          <Text
            style={[
              styles.title,
              {
                fontSize: ms(28),
                marginBottom: s(8),
              },
            ]}
          >
            Welcome to LFIcare
          </Text>
          <Text
            style={[
              styles.subtitle,
              {
                fontSize: ms(14),
              },
            ]}
          >
            {user
              ? `Hello ${user.email || "there"} — explore your programs and chat with your teachers from the header.`
              : "Browse programs and teachers from the header. Log in to access your profile and purchases."}
          </Text>
        </View>
      </ScrollView>
    </Layout>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f5f5f5",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  title: {
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
  },
  subtitle: {
    color: "#4b5563",
    textAlign: "center",
  },
});
