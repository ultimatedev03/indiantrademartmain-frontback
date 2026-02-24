-- Chat block/unblock support for buyer-vendor messaging
-- Safe to re-run

CREATE TABLE IF NOT EXISTS public.chat_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  blocked_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (blocker_user_id <> blocked_user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_chat_blocks_pair
  ON public.chat_blocks (blocker_user_id, blocked_user_id);

CREATE INDEX IF NOT EXISTS idx_chat_blocks_blocker
  ON public.chat_blocks (blocker_user_id);

CREATE INDEX IF NOT EXISTS idx_chat_blocks_blocked
  ON public.chat_blocks (blocked_user_id);
