FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

ENV APP_HOST=0.0.0.0 \
    APP_PORT=8003 \
    ROOT_PATH=/media-service

EXPOSE 8003

CMD ["uvicorn", "app.app:app", "--host", "0.0.0.0", "--port", "8003"]
