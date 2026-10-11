# Lab 1.1, part B: containerise app/etl.py.
# Build context is the lab folder (labs/mod-1-1). This starter works, but it breaks several good practices.
FROM python:latest
COPY . /app
RUN pip install -r /app/app/requirements.txt
CMD python /app/app/etl.py /data/orders.csv
