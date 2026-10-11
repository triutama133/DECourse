# Reference solution for Lab 1.1 part B.
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Copy only the dependency list first, so this layer is cached until requirements change.
COPY app/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ .

# Do not run as root inside the container.
RUN useradd --create-home appuser
USER appuser

ENTRYPOINT ["python", "etl.py"]
CMD ["/data/orders.csv"]
