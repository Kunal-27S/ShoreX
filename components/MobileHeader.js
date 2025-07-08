import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Drawer, Portal, Modal, FAB } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';

const menuItems = [
  { label: 'Home', icon: 'home', route: '/home' },
  { label: 'Explore', icon: 'explore', route: '/explore' },
  { label: 'Map', icon: 'map', route: '/mapview' },
  { label: 'Profile', icon: 'person', route: '/profile' },
];

export default function MobileHeader() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [bottomNav, setBottomNav] = useState(0);
  const router = useRouter();

  const handleMenuPress = () => setDrawerOpen(true);
  const handleDrawerClose = () => setDrawerOpen(false);
  const handleNav = (route, idx) => {
    setBottomNav(idx);
    setDrawerOpen(false);
    router.push(route);
  };

  return (
    <View>
      {/* Drawer Navigation (open via gesture or programmatically elsewhere if needed) */}
      <Portal>
        <Modal visible={drawerOpen} onDismiss={handleDrawerClose} contentContainerStyle={styles.drawerModal}>
          <Drawer.Section>
            {menuItems.map((item, idx) => (
              <Drawer.Item
                key={item.label}
                label={item.label}
                icon={({ size, color }) => (
                  <MaterialIcons name={item.icon} size={size} color={color} />
                )}
                active={bottomNav === idx}
                onPress={() => handleNav(item.route, idx)}
              />
            ))}
          </Drawer.Section>
        </Modal>
      </Portal>

      {/* Bottom Navigation */}
      <View style={styles.bottomNavWrap}>
        {menuItems.map((item, idx) => (
          <FAB
            key={item.label}
            small
            icon={({ size, color }) => (
              <MaterialIcons name={item.icon} size={size} color={color} />
            )}
            color={bottomNav === idx ? '#6200ee' : '#888'}
            style={styles.bottomNavIcon}
            onPress={() => handleNav(item.route, idx)}
          />
        ))}
      </View>

      {/* Floating Action Button for Create Post */}
      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => router.push('/createpost')}
        color="white"
        accessibilityLabel="Create Post"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  drawerModal: {
    backgroundColor: 'white',
    margin: 24,
    borderRadius: 12,
    paddingVertical: 8,
  },
  bottomNavWrap: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    height: 56,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
  },
  bottomNavIcon: {
    flex: 1,
    marginHorizontal: 2,
    backgroundColor: 'transparent',
    elevation: 0,
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 72,
    zIndex: 20,
    backgroundColor: '#6200ee',
  },
}); 