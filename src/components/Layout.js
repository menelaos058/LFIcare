// src/components/Layout.js
import { StyleSheet, View } from "react-native";
import { useResponsive } from "../theme/responsive";

export default function Layout({ children }) {
  const { width, isTablet, isLargeScreen } = useResponsive();

  let maxWidth = width;
  if (isLargeScreen) maxWidth = 1100;
  else if (isTablet) maxWidth = 800;

  return (
    <View style={styles.outer}>
      <View style={[styles.inner, { maxWidth }]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    backgroundColor: "#F6F7FB",
    alignItems: "center",
  },
  inner: {
    flex: 1,
    width: "100%",
  },
});
