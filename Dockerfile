# GITAM College Management System — backend image
# The app only uses the Python standard library, so a slim Python base is enough.
FROM python:3.12-slim

# Don't write .pyc files; flush stdout/stderr immediately (better logs)
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=5500 \
    GITAM_DB=/data/gitam.db

WORKDIR /app

# Copy the application code (see .dockerignore for what is excluded)
COPY . .

# /data holds the SQLite database; mount a volume here so it persists
RUN mkdir -p /data
VOLUME ["/data"]

EXPOSE 5500

# Basic healthcheck — hits the login page on whatever PORT is configured
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD python -c "import os,urllib.request,sys; p=os.environ.get('PORT','5500'); sys.exit(0 if urllib.request.urlopen(f'http://localhost:{p}/index.html').status==200 else 1)"

CMD ["python", "server.py"]
