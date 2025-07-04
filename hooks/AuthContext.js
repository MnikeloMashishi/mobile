import { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/app/supabaseClient";

export const AuthContext = createContext();

export const AuthContextProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);

  // 🔒 Load session and profile from AsyncStorage on mount
  useEffect(() => {
    const loadStoredData = async () => {
      const storedSession = await AsyncStorage.getItem('session');
      const storedProfile = await AsyncStorage.getItem('profile');

      if (storedSession) setSession(JSON.parse(storedSession));
      if (storedProfile) setProfile(JSON.parse(storedProfile));
    };

    loadStoredData();

    // 🔄 Realtime auth updates
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (newSession) {
        setSession(newSession);
        AsyncStorage.setItem('session', JSON.stringify(newSession));
      } else {
        setSession(null);
        setProfile(null);
        AsyncStorage.removeItem('session');
        AsyncStorage.removeItem('profile');
      }
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  // 🔑 Login and fetch profile
  const signInUser = async (email, password) => {
    try {
      const { data: signInData, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.log("❌ Sign-in error:", error.message);
        return { success: false, message: error.message };
      }

      const { data: profileData, error: profileError } = await supabase
        .from('attendees')
        .select('*')
        .eq('id', signInData.user.id)
        .maybeSingle();

      if (profileError) {
        console.log("⚠️ Profile fetch error:", profileError.message);
        return { success: false, message: "Could not load profile." };
      }

      setSession(signInData.session);
      setProfile(profileData);

      await AsyncStorage.setItem('session', JSON.stringify(signInData.session));
      await AsyncStorage.setItem('profile', JSON.stringify(profileData));

      return { success: true, profile: profileData };
    } catch (error) {
      console.log("🛑 Unexpected login error:", error);
      return { success: false, message: "An unexpected error occurred." };
    }
  };

  // 🔐 Sign up
  const signUpNewUser = async (email, password) => {
    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) {
      console.log("❌ Sign-up error:", error.message);
      return { success: false, message: error.message };
    }

    return { success: true, data };
  };

  // 🚪 Logout
  const signOut = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.log("❌ Logout error:", error.message);
    } else {
      setSession(null);
      setProfile(null);
      await AsyncStorage.removeItem('session');
      await AsyncStorage.removeItem('profile');
    }
  };

  return (
    <AuthContext.Provider value={{ session, profile, signInUser, signOut, signUpNewUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const UserAuth = () => useContext(AuthContext);
