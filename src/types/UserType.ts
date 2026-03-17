/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * UserType definition - Now read from Firestore instead of hardcoded
 * This allows updating required fields without app updates
 */

export interface UserType {
  uid: string;
  email: string;
  [key: string]: any; // Dynamic fields based on Firestore schema
}

/**
 * Field metadata from API
 * Matches the response from https://api.tradyapp.com/user/data-types
 */
export interface UserFieldMetadata {
  name: string;
  type: 'string' | 'String' | 'number' | 'Date' | 'country' | 'Country' | 'Boolean' | 'bool' | 'email' | 'tel';
  required: boolean;
  label?: string;
  description?: string;
  placeholder?: string;
  options?: string[]; // For select/dropdown fields
}

/**
 * API response structure for user data types
 */
export interface UserSchemaResponse {
  status: 'success' | 'error';
  updateDate: string;
  fields: UserFieldMetadata[];
}

/**
 * User schema document structure in Firestore (legacy - now using API)
 * Stored at: /config/userSchema
 */
export interface UserSchemaDocument {
  version: string; // Schema version for tracking changes
  fields: UserFieldMetadata[];
  updatedAt: Date;
}

/**
 * User profile response from API
 * Single call that returns everything
 */
export interface UserProfileResponse {
  userData: Partial<UserType>;
  missingFields: string[];
  isComplete: boolean;
  schema: UserFieldMetadata[];
}
