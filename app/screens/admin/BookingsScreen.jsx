import React, { useState, useEffect } from 'react';
import { StyleSheet, FlatList, Alert, ActivityIndicator, ScrollView, RefreshControl } from 'react-native';
import { View, Text, Colors, Card, Button, Chip } from 'react-native-ui-lib';
import { collection, getDocs, doc, updateDoc, query, orderBy, where, getDoc, deleteDoc, addDoc } from 'firebase/firestore';
import { db, formatCurrency, formatDate } from '../../utils';
import { Icon } from '../../components';

const BookingsScreen = () => {

    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState('all');
    const [refreshing, setRefreshing] = useState(false);

    const fetchBookings = async () => {
        try {
        setLoading(true);
        const bookingsQuery = query(collection(db, 'bookings'), orderBy('createdAt', 'desc'));
        const bookingsSnapshot = await getDocs(bookingsQuery);
        
        // Get all bookings
        let bookingsData = bookingsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        // Get room details for each booking
        const roomPromises = bookingsData.map(async (booking) => {
            try {
            // Get user details
            const userQuery = query(collection(db, 'users'), where('uid', '==', booking.userId));
            const userSnapshot = await getDocs(userQuery);
            const userData = !userSnapshot.empty ? userSnapshot.docs[0].data() : null;
            
            // Get room details
            const roomDoc = await getDoc(doc(db, 'rooms', booking.roomId));
            const roomData = roomDoc.exists() ? roomDoc.data() : null;
            
            return {
                ...booking,
                roomName: roomData ? roomData.name : 'Unknown Room',
                roomImage: roomData && roomData.images && roomData.images.length > 0 ? 
                roomData.images[0] : 'https://via.placeholder.com/100',
                userName: userData ? userData.name : 'Unknown User'
            };
            } catch (error) {
            console.log('Error fetching booking details:', error);
            return booking;
            }
        });
        
        const enrichedBookings = await Promise.all(roomPromises);
        setBookings(enrichedBookings);
        } catch (error) {
        console.log('Error fetching bookings:', error);
        Alert.alert('Error', 'Failed to load bookings. Please try again.');
        } finally {
        setLoading(false);
        }
    };

    useEffect(() => {
        fetchBookings();
    }, []);
    
    // Handle pull-to-refresh
    const onRefresh = React.useCallback(async () => {
        setRefreshing(true);
        try {
            await fetchBookings();
        } catch (error) {
            console.error('Error refreshing bookings:', error);
        } finally {
            setRefreshing(false);
        }
    }, [filterStatus]);

    const getStatusColor = (status) => {
        switch (status) {
        case 'pending': return Colors.orange40;
        case 'confirmed': return Colors.blue;
        case 'checked-in': return Colors.green;
        case 'completed': return Colors.purple;
        case 'cancelled': return Colors.red;
        default: return Colors.grey;
        }
    };

    const getStatusLabel = (status) => {
        switch (status) {
        case 'pending': return 'Pending';
        case 'confirmed': return 'Confirmed';
        case 'checked-in': return 'Checked In';
        case 'completed': return 'Completed';
        case 'cancelled': return 'Cancelled';
        default: return 'Unknown';
        }
    };

    const updateBookingStatus = async (bookingId, roomId, newStatus) => {
        try {
            setLoading(true);
            
            // Get the booking details first to use for notifications
            const bookingRef = doc(db, 'bookings', bookingId);
            const bookingSnap = await getDoc(bookingRef);
            const bookingData = bookingSnap.exists() ? bookingSnap.data() : null;
            
            // Update booking status
            await updateDoc(bookingRef, {
                status: newStatus,
                updatedAt: new Date().toISOString()
            });
            
            // Update room status based on booking status
            if (newStatus === 'cancelled') {
                await updateDoc(doc(db, 'rooms', roomId), {
                    status: 'available',
                    updatedAt: new Date().toISOString()
                });
            }
            if (newStatus === 'checked-in') {
                await updateDoc(doc(db, 'rooms', roomId), {
                    status: 'occupied',
                    updatedAt: new Date().toISOString()
                });
            }
            if (newStatus === 'completed') {
                await updateDoc(doc(db, 'rooms', roomId), {
                    status: 'available',
                    updatedAt: new Date().toISOString()
                });
            }
            
            // Create notification for user if booking is confirmed, checked-in, or completed
            if (['confirmed', 'checked-in', 'completed'].includes(newStatus) && bookingData && bookingData.userId) {
                let title = '';
                let message = '';
                
                switch(newStatus) {
                    case 'confirmed':
                        title = 'Booking Confirmed';
                        message = `Your booking for ${bookingData.roomName || 'a room'} has been confirmed.`;
                        break;
                    case 'checked-in':
                        title = 'Check-in Completed';
                        message = `You have been checked in to ${bookingData.roomName || 'your room'}. Enjoy your stay!`;
                        break;
                    case 'completed':
                        title = 'Stay Completed';
                        message = `Your stay at ${bookingData.roomName || 'our hotel'} has been marked as completed. We hope you enjoyed your stay!`;
                        break;
                }
                
                // Create notification in Firestore
                const notificationData = {
                    userId: bookingData.userId,
                    title,
                    message,
                    type: 'booking',
                    referenceId: bookingId,
                    read: false,
                    createdAt: new Date().toISOString()
                };
                
                await addDoc(collection(db, 'notifications'), notificationData);
            }
            
            Alert.alert('Success', `Booking status updated to ${getStatusLabel(newStatus)}`);
            fetchBookings();
        } catch(error) {
            console.log('Error updating booking status:', error);
            Alert.alert('Error', 'Failed to update booking status. Please try again.');
        } finally {
            setLoading(false);
        }
    };
    
    const deleteBooking = async (bookingId, roomId) => {
        Alert.alert(
            'Delete Booking',
            'Are you sure you want to delete this booking? This action cannot be undone.',
            [
                {
                    text: 'Cancel',
                    style: 'cancel'
                },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setLoading(true);
                            
                            // Get the booking to check its status
                            const bookingRef = doc(db, 'bookings', bookingId);
                            const bookingSnap = await getDoc(bookingRef);
                            
                            if (bookingSnap.exists()) {
                                const bookingData = bookingSnap.data();
                                
                                // If the booking is checked-in or confirmed, make the room available again
                                if (['checked-in', 'confirmed'].includes(bookingData.status)) {
                                    await updateDoc(doc(db, 'rooms', roomId), {
                                        status: 'available',
                                        updatedAt: new Date().toISOString()
                                    });
                                }
                                
                                // Create a notification for the user
                                const notificationData = {
                                    userId: bookingData.userId,
                                    title: 'Booking Deleted',
                                    message: `Your booking for ${bookingData.roomName || 'a room'} has been deleted by the admin.`,
                                    type: 'booking',
                                    referenceId: bookingId,
                                    read: false,
                                    createdAt: new Date().toISOString()
                                };
                                
                                // Add the notification to Firestore
                                await addDoc(collection(db, 'notifications'), notificationData);
                                
                                // Delete the booking
                                await deleteDoc(bookingRef);
                                
                                Alert.alert('Success', 'Booking has been deleted successfully');
                                fetchBookings();
                            }
                        } catch (error) {
                            console.log('Error deleting booking:', error);
                            Alert.alert('Error', 'Failed to delete booking. Please try again.');
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    const handleStatusChange = (bookingId, roomId, currentStatus) => {
        const statusOptions = [];
        switch (currentStatus) {
            case 'pending':
                statusOptions.push(
                    { label: 'Confirm', value: 'confirmed' },
                    { label: 'Cancel', value: 'cancelled' }
                );
                break;
            case 'confirmed':
                statusOptions.push(
                    { label: 'Check In', value: 'checked-in' },
                    { label: 'Cancel', value: 'cancelled' }
                );
                break;
            case 'checked-in':
                statusOptions.push(
                    { label: 'Complete', value: 'completed' }
                );
                break;
            default:
                Alert.alert('Info', 'No status changes available for this booking.');
                return;
        }
        Alert.alert(
        'Update Booking Status',
        'Select new status:',
        [
            ...statusOptions.map(option => ({
                text: option.label,
                onPress: () => updateBookingStatus(bookingId, roomId, option.value)
            })),
            { text: 'Cancel', style: 'cancel' }
        ]
        );
    };

    const calculateNights = (checkInDate, checkOutDate) => {
        if (!checkInDate || !checkOutDate) return 0;
        
        const checkIn = new Date(checkInDate);
        const checkOut = new Date(checkOutDate);
        
        // Calculate the difference in milliseconds
        const diffTime = Math.abs(checkOut - checkIn);
        
        // Convert to days
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        return diffDays;
    };

    const filteredBookings = filterStatus === 'all' ? bookings : bookings.filter(booking => booking.status === filterStatus);

    const renderBookingItem = ({ item }) => (
        <Card style={styles.bookingCard} marginB-15>
            <View padding-15>
                <View row spread centerV marginB-10>
                    <Text text70 bold>{item.roomName}</Text>
                    <Chip 
                    label={getStatusLabel(item.status)}
                    labelStyle={{ color: 'white' }}
                    containerStyle={{ backgroundColor: getStatusColor(item.status), borderWidth: 0 }}/>
                </View>

                <View row marginB-10>
                    <View flex>
                        <Text text80 grey30>Guest</Text>
                        <Text text80>{item.userName}</Text>
                    </View>
                    <View flex>
                        <Text text80 grey30>Booking ID</Text>
                        <Text text80>{item.id.substring(0, 8)}</Text>
                    </View>
                </View>
                
                <View row marginB-10>
                    <View flex>
                        <Text text80 grey30>Check In</Text>
                        <Text text80>{formatDate(item.checkInDate)}</Text>
                    </View>
                    <View flex>
                        <Text text80 grey30>Check Out</Text>
                        <Text text80>{formatDate(item.checkOutDate)}</Text>
                    </View>
                </View>

                <View row spread centerV marginB-10>
                    <Text text70 bold>{formatCurrency(item.totalPrice)}</Text>
                    <Text text80 grey30>{calculateNights(item.checkInDate, item.checkOutDate)} night{calculateNights(item.checkInDate, item.checkOutDate) !== 1 ? 's' : ''}</Text>
                </View>

                <View row spread marginT-10>
                    {item.status !== 'completed' && item.status !== 'cancelled' && (
                        <Button 
                            label="Update Status" 
                            size="small"
                            backgroundColor={Colors.blue}
                            onPress={() => handleStatusChange(item.id, item.roomId, item.status)}
                            style={{flex: 1, marginRight: 10}}
                        />
                    )}
                    <Button 
                        label="Delete" 
                        size="small" 
                        backgroundColor={Colors.red30}
                        onPress={() => deleteBooking(item.id, item.roomId)}
                        style={{flex: item.status !== 'completed' && item.status !== 'cancelled' ? 1 : 0}}
                    />
                </View>
            </View>
        </Card>

    );

    const renderFilterChips = () => (
        <View width='100%' height={60} bg-bg1 centerV paddingB-22>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <Chip 
                label="All"
                labelStyle={{ color: filterStatus === 'all' ? 'white' : Colors.blue }}
                containerStyle={{
                    backgroundColor: filterStatus === 'all' ? Colors.blue : 'white',
                    marginLeft: 16,
                    borderWidth: 1,
                    borderColor: Colors.blue
                }}
                onPress={() => setFilterStatus('all')}/>
                <Chip 
                label="Pending"
                labelStyle={{ color: filterStatus === 'pending' ? 'white' : Colors.orange40 }}
                containerStyle={{
                    backgroundColor: filterStatus === 'pending' ? Colors.orange40 : 'white',
                    marginLeft: 8,
                    borderWidth: 1,
                    borderColor: Colors.orange40
                }}
                onPress={() => setFilterStatus('pending')}/>
                <Chip 
                label="Confirmed"
                labelStyle={{ color: filterStatus === 'confirmed' ? 'white' : Colors.blue }}
                containerStyle={{
                    backgroundColor: filterStatus === 'confirmed' ? Colors.blue : 'white',
                    marginLeft: 8,
                    borderWidth: 1,
                    borderColor: Colors.blue
                }}
                onPress={() => setFilterStatus('confirmed')}/>
                <Chip 
                label="Checked In"
                labelStyle={{ color: filterStatus === 'checked-in' ? 'white' : Colors.green }}
                containerStyle={{
                    backgroundColor: filterStatus === 'checked-in' ? Colors.green : 'white',
                    marginLeft: 8,
                    borderWidth: 1,
                    borderColor: Colors.green
                }}
                onPress={() => setFilterStatus('checked-in')}/>
                <Chip 
                label="Completed"
                labelStyle={{ color: filterStatus === 'completed' ? 'white' : Colors.purple40 }}
                containerStyle={{
                    backgroundColor: filterStatus === 'completed' ? Colors.purple40 : 'white',
                    marginLeft: 8,
                    borderWidth: 1,
                    borderColor: Colors.purple40
                }}
                onPress={() => setFilterStatus('completed')}/>
                <Chip 
                label="Cancelled"
                labelStyle={{ color: filterStatus === 'cancelled' ? 'white' : Colors.red }}
                containerStyle={{
                    backgroundColor: filterStatus === 'cancelled' ? Colors.red : 'white',
                    marginRight: 8,
                    marginLeft: 8,
                    borderWidth: 1,
                    borderColor: Colors.red
                }}
                onPress={() => setFilterStatus('cancelled')}/>
            </ScrollView>
        </View>
    );

    if (loading && bookings.length === 0) {
        return (
            <View flex center>
                <ActivityIndicator size="large" color={Colors.blue} />
            </View>
        );
    };

    return (

        <View flex useSafeArea bg-bg1 paddingT-46>
            {renderFilterChips()}
            <View flex bg-bg2>
                <FlatList
                data={filteredBookings}
                renderItem={renderBookingItem}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={[Colors.blue]}
                        tintColor={Colors.blue}
                        title="Refreshing bookings..."
                        titleColor={Colors.text1}
                    />
                }
                ListEmptyComponent={
                <View flex center padding-20>
                    <Icon name="calendar-outline" type="ion" size={50} color={Colors.grey30} marginB-10 />
                    <Text text70 center>No bookings found</Text>
                    {filterStatus !== 'all' && (<Text text80 center marginT-10>Try changing the filter</Text>)}
                </View>
                }/>
            </View>
        </View>

    );

};

const styles = StyleSheet.create({
    listContent: {
        padding: 15,
    },
    bookingCard: {
        borderRadius: 10,
    },
});

export default BookingsScreen;
