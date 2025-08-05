import React, { useState, useEffect } from 'react';
import { StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator, Image } from 'react-native';
import { View, Text, Colors, Card, Button, FloatingButton } from 'react-native-ui-lib';
import { collection, getDocs, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db, formatCurrency } from '../../utils';
import { Icon } from '../../components';
import { useNavigation, useRoute } from '@react-navigation/native';

const ManageRoomsScreen = () => {

    const route = useRoute();
    const navigation = useNavigation();

    const [rooms, setRooms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState(route.params?.filterStatus || 'all');

    const fetchRooms = async () => {
        try {
        setLoading(true);
        const roomsSnapshot = await getDocs(collection(db, 'rooms'));
        const roomsData = roomsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        setRooms(roomsData);
        } catch (error) {
        console.log('Error fetching rooms:', error);
        Alert.alert('Error', 'Failed to load rooms. Please try again.');
        } finally {
        setLoading(false);
        }
    };

    useEffect(() => {
        fetchRooms();
        const unsubscribe = navigation.addListener('focus', () => {
            fetchRooms();
        });
        return unsubscribe;
    }, [navigation]);

    const handleDeleteRoom = (roomId, roomName) => {
        Alert.alert(
        'Delete Room',
        `Are you sure you want to delete ${roomName}?`,
        [
            { text: 'Cancel', style: 'cancel' },
            {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
                try {
                setLoading(true);
                await deleteDoc(doc(db, 'rooms', roomId));
                Alert.alert('Success', 'Room deleted successfully');
                fetchRooms();
                } catch (error) {
                console.log('Error deleting room:', error);
                Alert.alert('Error', 'Failed to delete room. Please try again.');
                } finally {
                setLoading(false);
                }
            }
            }
        ]
        );
    };

    const toggleRoomStatus = async (roomId, currentStatus) => {
        try {
        const newStatus = currentStatus === 'available' ? 'maintenance' : 'available';
        await updateDoc(doc(db, 'rooms', roomId), {
            status: newStatus,
            updatedAt: new Date().toISOString()
        });
        fetchRooms();
        } catch (error) {
        console.log('Error updating room status:', error);
        Alert.alert('Error', 'Failed to update room status. Please try again.');
        }
    };

    const filteredRooms = filterStatus === 'all'  ? rooms  : rooms.filter(room => room.status === filterStatus);

    const renderRoomItem = ({ item }) => {
        const isAvailable = item.status === 'available';
        const isBooked = item.status === 'booked';
        const isMaintenance = item.status === 'maintenance';
    
        let statusColor = '#66BB6A'; // green for available
        if (isBooked) statusColor = '#EF5350'; // red for booked
        if (isMaintenance) statusColor = '#FFA726'; // orange40 for maintenance

        return (

            <Card style={styles.roomCard} marginB-15>
                <View row>
                    <Image resizeMode='cover' source={{ uri: item.images && item.images.length > 0 ? item.images[0] : 'https://via.placeholder.com/100' }} style={styles.roomImage} />
                    <View flex padding-10>
                        <Text text70 text1 style={{ fontWeight: 'bold' }} numberOfLines={1}>{item.name}</Text>
                        <View row spread centerV marginT-6>
                            <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
                                <Text white text90>{isAvailable ? 'Available' : isBooked ? 'Booked' : 'Maintenance'}</Text>
                            </View>
                            <View flex/>
                        </View>

                        <Text text80 text2 marginT-5 numberOfLines={2}>{item.description}</Text>

                        <Text text70 text1 marginT-10 style={{ fontWeight: 'bold' }}>{formatCurrency(item.price)}<Text text90>/night</Text></Text>

                        <View row spread marginT-6>
                            <Text text80 text1 marginT-5>Capacity: {item.capacity}</Text>
                            <View row>
                                <TouchableOpacity onPress={() => navigation.navigate('AddEditRoom', { roomId: item.id })}>
                                    <View center width={32} height={26}>
                                        <Icon name='edit' type='feather' color={Colors.blue} size={20}/>
                                    </View>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => handleDeleteRoom(item.id, item.name)}>
                                    <View center width={32} height={26}>
                                        <Icon name='trash-2' type='feather' color={Colors.red} size={20}/>
                                    </View>
                                </TouchableOpacity>
                            </View>
                        </View>
                        {!isBooked && (
                        <Button 
                        marginT-10
                        label={isAvailable ? "Set Maintenance" : "Set Available"} 
                        size="small" 
                        bg-blue
                        backgroundColor={isAvailable ? Colors.orange40 : Colors.green} 
                        onPress={() => toggleRoomStatus(item.id, item.status)}/>
                        )}
                    </View>
                </View>
            </Card>

        );

    };

    if (loading && rooms.length === 0) {
        return (
            <View flex center>
                <ActivityIndicator size="large" color={Colors.blue} />
            </View>
        );
    }

    return (

        <View flex useSafeArea bg-bg2 paddingT-36>
            <FlatList
            data={rooms}
            renderItem={renderRoomItem}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
            <View center padding-20>
                <Icon name="bed-empty" type="material-community" size={50} color={Colors.grey30} marginB-10 />
                <Text text70 center>No rooms available</Text>
                <Text text80 center marginT-10>Add your first room by clicking the + button</Text>
            </View>
            }/>
            <FloatingButton
            visible={true}
            button={{
                label: 'Add Room',
                onPress: () => navigation.navigate('AddEditRoom'),
                backgroundColor: Colors.blue
            }}/>
        </View>

    );

};

const styles = StyleSheet.create({
    listContent: {
        padding: 15,
        paddingBottom: 80, 
    },
    roomCard: {
        borderRadius: 10,
        overflow: 'hidden',
    },
    roomImage: {
        width: 120,
        height: '100%',
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
});

export default ManageRoomsScreen;