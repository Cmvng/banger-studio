# Single-file worker. Serves the studio app at /app and the worker page at /.
FROM python:3.11-slim
WORKDIR /app
COPY . /app
EXPOSE 8080
CMD ["python", "app.py"]
