import React, { useState, useEffect } from 'react';
import MainTabNavigator from './HomeScreen';
import AdminTabNavigator from './AdminScreen';
import { createStackNavigator } from '@react-navigation/stack';
import RoomDetailsScreen from '../screens/user/RoomDetailsScreen';
import RegisterComplaintScreen from '../screens/user/RegisterComplaintScreen';
import BookingDetailsScreen from '../screens/user/BookingDetailsScreen';
import WishlistDetailsScreen from '../screens/user/WishlistDetailsScreen';
import MyComplaintsScreen from '../screens/user/MyComplaintsScreen';
import EditProfileScreen from '../screens/user/EditProfileScreen';
import NotificationsScreen from '../screens/user/NotificationsScreen';
import AIReceptionistScreen from '../screens/user/AIReceptionistScreen';
import FoodScreen from '../screens/user/FoodScreen';
import AddEditRoomScreen from '../screens/admin/AddEditRoomScreen';
import BookingsScreen from '../screens/admin/BookingsScreen';
import ManageRoomsScreen from '../screens/admin/ManageRoomsScreen';
import ComplaintsScreen from '../screens/admin/ComplaintsScreen';
import { auth, db } from '../utils';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { View, Colors, Text } from 'react-native-ui-lib';
import { ActivityIndicator } from 'react-native';

const Stack = createStackNavigator();

const CustomHeader = ({ title }) => (
  <View useSafeArea center width='100%' height={80}>
    <Text text60 text1 margin-26>{title}</Text>
  </View>
);

export default function ScreenStack() {

    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkUserRole = async () => {
            try {
                if (auth.currentUser) {
                    const userQuery = query(
                        collection(db, 'users'),
                        where('uid', '==', auth.currentUser.uid)
                    );
                    
                    const userSnapshot = await getDocs(userQuery);
                    if (!userSnapshot.empty) {
                        const userData = userSnapshot.docs[0].data();
                        setIsAdmin(userData.role === 'admin');
                    }
                }
            } catch (error) {
                console.log('Error checking user role:', error);
            } finally {
                setLoading(false);
            }
        };

        checkUserRole();

        const unsubscribe = auth.onAuthStateChanged((user) => {
            if (user) {
                checkUserRole();
            } else {
                setIsAdmin(false);
                setLoading(false);
            }
        });

        return () => unsubscribe();

    }, []);

    const renderScreens = () => {
        if (isAdmin) {
            return (
                <>
                    <Stack.Screen 
                        name="MainTabs" 
                        component={AdminTabNavigator} 
                        options={{ headerShown: false }} 
                    />
                    <Stack.Screen 
                        name="AddEditRoom" 
                        component={AddEditRoomScreen} 
                        options={({ route }) => ({ 
                            header: () => <CustomHeader title={route.params?.roomId ? 'Edit Room' : 'Add New Room'} />
                        })}
                    />
                    <Stack.Screen 
                        name="Bookings" 
                        component={BookingsScreen} 
                        options={({ route }) => ({ 
                            header: () => <CustomHeader title={route.params?.title || 'All Bookings'} />
                        })}
                    />
                    <Stack.Screen 
                        name="ManageRooms" 
                        component={ManageRoomsScreen} 
                        options={({ route }) => ({ 
                            header: () => <CustomHeader title={route.params?.title || 'Manage Rooms'} />
                        })}
                    />
                    <Stack.Screen 
                        name="Complaints" 
                        component={ComplaintsScreen} 
                        options={({ route }) => ({ 
                            header: () => <CustomHeader title={route.params?.title || 'All Complaints'} />
                        })}
                    />
                </>
            );
        } else {
            return (
                <>
                    <Stack.Screen 
                        name="MainTabs" 
                        component={MainTabNavigator} 
                        options={{ headerShown: false }} 
                    />
                    <Stack.Screen 
                        name="RoomDetails" 
                        component={RoomDetailsScreen} 
                        options={{ 
                            header: () => <CustomHeader title='Room Details' />
                        }}
                    />
                    <Stack.Screen 
                        name="RegisterComplaint" 
                        component={RegisterComplaintScreen} 
                        options={{ 
                            header: () => <CustomHeader title='Register Complaint' />
                        }}
                    />
                    <Stack.Screen 
                        name="BookingDetails" 
                        component={BookingDetailsScreen} 
                        options={{ 
                            header: () => <CustomHeader title='Booking Details' />
                        }}
                    />
                    <Stack.Screen 
                        name="WishlistDetails" 
                        component={WishlistDetailsScreen} 
                        options={{ 
                            header: () => <CustomHeader title='Wishlist' />
                        }}
                    />
                    <Stack.Screen 
                        name="MyComplaints" 
                        component={MyComplaintsScreen} 
                        options={{ 
                            header: () => <CustomHeader title='My Complaints' />
                        }}
                    />
                    <Stack.Screen 
                        name="EditProfile" 
                        component={EditProfileScreen} 
                        options={{ 
                            header: () => <CustomHeader title='Edit Profile' />
                        }}
                    />
                    <Stack.Screen 
                        name="Notifications" 
                        component={NotificationsScreen} 
                        options={{ 
                            header: () => <CustomHeader title='Notifications' />
                        }}
                    />
                    <Stack.Screen 
                        name="AIReceptionist" 
                        component={AIReceptionistScreen} 
                        options={{ 
                            headerShown: false
                        }}
                    />
                    <Stack.Screen 
                        name="Food" 
                        component={FoodScreen} 
                        options={{ 
                            headerShown: false, 
                            header: () => <CustomHeader title='Food' />
                        }}
                    />
                </>
            );
        }
    };

    if (loading) {
        return (
            <View flex center>
                <ActivityIndicator size="large" color={Colors.blue} />
            </View>
        );
    }

    return (

        <Stack.Navigator initialRouteName="MainTabs" screenOptions={{ headerShown: false }}>
            {renderScreens()}
        </Stack.Navigator>

    );

};