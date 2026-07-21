/**
 * Centralised Cloudinary transformation constants.
 *
 * All transformation strings are built here so they can be reused across
 * the service and tested in isolation without hitting the Cloudinary API.
 */

export const CLOUDINARY_PROFILE_FOLDER = 'hubassist/profile-pictures';

/**
 * Variant definitions for profile pictures.
 *
 * Each entry describes:
 *  - key    : the property name stored in the JSONB column
 *  - width  : target width in pixels
 *  - height : target height in pixels
 *  - crop   : Cloudinary crop mode
 *  - gravity: Cloudinary gravity (face-detection for portrait crops)
 */
export const PROFILE_PICTURE_VARIANTS = {
  thumbnail: { key: 'thumbnail', width: 50, height: 50, crop: 'fill', gravity: 'face' },
  avatar: { key: 'avatar', width: 200, height: 200, crop: 'fill', gravity: 'face' },
  full: { key: 'full', width: 800, height: 800, crop: 'limit', gravity: 'auto' },
} as const;

export type ProfilePictureVariantKey = keyof typeof PROFILE_PICTURE_VARIANTS;

/**
 * Build a Cloudinary delivery URL with transformation parameters applied.
 *
 * We derive variant URLs from the original public_id rather than uploading
 * multiple times, keeping storage costs low and ensuring consistency.
 *
 * @param cloudName  - Cloudinary cloud name (from env)
 * @param publicId   - The public_id returned by the initial upload
 * @param variant    - One of the PROFILE_PICTURE_VARIANTS entries
 */
export function buildVariantUrl(
  cloudName: string,
  publicId: string,
  variant: (typeof PROFILE_PICTURE_VARIANTS)[ProfilePictureVariantKey],
): string {
  const { width, height, crop, gravity } = variant;
  // Transformation string: w_<n>,h_<n>,c_<mode>,g_<gravity>,q_auto,f_auto
  const transformation = `w_${width},h_${height},c_${crop},g_${gravity},q_auto,f_auto`;
  return `https://res.cloudinary.com/${cloudName}/image/upload/${transformation}/${publicId}`;
}
