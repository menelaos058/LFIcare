// screens/ContactScreen.js
import { push, ref } from "firebase/database";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { database } from "../services/firebaseConfig";

export default function ContactScreen({ user }) {
  const [name, setName] = useState(user?.displayName || "");
  const [email, setEmail] = useState(user?.email || "");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Support");
  const [loading, setLoading] = useState(false);

  const categories = useMemo(
    () => ["Support", "Bug Report", "Feedback", "Partnership", "Other"],
    []
  );

  const isGuest = !user?.uid;

  const validateEmail = (value) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value.trim());
  };

  const resetForm = () => {
    if (!user?.displayName) setName("");
    if (!user?.email) setEmail("");
    setSubject("");
    setMessage("");
    setSelectedCategory("Support");
  };

  const handleSend = async () => {
    if (!name.trim()) {
      Alert.alert("Missing Name", "Please enter your name.");
      return;
    }

    if (!email.trim()) {
      Alert.alert("Missing Email", "Please enter your email.");
      return;
    }

    if (!validateEmail(email)) {
      Alert.alert("Invalid Email", "Please enter a valid email address.");
      return;
    }

    if (!subject.trim()) {
      Alert.alert("Missing Subject", "Please enter a subject.");
      return;
    }

    if (!message.trim()) {
      Alert.alert("Missing Message", "Message cannot be empty.");
      return;
    }

    if (message.trim().length < 10) {
      Alert.alert("Message Too Short", "Please write a more detailed message.");
      return;
    }

    setLoading(true);

    try {
      await push(ref(database, "contactMessages"), {
        uid: user?.uid || null,
        isGuest,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        category: selectedCategory,
        subject: subject.trim(),
        message: message.trim(),
        status: "new",
        timestamp: Date.now(),
        createdAt: new Date().toISOString(),
        userInfo: {
          displayName: user?.displayName || null,
          registeredEmail: user?.email || null,
        },
        appMeta: {
          platform: Platform.OS,
        },
      });

      resetForm();

      Alert.alert(
        "Message Sent",
        "Thank you for contacting us. We will get back to you as soon as possible."
      );
    } catch (error) {
      Alert.alert(
        "Error",
        error.message || "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#F6FBF7" />
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.headerCard}>
            <Text style={styles.badge}>
              {isGuest ? "Guest Contact" : "Registered User"}
            </Text>
            <Text style={styles.title}>Contact Us</Text>
            <Text style={styles.subtitle}>
              Have a question, found a problem, or want to share feedback? Fill
              out the form below and our team will respond as soon as possible.
            </Text>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.sectionTitle}>Your Information</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Full Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your full name"
                placeholderTextColor="#8A8A8A"
                value={name}
                onChangeText={setName}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email Address</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your email"
                placeholderTextColor="#8A8A8A"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <Text style={styles.sectionTitle}>Message Details</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Category</Text>
              <View style={styles.categoriesContainer}>
                {categories.map((category) => {
                  const active = selectedCategory === category;
                  return (
                    <TouchableOpacity
                      key={category}
                      style={[
                        styles.categoryChip,
                        active && styles.categoryChipActive,
                      ]}
                      onPress={() => setSelectedCategory(category)}
                      activeOpacity={0.85}
                    >
                      <Text
                        style={[
                          styles.categoryChipText,
                          active && styles.categoryChipTextActive,
                        ]}
                      >
                        {category}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Subject</Text>
              <TextInput
                style={styles.input}
                placeholder="What is this about?"
                placeholderTextColor="#8A8A8A"
                value={subject}
                onChangeText={setSubject}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Message</Text>
              <TextInput
                style={styles.messageInput}
                placeholder="Write your message here..."
                placeholderTextColor="#8A8A8A"
                value={message}
                onChangeText={setMessage}
                multiline
                textAlignVertical="top"
                maxLength={1000}
              />
              <Text style={styles.counter}>{message.length}/1000</Text>
            </View>

            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#28A745" />
                <Text style={styles.loadingText}>Sending your message...</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.button}
                onPress={handleSend}
                activeOpacity={0.85}
              >
                <Text style={styles.buttonText}>Send Message</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Other Ways to Reach Us</Text>
            <Text style={styles.infoText}>Email: support@yourapp.com</Text>
            <Text style={styles.infoText}>
              Availability: Monday - Friday, 09:00 - 18:00
            </Text>
            <Text style={styles.infoNote}>
              We only use your information to reply to your request.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F6FBF7",
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 40,
  },

  headerCard: {
    backgroundColor: "#EAF8EE",
    borderRadius: 24,
    padding: 22,
    marginBottom: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: "#28A745",
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    marginBottom: 14,
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: "#1B5E20",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    color: "#4F4F4F",
    lineHeight: 22,
  },

  formCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    marginBottom: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1F1F1F",
    marginBottom: 14,
    marginTop: 6,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
    color: "#333333",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E1E1E1",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    color: "#1F1F1F",
  },
  messageInput: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E1E1E1",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    color: "#1F1F1F",
    minHeight: 150,
  },
  counter: {
    marginTop: 6,
    alignSelf: "flex-end",
    fontSize: 12,
    color: "#777777",
  },

  categoriesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  categoryChip: {
    backgroundColor: "#F2F2F2",
    borderWidth: 1,
    borderColor: "#DDDDDD",
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginRight: 10,
    marginBottom: 10,
  },
  categoryChipActive: {
    backgroundColor: "#28A745",
    borderColor: "#28A745",
  },
  categoryChipText: {
    color: "#555555",
    fontSize: 13,
    fontWeight: "700",
  },
  categoryChipTextActive: {
    color: "#FFFFFF",
  },

  button: {
    backgroundColor: "#28A745",
    paddingVertical: 18,
    borderRadius: 22,
    marginTop: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#28A745",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800",
    textAlign: "center",
  },

  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: "#555555",
    fontWeight: "600",
  },

  infoCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1F1F1F",
    marginBottom: 12,
  },
  infoText: {
    fontSize: 15,
    color: "#4F4F4F",
    marginBottom: 8,
    lineHeight: 22,
  },
  infoNote: {
    marginTop: 8,
    fontSize: 13,
    color: "#7A7A7A",
    lineHeight: 20,
  },
});