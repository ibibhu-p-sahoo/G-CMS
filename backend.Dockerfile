# Backend container — Python REST API (talks to the PostgreSQL container)
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=5000 \
    DB_BACKEND=postgres

WORKDIR /app

# psycopg2-binary = PostgreSQL driver (binary wheel, no system build needed)
RUN pip install --no-cache-dir psycopg2-binary

COPY server.py .

EXPOSE 5000
CMD ["python", "server.py"]
