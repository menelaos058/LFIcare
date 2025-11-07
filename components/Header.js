// Header.js
import { useNavigation } from "@react-navigation/native";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { logout } from "../services/AuthService";

const Header = ({ user, setUser }) => {
  const navigation = useNavigation();
  const { width } = useWindowDimensions();
  const [loggingOut, setLoggingOut] = useState(false);
  const pressedOnceRef = useRef(false);

  const handleLogout = useCallback(async () => {
    if (pressedOnceRef.current || loggingOut) return;
    pressedOnceRef.current = true;
    setLoggingOut(true);
    try {
      await logout();
      setUser(null);
      Alert.alert("Success", "You have been logged out.");
      navigation.navigate("Home");
    } catch (error) {
      Alert.alert("Error", "Logout failed: " + error.message);
    } finally {
      setLoggingOut(false);
      // επιτρέπουμε ξανά πάτημα μετά από λίγο για ασφάλεια
      setTimeout(() => (pressedOnceRef.current = false), 800);
    }
  }, [loggingOut, navigation, setUser]);

  const buttons = useMemo(() => {
    if (user?.role === "admin") {
      // Admin: δείξε και το Admin panel ρητά
      return [
        { title: "Home", screen: "Home" },
        { title: "Programs", screen: "Programs" },
        { title: "Teachers", screen: "Teachers" },
        { title: "Admin", screen: "Admin", variant: "admin" },
        { title: "Log Out", action: handleLogout, variant: "danger" },
      ];
    } else if (user) {
      return [
        { title: "Home", screen: "Home" },
        { title: "Programs", screen: "Programs" },
        { title: "Teachers", screen: "Teachers" },
        { title: "Contact", screen: "Contact" },
        { title: "Profile", screen: "Profile" },
        { title: "My Programs", screen: "MyPrograms" },
        { title: "Log Out", action: handleLogout, variant: "danger" },
      ];
    } else {
      return [
        { title: "Home", screen: "Home" },
        { title: "Programs", screen: "Programs" },
        { title: "Teachers", screen: "Teachers" },
        { title: "Contact", screen: "Contact" },
        { title: "Login", screen: "Login" },
        { title: "Register", screen: "Register" },
      ];
    }
  }, [user, handleLogout]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.container}>
        <Text
          style={styles.logo}
          accessibilityRole="header"
          accessibilityLabel="MyApp Logo"
        >
          MyApp Logo
        </Text>

        {/* Μικρή ένδειξη συνεδρίας */}
        <Text style={styles.subtle}>
          {user ? user.email ?? "Signed in" : "Guest"}
        </Text>

        <View style={[styles.buttonsWrap, { maxWidth: width - 20 }]}>
          {buttons.map((btn, idx) => {
            const isLogout = !!btn.action;
            const variantStyle =
              btn.variant === "danger"
                ? styles.btnDanger
                : btn.variant === "admin"
                ? styles.btnAdmin
                : styles.btnPrimary;

            return (
              <Pressable
                key={`${btn.title}-${idx}`}
                accessibilityRole="button"
                accessibilityLabel={btn.title}
                style={({ pressed }) => [
                  styles.button,
                  variantStyle,
                  pressed && styles.buttonPressed,
                  isLogout && loggingOut && styles.buttonDisabled,
                ]}
                disabled={isLogout && loggingOut}
                onPress={() => {
                  if (btn.screen) navigation.navigate(btn.screen);
                  else if (btn.action) btn.action();
                }}
                hitSlop={8}
              >
                <Text style={styles.buttonText}>
                  {isLogout && loggingOut ? "" : btn.title}
                </Text>
                {isLogout && loggingOut && (
                  <ActivityIndicator size="small" color="#fff" />
                )}
              </Pressable>
            );
          })}
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    backgroundColor: "#fff",
    // Android δεν “σέβεται” πάντα safe areas. Αυτό προσθέτει
    // paddingTop ίσο με το StatusBar ύψος όπου χρειάζεται.
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight ?? 0 : 0,
  },
  container: {
    paddingTop: 10,
    paddingBottom: 12,
    backgroundColor: "#fff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#ccc",
    alignItems: "center",
  },
  logo: {
    fontSize: 24,
    fontWeight: "800",
    color: "#007AFF",
  },
  subtle: {
    marginTop: 2,
    marginBottom: 8,
    fontSize: 12,
    color: "#6b7280",
  },
  buttonsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
  },
  button: {
    margin: 5,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 20,
    minWidth: 110,
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  btnPrimary: {
    backgroundColor: "#007AFF",
  },
  btnDanger: {
    backgroundColor: "#FF3B30",
  },
  btnAdmin: {
    backgroundColor: "#10B981", // πράσινο για admin action
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

export default Header;
