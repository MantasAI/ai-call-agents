import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabaseClient';

type ImageData = {
  uri: string;
  type: string;
  name: string;
};

type VerificationStatus = 'idle' | 'uploading' | 'verifying' | 'submitted' | 'failed';

export default function IDVerification() {
  const navigation = useNavigation();
  const [frontImage, setFrontImage] = useState<ImageData | null>(null);
  const [backImage, setBackImage] = useState<ImageData | null>(null);
  const [status, setStatus] = useState<VerificationStatus>('idle');
  const [loading, setLoading] = useState(false);

  const pickImage = async (side: 'front' | 'back') => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        
        if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
          Alert.alert('Error', 'Image size must be less than 5MB');
          return;
        }

        const imageData: ImageData = {
          uri: asset.uri,
          type: asset.type || 'image/jpeg',
          name: `${side}-id.jpg`,
        };

        if (side === 'front') {
          setFrontImage(imageData);
        } else {
          setBackImage(imageData);
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to select image');
    }
  };

  const takePhoto = async (side: 'front' | 'back') => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        
        const imageData: ImageData = {
          uri: asset.uri,
          type: asset.type || 'image/jpeg',
          name: `${side}-id.jpg`,
        };

        if (side === 'front') {
          setFrontImage(imageData);
        } else {
          setBackImage(imageData);
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to capture image');
    }
  };

  const uploadImage = async (imageData: ImageData, side: 'front' | 'back'): Promise<string> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const timestamp = Date.now();
    const fileName = `${user.id}/${timestamp}-${side}.jpg`;
    
    const formData = new FormData();
    formData.append('file', {
      uri: imageData.uri,
      type: imageData.type,
      name: imageData.name,
    } as any);

    const { data, error } = await supabase.storage
      .from('id-verifications')
      .upload(fileName, formData);

    if (error) throw error;

    const { data: publicUrl } = supabase.storage
      .from('id-verifications')
      .getPublicUrl(fileName);

    return publicUrl.publicUrl;
  };

  const handleSubmit = async () => {
    if (!frontImage || !backImage) {
      Alert.alert('Error', 'Please provide both front and back images of your ID');
      return;
    }

    setLoading(true);
    setStatus('uploading');

    try {
      const [frontUrl, backUrl] = await Promise.all([
        uploadImage(frontImage, 'front'),
        uploadImage(backImage, 'back'),
      ]);

      setStatus('verifying');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const response = await fetch('/api/id/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          frontImageUrl: frontUrl,
          backImageUrl: backUrl,
        }),
      });

      if (!response.ok) throw new Error('Verification request failed');

      setStatus('submitted');
      Alert.alert('Success', 'ID verification submitted successfully');
      navigation.navigate('Home' as never);
    } catch (error) {
      setStatus('failed');
      Alert.alert('Error', error instanceof Error ? error.message : 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-white px-6 pt-12">
      <Text className="text-2xl font-bold text-center mb-4">ID Verification</Text>
      <Text className="text-gray-600 text-center mb-8">Please upload clear photos of the front and back of your government-issued ID</Text>

      <View className="mb-6">
        <Text className="text-lg font-semibold mb-3">Front of ID</Text>
        {frontImage ? (
          <View>
            <Image source={{ uri: frontImage.uri }} className="w-full h-48 rounded-lg mb-2" />
            <TouchableOpacity onPress={() => pickImage('front')} className="bg-gray-200 py-2 rounded-lg mb-1">
              <Text className="text-center text-gray-700">Change Photo</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View className="flex-row gap-2">
            <TouchableOpacity onPress={() => pickImage('front')} className="flex-1 bg-blue-500 py-3 rounded-lg" testID="front-gallery-button">
              <Text className="text-white text-center font-medium">Choose from Gallery</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => takePhoto('front')} className="flex-1 bg-green-500 py-3 rounded-lg" testID="front-camera-button">
              <Text className="text-white text-center font-medium">Take Photo</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View className="mb-8">
        <Text className="text-lg font-semibold mb-3">Back of ID</Text>
        {backImage ? (
          <View>
            <Image source={{ uri: backImage.uri }} className="w-full h-48 rounded-lg mb-2" />
            <TouchableOpacity onPress={() => pickImage('back')} className="bg-gray-200 py-2 rounded-lg mb-1">
              <Text className="text-center text-gray-700">Change Photo</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View className="flex-row gap-2">
            <TouchableOpacity onPress={() => pickImage('back')} className="flex-1 bg-blue-500 py-3 rounded-lg" testID="back-gallery-button">
              <Text className="text-white text-center font-medium">Choose from Gallery</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => takePhoto('back')} className="flex-1 bg-green-500 py-3 rounded-lg" testID="back-camera-button">
              <Text className="text-white text-center font-medium">Take Photo</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <TouchableOpacity
        onPress={handleSubmit}
        disabled={loading || !frontImage || !backImage}
        className={`py-4 rounded-lg ${loading || !frontImage || !backImage ? 'bg-gray-300' : 'bg-blue-600'}`}
        testID="submit-button"
      >
        {loading ? (
          <View className="flex-row justify-center items-center">
            <ActivityIndicator color="white" size="small" />
            <Text className="text-white ml-2 font-semibold">
              {status === 'uploading' ? 'Uploading...' : status === 'verifying' ? 'Verifying...' : 'Processing...'}
            </Text>
          </View>
        ) : (
          <Text className="text-white text-center font-semibold text-base">Submit for Verification</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}
