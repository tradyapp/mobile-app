import { useEffect, useState, useCallback } from "react";
import AppLayout from "@/components/AppLayout";
import LoadingScreen from "@/modules/LoadingScreen";
import LoginScreen from "@/modules/LoginScreen";
import CompleteProfileScreen from "@/modules/CompleteProfileScreen";
import { useAuthStore } from "@/stores/authStore";
import { userService } from "@/services/UserService";
import dataService from "@/services/DataService";
import type { UserType, UserFieldMetadata } from "@/types/UserType";

export default function Home() {
  const user = useAuthStore((state) => state.user);
  const isSessionLoaded = useAuthStore((state) => state.isSessionLoaded);
  const initializeAuth = useAuthStore((state) => state.initializeAuth);

  const [profileCheckLoading, setProfileCheckLoading] = useState(false);
  const [profileComplete, setProfileComplete] = useState(false);
  const [isUserProfileLoaded, setIsUserProfileLoaded] = useState(false);
  const [existingProfile, setExistingProfile] = useState<Partial<UserType> | null>(null);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [schema, setSchema] = useState<UserFieldMetadata[]>([]);

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  const checkUserProfile = useCallback(async () => {
    if (!user) return;

    setProfileCheckLoading(true);
    try {
      const result = await userService.getUserProfile(user.uid);
      setExistingProfile(result.userData);
      setMissingFields(result.missingFields);
      setSchema(result.schema);
      setProfileComplete(result.isComplete);
    } catch (error) {
      console.error("Error checking profile:", error);
      setProfileComplete(false);
    } finally {
      setProfileCheckLoading(false);
      setIsUserProfileLoaded(true);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      checkUserProfile();
    }
  }, [user, checkUserProfile]);

  useEffect(() => {
    if (user && profileComplete) {
      dataService.loadSymbols().catch((error) => {
        console.error("Error loading symbols:", error);
      });
    }
  }, [user, profileComplete]);

  if (!isSessionLoaded) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <LoginScreen />;
  }

  if (profileCheckLoading) {
    return <LoadingScreen />;
  }

  if (isUserProfileLoaded && !profileComplete) {
    return (
      <CompleteProfileScreen
        uid={user.uid}
        email={user.email || ""}
        existingProfile={existingProfile}
        missingFields={missingFields}
        schema={schema}
        onProfileCompleted={() => {
          setProfileComplete(true);
          checkUserProfile();
        }}
      />
    );
  }

  return <AppLayout />;
}
