// screens/HomeScreen.js
import { useNavigation } from "@react-navigation/native";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";

export default function HomeScreen({ user }) {
  const navigation = useNavigation();
  const { width } = useWindowDimensions();

  const isTablet = width >= 768;
  const isWide = width >= 1024;
  const contentMaxWidth = isWide ? 980 : 760;

  const quickActions = user
    ? [
        { label: "My Programs", screen: "MyPrograms" },
        { label: "Profile", screen: "Profile" },
        { label: "Mentors", screen: "Teachers" },
        { label: "Programs", screen: "Programs" },
      ]
    : [
        { label: "Programs", screen: "Programs" },
        { label: "Mentors", screen: "Teachers" },
        { label: "Login", screen: "Login" },
        { label: "Register", screen: "Register" },
      ];

  const features = [
    {
      title: "Structured Learning",
      text: "Programs organized clearly so you can easily find what you need.",
    },
    {
      title: "Expert Mentors",
      text: "Connect with experienced mentors and explore their profiles.",
    },
    {
      title: "Simple Experience",
      text: "Clean and modern interface designed for easy navigation.",
    },
  ];

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[
        styles.container,
        { paddingHorizontal: isTablet ? 28 : 18 },
      ]}
    >
      <View style={[styles.content, { maxWidth: contentMaxWidth }]}>
        <View style={[styles.heroCard, { padding: isTablet ? 28 : 20 }]}>
          <View style={styles.badge}>
            <Text style={[styles.badgeText, { fontSize: isTablet ? 13 : 12 }]}>
              Welcome to LFIcare
            </Text>
          </View>

          <Text
            style={[
              styles.title,
              { fontSize: isTablet ? 34 : 28 },
            ]}
          >
            Learn with confidence
          </Text>

          <Text
            style={[
              styles.subtitle,
              {
                fontSize: isTablet ? 16 : 14,
                maxWidth: isTablet ? 620 : "100%",
              },
            ]}
          >
            {user
              ? `Hello ${user.email || "there"}! Continue exploring your programs and stay connected with mentors.`
              : "Explore educational programs, meet mentors, and access your account easily."}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { fontSize: isTablet ? 22 : 20 }]}>
            Quick Access
          </Text>

          <View style={styles.quickGrid}>
            {quickActions.map((item) => (
              <Pressable
                key={item.label}
                onPress={() => navigation.navigate(item.screen)}
                style={({ pressed }) => [
                  styles.quickChip,
                  pressed && styles.quickChipPressed,
                ]}
              >
                <Text style={styles.quickChipText}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { fontSize: isTablet ? 22 : 20 }]}>
            Why choose LFIcare
          </Text>

          <View
            style={[
              styles.featureGrid,
              { flexDirection: isWide ? "row" : "column" },
            ]}
          >
            {features.map((feature) => (
              <View
                key={feature.title}
                style={[
                  styles.featureCard,
                  { flex: isWide ? 1 : undefined },
                ]}
              >
                <View style={styles.featureAccent} />
                <Text
                  style={[
                    styles.featureTitle,
                    { fontSize: isTablet ? 18 : 16 },
                  ]}
                >
                  {feature.title}
                </Text>

                <Text
                  style={[
                    styles.featureText,
                    { fontSize: isTablet ? 14 : 13 },
                  ]}
                >
                  {feature.text}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const GREEN = "#28A745";
const GREEN_DARK = "#1E7E34";
const BG = "#F3F4F6";
const BORDER = "#D1D5DB";
const TEXT = "#111827";
const SUBTEXT = "#6B7280";

const styles = StyleSheet.create({
  container: {
    paddingTop: 18,
    paddingBottom: 28,
    backgroundColor: BG,
  },
  content: {
    width: "100%",
    alignSelf: "center",
  },
  heroCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.05,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
      },
      android: {
        elevation: 2,
      },
    }),
  },
  badge: {
    backgroundColor: "#EAF8EE",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 14,
  },
  badgeText: {
    color: GREEN_DARK,
    fontWeight: "700",
  },
  title: {
    color: TEXT,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 10,
  },
  subtitle: {
    color: SUBTEXT,
    textAlign: "center",
    lineHeight: 22,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    color: GREEN,
    fontWeight: "800",
    marginBottom: 12,
  },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 10,
  },
  quickChip: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 14,
    alignItems: "center",
  },
  quickChipPressed: {
    backgroundColor: "#F3F4F6",
  },
  quickChipText: {
    color: TEXT,
    fontWeight: "600",
    fontSize: 14,
  },
  featureGrid: {
    gap: 12,
  },
  featureCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 18,
    minHeight: 130,
  },
  featureAccent: {
    width: 40,
    height: 6,
    borderRadius: 999,
    backgroundColor: GREEN,
    marginBottom: 12,
  },
  featureTitle: {
    color: TEXT,
    fontWeight: "700",
    marginBottom: 8,
  },
  featureText: {
    color: SUBTEXT,
    lineHeight: 20,
  },
});