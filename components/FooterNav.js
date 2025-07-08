import React from 'react';
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { useTheme } from '../contexts/ThemeContext';

const navOptions = [
  { label: 'Home', icon: 'home', route: '/home' },
  { label: 'Map', icon: 'map', route: '/mapview' },
  { label: 'Create', icon: 'add-circle-outline', route: '/createpost' },
  { label: 'Explore', icon: 'explore', route: '/explore' },
  { label: 'Profile', icon: 'person', route: '/profile' },
];

export default function FooterNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { colors } = useTheme();

  return (
    <View style={[styles.footer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
      {navOptions.map((opt) => {
        const isActive = pathname === opt.route;
        
        return (
          <TouchableOpacity
            key={opt.label}
            style={styles.navItem}
            onPress={() => router.push(opt.route)}
          >
            <MaterialIcons name={opt.icon} size={28} color={isActive ? colors.primary : colors.textSecondary} />
            <Text style={[styles.label, { color: isActive ? colors.primary : colors.textSecondary, fontWeight: isActive ? 'bold' : 'normal' }]}>{opt.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    height: 60,
    backgroundColor: '#181818',
    borderTopWidth: 1,
    borderTopColor: '#232323',
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  label: {
    fontSize: 12,
    color: '#aaa',
    marginTop: 2,
  },
  activeLabel: {
    color: '#4A6FFF',
    fontWeight: 'bold',
  },
}); 