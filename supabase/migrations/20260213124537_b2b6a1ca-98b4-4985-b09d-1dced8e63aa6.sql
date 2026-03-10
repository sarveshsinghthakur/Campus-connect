
CREATE TYPE public.app_role AS ENUM ('student', 'professor');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own role" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE TABLE public.availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professor_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view availability" ON public.availability FOR SELECT TO authenticated USING (true);
CREATE POLICY "Professors can insert own availability" ON public.availability FOR INSERT TO authenticated WITH CHECK (auth.uid() = professor_id AND public.has_role(auth.uid(), 'professor'));
CREATE POLICY "Professors can delete own availability" ON public.availability FOR DELETE TO authenticated USING (auth.uid() = professor_id AND public.has_role(auth.uid(), 'professor'));

CREATE TABLE public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  availability_id UUID REFERENCES public.availability(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL DEFAULT 'booked' CHECK (status IN ('booked', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view own appointments" ON public.appointments FOR SELECT TO authenticated USING (auth.uid() = student_id);
CREATE POLICY "Professors can view appointments for their slots" ON public.appointments FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.availability WHERE availability.id = appointments.availability_id AND availability.professor_id = auth.uid())
);
CREATE POLICY "Students can insert own appointments" ON public.appointments FOR INSERT TO authenticated WITH CHECK (auth.uid() = student_id AND public.has_role(auth.uid(), 'student'));
CREATE POLICY "Professors can update appointments for their slots" ON public.appointments FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.availability WHERE availability.id = appointments.availability_id AND availability.professor_id = auth.uid())
);
CREATE POLICY "Students can update own appointments" ON public.appointments FOR UPDATE TO authenticated USING (auth.uid() = student_id);
