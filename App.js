// App.js
import {
  NavigationContainer,
  useNavigationContainerRef,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  NativeModules,
  Platform,
  View,
} from "react-native";
import "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { auth, db } from "./src/services/firebaseConfig";

// Screens
import AboutUsScreen from "./src/screens/AboutUsScreen";
import AdminScreen from "./src/screens/AdminScreen";
import ChatScreen from "./src/screens/ChatScreen";
import ContactScreen from "./src/screens/ContactScreen";
import HomeScreen from "./src/screens/HomeScreen";
import LoginScreen from "./src/screens/LoginScreen";
import MyProgramsScreen from "./src/screens/MyProgramsScreen";
import PaywallScreen from "./src/screens/PaywallScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import ProgramsScreen from "./src/screens/ProgramsScreen";
import RegisterScreen from "./src/screens/RegisterScreen";
import ShareSheetScreen from "./src/screens/ShareSheetScreen";
import TeachersScreen from "./src/screens/TeachersScreen";

// Components
import Header from "./src/components/Header";

// --- NativeEventEmitter polyfill για παλιότερο ShareMenu native module ---
if (Platform.OS === "android") {
  const M = NativeModules?.ShareMenu || NativeModules?.ShareMenuModule;

  if (M && !M.addListener) {
    M.addListener = () => {};
  }

  if (M && !M.removeListeners) {
    M.removeListeners = () => {};
  }
}

// Lazy & safe import για ShareMenu, μόνο σε native πλατφόρμες
let ShareMenu = null;

if (Platform.OS === "android" || Platform.OS === "ios") {
  try {
    const mod = require("react-native-share-menu");
    ShareMenu = mod?.default ?? mod;
  } catch (e) {
    ShareMenu = null;
  }
}

const Stack = createNativeStackNavigator();

function App() {
  const navRef = useNavigationContainerRef();

  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [navReady, setNavReady] = useState(false);
  const [pendingShare, setPendingShare] = useState(null);

  const navigatorKey = useMemo(() => {
    if (!currentUser) return "guest";
    if (currentUser.role === "admin") return "admin";
    return "user";
  }, [currentUser]);

  // ====== Auth + live role από /users/{uid} ======
  useEffect(() => {
    let unsubscribeUserDoc = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (unsubscribeUserDoc) {
        unsubscribeUserDoc();
        unsubscribeUserDoc = null;
      }

      if (!user) {
        setCurrentUser(null);
        setLoading(false);
        return;
      }

      const userRef = doc(db, "users", user.uid);

      unsubscribeUserDoc = onSnapshot(
        userRef,
        (snap) => {
          const data = snap.exists() ? snap.data() : {};
          const role = typeof data.role === "string" ? data.role : "user";

          setCurrentUser({
            uid: user.uid,
            email: user.email ?? null,
            role,
          });

          setLoading(false);
        },
        (err) => {
          console.log("onSnapshot(users/uid) error:", err);

          setCurrentUser({
            uid: user.uid,
            email: user.email ?? null,
            role: "user",
          });

          setLoading(false);
        }
      );
    });

    return () => {
      if (unsubscribeUserDoc) unsubscribeUserDoc();
      unsubscribeAuth();
    };
  }, []);

  // ====== Share intents (μόνο αν υπάρχει το native module) ======
  useEffect(() => {
    if (!ShareMenu) return;

    const hasInitial = typeof ShareMenu.getInitialShare === "function";
    const hasListener = typeof ShareMenu.addNewShareListener === "function";

    if (!hasInitial && !hasListener) return;

    if (hasInitial) {
      try {
        ShareMenu.getInitialShare((item) => {
          if (item) setPendingShare(item);
        });
      } catch (e) {
        console.warn("ShareMenu.getInitialShare failed:", e?.message);
      }
    }

    let listenerCleanup = null;

    if (hasListener) {
      try {
        const listener = ShareMenu.addNewShareListener((item) => {
          if (item) setPendingShare(item);
        });

        listenerCleanup = () => {
          try {
            listener?.remove?.();
          } catch {}
        };
      } catch (e) {
        console.warn("ShareMenu.addNewShareListener failed:", e?.message);
      }
    }

    return () => {
      if (listenerCleanup) listenerCleanup();
    };
  }, []);

  // ====== Όταν είναι έτοιμο το navigation + υπάρχει pendingShare => πλοήγηση ======
  useEffect(() => {
    if (!navReady || !pendingShare || !navRef.isReady()) return;

    if (!currentUser) {
      navRef.navigate("Login", {
        redirect: {
          name: "ShareSheet",
          params: { shared: pendingShare },
        },
      });
      setPendingShare(null);
      return;
    }

    navRef.navigate("ShareSheet", { shared: pendingShare });
    setPendingShare(null);
  }, [navReady, pendingShare, currentUser, navRef]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer ref={navRef} onReady={() => setNavReady(true)}>
        <Stack.Navigator
          key={navigatorKey}
          screenOptions={{
            header: (props) => (
              <Header
                {...props}
                user={currentUser}
                setUser={setCurrentUser}
              />
            ),
          }}
        >
          <Stack.Screen name="Home" options={{ title: "Home" }}>
            {(props) => <HomeScreen {...props} user={currentUser} />}
          </Stack.Screen>

          <Stack.Screen
            name="AboutUs"
            component={AboutUsScreen}
            options={{ title: "About Us" }}
          />

          <Stack.Screen name="Programs" options={{ title: "Programs" }}>
            {(props) => <ProgramsScreen {...props} user={currentUser} />}
          </Stack.Screen>

          <Stack.Screen name="Teachers" options={{ title: "Teachers" }}>
            {(props) => <TeachersScreen {...props} user={currentUser} />}
          </Stack.Screen>

          <Stack.Screen
            name="Paywall"
            component={PaywallScreen}
            options={{ title: "Paywall" }}
          />

          <Stack.Screen
            name="Contact"
            component={ContactScreen}
            options={{ title: "Contact" }}
          />

          {!currentUser && (
            <>
              <Stack.Screen name="Login" options={{ title: "Login" }}>
                {(props) => <LoginScreen {...props} setUser={setCurrentUser} />}
              </Stack.Screen>

              <Stack.Screen name="Register" options={{ title: "Register" }}>
                {(props) => (
                  <RegisterScreen {...props} setUser={setCurrentUser} />
                )}
              </Stack.Screen>
            </>
          )}

          {!!currentUser && (
            <>
              <Stack.Screen
                name="MyPrograms"
                options={{ title: "My Programs" }}
              >
                {(props) => (
                  <MyProgramsScreen {...props} user={currentUser} />
                )}
              </Stack.Screen>

              <Stack.Screen name="Profile" options={{ title: "Profile" }}>
                {(props) => <ProfileScreen {...props} user={currentUser} />}
              </Stack.Screen>

              <Stack.Screen name="Chat" options={{ title: "Chat" }}>
                {(props) => <ChatScreen {...props} user={currentUser} />}
              </Stack.Screen>

              <Stack.Screen
                name="ShareSheet"
                component={ShareSheetScreen}
                options={{ title: "Κοινοποίηση" }}
              />

              {currentUser.role === "admin" && (
                <Stack.Screen name="Admin" options={{ title: "Admin" }}>
                  {(props) => <AdminScreen {...props} user={currentUser} />}
                </Stack.Screen>
              )}
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

export default App;