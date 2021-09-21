# elt-dbt-redshift
implement data transform using DBT for Amazon Redshift

## 准备数据
``` shell
aws s3 sync ./sample_db/tickit s3://<myBucket>/tickit
```

## C9
``` shell
sudo yum install postgresql
```

Install DBT

``` shell
pip install dbt
dbt --version
```