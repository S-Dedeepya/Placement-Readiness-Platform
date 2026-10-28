import os

from dotenv import load_dotenv
from supabase import Client, create_client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")


def get_supabase_client(access_token: str) -> Client:
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise RuntimeError(
            "SUPABASE_URL and SUPABASE_KEY must be configured in .env"
        )

    client = create_client(SUPABASE_URL, SUPABASE_KEY)

    # Attach the logged-in user's token so database queries
    # are executed in the user's authenticated context.
    client.postgrest.auth(access_token)

    return client