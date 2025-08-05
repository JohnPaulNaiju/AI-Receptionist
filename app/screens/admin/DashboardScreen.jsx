import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, ActivityIndicator, RefreshControl, Alert, ToastAndroid } from 'react-native';
import { View, Text, Colors, Card, Button, TouchableOpacity } from 'react-native-ui-lib';
import { collection, getDocs } from 'firebase/firestore';
import { auth, db, formatCurrency } from '../../utils';
import { Icon } from '../../components';
import { useNavigation } from '@react-navigation/native';

const DashboardScreen = () => {

    const navigation = useNavigation();

    const [stats, setStats] = useState({
        totalRooms: 0,
        availableRooms: 0,
        bookedRooms: 0,
        totalBookings: 0,
        pendingBookings: 0,
        totalComplaints: 0,
        openComplaints: 0,
        revenue: 0
    });
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchDashboardData = async () => {
        try {
        setLoading(true);
        
        // Get rooms data
        const roomsSnapshot = await getDocs(collection(db, 'rooms'));
        const roomsData = roomsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        const availableRooms = roomsData.filter(room => room.status === 'available').length;
        const bookedRooms = roomsData.filter(room => room.status === 'booked').length;
        
        // Get bookings data
        const bookingsSnapshot = await getDocs(collection(db, 'bookings'));
        const bookingsData = bookingsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        // Count only pending bookings (not including confirmed)
        const pendingBookings = bookingsData.filter(booking => 
            booking.status === 'pending'
        ).length;
        
        // Calculate revenue from completed bookings
        const revenue = bookingsData
            .filter(booking => booking.status === 'completed' || booking.status === 'confirmed')
            .reduce((total, booking) => total + (booking.totalPrice || 0), 0);
        
        // Get complaints data
        const complaintsSnapshot = await getDocs(collection(db, 'complaints'));
        const complaintsData = complaintsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        const openComplaints = complaintsData.filter(complaint => 
            complaint.status === 'open' || complaint.status === 'in-progress'
        ).length;
        
        setStats({
            totalRooms: roomsData.length,
            availableRooms,
            bookedRooms,
            totalBookings: bookingsData.length,
            pendingBookings,
            totalComplaints: complaintsData.length,
            openComplaints,
            revenue
        });
        } catch (error) {
        console.log('Error fetching dashboard data:', error);
        } finally {
        setLoading(false);
        setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        fetchDashboardData();
    };

    const StatCard = ({ title, value, icon, color, onPress }) => (
        <Card flex center padding-12 marginB-15 marginR-10 style={styles.statCard} onPress={onPress}>
            <View flex center>
                <Icon name={icon} type="ion" size={24} color={color} marginB-10 />
                <Text center text70 marginB-5 style={{ color }}>{title}</Text>
                <Text center text50 bold style={{ color }}>{value}</Text>
            </View>
        </Card>
    );

    const logout = () => {
        Alert.alert('Logout', 'Are you sure you want to logout?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Logout',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await auth.signOut();
                    } catch (error) {
                        ToastAndroid.show('Error logging out', ToastAndroid.SHORT);
                        console.log('Error logging out:', error);
                    }
                }
            }
        ]);
    };

    if (loading && !refreshing) {
        return (
            <View flex center useSafeArea>
                <ActivityIndicator size="large" color={Colors.blue} />
            </View>
        );
    }

    return (

        <View flex useSafeArea>

            <View row spread>
                <Text text50 marginT-60 marginL-16 marginB-16 text1>Admin Dashboard</Text>
                <TouchableOpacity marginT-60 marginR-16 marginB-16 onPress={logout}>
                    <Icon name='logout' color={Colors.red}/>
                </TouchableOpacity>
            </View>
    
            <ScrollView  style={{ flex: 1, backgroundColor: Colors.bg2 }} contentContainerStyle={{ padding: 15 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>

            <Card padding-20 marginB-20 style={styles.revenueCard}>
                <Text text70 marginB-5 style={styles.revenueTitle}>Total Revenue</Text>
                <Text text40 bold style={styles.revenueAmount}>{formatCurrency(stats.revenue)}</Text>
            </Card>

            <Text text60 marginB-10 style={styles.sectionTitle}>Rooms</Text>
            <View row marginB-20>
                <StatCard 
                title="Rooms" 
                value={stats.totalRooms} 
                icon="bed" 
                color="#4A6572" 
                onPress={() => navigation.navigate('ManageRooms', { title: 'All Rooms' })}
                />
                <StatCard 
                title="Available" 
                value={stats.availableRooms} 
                icon="checkmark-circle" 
                color="#66BB6A" 
                onPress={() => navigation.navigate('ManageRooms', { title: 'Available Rooms', filterStatus: 'available' })}
                />
                <StatCard 
                title="Booked" 
                value={stats.bookedRooms} 
                icon="close-circle" 
                color="#EF5350" 
                onPress={() => navigation.navigate('ManageRooms', { title: 'Booked Rooms', filterStatus: 'booked' })}
                />
            </View>

            <Text text60 marginB-10 style={styles.sectionTitle}>Bookings</Text>
            <View row marginB-20>
                <StatCard 
                title="Bookings" 
                value={stats.totalBookings} 
                icon="calendar" 
                color="#4A6572" 
                onPress={() => navigation.navigate('Bookings', { title: 'All Bookings', filterStatus: 'all' })}/>
                <StatCard 
                title="Pending" 
                value={stats.pendingBookings} 
                icon="time" 
                color="#FFA726" 
                onPress={() => navigation.navigate('Bookings', { title: 'Pending Bookings', filterStatus: 'pending' })}/>
            </View>

            <Text text60 marginB-10 style={styles.sectionTitle}>Complaints</Text>
            <View row marginB-20>
                <StatCard 
                title="Complaints" 
                value={stats.totalComplaints} 
                icon="chatbox" 
                color="#4A6572" 
                onPress={() => navigation.navigate('Complaints', { title: 'All Complaints', filterStatus: 'all' })}/>
                <StatCard 
                title="Open" 
                value={stats.openComplaints} 
                icon="alert-circle" 
                color="#EF5350" 
                onPress={() => navigation.navigate('Complaints', { title: 'Open Complaints', filterStatus: 'open' })}/>
            </View>

            <Text text60 marginB-10 style={styles.sectionTitle}>Quick Actions</Text>
            <View marginB-20>
                <Button 
                label="Add New Room" 
                backgroundColor={Colors.blue} 
                style={styles.actionButton}
                onPress={() => navigation.navigate('AddEditRoom')}/>
                <Button 
                marginT-16
                outline
                blue
                outlineColor={Colors.blue}
                label="View All Bookings" 
                backgroundColor={Colors.white} 
                style={styles.actionButton}
                onPress={() => navigation.navigate('Bookings', { title: 'All Bookings', filterStatus: 'all' })}/>
            </View>
            </ScrollView>
        </View>

    );

};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg2,
  },
  contentContainer: {
    padding: 15,
  },
  header: {
    color: Colors.text,
    fontWeight: 'bold',
  },
  revenueCard: {
    backgroundColor: Colors.blue,
    borderRadius: 10,
  },
  revenueTitle: {
    color: 'white',
    opacity: 0.8,
  },
  revenueAmount: {
    color: 'white',
  },
  sectionTitle: {
    color: Colors.text,
    fontWeight: 'bold',
  },
  statCard: {
    borderRadius: 10,
    flex: 1,
    maxWidth: '33%',
  },
  actionButton: {
    flex: 1,
    marginRight: 10,
    borderRadius: 8,
  },
});

export default DashboardScreen;
