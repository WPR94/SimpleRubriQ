import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { useEffect, useState } from 'react';

export interface UserPlan {
  plan: 'free' | 'teacher_pro' | 'teacher_pro_plus' | 'school';
  isLoading: boolean;
}

export const usePlan = (): UserPlan => {
  const { user } = useAuth();
  const [plan, setPlan] = useState<'free' | 'teacher_pro' | 'teacher_pro_plus' | 'school'>('free');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPlan = async () => {
      if (!user) {
        setPlan('free');
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('plan')
          .eq('id', user.id)
          .single();

        if (error) throw error;
        setPlan(data?.plan || 'free');
      } catch (error) {
        console.error('Error fetching plan:', error);
        setPlan('free');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPlan();
  }, [user]);

  return { plan, isLoading };
};

export const isPro = (plan: string) => {
  return plan === 'teacher_pro' || plan === 'teacher_pro_plus' || plan === 'school';
};
