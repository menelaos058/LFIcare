import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Linking,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { onAuthStateChanged } from "firebase/auth";
import { collection, onSnapshot } from "firebase/firestore";
import { ErrorCode, useIAP } from "react-native-iap";

import { auth, db } from "../services/firebaseConfig";

const ANDROID_SUBS = ["pro", "pro2"];
const VERIFY_URL =
  "https://europe-west1-lficare-6cf8d.cloudfunctions.net/verifyAndroidSubscription";

function formatTs(ts) {
  const d = ts?.toDate?.();
  if (!d) return "-";
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString();
}

function isActiveSub(doc) {
  const exp = doc?.expiresAt?.toDate?.();
  return !!exp && exp.getTime() > Date.now();
}

function getSubId(sub) {
  return sub?.id ?? sub?.productId ?? sub?.sku;
}

function pickOfferTokenAndroid(sub) {
  const d1 = sub?.subscriptionOfferDetailsAndroid;
  if (Array.isArray(d1) && d1.length > 0) {
    return d1[0]?.offerToken;
  }

  const d2 = sub?.subscriptionOfferDetails;
  if (Array.isArray(d2) && d2.length > 0) {
    return d2[0]?.offerToken;
  }

  return undefined;
}

async function verifyAndroidSubscriptionRequest({
  user,
  productId,
  purchaseToken,
  programId,
}) {
  if (!user) {
    throw new Error("Login required.");
  }

  const idToken = await user.getIdToken(true);

  const res = await fetch(VERIFY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      productId,
      purchaseToken,
      programId,
    }),
  });

  const text = await res.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Non-JSON response from function: ${text}`);
  }

  if (!res.ok) {
    throw new Error(data?.error || data?.message || "Verification failed.");
  }

  return data;
}

export default function PaywallScreen({ route, navigation }) {
  const routeProductId = route?.params?.productId ?? null;
  const routeProgramId = route?.params?.programId ?? null;
  const autoStart = !!route?.params?.autoStart;
  const routeReturnTo = route?.params?.returnTo || "MyPrograms";
  const programTitle = route?.params?.title || "Program";

  const [busySku, setBusySku] = useState(null);
  const [mySubs, setMySubs] = useState({});
  const [firebaseUser, setFirebaseUser] = useState(null);

  const autoStartedRef = useRef(false);
  const handledPurchaseTokensRef = useRef(new Set());

  const purchaseContextRef = useRef({
    productId: routeProductId,
    programId: routeProgramId,
    returnTo: routeReturnTo,
  });

  useEffect(() => {
    purchaseContextRef.current = {
      productId: routeProductId,
      programId: routeProgramId,
      returnTo: routeReturnTo,
    };
  }, [routeProductId, routeProgramId, routeReturnTo]);

  const {
    connected,
    subscriptions,
    fetchProducts,
    requestPurchase,
    finishTransaction,
  } = useIAP({
    onPurchaseSuccess: async (purchase) => {
      try {
        const purchasedProductId =
          purchase?.productId ?? purchase?.id ?? purchase?.sku;
        const purchaseToken =
          purchase?.purchaseToken ?? purchase?.token;

        const currentUser = auth.currentUser;
        const pending = purchaseContextRef.current;

        console.log("PURCHASE SUCCESS");
        console.log("pendingProductId:", pending?.productId ?? null);
        console.log("purchasedProductId:", purchasedProductId);
        console.log("pendingProgramId:", pending?.programId ?? null);

        if (!currentUser) {
          throw new Error("Login required.");
        }

        if (!purchaseToken) {
          throw new Error("Missing purchase token.");
        }

        if (handledPurchaseTokensRef.current.has(purchaseToken)) {
          console.warn("Ignoring duplicate purchase callback", {
            purchasedProductId,
            purchaseToken,
          });
          return;
        }

        if (!pending?.programId || !pending?.productId) {
          console.warn("Ignoring purchase callback with no pending context", {
            pendingProductId: pending?.productId ?? null,
            pendingProgramId: pending?.programId ?? null,
            purchasedProductId,
          });
          return;
        }

        if (purchasedProductId && purchasedProductId !== pending.productId) {
          console.warn("Ignoring stale purchase callback", {
            pendingProgramId: pending.programId,
            pendingProductId: pending.productId,
            purchasedProductId,
          });
          return;
        }

        await verifyAndroidSubscriptionRequest({
          user: currentUser,
          productId: pending.productId,
          purchaseToken,
          programId: pending.programId,
        });

        await finishTransaction({
          purchase,
          isConsumable: false,
        });

        handledPurchaseTokensRef.current.add(purchaseToken);

        Alert.alert("Success", "Purchase completed successfully.");

        const goTo = pending.returnTo || "MyPrograms";

        purchaseContextRef.current = {
          productId: null,
          programId: null,
          returnTo: "MyPrograms",
        };

        navigation.replace(goTo);
      } catch (e) {
        console.error("Purchase success handler failed:", e);
        Alert.alert("Purchase error", e?.message ?? "Something went wrong.");
      } finally {
        setBusySku(null);
      }
    },

    onPurchaseError: (e) => {
      if (e?.code === ErrorCode.E_USER_CANCELLED) {
        setBusySku(null);
        return;
      }

      console.warn("purchase error:", e);
      setBusySku(null);

      Alert.alert("Purchase error", e?.message ?? "Purchase failed.");
    },
  });

  const subsById = useMemo(() => {
    const map = new Map();

    (subscriptions ?? []).forEach((s) => {
      const id = getSubId(s);
      if (id) {
        map.set(id, s);
      }
    });

    return map;
  }, [subscriptions]);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    if (!connected) return;

    (async () => {
      try {
        await fetchProducts({
          skus: ANDROID_SUBS,
          type: "subs",
        });
      } catch (e) {
        console.error("fetchProducts error:", e);
      }
    })();
  }, [connected, fetchProducts]);

  useEffect(() => {
    let unsubFirestore = null;

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);

      if (typeof unsubFirestore === "function") {
        unsubFirestore();
        unsubFirestore = null;
      }

      if (!user) {
        setMySubs({});
        return;
      }

      const colRef = collection(db, "users", user.uid, "subscriptions");

      unsubFirestore = onSnapshot(
        colRef,
        (snap) => {
          const next = {};

          snap.forEach((d) => {
            const data = d.data();
            const subProgramId = data?.programId || d.id;

            if (subProgramId) {
              next[subProgramId] = data;
            }
          });

          setMySubs(next);
        },
        (err) => {
          console.error("subscriptions snapshot failed:", err);
        }
      );
    });

    return () => {
      if (typeof unsubFirestore === "function") {
        unsubFirestore();
      }
      unsubAuth();
    };
  }, []);

  const currentSubDoc = routeProgramId ? mySubs[routeProgramId] : null;
  const currentSubActive = isActiveSub(currentSubDoc);
  const hasExistingSubscription = !!currentSubDoc;

  function getStorePrice(productId) {
    const s = subsById.get(productId);

    return (
      s?.localizedPrice ??
      s?.displayPrice ??
      (s?.price && s?.currency ? `${s.price} ${s.currency}` : "—")
    );
  }

  async function buyOrRenew(productId) {
    try {
      const currentUser = auth.currentUser;

      console.log("BUY START", {
        routeProgramId,
        routeProductId,
        clickedProductId: productId,
      });

      if (!currentUser) {
        Alert.alert("Login required", "Please login first.");
        return;
      }

      if (Platform.OS !== "android") {
        Alert.alert("Unsupported", "This screen currently supports Android only.");
        return;
      }

      if (!connected) {
        Alert.alert("Billing", "Billing not ready.");
        return;
      }

      if (!routeProgramId) {
        Alert.alert("Error", "Missing programId.");
        return;
      }

      if (!productId) {
        Alert.alert("Error", "Missing productId.");
        return;
      }

      if (busySku) return;

      purchaseContextRef.current = {
        productId,
        programId: routeProgramId,
        returnTo: routeReturnTo,
      };

      setBusySku(productId);

      const sub = subsById.get(productId);

      if (!sub) {
        throw new Error("Subscriptions not loaded from Google Play.");
      }

      const offerToken = pickOfferTokenAndroid(sub);

      console.log("SUB OBJECT:", JSON.stringify(sub, null, 2));
      console.log("OFFER TOKEN:", offerToken);

      if (!offerToken) {
        throw new Error("Offer token missing.");
      }

      await requestPurchase({
        type: "subs",
        request: {
          android: {
            skus: [productId],
            subscriptionOffers: [
              {
                sku: productId,
                offerToken,
              },
            ],
          },
        },
      });
    } catch (e) {
      console.error("buyOrRenew failed:", e);
      setBusySku(null);
      Alert.alert("Purchase failed", e?.message ?? "Purchase failed.");
    }
  }

  useEffect(() => {
    if (!autoStart) return;
    if (!routeProductId) return;
    if (!connected) return;
    if (!subsById.get(routeProductId)) return;
    if (busySku) return;
    if (autoStartedRef.current) return;

    autoStartedRef.current = true;
    buyOrRenew(routeProductId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, routeProductId, connected, subsById, busySku]);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 22, fontWeight: "700" }}>Paywall</Text>

      <Text style={{ opacity: 0.75 }}>
        {connected ? "Ready for purchase" : "Connecting to billing..."}
      </Text>

      {!firebaseUser && (
        <View style={{ padding: 12, borderRadius: 12, borderWidth: 1 }}>
          <Text style={{ fontWeight: "700" }}>Not logged in</Text>
          <Text>Please login before purchasing.</Text>
        </View>
      )}

      <View
        style={{
          borderWidth: 1,
          borderRadius: 14,
          padding: 14,
          gap: 8,
        }}
      >
        <Text style={{ fontSize: 18, fontWeight: "700" }}>
          {programTitle}
        </Text>

        <Text>Program ID: {routeProgramId || "-"}</Text>
        <Text>Product ID: {routeProductId || "-"}</Text>
        <Text>Price: {routeProductId ? getStorePrice(routeProductId) : "—"}</Text>

        <Text>
          Status:{" "}
          {currentSubActive
            ? "Active"
            : hasExistingSubscription
            ? "Expired"
            : "Inactive"}
        </Text>

        <Text>Expires: {formatTs(currentSubDoc?.expiresAt)}</Text>

        <TouchableOpacity
          disabled={!!busySku || !firebaseUser || !connected || !routeProductId}
          onPress={() => buyOrRenew(routeProductId)}
          style={{
            paddingVertical: 12,
            borderRadius: 12,
            backgroundColor: busySku ? "#333" : "#000",
            opacity: !firebaseUser || !connected || !routeProductId ? 0.5 : 1,
          }}
        >
          <Text
            style={{
              color: "white",
              textAlign: "center",
              fontWeight: "700",
            }}
          >
            {busySku === routeProductId
              ? "Processing..."
              : hasExistingSubscription
              ? "Resubscribe"
              : "Subscribe"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() =>
            Linking.openURL(
              "https://play.google.com/store/account/subscriptions"
            )
          }
        >
          <Text
            style={{
              textAlign: "center",
              textDecorationLine: "underline",
            }}
          >
            Manage subscriptions in Google Play
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}