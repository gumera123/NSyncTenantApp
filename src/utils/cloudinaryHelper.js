import { CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET } from '../config/cloudinary';

export const uploadImageToCloudinary = async (uri) => {
  if (!uri) return null;

  try {
    const formData = new FormData();

    formData.append('file', {
      uri: uri,
      type: 'image/jpeg',
      name: 'upload.jpg',
    });

    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
      {
        method: 'POST',
        body: formData,
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || 'Cloudinary upload failed');
    }

    return data.secure_url;
  } catch (error) {
    console.log('Cloudinary upload error:', error);
    throw error;
  }
};