# Runs the Python worker, which serves BOTH the studio app (/app) and the worker page (/).
FROM python:3.11-slim
WORKDIR /app
COPY . /app
EXPOSE 8080
CMD ["python", "worker/server.py"]
