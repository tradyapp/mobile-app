import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

class AuthService {
  async loginWithEmail(email: string, password: string): Promise<User> {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      throw new Error(error?.message ?? "Error al iniciar sesion");
    }
    return data.user;
  }

  async loginWithGoogle(): Promise<User> {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });

    if (error) {
      throw new Error(error.message);
    }

    if (data?.url) {
      window.location.href = data.url;
      throw new Error("Redirigiendo a Google...");
    }

    throw new Error("No se pudo iniciar Google OAuth");
  }

  async signup(email: string, password: string): Promise<User> {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error || !data.user) {
      throw new Error(error?.message ?? "Error al registrarse");
    }
    return data.user;
  }

  async requestPasswordReset(email: string): Promise<void> {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}?auth_flow=recovery`,
    });
    if (error) {
      throw new Error(error.message ?? "No se pudo enviar el correo de recuperación");
    }
  }

  async updatePassword(password: string): Promise<User> {
    const { data, error } = await supabase.auth.updateUser({ password });
    if (error || !data.user) {
      throw new Error(error?.message ?? "No se pudo actualizar la contraseña");
    }
    return data.user;
  }

  async logout(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(error.message);
  }

  getCurrentUser(): User | null {
    return null;
  }
}

export const authService = new AuthService();
