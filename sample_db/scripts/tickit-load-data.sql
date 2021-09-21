copy users from 's3://<myBucket>/tickit/allusers_pipe.txt' 
credentials 'aws_iam_role=<iam-role-arn>' 
delimiter '|' region '<aws-region>';

copy venue from 's3://<myBucket>/tickit/venue_pipe.txt' 
credentials 'aws_iam_role=<iam-role-arn>' 
delimiter '|' region '<aws-region>';

copy category from 's3://<myBucket>/tickit/category_pipe.txt' 
credentials 'aws_iam_role=<iam-role-arn>' 
delimiter '|' region '<aws-region>';

copy date from 's3://<myBucket>/tickit/date2008_pipe.txt' 
credentials 'aws_iam_role=<iam-role-arn>' 
delimiter '|' region '<aws-region>';

copy event from 's3://<myBucket>/tickit/allevents_pipe.txt' 
credentials 'aws_iam_role=<iam-role-arn>' 
delimiter '|' timeformat 'YYYY-MM-DD HH:MI:SS' region '<aws-region>';

copy listing from 's3://<myBucket>/tickit/listings_pipe.txt' 
credentials 'aws_iam_role=<iam-role-arn>' 
delimiter '|' region '<aws-region>';

copy sales from 's3://<myBucket>/tickit/sales_tab.txt'
credentials 'aws_iam_role=<iam-role-arn>'
delimiter '\t' timeformat 'MM/DD/YYYY HH:MI:SS' region '<aws-region>';