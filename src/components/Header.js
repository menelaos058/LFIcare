// src/components/Header.js
import { useCallback, useMemo, useState } from "react";
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

const LOGO = require("../../assets/images/icon.png");

const Header = ({ navigation, route, options, user, setUser }) => {
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const { s, ms, isTablet, isLargeScreen } = useResponsive();
  const isWide = isTablet || isLargeScreen;
  const headerHeight = isWide ? s(64) : s(56);
  const title = options?.title || route?.name || "LFIcare";

  const handleNavigateHome = useCallback(() => {
    setOpen(false);
    navigation.navigate("Home");
  }, [navigation]);

  const handleLogout = useCallback(async () => {
    if (loggingOut) return;

    setLoggingOut(true);

    try {
    await logout();
    setUser(null);
    setOpen(false);
    navigation.reset({
      index: 0,
      routes: [{ name: "Home" }],
    });
    } catch (error) {
      Alert.alert(
        "Error",
        "Logout failed: " + (error?.message || "Unknown error")
      );
    } finally {
      setLoggingOut(false);
    }
  }, [loggingOut, navigation, setUser]);

  const menuItems = useMemo(() => {
    const common = [
      { label: "Home", screen: "Home" },
      { label: "Programs", screen: "Programs" },
      { label: "Mentors", screen: "Teachers" },
      { label: "Contact", screen: "Contact" },
      { label: "About Us", screen: "AboutUs" },
    ];

    if (user?.role === "admin") {
      return [
        ...common,
        { label: "Profile", screen: "Profile" },
        { label: "My Programs", screen: "MyPrograms" },
        { label: "Admin", screen: "Admin" },
        { label: "Log Out", action: handleLogout, variant: "danger" },
      ];
    }

    if (user) {
      return [
        ...common,
        { label: "Profile", screen: "Profile" },
        { label: "My Programs", screen: "MyPrograms" },
        { label: "Log Out", action: handleLogout, variant: "danger" },
      ];
    }

    return [
      ...common,
      { label: "Login", screen: "Login" },
      { label: "Register", screen: "Register" },
    ];
  }, [user, handleLogout]);

  const onItemPress = useCallback(
    (item) => {
      if (item.action) {
        item.action();
        return;
      }

      if (item.screen) {
        setOpen(false);
        navigation.navigate(item.screen);
      }
    },
    [navigation]
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <View
        style={[
          styles.bar,
          {
            height: headerHeight,
            paddingHorizontal: isWide ? s(18) : s(12),
          },
        ]}
      >
        <View style={styles.leftWrap}>
          <Pressable
            onPress={handleNavigateHome}
            accessibilityRole="button"
            accessibilityLabel="Go to home"
            style={styles.left}
            hitSlop={8}
          >
            <View style={styles.logoWrap}>
              <Image
                source={LOGO}
                style={[
                  styles.logo,
                  {
                    width: isWide ? s(56) : s(50),
                    height: isWide ? s(56) : s(50),
                  },
                ]}
                resizeMode="cover"
              />
            </View>

            <View style={styles.brandBlock}>
              <Text
                numberOfLines={1}
                style={[styles.brandSubtitle, { fontSize: ms(11) }]}
              >
                LFIcare
              </Text>

              <Text
                numberOfLines={1}
                style={[styles.screenTitle, { fontSize: ms(13) }]}
              >
                {title}
              </Text>
            </View>
          </Pressable>
        </View>

        <View style={styles.right}>
          <Text
            numberOfLines={1}
            style={[
              styles.userText,
              {
                fontSize: ms(12),
                maxWidth: isWide ? s(210) : s(120),
              },
            ]}
            accessibilityLabel={user?.email || "Guest"}
          >
            {user?.email || "Guest"}
          </Text>

          <Pressable
            onPress={() => setOpen((prev) => !prev)}
            style={({ pressed }) => [
              styles.menuBtn,
              {
                minWidth: s(42),
                height: s(38),
                borderRadius: s(19),
                paddingHorizontal: s(12),
              },
              pressed && styles.menuBtnPressed,
            ]}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={open ? "Close menu" : "Open menu"}
          >
            <Text style={[styles.menuBtnText, { fontSize: ms(18) }]}>☰</Text>
          </Pressable>
        </View>
      </View>

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
              top: headerHeight + s(10),
              right: s(12),
              minWidth: isWide ? s(250) : s(220),
            },
          ]}
        >
          {!!user?.email && (
            <View style={styles.menuHeader}>
              <Text
                numberOfLines={1}
                style={[styles.menuHeaderText, { fontSize: ms(12) }]}
              >
                {user.email}
              </Text>
            </View>
          )}

          {menuItems.map((item, index) => {
            const isDanger = item.variant === "danger";
            const showSpinner = isDanger && loggingOut;

            return (
              <Pressable
                key={`${item.label}-${index}`}
                onPress={() => onItemPress(item)}
                disabled={showSpinner}
                style={({ pressed }) => [
                  styles.item,
                  pressed && !isDanger && styles.itemPressed,
                  isDanger && styles.itemDanger,
                ]}
              >
                <Text
                  style={[
                    styles.itemLabel,
                    { fontSize: ms(14) },
                    isDanger && styles.itemDangerLabel,
                  ]}
                >
                  {showSpinner ? "Signing out..." : item.label}
                </Text>

                {showSpinner ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : null}
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
    backgroundColor: "#FFFFFF",
  },
  bar: {
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7EB",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.05,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
      },
      android: {
        elevation: 2,
      },
    }),
  },
  leftWrap: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    minWidth: 0,
  },
  logoWrap: {
    backgroundColor: "#ECFDF5",
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: "#D1FAE5",
  },
  logo: {
    borderRadius: 10,
  },
  brandBlock: {
    marginLeft: 10,
    flexShrink: 1,
  },
  brandSubtitle: {
    color: "#6B7280",
    marginTop: 1,
  },
  screenTitle: {
    color: "#111827",
    fontWeight: "700",
    marginTop: 2,
  },
  right: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 12,
    paddingLeft: 8,
  },
  userText: {
    color: "#6B7280",
    marginRight: 8,
  },
  menuBtn: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
    alignItems: "center",
    justifyContent: "center",
  },
  menuBtnPressed: {
    opacity: 0.7,
  },
  menuBtnText: {
    color: "#111827",
    fontWeight: "600",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(17,24,39,0.18)",
  },
  menu: {
    position: "absolute",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.12,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 10 },
      },
      android: {
        elevation: 8,
      },
    }),
  },
  menuHeader: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7EB",
    marginBottom: 4,
  },
  menuHeaderText: {
    color: "#6B7280",
  },
  item: {
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  itemPressed: {
    backgroundColor: "#F3F4F6",
  },
  itemLabel: {
    color: "#111827",
    fontWeight: "600",
  },
  itemDanger: {
    backgroundColor: "#DC2626",
    marginHorizontal: 8,
    marginTop: 6,
    borderRadius: 12,
  },
  itemDangerLabel: {
    color: "#FFFFFF",
  },
});

export default Header;