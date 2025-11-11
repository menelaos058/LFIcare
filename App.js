// App.js
import { NavigationContainer, useNavigationContainerRef } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, View } from "react-native";
import 'react-native-gesture-handler';
import { auth, db } from "./firebaseConfig";

// Screens
import AdminScreen from "./screens/AdminScreen";
import ChatScreen from "./screens/ChatScreen";
import ContactScreen from "./screens/ContactScreen";
import HomeScreen from "./screens/HomeScreen";
import LoginScreen from "./screens/LoginScreen";
import MyProgramsScreen from "./screens/MyProgramsScreen";
import ProfileScreen from "./screens/ProfileScreen";
import ProgramsScreen from "./screens/ProgramsScreen";
import RegisterScreen from "./screens/RegisterScreen";
import ShareSheetScreen from "./screens/ShareSheetScreen";
import TeachersScreen from "./screens/TeachersScreen";

// Components
import Header from "./components/Header";

const Stack = createNativeStackNavigator();

// ❗ Lazy, safe import για ShareMenu
let ShareMenu = null;
if (Platform.OS === 'android' || Platform.OS === 'ios') {
  try {
    // ορισμένες εκδόσεις κάνουν default export, άλλες όχι
    const mod = require('react-native-share-menu');
    ShareMenu = mod?.default ?? mod;
  } catch (e) {
    // μένει null -> θα αγνοήσουμε τα share intents
  }
}

export default function App() {
  const navRef = useNavigationContainerRef();

  const [currentUser, setCurrentUser] = useState(null); // { uid, email, role }
  const [loading, setLoading] = useState(true);
  const [navReady, setNavReady] = useState(false);

  // incoming share buffer μέχρι να είναι έτοιμο το navigation
  const [pendingShare, setPendingShare] = useState(null); // { mimeType, data, items? }

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
    // αν το module λείπει, δεν στήνουμε listeners
    if (!ShareMenu) return;
    const hasInitial = typeof ShareMenu.getInitialShare === 'function';
    const hasListener = typeof ShareMenu.addNewShareListener === 'function';
    if (!hasInitial && !hasListener) return;

    // 1) Share όταν άνοιξε η app
    if (hasInitial) {
      try {
        ShareMenu.getInitialShare((item) => {
          if (item) setPendingShare(item);
        });
      } catch (e) {
        console.warn("ShareMenu.getInitialShare failed:", e?.message);
      }
    }

    // 2) Νέα shares όσο τρέχει η app
    let listenerCleanup = null;
    if (hasListener) {
      try {
        const listener = ShareMenu.addNewShareListener((item) => {
          if (item) setPendingShare(item);
        });
        listenerCleanup = () => {
          try { listener?.remove?.(); } catch {}
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
    if (!navReady || !pendingShare) return;

    if (!currentUser) {
      navRef.navigate("Login", {
        redirect: { name: "ShareSheet", params: { shared: pendingShare } },
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
    <NavigationContainer ref={navRef} onReady={() => setNavReady(true)}>
      <Header user={currentUser} setUser={setCurrentUser} />

      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Home" component={HomeScreen} />

        <Stack.Screen name="Programs">
          {(props) => <ProgramsScreen {...props} user={currentUser} />}
        </Stack.Screen>

        <Stack.Screen name="Teachers">
          {(props) => <TeachersScreen {...props} user={currentUser} />}
        </Stack.Screen>

        <Stack.Screen name="Contact" component={ContactScreen} />

        <Stack.Screen name="Login">
          {(props) => <LoginScreen {...props} setUser={setCurrentUser} />}
        </Stack.Screen>

        <Stack.Screen name="Register">
          {(props) => <RegisterScreen {...props} setUser={setCurrentUser} />}
        </Stack.Screen>

        <Stack.Screen name="MyPrograms">
          {(props) => <MyProgramsScreen {...props} user={currentUser} />}
        </Stack.Screen>

        <Stack.Screen name="Profile">
          {(props) => <ProfileScreen {...props} user={currentUser} />}
        </Stack.Screen>

        <Stack.Screen name="Chat">
          {(props) => <ChatScreen {...props} user={currentUser} />}
        </Stack.Screen>

        {currentUser?.role === "admin" && (
          <Stack.Screen name="Admin" component={AdminScreen} />
        )}

        <Stack.Screen
          name="ShareSheet"
          component={ShareSheetScreen}
          options={{ headerShown: true, title: "Κοινοποίηση" }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
