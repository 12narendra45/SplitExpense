import React, { useEffect, useState } from 'react';
import { StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import LoginScreen from './src/screens/LoginScreen';
import SignupScreen from './src/screens/SignupScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import AddExpenseScreen from './src/screens/AddExpenseScreen';
import CreateRoomScreen from './src/screens/CreateRoomScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import SplashScreen from './src/screens/SplashScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      initialRouteName="Dashboard"
      screenOptions={({ route }) => ({
        headerShown: true,
        headerStyle: {
          backgroundColor: '#ffffff',
          shadowColor: '#e2e8f0',
          shadowOpacity: 0.5,
          shadowRadius: 8,
          elevation: 2
        },
        headerTintColor: '#111827',
        headerTitleStyle: { color: '#111827', fontWeight: '800' },
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopColor: '#f1e8ff',
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 8,
          paddingTop: 6
        },
        tabBarLabelStyle: { fontWeight: '700', fontSize: 11 },
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'Dashboard') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'AddExpense') {
            iconName = focused ? 'add-circle' : 'add-circle-outline';
          } else if (route.name === 'CreateRoom') {
            iconName = focused ? 'people' : 'people-outline';
          } else if (route.name === 'History') {
            iconName = focused ? 'time' : 'time-outline';
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#a855f7',
        tabBarInactiveTintColor: '#64748b'
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="AddExpense" component={AddExpenseScreen} options={{ title: 'Add' }} />
      <Tab.Screen name="CreateRoom" component={CreateRoomScreen} options={{ title: 'Rooms' }} />
      <Tab.Screen name="History" component={HistoryScreen} options={{ title: 'History' }} />
    </Tab.Navigator>
  );
}

export default function App() {
  const [initialRoute, setInitialRoute] = useState('Login');
  const [initialParams, setInitialParams] = useState({});
  const [loading, setLoading] = useState(true);
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const storedUser = await SecureStore.getItemAsync('user');
        if (storedUser) {
          const user = JSON.parse(storedUser);
          setInitialRoute('Main');
          setInitialParams({ screen: 'Dashboard', params: { user, roomCode: user?.room_code || null } });
        }
      } catch (error) {
        console.log('Failed to load stored user', error.message);
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, []);

  if (loading) {
    return null;
  }

  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  return (
    <>
      <StatusBar backgroundColor="#ffffff" barStyle="dark-content" />
      <NavigationContainer>
        <Stack.Navigator initialRouteName={initialRoute}>
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Signup" component={SignupScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Main" component={MainTabs} initialParams={initialParams} options={{ headerShown: false }} />
        </Stack.Navigator>
      </NavigationContainer>
    </>
  );
}
