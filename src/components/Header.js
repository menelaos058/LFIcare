// src/components/Header.js
import { useNavigation } from "@react-navigation/native";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { logout } from "../services/AuthService";
import { useResponsive } from "../theme/responsive";

// Μπορείς να αλλάξεις το path του logo αν χρειάζεται
const LOGO = require("../../assets/images/icon.png");

const Header = ({ user, setUser }) => {
  const navigation = useNavigation();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const pressedOnceRef = useRef(false);

  const { s, ms, isTablet, isLargeScreen } = useResponsive();
  const headerHeight = isTablet || isLargeScreen ? s(64) : s(56);

  const handleLogout = useCallback(async () => {
    if (pressedOnceRef.current || loggingOut) return;
    pressedOnceRef.current = true;
    setLoggingOut(true);
    try {
      await logout();
      setUser(null);
      setOpen(false);
      Alert.alert("Success", "You have been logged out.");
      navigation.navigate("Home");
    } catch (error) {
      Alert.alert("Error", "Logout failed: " + error.message);
    } finally {
      setLoggingOut(false);
      setTimeout(() => (pressedOnceRef.current = false), 800);
    }
  }, [loggingOut, navigation, setUser]);

  const items = useMemo(() => {
    if (user?.role === "admin") {
      return [
        { label: "Home", screen: "Home" },
        { label: "Programs", screen: "Programs" },
        { label: "Teachers", screen: "Teachers" },
        { label: "Log Out", action: handleLogout, variant: "danger" },
      ];
    } else if (user) {
      return [
        { label: "Home", screen: "Home" },
        { label: "Programs", screen: "Programs" },
        { label: "Teachers", screen: "Teachers" },
        { label: "Contact", screen: "Contact" },
        { label: "Profile", screen: "Profile" },
        { label: "My Programs", screen: "MyPrograms" },
        { label: "Log Out", action: handleLogout, variant: "danger" },
      ];
    } else {
      return [
        { label: "Home", screen: "Home" },
        { label: "Programs", screen: "Programs" },
        { label: "Teachers", screen: "Teachers" },
        { label: "Contact", screen: "Contact" },
        { label: "Login", screen: "Login" },
        { label: "Register", screen: "Register" },
      ];
    }
  }, [user, handleLogout]);

  const onItemPress = (it) => {
    if (it.action) {
      it.action();
    } else if (it.screen) {
      setOpen(false);
      navigation.navigate(it.screen);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle="dark-content" />
      <View
        style={[
          styles.bar,
          {
            height: headerHeight,
            paddingHorizontal: isTablet || isLargeScreen ? s(20) : s(12),
          },
        ]}
      >
        {/* Logo (αριστερά) */}
        <Pressable
          onPress={() => navigation.navigate("Home")}
          accessibilityRole="button"
          style={styles.logoWrap}
          hitSlop={8}
        >
          <Image
            source={LOGO}
            style={[
              styles.logo,
              { width: s(28), height: s(28), borderRadius: s(6) },
            ]}
            resizeMode="contain"
          />
        </Pressable>

        {/* δεξιά: email μικρό + menu button */}
        <View style={styles.right}>
          <Text
            numberOfLines={1}
            style={[
              styles.userText,
              {
                fontSize: ms(12),
                maxWidth: isTablet || isLargeScreen ? "60%" : "50%",
              },
            ]}
            accessibilityLabel={user ? user.email ?? "Signed in" : "Guest"}
          >
            {user ? user.email ?? "Signed in" : "Guest"}
          </Text>

          <Pressable
            onPress={() => setOpen((v) => !v)}
            style={({ pressed }) => [
              styles.menuBtn,
              { width: s(34), height: s(34), borderRadius: s(17) },
              pressed && { opacity: 0.6 },
            ]}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Open menu"
          >
            <Text style={[styles.menuBtnText, { fontSize: ms(18) }]}>⋮</Text>
          </Pressable>
        </View>
      </View>

      {/* Dropdown menu (Modal + overlay για κλείσιμο) */}
      <Modal
        transparent
        visible={open}
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setOpen(false)}>
          <View style={styles.overlay} />
        </TouchableWithoutFeedback>

        <View
          style={[
            styles.menu,
            {
              top:
                (Platform.OS === "android"
                  ? (StatusBar.currentHeight ?? 0)
                  : 0) +
                headerHeight +
                s(4),
              right: s(10),
              minWidth: isTablet || isLargeScreen ? s(260) : s(220),
            },
          ]}
        >
          {!!user && (
            <View style={styles.menuHeader}>
              <Text
                numberOfLines={1}
                style={[styles.menuHeaderText, { fontSize: ms(12) }]}
              >
                {user.email ?? "Signed in"}
              </Text>
            </View>
          )}

          {items.map((it, idx) => {
            const variantStyle =
              it.variant === "danger"
                ? styles.itemDanger
                : it.variant === "admin"
                ? styles.itemAdmin
                : null;

            const showSpinner = it.variant === "danger" && loggingOut;

            return (
              <Pressable
                key={`${it.label}-${idx}`}
                onPress={() => onItemPress(it)}
                style={({ pressed }) => [
                  styles.item,
                  variantStyle,
                  pressed && styles.itemPressed,
                ]}
                disabled={showSpinner}
              >
                <Text
                  style={[
                    styles.itemLabel,
                    { fontSize: ms(14) },
                    variantStyle && styles.itemLabelOnColor,
                  ]}
                >
                  {showSpinner ? "Signing out..." : it.label}
                </Text>
                {showSpinner && (
                  <ActivityIndicator size="small" color="#fff" />
                )}
              </Pressable>
            );
          })}
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    backgroundColor: "#fff",
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight ?? 0 : 0,
  },
  bar: {
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#E5E7EB",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.06,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
      },
      android: { elevation: 1 },
    }),
  },
  logoWrap: { paddingRight: 8 },
  logo: {},
  right: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
  },
  userText: {
    color: "#6B7280",
  },
  menuBtn: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  menuBtnText: { lineHeight: 18, color: "#111827" },

  // Dropdown
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.15)",
  },
  menu: {
    position: "absolute",
    backgroundColor: "#111827",
    borderRadius: 12,
    paddingVertical: 6,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.25,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 6 },
      },
      android: { elevation: 4 },
    }),
  },
  menuHeader: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomColor: "rgba(255,255,255,0.08)",
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 4,
  },
  menuHeaderText: { color: "rgba(255,255,255,0.9)" },
  item: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  itemPressed: { backgroundColor: "rgba(255,255,255,0.06)" },
  itemLabel: { color: "#F9FAFB", fontWeight: "600" },
  itemDanger: { backgroundColor: "#DC2626" },
  itemAdmin: { backgroundColor: "#10B981" },
  itemLabelOnColor: { color: "#fff" },
});

export default Header;
