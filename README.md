Blog "使用AWS CDK，在云上构建DataOPS 平台" 有两个代码仓库。

本仓库是 Data Infra Engineer 代码的参考实现，
Data Analysts 代码参考实现请参看 [这里](https://github.com/readybuilderone/elt-dbt-redshift-demo-for-data-analysts)

### 架构图及流程说明



![architecture](./assets/DataOPS.drawio.svg)



#### Data Infra Engineer

通过CDK 创建DataOPS 平台, 主要组件包括:

- Redshift 集群
- CodeCommit， CodeBuild，用于构建 Data Analysts 开发的DBT工程的持续集成流程
- ECR，用于存放管理Data Analysts 开发的DBT工程的Docker Image
- MWAA，用于供数据开发人员调度DBT任务的Airflow集群
- ECS Cluster, 用于运行DBT Task

#### Data Analysts

在Data Infra Engineer使用CDK创建好DataOPS平台之后，Data Analysts大致操作流程如下:

1. Data Analysts使用SQL基于DBT框架编写代码，推送到GitCommit；

   GitCommit 会自动触发CodeBuild，下载代码，进行编译，生成container 镜像，并推送到ECR仓库；

2. Data Analysts，编写Airflow的DAG，并上传到S3；

3. Data Analysts，在Airflow中管理触发DAG；

   Airflow 会自动在ECS Cluster中创建Task，运行DBT任务。

## 使用AWS CDK构建 Data OPS 方案

#### CDK 开发环境搭建

开发AWS CDK需要先安装AWS CDK CLI，利用 AWS CDK CLI可以生成对应的CDK 的Project。

AWS CDK CLI的安装依赖于Node.js, 所以在您的开发环境需要先安装node.js。node.js 的安装可参看官方教程: https://nodejs.org/en/download/package-manager/。

安装好 node.js 之后，可以直接使用 如下命令安装 AWS CDK CLI：

~~~shell
npm install -g aws-cdk  #安装cdk cli
cdk --version #查看版本
~~~

安装 CDK CLI后，需要通过aws configure 命令配置开发环境的用户权限，详情参考: https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-files.html 



#### 使用CDK 构建Data OPS 平台:

``` shell
npm install -g yarn
npm install -g npx

git clone https://github.com/readybuilderone/elt-dbt-redshift-demo-for-data-engineer.git
cd elt-dbt-redshift-demo-for-data-engineer
npx projen

npx cdk bootstrap --profile <YOUR-PROFILE>
npx cdk deploy  --profile <YOUR-PROFILE>
```

