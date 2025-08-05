import React, { useState, useEffect } from 'react';
import { StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { View, Text, Colors, Card, Button } from 'react-native-ui-lib';
import { collection, query, where, getDocs, doc, updateDoc, orderBy } from 'firebase/firestore';
import { db, auth } from '../../utils';
import { formatDate } from '../../utils/models';
import { Icon } from '../../components';

const MyBookingsScreen = ({ navigation }) => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchBookings = async () => {
    if (!auth.currentUser) return;
    
    try {
      setLoading(true);
      const bookingsQuery = query(
        collection(db, 'bookings'),
        where('userId', '==', auth.currentUser.uid),
        orderBy('createdAt', 'desc')
      );
      
      const bookingsSnapshot = await getDocs(bookingsQuery);
      const bookingsData = bookingsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setBookings(bookingsData);
    } catch (error) {
      console.log('Error fetching bookings:', error);
      Alert.alert('Error', 'Failed to load your bookings');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchBookings();
    
    // Refresh bookings when the screen comes into focus
    const unsubscribe = navigation.addListener('focus', () => {
      fetchBookings();
    });
    
    return unsubscribe;
  }, [navigation]);
  
  // Handle pull-to-refresh
  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    fetchBookings();
  }, []);

  const handleCancelBooking = async (bookingId, roomId) => {
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
              setLoading(true);
              
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
              
              // Refresh bookings list
              fetchBookings();
              
              Alert.alert('Success', 'Your booking has been cancelled');
            } catch (error) {
              console.log('Error cancelling booking:', error);
              Alert.alert('Error', 'Failed to cancel booking. Please try again.');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const getStatusColor = (status) => {
    switch(status.toLowerCase()) {
      case 'confirmed': return Colors.green30;
      case 'pending': return Colors.orange30;
      case 'cancelled': return Colors.red30;
      case 'completed': return Colors.blue30;
      default: return Colors.grey30;
    }
  };

  const renderBookingItem = ({ item }) => (
    <Card style={styles.bookingCard}>
      <View padding-15>
        <View row spread marginB-10>
          <Text text70 bold>{item.roomName}</Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
            <Text white text90 capitalize>{item.status}</Text>
          </View>
        </View>
        
        <View row marginB-10>
          <View flex>
            <Text text90 grey30>Check-in</Text>
            <Text text80>{formatDate(item.checkInDate)}</Text>
          </View>
          <View flex>
            <Text text90 grey30>Check-out</Text>
            <Text text80>{formatDate(item.checkOutDate)}</Text>
          </View>
        </View>
        
        <View row spread marginB-15>
          <View row centerV>
            <Icon name="people" type="ion" size={18} color={Colors.grey30} />
            <Text text80 marginL-5>{item.guestCount} guests</Text>
          </View>
          <Text text70 blue bold>${item.totalPrice}</Text>
        </View>
        
        <View row>
          <Button
            label="View Details"
            link
            text70
            blue
            style={styles.button}
            onPress={() => navigation.navigate('BookingDetails', { bookingId: item.id })}
          />
          
          {item.status === 'pending' && (
            <Button
              label="Cancel"
              link
              text70
              red30
              style={styles.button}
              onPress={() => handleCancelBooking(item.id, item.roomId)}
            />
          )}
          
          {item.status === 'confirmed' && (
            <Button
              label="Register Complaint"
              link
              text70
              orange30
              style={styles.button}
              onPress={() => navigation.navigate('RegisterComplaint', { bookingId: item.id })}
            />
          )}
        </View>
      </View>
    </Card>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.blue} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={bookings}
        keyExtractor={(item) => item.id}
        renderItem={renderBookingItem}
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
          <View style={styles.emptyContainer}>
            <Icon name="calendar" type="ion" size={50} color={Colors.grey50} />
            <Text text70 grey30 center marginT-10>You don't have any bookings yet</Text>
            <Button
              label="Browse Rooms"
              outline
              blue
              marginT-20
              onPress={() => navigation.navigate('Home')}
            />
          </View>
        }
      />
    </View>
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
  },
  listContent: {
    paddingBottom: 20,
  },
  bookingCard: {
    marginBottom: 15,
    borderRadius: 10,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  button: {
    marginRight: 15,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    marginTop: 50,
  },
});

export default MyBookingsScreen;
