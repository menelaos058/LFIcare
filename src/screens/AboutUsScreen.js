// src/screens/AboutUsScreen.js
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Layout from "../components/Layout";
import { useResponsive } from "../theme/responsive";

export default function AboutUsScreen() {
  const { s, ms } = useResponsive();

  const programs = [
    "LFI ATHENA – Family, Students, Schools, Colleges, Universities",
    "LFI HERMES – Professionals, Corporations",
    "LFI GAIA – Back to Work, Life Long Education, New Career",
    "LFI XENIA – Greece Visitors, Individuals & Groups",
    "LFI ACADEMY – Seminars, Workshops, Webinars",
    "LFI ATLAS – Executives",
    "LFI HORIZON – Biomedicine, Science & Technology",
    "LFI ARTEMIS – Women in Life, Women in Science",
    "LFI VITA – Rejuvenation & Revitalization",
  ];

  return (
    <Layout>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          {
            padding: s(20),
            paddingBottom: s(40),
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.card,
            {
              padding: s(18),
              borderRadius: s(16),
            },
          ]}
        >
          <Text style={[styles.title, { fontSize: ms(28) }]}>About Us</Text>

          <Text
            style={[
              styles.subtitle,
              {
                fontSize: ms(15),
                marginTop: s(6),
                marginBottom: s(18),
              },
            ]}
          >
            Learn more about the philosophy, mission, and programs of Leap
            Forward Initiative.
          </Text>

          <Text style={[styles.sectionTitle, { fontSize: ms(20) }]}>
            Who We Are
          </Text>
          <Text
            style={[
              styles.paragraph,
              { fontSize: ms(15), marginTop: s(10), lineHeight: ms(24) },
            ]}
          >
            Leap Forward Initiative (LFI) is a personalized mentorship
            methodology developed by Dr. Eumorphia Remboutsika in 2015. It was
            designed as a cognitive and stress-management framework that helps
            individuals discover their inner motivations and identify their true
            life and career path.
          </Text>

          <Text
            style={[
              styles.paragraph,
              { fontSize: ms(15), marginTop: s(12), lineHeight: ms(24) },
            ]}
          >
            LFI is based on the combination of the Socratic method and cognitive
            training techniques. Through simple but powerful processes, the
            program encourages self-discovery, holistic thinking, and more
            meaningful decision-making. It supports people in connecting with
            their deeper instincts and building a life path that reflects their
            authentic potential.
          </Text>

          <Text style={[styles.sectionTitle, { fontSize: ms(20), marginTop: s(22) }]}>
            Our Vision
          </Text>
          <Text
            style={[
              styles.paragraph,
              { fontSize: ms(15), marginTop: s(10), lineHeight: ms(24) },
            ]}
          >
            Our vision is to make holistic mentorship accessible to a wider
            international audience. We believe that by helping people understand
            themselves better, we can empower them to make better personal,
            professional, and educational choices.
          </Text>

          <Text style={[styles.sectionTitle, { fontSize: ms(20), marginTop: s(22) }]}>
            Who LFI Is For
          </Text>
          <Text
            style={[
              styles.paragraph,
              { fontSize: ms(15), marginTop: s(10), lineHeight: ms(24) },
            ]}
          >
            LFI is designed for all ages, including children, teenagers, and
            adults. It is especially valuable for people navigating important
            life transitions, periods of stress, career uncertainty, or the need
            for greater clarity about their goals and direction.
          </Text>

          <Text style={[styles.sectionTitle, { fontSize: ms(20), marginTop: s(22) }]}>
            What Makes LFI Different
          </Text>
          <Text
            style={[
              styles.paragraph,
              { fontSize: ms(15), marginTop: s(10), lineHeight: ms(24) },
            ]}
          >
            Unlike traditional career counseling approaches, LFI goes deeper
            into the process of self-reflection and internal awareness. It helps
            participants reconnect with their passions, values, and natural
            strengths, allowing them to shape a life path with more confidence
            and purpose.
          </Text>

          <Text style={[styles.sectionTitle, { fontSize: ms(20), marginTop: s(22) }]}>
            Our Programs
          </Text>

          <View style={{ marginTop: s(10), gap: s(10) }}>
            {programs.map((item, index) => (
              <View
                key={`${item}-${index}`}
                style={[
                  styles.programItem,
                  {
                    paddingVertical: s(10),
                    paddingHorizontal: s(12),
                    borderRadius: s(12),
                  },
                ]}
              >
                <Text style={[styles.bullet, { fontSize: ms(18) }]}>•</Text>
                <Text
                  style={[
                    styles.programText,
                    { fontSize: ms(14), lineHeight: ms(22) },
                  ]}
                >
                  {item}
                </Text>
              </View>
            ))}
          </View>

          <Text style={[styles.sectionTitle, { fontSize: ms(20), marginTop: s(22) }]}>
            Our Mission
          </Text>
          <Text
            style={[
              styles.paragraph,
              { fontSize: ms(15), marginTop: s(10), lineHeight: ms(24) },
            ]}
          >
            Our mission is to expand the reach of LFI through educational
            programs, digital tools, seminars, workshops, and our mobile
            application. We aim to support individuals worldwide in discovering
            clarity, growth, resilience, and meaningful transformation in their
            lives.
          </Text>

          <Text
            style={[
              styles.footerText,
              {
                fontSize: ms(13),
                marginTop: s(24),
                lineHeight: ms(20),
              },
            ]}
          >
            Leap Forward Initiative is committed to helping people move forward
            with awareness, purpose, and confidence.
          </Text>
        </View>
      </ScrollView>
    </Layout>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#F5F7FA",
    flexGrow: 1,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  title: {
    fontWeight: "700",
    color: "#111827",
  },
  subtitle: {
    color: "#6B7280",
  },
  sectionTitle: {
    fontWeight: "700",
    color: "#28A745",
  },
  paragraph: {
    color: "#374151",
  },
  programItem: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  bullet: {
    color: "#28A745",
    fontWeight: "700",
    marginTop: -1,
  },
  programText: {
    flex: 1,
    color: "#374151",
  },
  footerText: {
    color: "#6B7280",
    fontStyle: "italic",
  },
});