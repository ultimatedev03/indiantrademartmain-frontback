-- SuperAdmin Monitoring: states_scope for employees
-- Tracks which states each ADMIN is responsible for
-- Safe to rerun: IF NOT EXISTS guards

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS states_scope jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.employees.states_scope IS
  'JSON array of state names this employee is responsible for. Used by ADMIN role to scope their region. Example: ["Maharashtra","Gujarat","Rajasthan"]';

CREATE INDEX IF NOT EXISTS idx_employees_states_scope
  ON public.employees USING gin (states_scope);
