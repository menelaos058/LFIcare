// App.js
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import 'react-native-gesture-handler';

import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
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
import TeachersScreen from "./screens/TeachersScreen";

// Components
import Header from "./components/Header";

const Stack = createNativeStackNavigator();

export default function App() {
  const [currentUser, setCurrentUser] = useState(null); // { uid, email, role }
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeUserDoc = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      // Καθάρισε προηγούμενο listener στο user doc (αν υπήρχε)
      if (unsubscribeUserDoc) {
        unsubscribeUserDoc();
        unsubscribeUserDoc = null;
      }

      if (!user) {
        setCurrentUser(null);
        setLoading(false);
        return;
      }

      // Ζωντανός συγχρονισμός ρόλου από /users/{uid}
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
          // Σε σφάλμα, κράτα default ρόλο ώστε να μη μπλοκάρει το UI
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

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
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

        {/* Εμφάνιση Admin screen μόνο για role === 'admin' */}
        {currentUser?.role === "admin" && (
          <Stack.Screen name="Admin" component={AdminScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
