"""Overture address points for Kentucky -> data/ky/addresses_ky.parquet

Places researched addresses
the map listings lack. Adapted from co-eats/pipeline/fetch_extras.py.
"""
import os, time
import duckdb

RELEASE = "2026-10-21.0"
OUT = os.path.join(os.path.dirname(__file__), "..", "data", "ky")
t = time.time()
con = duckdb.connect()
con.execute("INSTALL httpfs; LOAD httpfs; INSTALL spatial; LOAD spatial; SET s3_region='us-west-2';")
addr = f"s3://overturemaps-us-west-2/release/{RELEASE}/theme=addresses/type=address/*.parquet"
con.execute(f"""COPY (SELECT number, street, unit, postcode, postal_city, address_levels[1].value AS state, address_levels[-1].value AS muni,
  ST_Y(geometry) lat, ST_X(geometry) lon FROM read_parquet('{addr}', hive_partitioning=1)
  WHERE country = 'US' AND bbox.xmin BETWEEN -89.7 AND -81.8 AND bbox.ymin BETWEEN 36.4 AND 39.25)
  TO '{OUT}/addresses_ky.parquet' (FORMAT PARQUET)""")
print(con.execute(f"select count(*), count(*) filter (where state='KY') from '{OUT}/addresses_ky.parquet'").fetchall(), round(time.time() - t), "s")
