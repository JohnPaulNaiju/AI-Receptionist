import React, { useState } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from 'react-native-ui-lib';
import { Text } from 'react-native-ui-lib';
import { View, TouchableOpacity } from 'react-native-ui-lib';

// Import admin screens directly
import DashboardScreen from '../screens/admin/DashboardScreen';
import ManageRoomsScreen from '../screens/admin/ManageRoomsScreen';
import BookingsScreen from '../screens/admin/BookingsScreen';
import ComplaintsScreen from '../screens/admin/ComplaintsScreen';
import ManageFoodScreen from '../screens/admin/ManageFoodScreen';

const CustomTabBar = ({ state, descriptors, navigation }) => {

    return (

        <View row height={60} spread bg-bg1>
            {state.routes.map((route, index) => {
                const { options } = descriptors[route.key];
                const label = options.tabBarLabel || options.title || route.name;
                const isFocused = state.index === index;

                let iconName;
                if (route.name === 'Dashboard') {
                    iconName = 'dashboard';
                } else if (route.name === 'ManageRooms') {
                    iconName = 'hotel';
                } else if (route.name === 'Bookings') {
                    iconName = 'event';
                } else if (route.name === 'Complaints') {
                    iconName = 'warning';
                } else if (route.name === 'Food') {
                    iconName = 'restaurant';
                }

                const onPress = () => {
                    const event = navigation.emit({
                        type: 'tabPress',
                        target: route.key,
                    });
                
                    if (!isFocused && !event.defaultPrevented) {
                        navigation.navigate(route.name);
                    }
                };

                return (

                    <TouchableOpacity
                    flex
                    paddingV-8
                    center
                    key={index}
                    accessibilityRole="button"
                    accessibilityState={isFocused ? { selected: true } : {}}
                    onPress={onPress}>
                        <MaterialIcons
                        name={iconName}
                        size={24}
                        color={isFocused ? Colors.blue : Colors.grey30}/>
                        <Text text90R marginT-2 style={{ color: isFocused ? Colors.blue : Colors.grey30 }}>
                            {label}
                        </Text>
                    </TouchableOpacity>

                );

            })}

        </View>

    );

};

const AdminTabNavigator = () => {

    const [activeTab, setActiveTab] = useState('Dashboard');

    const renderScreen = () => {
        switch (activeTab) {
        case 'Dashboard':
            return <DashboardScreen />;
        case 'ManageRooms':
            return <ManageRoomsScreen />;
        case 'Bookings':
            return <BookingsScreen />;
        case 'Complaints':
            return <ComplaintsScreen />;
        case 'Food':
            return <ManageFoodScreen />;
        default:
            return <DashboardScreen />;
        }
    };

    const navigationState = {
        index: ['Dashboard', 'ManageRooms', 'Bookings', 'Complaints', 'Food'].indexOf(activeTab),
        routes: [
            { key: 'Dashboard', name: 'Dashboard', params: {} },
            { key: 'ManageRooms', name: 'ManageRooms', params: {} },
            { key: 'Bookings', name: 'Bookings', params: {} },
            { key: 'Complaints', name: 'Complaints', params: {} },
            { key: 'Food', name: 'Food', params: {} }
        ]
    };

    const descriptors = {
        Dashboard: { options: { title: 'Dashboard' } },
        ManageRooms: { options: { title: 'Rooms' } },
        Bookings: { options: { title: 'Bookings' } },
        Complaints: { options: { title: 'Complaints' } },
        Food: { options: { title: 'Food' } }
    };

    const navigation = {
        emit: () => ({ defaultPrevented: false }),
        navigate: (name) => setActiveTab(name)
    };

    return (

        <View flex bg-white>
            {renderScreen()}
            <CustomTabBar 
            state={navigationState} 
            descriptors={descriptors}
            navigation={navigation}/>
        </View>

    );

};

export default AdminTabNavigator;