
from fastapi import Header, HTTPException
from supabase import create_client

from database import SUPABASE_URL, SUPABASE_KEY


def get_authenticated_user(
    authorization: str | None = Header(default=None),
):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Missing or invalid authorization token",
        )

    access_token = authorization.removeprefix("Bearer ").strip()

    if not access_token or not SUPABASE_URL or not SUPABASE_KEY:
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication configuration or token",
        )

    try:
        auth_client = create_client(SUPABASE_URL, SUPABASE_KEY)
        response = auth_client.auth.get_user(access_token)

        if not response.user:
            raise HTTPException(
                status_code=401,
                detail="Invalid or expired access token",
            )

        return {
            "user_id": response.user.id,
            "access_token": access_token,
        }

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=401,
            detail="Authentication failed",
        )


# Backward-compatible name used by main.py
get_current_user = get_authenticated_user
