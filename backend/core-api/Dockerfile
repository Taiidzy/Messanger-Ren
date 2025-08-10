FROM python:3.11-alpine AS builder

WORKDIR /backend/core-api

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["uvicorn", "app:app", "--port", "8000", "--host", "0.0.0.0"]