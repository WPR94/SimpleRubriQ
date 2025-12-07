-- Create a consolidated dashboard function to improve performance and reduce network requests
-- Run this in the Supabase SQL Editor

CREATE OR REPLACE FUNCTION get_teacher_dashboard(p_teacher_id uuid)
RETURNS TABLE (
  essays_count bigint,
  rubrics_count bigint,
  feedback_count bigint,
  recent jsonb
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_essays_count bigint;
  v_rubrics_count bigint;
  v_feedback_count bigint;
  v_recent jsonb;
BEGIN
  -- Count essays
  SELECT count(*) INTO v_essays_count
  FROM essays
  WHERE teacher_id = p_teacher_id;

  -- Count rubrics
  SELECT count(*) INTO v_rubrics_count
  FROM rubrics
  WHERE teacher_id = p_teacher_id;

  -- Count feedback (joined with essays to check teacher ownership)
  SELECT count(f.id) INTO v_feedback_count
  FROM feedback f
  JOIN essays e ON f.essay_id = e.id
  WHERE e.teacher_id = p_teacher_id;

  -- Get recent feedback
  SELECT jsonb_agg(t) INTO v_recent
  FROM (
    SELECT f.id, f.created_at, e.title as essay_title
    FROM feedback f
    JOIN essays e ON f.essay_id = e.id
    WHERE e.teacher_id = p_teacher_id
    ORDER BY f.created_at DESC
    LIMIT 5
  ) t;

  RETURN QUERY
  SELECT 
    v_essays_count, 
    v_rubrics_count, 
    v_feedback_count, 
    COALESCE(v_recent, '[]'::jsonb);
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_teacher_dashboard(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_teacher_dashboard(uuid) TO service_role;
