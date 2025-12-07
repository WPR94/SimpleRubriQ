-- Fix missing foreign key relationship between essays and students
-- This is needed because dropping the students table (cascade) removed the constraint from essays

-- 1. Nullify any student_ids in essays that point to non-existent students
-- This prevents the FK creation from failing
UPDATE public.essays
SET student_id = NULL
WHERE student_id IS NOT NULL
AND student_id NOT IN (SELECT id FROM public.students);

-- 2. Re-add the foreign key constraint
DO $$
BEGIN
  -- Drop if exists to be safe
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'essays_student_id_fkey'
  ) THEN
    ALTER TABLE public.essays DROP CONSTRAINT essays_student_id_fkey;
  END IF;

  -- Add the constraint
  ALTER TABLE public.essays
  ADD CONSTRAINT essays_student_id_fkey
  FOREIGN KEY (student_id)
  REFERENCES public.students(id);
END $$;

-- 3. Ensure index exists for performance
CREATE INDEX IF NOT EXISTS idx_essays_student_id ON public.essays(student_id);
