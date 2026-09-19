-- Create table for storing encrypted refresh tokens
CREATE TABLE public.google_calendar_links (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    refresh_token TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: deny all. Service role will access it.
ALTER TABLE public.google_calendar_links ENABLE ROW LEVEL SECURITY;

-- Create table for storing created google calendar events for idempotency
CREATE TABLE public.google_calendar_events (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    google_event_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, event_id)
);

ALTER TABLE public.google_calendar_events ENABLE ROW LEVEL SECURITY;
