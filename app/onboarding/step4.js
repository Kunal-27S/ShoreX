import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { auth, firestore } from '../../firebaseConfig';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import StepsIndicator from '../../components/StepsIndicator';
import { useTheme } from '../../contexts/ThemeContext';

export default function OnboardingStep4() {
  const router = useRouter();
  const { colors } = useTheme();
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [userData, setUserData] = useState({});

  useEffect(() => {
    const fetchUserData = async () => {
      const userRef = doc(firestore, 'users', auth.currentUser.uid);
      const snap = await getDoc(userRef);
      if (snap.exists()) setUserData(snap.data());
    };
    fetchUserData();
  }, []);

  const handleFinish = async () => {
    if (!accepted) return;
    setLoading(true);
    try {
      const userRef = doc(firestore, 'users', auth.currentUser.uid);
      await updateDoc(userRef, { onboarded: true });
      router.replace('/home');
    } catch (e) {
      // handle error
    }
    setLoading(false);
  };

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}> 
      <StepsIndicator currentStep={4} totalSteps={4} />
      <Text style={[styles.title, { color: colors.text }]}>Review & Accept</Text>
      <View style={styles.summaryBox}>
        <Text style={[styles.summaryText, { color: colors.text }]}>Nickname: {userData.nickname || ''}</Text>
        <Text style={[styles.summaryText, { color: colors.text }]}>Interests: {(userData.interests || []).join(', ')}</Text>
        <Text style={[styles.summaryText, { color: colors.text }]}>Location: {userData.locationPreference || ''}</Text>
      </View>
      <TouchableOpacity style={styles.checkboxRow} onPress={() => setAccepted(a => !a)}>
        <View style={[styles.checkbox, { borderColor: colors.primary, backgroundColor: accepted ? colors.primary : 'transparent' }]} />
        <Text style={[styles.checkboxLabel, { color: colors.text }]}>I accept the community guidelines</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.button, { backgroundColor: accepted ? colors.primary : colors.border }]}
        onPress={handleFinish}
        disabled={!accepted || loading}
      >
        <Text style={styles.buttonText}>{loading ? 'Finishing...' : 'Finish'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
  },
  summaryBox: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
  },
  summaryText: {
    fontSize: 16,
    marginBottom: 8,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderRadius: 6,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxLabel: {
    fontSize: 16,
  },
  button: {
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
}); 