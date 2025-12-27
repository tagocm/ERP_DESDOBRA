-- Allow users to insert their own profile (record creation on first edit)
CREATE POLICY "Users can insert own profile" ON public.user_profiles
    FOR INSERT TO authenticated
    WITH CHECK (auth_user_id = auth.uid());
