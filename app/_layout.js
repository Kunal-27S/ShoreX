import { Stack, useRouter, Slot } from 'expo-router';
import { useEffect, useState } from 'react';
import { auth, firestore } from '../firebaseConfig';
import { collection, query, where, onSnapshot, doc, addDoc, Timestamp, getDoc } from 'firebase/firestore';
import { ThemeProvider } from '../contexts/ThemeContext';

export default function RootLayout() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [onboarded, setOnboarded] = useState(true);

  useEffect(() => {
    const checkOnboarding = async () => {
      if (auth.currentUser) {
        const userDoc = await getDoc(doc(firestore, 'users', auth.currentUser.uid));
        if (userDoc.exists()) {
          setOnboarded(userDoc.data().onboarded === true);
          if (!userDoc.data().onboarded) {
            router.replace('/onboarding/step1');
          }
        } else {
          setOnboarded(false);
          router.replace('/onboarding/step1');
        }
      }
      setChecking(false);
    };
    checkOnboarding();
  }, [auth.currentUser]);

  if (checking) return null;
  return (
    <ThemeProvider>
      <Slot />
    </ThemeProvider>
  );
} 