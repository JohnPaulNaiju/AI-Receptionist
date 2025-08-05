import React, { useState, useEffect } from 'react';
import { StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { View, Text, Colors } from 'react-native-ui-lib';
import { collection, query, where, getDocs, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../../utils';
import { Icon } from '../../components';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { RefreshControl } from 'react-native';

const NotificationsScreen = () => {
    const navigation = useNavigation();
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchNotifications = async () => {
        if (!auth.currentUser) {
            setNotifications([]);
            setLoading(false);
            setRefreshing(false);
            return;
        }

        try {
            setLoading(true);
            const notificationsRef = collection(db, 'notifications');
            const q = query(
                notificationsRef, 
                where('userId', '==', auth.currentUser.uid),
                orderBy('createdAt', 'desc')
            );
            const querySnapshot = await getDocs(q);

            const notificationsData = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt ? new Date(doc.data().createdAt) : new Date()
            }));

            setNotifications(notificationsData);
        } catch (error) {
            console.log('Error fetching notifications:', error);
            Alert.alert('Error', 'Failed to load notifications');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchNotifications();
    };

    // Fetch notifications when the screen comes into focus
    useFocusEffect(
        React.useCallback(() => {
            fetchNotifications();
            return () => {};
        }, [])
    );

    const markAsRead = async (notificationId) => {
        try {
            const notificationRef = doc(db, 'notifications', notificationId);
            await updateDoc(notificationRef, {
                read: true
            });
            
            // Update the local state
            setNotifications(prevNotifications => 
                prevNotifications.map(notification => 
                    notification.id === notificationId 
                        ? { ...notification, read: true } 
                        : notification
                )
            );
        } catch (error) {
            console.log('Error marking notification as read:', error);
        }
    };

    const handleNotificationPress = (notification) => {
        // Mark as read when pressed
        if (!notification.read) {
            markAsRead(notification.id);
        }

        // Navigate based on notification type
        switch (notification.type) {
            case 'booking':
                navigation.navigate('MainTabs', { 
                    screen: 'Bookings',
                    params: { bookingId: notification.referenceId }
                });
                break;
            case 'complaint':
                navigation.navigate('MyComplaints');
                break;
            case 'room':
                navigation.navigate('RoomDetails', { roomId: notification.referenceId });
                break;
            case 'general':
            default:
                // Just mark as read
                break;
        }
    };

    const getNotificationIcon = (type) => {
        switch (type) {
            case 'booking':
                return { name: 'calendar', color: Colors.blue };
            case 'complaint':
                return { name: 'warning', color: Colors.orange30 };
            case 'room':
                return { name: 'bed', color: Colors.green30 };
            case 'general':
            default:
                return { name: 'notifications', color: Colors.grey30 };
        }
    };

    const formatTimeAgo = (date) => {
        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);
        
        if (diffInSeconds < 60) {
            return 'Just now';
        }
        
        const diffInMinutes = Math.floor(diffInSeconds / 60);
        if (diffInMinutes < 60) {
            return `${diffInMinutes} ${diffInMinutes === 1 ? 'minute' : 'minutes'} ago`;
        }
        
        const diffInHours = Math.floor(diffInMinutes / 60);
        if (diffInHours < 24) {
            return `${diffInHours} ${diffInHours === 1 ? 'hour' : 'hours'} ago`;
        }
        
        const diffInDays = Math.floor(diffInHours / 24);
        if (diffInDays < 30) {
            return `${diffInDays} ${diffInDays === 1 ? 'day' : 'days'} ago`;
        }
        
        const diffInMonths = Math.floor(diffInDays / 30);
        return `${diffInMonths} ${diffInMonths === 1 ? 'month' : 'months'} ago`;
    };

    const renderNotificationItem = ({ item }) => (
        <TouchableOpacity 
            style={[styles.notificationItem, !item.read && styles.unreadNotification]}
            onPress={() => handleNotificationPress(item)}
        >
            <View style={[styles.iconContainer, { backgroundColor: getNotificationIcon(item.type).color + '20' }]}>
                <Icon 
                    name={getNotificationIcon(item.type).name} 
                    type="ion" 
                    size={20} 
                    color={getNotificationIcon(item.type).color} 
                />
            </View>
            <View style={styles.notificationContent}>
                <Text style={[styles.notificationTitle, !item.read && styles.unreadText]}>{item.title}</Text>
                <Text style={styles.notificationMessage}>{item.message}</Text>
                <Text style={styles.notificationTime}>{formatTimeAgo(item.createdAt)}</Text>
            </View>
            {!item.read && <View style={styles.unreadDot} />}
        </TouchableOpacity>
    );

    if (loading && !refreshing) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.blue} />
            </View>
        );
    }

    return (
        <View flex bg-bg2 useSafeArea paddingT-46 style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Notifications</Text>
            </View>

            <FlatList
                data={notifications}
                keyExtractor={(item) => item.id}
                renderItem={renderNotificationItem}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={[Colors.blue]}
                        tintColor={Colors.blue}
                    />
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Icon name="notifications-off" type="ion" size={50} color={Colors.grey50} />
                        <Text text70 grey30 center marginT-10>No notifications yet</Text>
                    </View>
                }
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 16,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: Colors.text,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        paddingBottom: 20,
    },
    notificationItem: {
        flexDirection: 'row',
        backgroundColor: Colors.white,
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        alignItems: 'center',
    },
    unreadNotification: {
        backgroundColor: Colors.blue + '10',
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    notificationContent: {
        flex: 1,
    },
    notificationTitle: {
        fontSize: 16,
        fontWeight: '500',
        marginBottom: 4,
    },
    unreadText: {
        fontWeight: 'bold',
    },
    notificationMessage: {
        fontSize: 14,
        color: Colors.grey30,
        marginBottom: 6,
    },
    notificationTime: {
        fontSize: 12,
        color: Colors.grey40,
    },
    unreadDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: Colors.blue,
        marginLeft: 8,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
    },
});

export default NotificationsScreen;
