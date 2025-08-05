import React from 'react';
import Icon from './Icon';
import { View, Colors } from 'react-native-ui-lib';
import { Dimensions, ActivityIndicator, TextInput, Platform } from 'react-native';

const isAndroid = Platform.OS === 'android';

const { width } = Dimensions.get('window');
const cw =  width*0.92;

const Input = React.forwardRef((props, ref) => {

    const { bgColor, multiline = false, value, returnKeyType, onSubmit, maxLength, search = false, readonly, placeholder, onChange, valid = false, notValid = false, loading = false, secure = false, autoFocus, keyboardType, cursorColor = Colors.blue, w, right, left, onFocus, onBlur, placeholderTextColor, color, ...rest } = props;

    const searchview = React.useMemo(() => (
        search?
        <View top width={60} height='100%'>
            <View center width={60} height={50}>
                <Icon name='search' type='feather' color={Colors.text1}/>
            </View>
        </View>:null
    ), []);

    const textview = React.useMemo(() => (
        <View flex centerV marginH-16 marginV-4={multiline} style={{ position: 'relative' }}>
            <TextInput 
            ref={ref} 
            value={value} 
            onBlur={onBlur}
            onFocus={onFocus}
            readonly={readonly} 
            autoCapitalize='none' 
            multiline={multiline} 
            autoFocus={autoFocus} 
            maxLength={maxLength} 
            onChangeText={onChange} 
            cursorColor={cursorColor} 
            secureTextEntry={secure}
            placeholder={placeholder} 
            onSubmitEditing={onSubmit} 
            textAlignVertical='center' 
            keyboardType={keyboardType} 
            returnKeyType={returnKeyType} 
            selectionHandleColor={Colors.blue} 
            keyboardAppearance={Colors.getScheme()}
            placeholderTextColor={placeholderTextColor || Colors.text2} 
            selectionColor={isAndroid ? Colors.selection : Colors.blue} 
            style={{ width: '100%', zIndex: 99, color: color || Colors.text1, fontSize: 16, textAlignVertical: 'center', paddingBottom: 0, paddingTop: 0 }}/>
            {readonly ? <View flex absH absV style={{ zIndex: 100 }}/> : null}
        </View>
    ), [value, secure]);

    const loadingview = React.useMemo(() => (
        loading?
        <View top width={60} height='100%'>
            <View center width={60} height={50}>
                <ActivityIndicator size='small' color={Colors.icon}/>
            </View>
        </View>:null
    ), [loading]);

    const validview = React.useMemo(() => (
        valid?
        <View top width={60} height='100%'>
            <View center width={60} height={50}>
                <Icon name='check-circle' type='feather' color={Colors.text1}/>
            </View>
        </View>:null
    ), [valid]);

    const notvalidview = React.useMemo(() => (
        notValid?
        <View top width={60} height='100%'>
            <View center width={60} height={50}>
                <Icon name='x-circle' type='feather' color={Colors.text1}/>
            </View>
        </View>:null
    ), [notValid]);

    const rightview = React.useMemo(() => right ? right : null, [right]);
    const leftview = React.useMemo(() => left ? left : null, [left]);

    return (

        <View center width={w || width}>
            <View {...rest} row centerV br100 width={w || cw} maxHeight={multiline ? 74 : 50} minHeight={50} backgroundColor={bgColor || Colors.bg3} >
                {leftview}
                {searchview}
                {textview}
                {loadingview}
                {validview}
                {notvalidview}
                {rightview}
            </View>
        </View>

    );

});

export default React.memo(Input);