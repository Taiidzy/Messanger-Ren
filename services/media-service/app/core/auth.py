import os
import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from .config import settings

security = HTTPBearer(auto_error=True)

async def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> int:
    token = credentials.credentials
    url = settings.AUTH_HOST.rstrip('/') + '/auth-service/auth/verify'
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(url, headers={
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        })
    if resp.status_code == 401:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")
    if resp.status_code != 200:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Auth service error")
    data = resp.json()
    user_id = data.get('user_id') or data.get('UserID')
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")
    return int(user_id)
