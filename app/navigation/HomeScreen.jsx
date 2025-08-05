import React from 'react';
import { Icon } from '../components';
import { Colors } from 'react-native-ui-lib';
import useScreenOptions from './useScreenOptions';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { HomeScreen as UserHomeScreen, MyBookingsScreen, ProfileScreen, BookmarksScreen, WishlistsScreen } from '../screens/user';

const Tab = createBottomTabNavigator();

export default function MainTabNavigator() {
    const screenOptions = useScreenOptions();

    const tabOptions = ({route}) => ({
        tabBarStyle: { 
            borderTopWidth: 0, 
            backgroundColor: Colors.bg2, 
            elevation: 0, 
            shadowOpacity: 0, 
        },
        tabBarHideOnKeyboard: true, 
        tabBarActiveTintColor: Colors.blue, 
        tabBarInactiveTintColor: Colors.icon,
        tabBarLabel: () => null,
        headerShown: true,
        headerStyle: {
            backgroundColor: Colors.bg2,
            elevation: 0,
            shadowOpacity: 0,
            borderBottomWidth: 0,
        },
        headerTitleStyle: {
            color: Colors.text,
            fontSize: 18,
            fontWeight: 'bold',
        },
        headerTintColor: Colors.blue,
        tabBarIcon: ({ focused, color, size }) => {
            focused ? size = 30 : size = 24;
            switch(route.name){
                case 'UserHome':
                    return <Icon name='house' type='font6' size={focused ? 27 : 24} color={color}/>;
                case 'Bookings':
                    return <Icon name='calendar' type='ion' size={size} color={color}/>;
                case 'Bookmarks':
                    return <Icon name='heart' type='ion' size={size} color={color}/>;
                case 'Wishlists':
                    return <Icon name='list' type='ion' size={size} color={color}/>;
                case 'Profile':
                    return <Icon name='person' type='ion' size={size} color={color}/>;
                default:
                    return null;
            }
        },
    });

    return (
        <Tab.Navigator initialRouteName='UserHome' screenOptions={tabOptions}>
            <Tab.Screen 
                name="UserHome" 
                component={UserHomeScreen} 
                options={{
                    headerShown: false,
                    title: 'Home'
                }}
            />
            <Tab.Screen 
                name="Bookings" 
                component={MyBookingsScreen} 
                options={{
                    headerTitle: () => <Text style={{ fontWeight: 'bold', fontSize: 18 }}>My Bookings</Text>
                }}
            />
            <Tab.Screen 
                name="Bookmarks" 
                component={BookmarksScreen} 
                options={{
                    headerShown: false,
                    headerTitle: () => <Text style={{ fontWeight: 'bold', fontSize: 18 }}>Favorites</Text>
                }}
            />
            <Tab.Screen 
                name="Wishlists" 
                component={WishlistsScreen} 
                options={{
                    headerShown: false,
                    headerTitle: () => <Text style={{ fontWeight: 'bold', fontSize: 18 }}>Wishlists</Text>
                }}
            />
            <Tab.Screen 
                name="Profile" 
                component={ProfileScreen} 
                options={{
                    headerTitle: () => <Text style={{ fontWeight: 'bold', fontSize: 18 }}>My Profile</Text>
                }}
            />
        </Tab.Navigator>
    );
};