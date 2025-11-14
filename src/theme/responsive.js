// src/theme/responsive.js
import { useWindowDimensions } from "react-native";

// Βάση σχεδίασης (π.χ. iPhone 11 περίπου)
const BASE_WIDTH = 375;
const BASE_HEIGHT = 812;

// scale για πλάτη / μεγέθη
export const scale = (size, width) => (width / BASE_WIDTH) * size;

// κάθετη κλιμάκωση (αν την θες)
export const verticalScale = (size, height) => (height / BASE_HEIGHT) * size;

// για fonts, πιο ήπια κλιμάκωση
export const moderateScale = (size, width, factor = 0.5) => {
  const scaled = scale(size, width);
  return size + (scaled - size) * factor;
};

// Hook που θα χρησιμοποιείς σε components
export function useResponsive() {
  const { width, height } = useWindowDimensions();

  // breakpoints
  const isSmallPhone = width < 360;
  const isPhone = width < 768;
  const isTablet = width >= 768 && width < 1024;
  const isLargeScreen = width >= 1024;

  const s = (val) => scale(val, width);
  const vs = (val) => verticalScale(val, height);
  const ms = (val, factor) => moderateScale(val, width, factor);

  return {
    width,
    height,
    isSmallPhone,
    isPhone,
    isTablet,
    isLargeScreen,
    s,
    vs,
    ms,
  };
}
