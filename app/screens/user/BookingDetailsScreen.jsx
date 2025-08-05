import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { View, Text, Colors, Button, Card } from 'react-native-ui-lib';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../utils';
import { formatDate } from '../../utils/models';
import { useRoute, useNavigation } from '@react-navigation/native';

const BookingDetailsScreen = () => {

    const route = useRoute();
    const navigation = useNavigation();

    const { bookingId } = route.params;
    const [booking, setBooking] = useState(null);
    const [room, setRoom] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchBookingDetails = async () => {
            try {
                setLoading(true);
                const bookingDoc = await getDoc(doc(db, 'bookings', bookingId));
                if (bookingDoc.exists()) {
                    const bookingData = { id: bookingDoc.id, ...bookingDoc.data() };
                    setBooking(bookingData);
                    const roomDoc = await getDoc(doc(db, 'rooms', bookingData.roomId));
                    if (roomDoc.exists()) {
                        setRoom({ id: roomDoc.id, ...roomDoc.data() });
                    }
                }else{
                    Alert.alert('Error', 'Booking not found');
                    navigation.goBack();
                }
            }catch(error){
                console.log('Error fetching booking details:', error);
                Alert.alert('Error', 'Failed to load booking details');
            }finally{
                setLoading(false);
            }
        };
        fetchBookingDetails();
    }, [bookingId]);

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.blue} />
            </View>
        );
    }

    return (

        <View flex useSafeArea bg-bg2 paddingT-46 paddingH-16>
            <ScrollView style={{ flex: 1 }}>
                <Card style={styles.card}>
                    <View padding-20>
                        <Text text50 bold marginB-15>Booking Details</Text>
                
                        <View style={styles.sectionContainer}>
                            <Text text70 bold marginB-10>Room Information</Text>
                            <Text text80>{room?.name}</Text>
                            <Text text80 grey30 marginB-5>{room?.type} Room</Text>
                            <Text text80 grey30>Max Capacity: {room?.capacity} guests</Text>
                        </View>
                
                        <View style={styles.sectionContainer}>
                            <Text text70 bold marginB-10>Booking Information</Text>
                            <View row spread marginB-5>
                                <Text text80 grey30>Booking ID:</Text>
                                <Text text80>{booking.id}</Text>
                            </View>
                            <View row spread marginB-5>
                                <Text text80 grey30>Status:</Text>
                                <Text text80 style={{color: getStatusColor(booking.status)}} capitalize>{booking.status}</Text>
                            </View>
                            <View row spread marginB-5>
                                <Text text80 grey30>Payment Status:</Text>
                                <Text text80 style={{color: getPaymentStatusColor(booking.paymentStatus)}} capitalize>{booking.paymentStatus}</Text>
                            </View>
                        </View>
                
                        <View style={styles.sectionContainer}>
                            <Text text70 bold marginB-10>Stay Details</Text>
                            <View row marginB-10>
                                <View flex>
                                    <Text text80 grey30>Check-in</Text>
                                    <Text text80>{formatDate(booking.checkInDate)}</Text>
                                </View>
                                <View flex>
                                    <Text text80 grey30>Check-out</Text>
                                    <Text text80>{formatDate(booking.checkOutDate)}</Text>
                                </View>
                            </View>
                            <View row spread marginB-5>
                                <Text text80 grey30>Number of Guests:</Text>
                                <Text text80>{booking.guestCount}</Text>
                            </View>
                            <View row spread marginB-5>
                                <Text text80 grey30>Total Price:</Text>
                                <Text text70 blue bold>${booking.totalPrice}</Text>
                            </View>
                        </View>
                
                        <View style={styles.sectionContainer}>
                            <Text text70 bold marginB-10>Booking Timeline</Text>
                            <View row spread marginB-5>
                                <Text text80 grey30>Created:</Text>
                                <Text text80>{formatDate(booking.createdAt)}</Text>
                            </View>
                            {booking.updatedAt !== booking.createdAt && (
                            <View row spread marginB-5>
                                <Text text80 grey30>Last Updated:</Text>
                                <Text text80>{formatDate(booking.updatedAt)}</Text>
                            </View>
                            )}
                        </View>
                
                        {booking.status === 'pending' && (
                            <Button
                            label="Cancel Booking"
                            red
                            outline
                            outlineColor={Colors.red}
                            style={styles.cancelButton}
                            onPress={() => handleCancelBooking(booking.id, booking.roomId, navigation)}/>
                        )}
                    </View>
                </Card>
            </ScrollView>
        </View>

    );

};

const getStatusColor = (status) => {
    switch(status?.toLowerCase()) {
        case 'confirmed': return Colors.green30;
        case 'pending': return Colors.orange30;
        case 'cancelled': return Colors.red30;
        case 'completed': return Colors.blue30;
        default: return Colors.grey30;
    }
};

const getPaymentStatusColor = (status) => {
    switch(status?.toLowerCase()) {
        case 'paid': return Colors.green30;
        case 'pending': return Colors.orange30;
        case 'refunded': return Colors.blue30;
        case 'failed': return Colors.red30;
        default: return Colors.grey30;
    }
};

const handleCancelBooking = async (bookingId, roomId, navigation) => {
    Alert.alert(
        'Cancel Booking',
        'Are you sure you want to cancel this booking?',
        [
        { text: 'No', style: 'cancel' },
        { 
            text: 'Yes', 
            style: 'destructive',
            onPress: async () => {
            try {
                // Update booking status
                await updateDoc(doc(db, 'bookings', bookingId), {
                status: 'cancelled',
                updatedAt: new Date().toISOString(),
                });
                
                // Update room status back to available
                await updateDoc(doc(db, 'rooms', roomId), {
                status: 'available',
                updatedAt: new Date().toISOString(),
                });
                
                Alert.alert('Success', 'Your booking has been cancelled', [
                { text: 'OK', onPress: () => navigation.goBack() }
                ]);
            } catch (error) {
                console.log('Error cancelling booking:', error);
                Alert.alert('Error', 'Failed to cancel booking. Please try again.');
            }
            }
        }
        ]
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.bg2,
        padding: 15,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: Colors.bg2,
    },
    card: {
        marginBottom: 15,
        borderRadius: 10,
    },
    sectionContainer: {
        marginBottom: 20,
        paddingBottom: 15,
        borderBottomWidth: 1,
        borderBottomColor: Colors.grey70,
    },
    cancelButton: {
        marginTop: 10,
    },
});

export default BookingDetailsScreen;