import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export function useProfile() {
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        async function fetchProfile() {
            try {
                const { data: { user } } = await supabase.auth.getUser();

                if (!user) {
                    setLoading(false);
                    return;
                }

                const { data, error } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', user.id)
                    .single();

                if (error) {
                    // If profile doesn't exist, it's not a critical error for the app, just means no restricted branch
                    if (error.code === 'PGRST116') {
                        setProfile(null);
                    } else {
                        throw error;
                    }
                } else {
                    setProfile(data);
                }
            } catch (err) {
                console.error('Error fetching profile:', err);
                setError(err);
            } finally {
                setLoading(false);
            }
        }

        fetchProfile();
    }, []);

    return { profile, loading, error };
}
