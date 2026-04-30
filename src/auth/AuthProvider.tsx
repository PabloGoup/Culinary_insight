import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { AuthError, User as SupabaseUser } from '@supabase/supabase-js';
import { AuthContext } from './AuthContext';
import type { AuthContextValue, LoginOptions } from './AuthContext';
import type { Role, UserProfile } from '../types';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';
import { createProductionAppState } from '../data/initialState';

const elevatedRoles: Role[] = [
  'Administrador general',
  'Gerente',
  'Chef ejecutivo',
  'Sous chef',
  'Jefe de compras',
  'Finanzas',
];

async function fetchProfile(userId: string) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('users')
    .select('id, business_id, name, email, role')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    id: data.id,
    businessId: data.business_id,
    name: data.name,
    email: data.email,
    role: data.role as Role,
  } satisfies UserProfile;
}

async function ensureProfile(authUser: SupabaseUser, role: Role, options?: LoginOptions) {
  if (!supabase) return null;

  const existing = await fetchProfile(authUser.id);
  if (existing) return existing;

  const businessName = options?.businessName?.trim() || 'Nuevo negocio gastronomico';
  const displayName = options?.name?.trim() || authUser.email?.split('@')[0] || 'Usuario';
  const businessId = crypto.randomUUID();

  const { error: businessError } = await supabase.from('businesses').insert({
    id: businessId,
    name: businessName,
    business_type: 'Restaurante',
    currency: 'CLP',
    tax_rate: 0.19,
    target_food_cost: 0.3,
    target_margin: 0.7,
    fixed_costs_monthly: 0,
    opening_hours: '',
    worker_count: 0,
    internal_categories: [],
  });

  if (businessError) throw businessError;

  const { error: userError } = await supabase.from('users').insert({
    id: authUser.id,
    business_id: businessId,
    name: displayName,
    email: authUser.email ?? '',
    role,
  });

  if (userError) throw userError;

  const profile = {
    id: authUser.id,
    businessId,
    name: displayName,
    email: authUser.email ?? '',
    role,
  } satisfies UserProfile;

  const initialState = createProductionAppState({
    businessId,
    businessName,
    user: profile,
  });

  const { error: snapshotError } = await supabase.from('app_snapshots').upsert({
    business_id: businessId,
    state: initialState,
  });

  if (snapshotError) throw snapshotError;

  return profile;
}

function getErrorMessage(error: AuthError | Error | null) {
  if (!error) return null;
  return error.message || 'No fue posible autenticar con Supabase.';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(isSupabaseConfigured);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setAuthError('Supabase no esta configurado. La aplicacion ahora funciona solo en produccion.');
      setAuthLoading(false);
      return undefined;
    }

    const client = supabase;
    let mounted = true;

    const hydrate = async () => {
      setAuthLoading(true);
      try {
        const {
          data: { session },
        } = await client.auth.getSession();

        if (!mounted) return;
        if (!session?.user) {
          setUser(null);
          return;
        }

        const profile = await fetchProfile(session.user.id);
        if (!mounted) return;
        setUser(profile);
      } catch (error) {
        if (!mounted) return;
        setAuthError(getErrorMessage(error as Error));
        setUser(null);
      } finally {
        if (mounted) setAuthLoading(false);
      }
    };

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setUser(null);
        setAuthLoading(false);
        return;
      }

      setAuthLoading(true);
      fetchProfile(session.user.id)
        .then((profile) => {
          if (mounted) setUser(profile);
        })
        .catch((error) => {
          if (mounted) setAuthError(getErrorMessage(error as Error));
        })
        .finally(() => {
          if (mounted) setAuthLoading(false);
        });
    });

    void hydrate();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      login: async (email, role, options) => {
        if (!supabase) {
          setAuthError('Supabase no esta configurado.');
          return;
        }

        const password = options?.password?.trim();
        if (!password) {
          setAuthError('Debes ingresar una contrasena para usar Supabase.');
          return;
        }

        setAuthLoading(true);
        setAuthError(null);

        try {
          if (options?.mode === 'signup') {
            const { data, error } = await supabase.auth.signUp({
              email,
              password,
              options: {
                data: {
                  name: options?.name ?? email.split('@')[0],
                  business_name: options?.businessName ?? 'Nuevo negocio gastronomico',
                  role,
                },
              },
            });

            if (error) throw error;
            if (!data.user) throw new Error('Supabase no devolvio el usuario creado.');
            if (!data.session) {
              throw new Error('La cuenta fue creada. Debes confirmar el correo o desactivar email confirmation para continuar.');
            }

            const profile = await ensureProfile(data.user, role, options);
            setUser(profile);
            return;
          }

          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          if (error) throw error;
          if (!data.user) throw new Error('No fue posible obtener el usuario autenticado.');

          const profile = await ensureProfile(data.user, role, options);
          setUser(profile);
        } catch (error) {
          setAuthError(getErrorMessage(error as Error));
        } finally {
          setAuthLoading(false);
        }
      },
      logout: () => {
        setAuthError(null);
        if (!supabase) {
          setUser(null);
          return;
        }
        void supabase.auth.signOut();
      },
      canManage: Boolean(user?.role && elevatedRoles.includes(user.role)),
      hasFinancialAccess: user?.role === 'Administrador general' || user?.role === 'Gerente' || user?.role === 'Finanzas',
      usingSupabase: Boolean(supabase),
      authLoading,
      authError,
    }),
    [user, authLoading, authError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
