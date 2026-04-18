// src/types/firebase-auth-shim.d.ts

// IMPORTANT: this import turns the file into a module and AUGMENTS the real typings
import "firebase/auth";

declare module "firebase/auth" {
  // minimal typing to satisfy TS
  export function getReactNativePersistence(storage: any): any;
}