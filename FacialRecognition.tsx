import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Camera, CameraView } from 'expo-camera';
import { supabase } from '@/lib/supabaseClient';

type VerificationResult = {
  match: boolean;
  score: number;
};

type VerificationStatus = 'idle' | 'capturing' | 'uploading' | 'verifying' | 'success' | 'failed';

export default function FacialRecognition() {
  const navigation = useNavigation();
  const route = useRoute();
  const cameraRef = useRef<CameraView>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [status, setStatus] = useState<VerificationStatus>('idle');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);

  React.useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  const takeSelfie = async () => {
    if (!cameraRef.current) return;

    setLoading(true);
    setStatus('capturing');

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
      });

      if (!photo) throw new Error('Failed to capture photo');

      setStatus('uploading');
      const selfieUrl = await uploadSelfie(photo.uri);

      setStatus('verifying');
      const verificationResult = await verifyFace(selfieUrl);

      setResult(verificationResult);

      if (verificationResult.match) {
        setStatus('success');
        Alert.alert('Success', 'Facial verification completed successfully!');
        navigation.navigate('Home' as never);
      } else {
        setStatus('failed');
        Alert.alert('Verification Failed', `Face match score: ${(verificationResult.score * 100).toFixed(1)}%. Please try again with better lighting.`);
      }
    } catch (error) {
      setStatus('failed');
      Alert.alert('Error', error instanceof Error ? error.message : 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const uploadSelfie = async (imageUri: string): Promise<string> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const timestamp = Date.now();
    const fileName = `${user.id}/selfie-${timestamp}.jpg`;

    const formData = new FormData();
    formData.append('file', {
      uri: imageUri,
      type: 'image/jpeg',
      name: 'selfie.jpg',
    } as any);

    const { data, error } = await supabase.storage
      .from('face-verifications')
      .upload(fileName, formData);

    if (error) throw error;

    const { data: publicUrl } = supabase.storage
      .from('face-verifications')
      .getPublicUrl(fileName);

    return publicUrl.publicUrl;
  };

  const verifyFace = async (selfieUrl: string): Promise<VerificationResult> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const idImageUrl = (route.params as any)?.idImageUrl || '';

    const response = await fetch('/api/face/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.id,
        selfieUrl,
        idImageUrl,
      }),
    });

    if (!response.ok) throw new Error('Face verification request failed');

    return await response.json();
  };

  const retry = () => {
    setStatus('idle');
    setResult(null);
    setLoading(false);
  };

  if (hasPermission === null) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" />
        <Text className="mt-4 text-gray-600">Requesting camera permission...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View className="flex-1 justify-center items-center bg-white px-6">
        <Text className="text-xl font-semibold mb-4 text-center">Camera Permission Required</Text>
        <Text className="text-gray-600 text-center mb-6">Please enable camera access to complete facial verification</Text>
        <TouchableOpacity onPress={() => Camera.requestCameraPermissionsAsync()} className="bg-blue-500 px-6 py-3 rounded-lg">
          <Text className="text-white font-semibold">Enable Camera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      <View className="flex-1">
        <CameraView
          ref={cameraRef}
          style={{ flex: 1 }}
          facing="front"
        />
        
        <View className="absolute top-16 left-0 right-0 px-6">
          <Text className="text-white text-xl font-bold text-center mb-2">Facial Verification</Text>
          <Text className="text-white text-center opacity-90">Position your face in the center and tap to capture</Text>
        </View>

        <View className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 p-6">
          {status === 'failed' && result && (
            <View className="mb-4 p-4 bg-red-100 rounded-lg">
              <Text className="text-red-800 text-center font-medium">
                Match Score: {(result.score * 100).toFixed(1)}%
              </Text>
              <Text className="text-red-600 text-center text-sm mt-1">
                Please ensure good lighting and face the camera directly
              </Text>
            </View>
          )}

          <View className="flex-row justify-center items-center">
            <TouchableOpacity
              onPress={status === 'failed' ? retry : takeSelfie}
              disabled={loading}
              className={`px-8 py-4 rounded-full ${loading ? 'bg-gray-500' : 'bg-blue-500'}`}
              testID="capture-button"
            >
              {loading ? (
                <View className="flex-row items-center">
                  <ActivityIndicator color="white" size="small" />
                  <Text className="text-white ml-2 font-semibold">
                    {status === 'capturing' ? 'Capturing...' : 
                     status === 'uploading' ? 'Uploading...' : 'Verifying...'}
                  </Text>
                </View>
              ) : (
                <Text className="text-white font-semibold text-lg">
                  {status === 'failed' ? 'Try Again' : 'Capture Selfie'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}
