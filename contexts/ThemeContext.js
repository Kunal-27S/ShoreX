import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, firestore } from '../firebaseConfig';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const [darkMode, setDarkMode] = useState(true); // Default to dark mode
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  // Listen to auth state changes
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setUser(user);
    });

    return () => unsubscribeAuth();
  }, []);

  // Load theme from Firebase when user changes
  useEffect(() => {
    let unsubscribe;
    
    if (user) {
      const userDocRef = doc(firestore, 'users', user.uid);
      unsubscribe = onSnapshot(userDocRef, async (userDoc) => {
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const themeValue = userData.settings?.theme;
          
          if (themeValue === 'dark' || themeValue === 'light') {
            setDarkMode(themeValue === 'dark');
          } else {
            // Set default theme for existing users who don't have a valid string preference
            await setDoc(userDocRef, { settings: { theme: 'dark' } }, { merge: true });
            setDarkMode(true);
          }
        } else {
          // Create user document with default dark theme
          await setDoc(userDocRef, { settings: { theme: 'dark' } });
        }
        setLoading(false);
      }, (error) => {
        console.error('Error listening to theme:', error);
        setDarkMode(true);
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
    
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user]); // Changed dependency to user instead of auth.currentUser

  const toggleTheme = async () => {
    const newTheme = !darkMode;
    setDarkMode(newTheme);

    if (user) {
      try {
        const userDocRef = doc(firestore, 'users', user.uid);
        await setDoc(userDocRef, { 
          settings: { theme: newTheme ? 'dark' : 'light' } 
        }, { merge: true });
      } catch (error) {
        console.error('Error saving theme:', error);
      }
    }
  };

  const theme = {
    darkMode,
    toggleTheme,
    loading,
    colors: darkMode ? {
      // Dark theme colors
      background: '#121212',
      surface: '#232323',
      primary: '#4A6FFF',
      secondary: '#666',
      text: '#fff',
      textSecondary: '#ccc',
      textTertiary: '#aaa',
      border: '#333',
      error: '#FF3B30',
      success: '#34C759',
      warning: '#FF9500',
      info: '#4A6FFF',
      card: '#232323',
      input: '#232323',
      placeholder: '#666',
      switchTrack: { false: '#767577', true: '#4A6FFF' },
      switchThumb: { false: '#f4f3f4', true: '#fff' }
    } : {
      // Light theme colors
      background: '#f5f5f5',
      surface: '#ffffff',
      primary: '#4A6FFF',
      secondary: '#666',
      text: '#000000',
      textSecondary: '#666',
      textTertiary: '#999',
      border: '#e0e0e0',
      error: '#FF3B30',
      success: '#34C759',
      warning: '#FF9500',
      info: '#4A6FFF',
      card: '#ffffff',
      input: '#ffffff',
      placeholder: '#999',
      switchTrack: { false: '#767577', true: '#4A6FFF' },
      switchThumb: { false: '#f4f3f4', true: '#fff' }
    }
  };

  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
};